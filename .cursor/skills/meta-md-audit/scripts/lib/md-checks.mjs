/*
 * FEATURES: S-verify
 * PURPOSE: スキル監査の検出・解析関数群。frontmatter/本文の解析と規約違反の検出を読み取り専用で行う (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ---- 定数 ----
// 日本語抽出のホワイトリスト: スキルのソース md を置くディレクトリ。将来増えたらここに追加する。
// スキル直下の .md（SKILL.md 等）と登録ディレクトリ配下の .md（再帰）が検索対象。
export const MD_SOURCE_DIRS = new Set(['references']);
// 走査から除外する非ソースディレクトリ（依存物・生成物。警告も出さない）
export const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);
// 日本語判定（ひらがな・カタカナ・漢字・全角記号・全角英数）
export const JAPANESE_RE = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FFF]/;
// 1 行の文字数上限（コードブロック・テーブル・HTML コメントは除外対象）
export const MAX_LINE_LENGTH = 240;

// ---- frontmatter / 本文の解析 ----

// frontmatter を簡易パース（key: value のみ。block scalar は検出のみ）
export function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) {
    return null;
  }
  const fields = {};
  const seen = new Set();
  const duplicates = [];
  let currentKey = null;
  let currentValue = '';
  let currentQuoted = false;
  let blockScalar = false;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) {
      if (currentKey) {
        fields[currentKey] = { value: currentValue, blockScalar, quoted: currentQuoted };
      }
      currentKey = kv[1];
      currentValue = kv[2];
      blockScalar = /^[|>][+-]?$/.test(kv[2].trim());
      currentQuoted = false;
      const q = kv[2].trim();
      if ((q.startsWith('"') && q.endsWith('"')) || (q.startsWith("'") && q.endsWith("'"))) {
        currentQuoted = true;
        currentValue = q.slice(1, -1);
      }
      if (seen.has(currentKey)) {
        duplicates.push(currentKey);
      }
      seen.add(currentKey);
    } else if (currentKey) {
      if (blockScalar) {
        currentValue += '\n' + line;
      } else if (line.trim()) {
        currentValue += '\n' + line.trim();
      }
    }
  }
  if (currentKey) {
    fields[currentKey] = { value: currentValue, blockScalar, quoted: currentQuoted };
  }
  return { fields, duplicates };
}

// frontmatter 以降の本文を返す
export function bodyOf(text) {
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
  return m ? m[1] : text;
}

// ---- 構造要素の判定 ----

// 表の行かどうか（長さチェックの除外対象）
export function isTableLine(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith('|')) {
    return true;
  } // 先頭パイプ
  if (/^[^\s|][^|]*\|[^|]*\|/.test(trimmed)) {
    return true;
  } // 表（先頭パイプなし）
  if (/^\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(trimmed)) {
    return true;
  } // 表の区切り行
  return false;
}

// 構造要素（段落とみなさない行）の判定
// インデントコード判定のため、trim 前の生の行を受け取る
export function isStructural(line) {
  const trimmed = line.trim();
  if (/^(#{1,6}\s|>\s?)/.test(trimmed)) {
    return true;
  } // 見出し / 引用
  if (isTableLine(line)) {
    return true;
  } // 表
  if (/^[-*+]\s+/.test(trimmed)) {
    return true;
  } // 箇条書き
  if (/^\d+\.\s/.test(trimmed)) {
    return true;
  } // 番号付きリスト
  if (/^:\s/.test(trimmed)) {
    return true;
  } // 定義リスト
  if (/^\s{4}/.test(line)) {
    return true;
  } // インデントコード
  if (/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
    return true;
  } // 水平線
  return false;
}

// ---- 本文の検出 ----

// 段落内の改行を検出（構造要素・コード・HTML コメントは除外）
export function findMidParagraphBreaks(body) {
  const lines = body.split(/\r?\n/);
  const violations = [];
  let inCode = false;
  let inComment = false;
  let prevText = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // コードフェンスのトグル
    if (!inComment && trimmed.startsWith('```')) {
      inCode = !inCode;
      prevText = false;
      continue;
    }
    if (inCode) {
      continue;
    }

    // HTML コメントの開始 / 終了
    if (inComment) {
      if (trimmed.includes('-->')) {
        inComment = false;
      }
      continue;
    }
    if (trimmed.startsWith('<!--')) {
      if (!trimmed.includes('-->')) {
        inComment = true;
      }
      continue;
    }

    if (!trimmed) {
      prevText = false;
      continue;
    }

    if (isStructural(lines[i])) {
      prevText = false;
      continue;
    }

    if (prevText) {
      violations.push(i + 1);
    }
    prevText = true;
  }
  return violations;
}

// 1 行の文字数上限を超える行を検出（コードブロック・テーブル・HTML コメントは除外）
// 200 文字超は「構造化が必要」というフラグ。1 行に複数概念が詰まっているため、
// 段落 → 導入文＋箇条書きなどに分解する（文中の改行は body-no-mid-paragraph-breaks で禁止）
// リスト・見出し・インラインコードを含む行は対象。frontmatter（description）は bodyOf で除去済み
export function findLongLines(body, maxLength, label) {
  const found = [];
  const lines = body.split(/\r?\n/);
  let inCode = false;
  let inComment = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // コードフェンスのトグル
    if (!inComment && trimmed.startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      continue;
    }

    // HTML コメントの開始 / 終了
    if (inComment) {
      if (trimmed.includes('-->')) {
        inComment = false;
      }
      continue;
    }
    if (trimmed.startsWith('<!--')) {
      if (!trimmed.includes('-->')) {
        inComment = true;
      }
      continue;
    }

    if (isTableLine(lines[i])) {
      continue;
    }

    if (lines[i].length > maxLength) {
      found.push(`${label} ${i + 1}行目: ${lines[i].trim().slice(0, 40)}...`);
    }
  }
  return found;
}

// 存在しないローカルファイルへのリンクを検出
export function findDeadLinks(body, skillDir) {
  const dead = [];
  const re = /!?\[[^\]]*\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(body))) {
    const target = m[1].trim();
    if (/^(https?:|mailto:|#)/.test(target)) {
      continue;
    }
    const p = resolve(skillDir, target.split('#')[0]);
    if (!existsSync(p)) {
      dead.push(target);
    }
  }
  return dead;
}

// ツール固有パス（.cursor/ .opencode/）を検出
// 方針: SKILL.md と references/*.md は両エディタで共有されるため、パスプレフィックスは書かない。
// エージェントはスキルのベースディレクトリを解決できる（例: scripts/dev.mjs）。
export function findToolSpecificPaths(text, label) {
  const found = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/\.(cursor|opencode)\//.test(lines[i])) {
      found.push(`${label} ${i + 1}行目: ${lines[i].trim()}`);
    }
  }
  return found;
}

// セキュリティ系のパターン（ヒューリスティック）
export const SECURITY_PATTERNS = [
  {
    id: 'sec-destructive',
    label: '破壊的コマンド',
    re: /rm\s+-rf|git\s+push\s+(?:-f|--force)|curl[^\n]*\|\s*(?:sh|bash)|DROP\s+TABLE|chmod\s+777/i,
  },
  {
    id: 'sec-sensitive',
    label: '機密パス',
    re: /~\/\.ssh|\.aws\/credentials|\.env\b|id_rsa|credentials/i,
  },
  {
    id: 'sec-injection',
    label: 'プロンプトインジェクション',
    re: /ignore\s+(?:all\s+)?previous\s+instructions|disregard\s+(?:your\s+)?(?:system\s+)?prompt|jailbreak/i,
  },
];

// ---- 否定表現の抽出（機械抽出のみ。削除/肯定形への言い換えの判定は Step 2 の手動チェック） ----

// 否定表現（〜しない。型の指示）の検出パターン（英語のみ）
// 方針: 「〜しない」という否定指示は削除するか肯定形に言い換える。
// スクリプトは抽出のみ行い、削除/言い換えの判断はエージェントに委ねる。
export const NEGATIVE_PATTERNS = [
  /\bdo not\b/i,
  /\bdoes not\b/i,
  /\bdon't\b/i,
  /\bnever\b/i,
  /\bmust not\b/i,
  /\bmustn't\b/i,
  /\bshould not\b/i,
  /\bshouldn't\b/i,
  /\bforbidden\b/i,
  /\bprohibited\b/i,
  /\bavoid\b/i,
];

// 否定表現を含む行を抽出する（コードブロック・HTML コメントは除外）
export function findNegatives(text, label) {
  const found = [];
  const lines = text.split(/\r?\n/);
  let inCode = false;
  let inComment = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // コードフェンスのトグル
    if (!inComment && trimmed.startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      continue;
    }

    // HTML コメントの開始 / 終了
    if (inComment) {
      if (trimmed.includes('-->')) {
        inComment = false;
      }
      continue;
    }
    if (trimmed.startsWith('<!--')) {
      if (!trimmed.includes('-->')) {
        inComment = true;
      }
      continue;
    }

    if (NEGATIVE_PATTERNS.some((re) => re.test(lines[i]))) {
      found.push(`${label} ${i + 1}行目: ${lines[i].trim()}`);
    }
  }
  return found;
}

// ---- 日本語抽出・ソース md 列挙（機械抽出のみ。明記の有無の判定は Step 2 の手動チェック） ----

// スキル内の .md をホワイトリスト方式で列挙する
// 戻り値: { sources: { rel, path }[], unregistered: string[] }
// unregistered: md を抱える未登録ディレクトリの先頭セグメント名（重複なし）
export function listSourceMd(skillDir) {
  const sources = [];
  const unregistered = new Set();
  const walk = (dir, rel) => {
    for (const e of readdirSync(dir, { withFileTypes: true }).toSorted((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) {
          continue;
        }
        walk(join(dir, e.name), rel ? `${rel}/${e.name}` : e.name);
      } else if (e.name.endsWith('.md')) {
        const head = rel ? rel.split('/')[0] : '';
        if (rel === '' || MD_SOURCE_DIRS.has(head)) {
          sources.push({ rel: rel ? `${rel}/${e.name}` : e.name, path: join(dir, e.name) });
        } else {
          unregistered.add(head);
        }
      }
    }
  };
  walk(skillDir, '');
  return { sources, unregistered: [...unregistered].toSorted((a, b) => a.localeCompare(b)) };
}

// 日本語を含む行を抽出する
export function findJapanese(text, label) {
  const found = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (JAPANESE_RE.test(lines[i])) {
      found.push(`${label} ${i + 1}行目: ${lines[i].trim()}`);
    }
  }
  return found;
}
