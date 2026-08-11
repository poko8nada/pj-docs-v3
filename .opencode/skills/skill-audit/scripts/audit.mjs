#!/usr/bin/env node
/**
 * .opencode/skills 配下のスキルを監査するスクリプト
 *
 * 使い方:
 *   node audit.mjs                  # .opencode/skills/ を監査（デフォルト）
 *   node audit.mjs --dir <path>     # 別ディレクトリを監査
 *   node audit.mjs --json           # JSON 出力
 *
 * チェック: spec / description / body / security。
 * error レベルの失敗が 1 つでもあれば exit 1。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_TARGET = resolve(SCRIPT_DIR, '..', '..');

const args = process.argv.slice(2);
const dirIdx = args.indexOf('--dir');
const targetDir = resolve(dirIdx !== -1 ? args[dirIdx + 1] : DEFAULT_TARGET);
const json = args.includes('--json');

// スキル一覧（SKILL.md を持つディレクトリのみ）
function listSkills(dir) {
  if (!existsSync(dir)) {
    console.error(`[skill-audit] Directory not found: ${dir}`);
    process.exit(1);
  }
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'SKILL.md')))
    .map((e) => e.name);
}

// frontmatter を簡易パース（key: value のみ。block scalar は検出のみ）
function parseFrontmatter(text) {
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
function bodyOf(text) {
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
  return m ? m[1] : text;
}

// 構造要素（段落とみなさない行）の判定
// インデントコード判定のため、trim 前の生の行を受け取る
function isStructural(line) {
  const trimmed = line.trim();
  if (/^(#{1,6}\s|>\s?|\|)/.test(trimmed)) {
    return true;
  } // 見出し / 引用 / 表（先頭パイプ）
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
  if (/^[^\s|][^|]*\|[^|]*\|/.test(trimmed)) {
    return true;
  } // 表（先頭パイプなし）
  if (/^\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(trimmed)) {
    return true;
  } // 表の区切り行
  if (/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
    return true;
  } // 水平線
  return false;
}

// 段落内の改行を検出（構造要素・コード・HTML コメントは除外）
function findMidParagraphBreaks(body) {
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

// 存在しないローカルファイルへのリンクを検出
function findDeadLinks(body, skillDir) {
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
function findToolSpecificPaths(text, label) {
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
const SECURITY_PATTERNS = [
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

// 1 スキル分の監査を実行し、findings を返す
function runChecks(skillDir) {
  const text = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
  const fm = parseFrontmatter(text);
  const body = bodyOf(text);
  const findings = [];

  const fail = (id, severity, label, suggestion, detail) =>
    findings.push({ id, severity, label, suggestion, detail });

  // Spec
  if (!fm) {
    fail(
      'frontmatter-parse',
      'error',
      'frontmatter がパースできる',
      '--- で囲まれた YAML ブロックを先頭に書く',
    );
  } else {
    if (fm.duplicates.length) {
      fail(
        'frontmatter-duplicate-key',
        'warning',
        'frontmatter に重複キーがない',
        `重複: ${fm.duplicates.join(', ')}`,
      );
    }
    const name = fm.fields.name?.value?.trim();
    if (!name) {
      fail('name-required', 'error', 'name が必須', 'name: <lowercase-hyphen> を追加する');
    } else {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 64) {
        fail('name-format', 'error', 'name は小文字ハイフン形式・64字以内', `現在: ${name}`);
      }
      if (name !== basename(skillDir)) {
        fail(
          'name-dir-match',
          'warning',
          'name がディレクトリ名と一致',
          `name=${name}, dir=${basename(skillDir)}`,
        );
      }
    }
    const descField = fm.fields.description;
    const desc = descField?.value?.trim();
    if (!desc) {
      fail('description-required', 'error', 'description が必須', 'description: を追加する');
    } else {
      if (descField.blockScalar) {
        fail(
          'description-no-block-scalar',
          'error',
          'description に >- や | を使わない',
          '1行の description: "..." に書き換える',
        );
      }
      if (desc.includes('\n')) {
        fail(
          'description-single-line',
          'error',
          'description は1行',
          '改行を削除して1行にまとめる',
        );
      }
      if (!descField.quoted && /: /.test(descField.value)) {
        fail(
          'description-unquoted-colon',
          'error',
          'description に : を含む場合は引用符で囲む',
          'description: "..." の形式にする',
        );
      }
      if (desc.length > 1024) {
        fail('description-length', 'error', 'description は1024字以内', `現在 ${desc.length} 字`);
      }
      if (desc.length < 30) {
        fail(
          'description-too-short',
          'warning',
          'description が具体的',
          '何をするか + いつ使うかを含める',
        );
      }
      if (!/use|when|とき|トリガー/i.test(desc)) {
        fail(
          'description-vague',
          'info',
          'description にトリガー語がある',
          '「Use when ...」形式を推奨',
        );
      }
    }
  }

  // Body
  if (!body.trim()) {
    fail('body-empty', 'warning', '本文が空でない', '手順を本文に書く');
  }
  const bodyLines = body.split(/\r?\n/);
  if (bodyLines.length > 500) {
    fail(
      'body-line-count',
      'warning',
      '本文は500行以内',
      `${bodyLines.length} 行。reference/ への分割を検討`,
    );
  }
  const breaks = findMidParagraphBreaks(body);
  if (breaks.length) {
    fail(
      'body-no-mid-paragraph-breaks',
      'warning',
      '本文は段落内で改行しない',
      `段落内改行: ${breaks.slice(0, 5).join(', ')} 行目`,
    );
  }
  const dead = findDeadLinks(body, skillDir);
  if (dead.length) {
    fail(
      'body-dead-links',
      'error',
      '参照ファイルが存在する',
      `存在しないリンク: ${dead.join(', ')}`,
    );
  }
  const toolPaths = findToolSpecificPaths(body, 'SKILL.md');
  if (toolPaths.length) {
    fail(
      'tool-agnostic-paths',
      'error',
      'SKILL.md / references/*.md にツール固有パス（.cursor/ .opencode/）がない',
      `検出: ${toolPaths.join(', ')}`,
    );
  }
  // references/*.md も対象（md のみ。スクリプト等は対象外）
  const refDir = join(skillDir, 'references');
  if (existsSync(refDir)) {
    for (const name of readdirSync(refDir).filter((n) => n.endsWith('.md'))) {
      const refText = readFileSync(join(refDir, name), 'utf8');
      const refPaths = findToolSpecificPaths(refText, `references/${name}`);
      if (refPaths.length) {
        fail(
          'tool-agnostic-paths',
          'error',
          'SKILL.md / references/*.md にツール固有パス（.cursor/ .opencode/）がない',
          `検出: ${refPaths.join(', ')}`,
        );
      }
    }
  }

  // Security
  for (const p of SECURITY_PATTERNS) {
    if (p.re.test(text)) {
      fail(p.id, 'warning', `${p.label} が含まれない`, `「${p.label}」に該当する記述を確認`);
    }
  }

  return findings;
}

function main() {
  const skills = listSkills(targetDir);
  if (skills.length === 0) {
    console.log(`No skills found in ${targetDir}`);
    return;
  }

  const results = skills.map((name) => ({ name, findings: runChecks(join(targetDir, name)) }));
  const totalErrors = results.reduce(
    (n, r) => n + r.findings.filter((f) => f.severity === 'error').length,
    0,
  );
  const totalWarnings = results.reduce(
    (n, r) => n + r.findings.filter((f) => f.severity === 'warning').length,
    0,
  );

  if (json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(`Audit ${targetDir} (${skills.length} skills)\n`);
    for (const { name, findings } of results) {
      console.log(`## ${name}`);
      if (findings.length === 0) {
        console.log('  ✓ all checks passed\n');
        continue;
      }
      for (const f of findings) {
        const mark = f.severity === 'error' ? '✗' : f.severity === 'warning' ? '⚠' : 'i';
        console.log(`  ${mark} ${f.id}  [${f.severity}] ${f.label}`);
        console.log(`      提案: ${f.suggestion}`);
        if (f.detail) {
          console.log(`      (${f.detail})`);
        }
      }
      console.log('');
    }
    console.log(
      `Summary: ${skills.length} skills, ${totalErrors} error(s), ${totalWarnings} warning(s)`,
    );
  }

  process.exit(totalErrors > 0 ? 1 : 0);
}

main();
