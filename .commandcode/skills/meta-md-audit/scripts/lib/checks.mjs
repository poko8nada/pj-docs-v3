/*
 * FEATURES: S-verify
 * PURPOSE: 監査チェック関数群。md の規約違反を検出して findings を積む (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  bodyOf,
  findDeadLinks,
  findJapanese,
  findLongLines,
  findMidParagraphBreaks,
  findNegatives,
  findToolSpecificPaths,
  MAX_LINE_LENGTH,
  SECURITY_PATTERNS,
} from './md-checks.mjs';

// Spec: frontmatter の存在・重複・description を検査する（skill / agent 共通）
export function checkFrontmatter(fm, findings) {
  if (!fm) {
    findings.push({
      id: 'frontmatter-parse',
      severity: 'error',
      label: 'frontmatter がパースできる',
      suggestion: '--- で囲まれた YAML ブロックを先頭に書く',
    });
    return;
  }
  if (fm.duplicates.length) {
    findings.push({
      id: 'frontmatter-duplicate-key',
      severity: 'warning',
      label: 'frontmatter に重複キーがない',
      suggestion: `重複: ${fm.duplicates.join(', ')}`,
    });
  }
  checkDescription(fm.fields.description, findings);
}

// Spec: name の必須・形式・ディレクトリ名一致（SKILL.md 固有。agent は name を持たないため対象外）
export function checkName(fm, skillDir, findings) {
  const name = fm?.fields.name?.value?.trim();
  if (!name) {
    findings.push({
      id: 'name-required',
      severity: 'error',
      label: 'name が必須',
      suggestion: 'name: <lowercase-hyphen> を追加する',
    });
    return;
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 64) {
    findings.push({
      id: 'name-format',
      severity: 'error',
      label: 'name は小文字ハイフン形式・64字以内',
      suggestion: `現在: ${name}`,
    });
  }
  if (name !== basename(skillDir)) {
    findings.push({
      id: 'name-dir-match',
      severity: 'warning',
      label: 'name がディレクトリ名と一致',
      suggestion: `name=${name}, dir=${basename(skillDir)}`,
    });
  }
}

// Spec: description の必須・形式・長さ・具体性を検査する
export function checkDescription(descField, findings) {
  const desc = descField?.value?.trim();
  if (!desc) {
    findings.push({
      id: 'description-required',
      severity: 'error',
      label: 'description が必須',
      suggestion: 'description: を追加する',
    });
    return;
  }
  if (descField.blockScalar) {
    findings.push({
      id: 'description-no-block-scalar',
      severity: 'error',
      label: 'description に >- や | を使わない',
      suggestion: '1行の description: "..." に書き換える',
    });
  }
  if (desc.includes('\n')) {
    findings.push({
      id: 'description-single-line',
      severity: 'error',
      label: 'description は1行',
      suggestion: '改行を削除して1行にまとめる',
    });
  }
  if (!descField.quoted && /: /.test(descField.value)) {
    findings.push({
      id: 'description-unquoted-colon',
      severity: 'error',
      label: 'description に : を含む場合は引用符で囲む',
      suggestion: 'description: "..." の形式にする',
    });
  }
  if (desc.length > 1024) {
    findings.push({
      id: 'description-length',
      severity: 'error',
      label: 'description は1024字以内',
      suggestion: `現在 ${desc.length} 字`,
    });
  }
  if (desc.length < 30) {
    findings.push({
      id: 'description-too-short',
      severity: 'warning',
      label: 'description が具体的',
      suggestion: '何をするか + いつ使うかを含める',
    });
  }
  if (!/use|when|とき|トリガー/i.test(desc)) {
    findings.push({
      id: 'description-vague',
      severity: 'info',
      label: 'description にトリガー語がある',
      suggestion: '「Use when ...」形式を推奨',
    });
  }
}

// Body: 空・行数・段落内改行・リンク・ツール固有パスを検査する
// skill は SKILL.md、agent は対象の .md を渡す。dead-links の基準ディレクトリも呼び出し元が渡す
export function checkBody(body, baseDir, findings) {
  if (!body.trim()) {
    findings.push({
      id: 'body-empty',
      severity: 'warning',
      label: '本文が空でない',
      suggestion: '手順を本文に書く',
    });
  }
  const bodyLines = body.split(/\r?\n/);
  if (bodyLines.length > 500) {
    findings.push({
      id: 'body-line-count',
      severity: 'warning',
      label: '本文は500行以内',
      suggestion: `${bodyLines.length} 行。reference/ への分割を検討`,
    });
  }
  const breaks = findMidParagraphBreaks(body);
  if (breaks.length) {
    findings.push({
      id: 'body-no-mid-paragraph-breaks',
      severity: 'warning',
      label: '本文は段落内で改行しない',
      suggestion: `段落内改行: ${breaks.slice(0, 5).join(', ')} 行目`,
    });
  }
  const dead = findDeadLinks(body, baseDir);
  if (dead.length) {
    findings.push({
      id: 'body-dead-links',
      severity: 'error',
      label: '参照ファイルが存在する',
      suggestion: `存在しないリンク: ${dead.join(', ')}`,
    });
  }
  checkToolPaths(body, findings);
}

// Body / references: ツール固有パス（.cursor/ .opencode/）を検査する（skill / agent 共通）
export function checkToolPaths(body, findings) {
  const toolPaths = findToolSpecificPaths(body, 'md');
  if (toolPaths.length) {
    findings.push({
      id: 'tool-agnostic-paths',
      severity: 'error',
      label: 'SKILL.md / agents/*.md にツール固有パス（.cursor/ .opencode/）がない',
      suggestion: `検出: ${toolPaths.join(', ')}`,
    });
  }
}

// references/*.md も対象（SKILL.md 固有。agent は references を持たない）
export function checkRefToolPaths(skillDir, findings) {
  const refDir = join(skillDir, 'references');
  if (!existsSync(refDir)) {
    return;
  }
  for (const name of readdirSync(refDir).filter((n) => n.endsWith('.md'))) {
    const refText = readFileSync(join(refDir, name), 'utf8');
    const refPaths = findToolSpecificPaths(refText, `references/${name}`);
    if (refPaths.length) {
      findings.push({
        id: 'tool-agnostic-paths',
        severity: 'error',
        label: 'SKILL.md / references/*.md にツール固有パス（.cursor/ .opencode/）がない',
        suggestion: `検出: ${refPaths.join(', ')}`,
      });
    }
  }
}

// 日本語抽出・否定表現抽出・行長チェック（skill は whitelist 対象 md、agent は単一の .md）
export function checkSources(sources, findings) {
  const jaHits = [];
  const negHits = [];
  const longLines = [];
  for (const { rel, path } of sources) {
    const srcText = readFileSync(path, 'utf8');
    jaHits.push(...findJapanese(srcText, rel));
    negHits.push(...findNegatives(srcText, rel));
    longLines.push(...findLongLines(bodyOf(srcText), MAX_LINE_LENGTH, rel));
  }
  if (jaHits.length) {
    findings.push({
      id: 'md-japanese',
      severity: 'warning',
      label: 'md に日本語が含まれない（ユーザー向け明記の有無は Step 2 で手動判定）',
      suggestion: `検出: ${jaHits.slice(0, 5).join('; ')}${jaHits.length > 5 ? ` ほか ${jaHits.length - 5} 件` : ''}`,
    });
  }
  if (negHits.length) {
    findings.push({
      id: 'md-negative',
      severity: 'warning',
      label: '否定表現（〜しない）を削除するか肯定形に言い換える（Step 2 で手動判定）',
      suggestion: `検出: ${negHits.slice(0, 5).join('; ')}${negHits.length > 5 ? ` ほか ${negHits.length - 5} 件` : ''}`,
    });
  }
  if (longLines.length) {
    findings.push({
      id: 'md-line-length',
      severity: 'warning',
      label: `行を構造化して ${MAX_LINE_LENGTH} 文字以内に収める（コードブロック・テーブル・HTML コメントは除外、description は対象外）`,
      suggestion: `検出: ${longLines.slice(0, 5).join('; ')}${longLines.length > 5 ? ` ほか ${longLines.length - 5} 件` : ''}`,
    });
  }
}

// 未登録ディレクトリ（SKILL.md 固有。agent は listSourceMd を使わない）
export function checkUnregistered(unregistered, findings) {
  for (const dir of unregistered) {
    findings.push({
      id: 'md-unregistered-dir',
      severity: 'warning',
      label: 'ホワイトリスト未登録ディレクトリに md がない',
      suggestion: `「${dir}/」に md があります。ソースなら MD_SOURCE_DIRS に追加、非ソースなら SKIP_DIRS に追加する`,
    });
  }
}

// Security: 破壊的コマンド・機密パス・プロンプトインジェクションを検査する
export function checkSecurity(text, findings) {
  for (const p of SECURITY_PATTERNS) {
    if (p.re.test(text)) {
      findings.push({
        id: p.id,
        severity: 'warning',
        label: `${p.label} が含まれない`,
        suggestion: `「${p.label}」に該当する記述を確認`,
      });
    }
  }
}
