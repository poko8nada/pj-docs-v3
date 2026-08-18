/*
 * FEATURES: H-verifier, H-mutator, H-reporter
 * PURPOSE: 編集済みコードのドリフト検出と STATUS 書込、ヘッダー欠落の案内を行う (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, isAbsolute, join, relative, sep } from 'node:path';
import {
  ALLOWED_DIRS,
  CODE_EXTENSIONS,
  HEADER_FORMAT_PATH,
  SKIP_DIRS,
} from '../../../constants/index.mjs';
import { runCommand } from '../lib/run-command.mjs';

export const name = 'drift';

// ヘッダー対象の拡張子・ディレクトリ（constants/index.mjs から import）
const codeExtensions = new Set(CODE_EXTENSIONS);
const allowedDirs = new Set(ALLOWED_DIRS);
const skipDirNames = new Set(SKIP_DIRS);
// ドリフト判定の閾値（opencode drift-gate より移植）
const SIZE_DRIFT_MAX_LINES = 300;
const DRIFT_SUSPECTED_RATIO = 0.5;
const DRIFT_SUSPECTED_MIN_LINES = 100;
// フォローアップメッセージに含める出力の最大行数
const MAX_OUTPUT_LINES = 40;

/**
 * 編集済みコードファイルのドリフト検出（STATUS 書き換え）とヘッダー欠落の案内を行う。
 * 判定と書込は opencode drift-gate のロジックを移植したもの。
 */
export async function run(context) {
  const files = resolveTouchedPaths(context);
  if (files.length === 0) {
    // no-op 時は undefined を返す。runChain のレスポンス合成は「後勝ち」のため、
    // { response: {} } を返すと前段 verify の followup_message が消える
    return undefined;
  }

  const detected = [];
  for (const abs of files) {
    // oxlint-disable-next-line no-await-in-loop -- ドリフト検出は git diff を伴う直列処理
    const result = await detectDrift(context.projectRoot, abs);
    if (result) {
      detected.push(result);
    }
  }

  const followUps = [];
  const issues = findHeaderIssues(context.projectRoot, files);
  if (issues.length > 0) {
    followUps.push(buildHeaderIssuesMessage(issues));
  }
  if (detected.length > 0) {
    followUps.push(buildDriftMessage(detected));
  }

  if (followUps.length === 0) {
    return undefined;
  }

  return {
    log: {
      handler: name,
      decision: 'allow',
      reason: `drift flags updated: ${detected.length} file(s), header issues: ${issues.length}`,
    },
    response: { followup_message: followUps.join('\n\n') },
  };
}

function resolveTouchedPaths(context) {
  const touched = context.snapshot?.touchedPaths ?? [];
  return touched.map((filePath) =>
    isAbsolute(filePath) ? filePath : join(context.projectRoot, filePath),
  );
}

// 実ファイル（ディレクトリではない）かどうか。
// touchedPaths はイベント由来でディレクトリが混入し得るため、readFileSync 前に必須。
function isRegularFile(abs) {
  return existsSync(abs) && statSync(abs).isFile();
}

// 実コードファイルかどうか（拡張子・テスト・ホワイトリストで判定）
function isCodeFile(rel) {
  const ext = extname(rel).toLowerCase();
  if (!codeExtensions.has(ext)) {
    return false;
  }
  const base = rel.split(/[\\/]/).at(-1) ?? '';
  if (/\.(test|spec)\./.test(base)) {
    return false;
  }
  // 依存・生成物ディレクトリはどの階層でも対象外
  const posixRel = rel.split(sep).join('/');
  if (posixRel.split('/').some((seg) => skipDirNames.has(seg))) {
    return false;
  }
  // 許可ディレクトリ配下のみ対象（ルート直下は設定ファイル等が置かれるため一律対象外）
  const segments = posixRel.split('/');
  return segments.length > 1 && allowedDirs.has(segments[0]);
}

// 実コード行数を数える（コメント・空行を除く。ドリフト判定としては十分な近似）
function countCodeLines(text) {
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  let count = 0;
  for (const line of stripped.split('\n')) {
    if (line.trim() !== '') {
      count++;
    }
  }
  return count;
}

// ファイル冒頭のヘッダーコメントを解析する。見つからなければ null
function parseHeader(filePath) {
  const text = readFileSync(filePath, 'utf8');
  const match = text.match(/^\/\*\r?\n([\s\S]*?)\*\//);
  if (!match) {
    return null;
  }

  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^\s*\*\s*(FEATURES|PURPOSE|STATUS):\s*(.*?)\s*$/);
    if (m) {
      fields[m[1]] = m[2];
    }
  }
  return { fields, headerText: match[0], codeLines: countCodeLines(text) };
}

// STATUS 行のベースライン（baseLines / baseCommit）を抽出する
function parseBaseline(statusLine) {
  const m = statusLine.match(/baseLines=(\d+)(?:,\s*baseCommit=([0-9a-f]+))?/);
  if (!m) {
    return null;
  }
  return { baseLines: Number(m[1]), baseCommit: m[2] ?? null };
}

// 出力を最大行数に切り詰める
function truncate(text) {
  const lines = text.trim().split('\n');
  if (lines.length <= MAX_OUTPUT_LINES) {
    return text.trim();
  }
  return [
    ...lines.slice(0, MAX_OUTPUT_LINES),
    `... and ${lines.length - MAX_OUTPUT_LINES} more lines`,
  ].join('\n');
}

// baseCommit 以降（無ければ未コミット分）の累積追加行数を git で求める
async function cumulativeAdditions(projectRoot, rel, baseCommit) {
  const base = baseCommit ? [baseCommit] : ['HEAD'];
  const result = await runCommand('git', ['diff', '--numstat', ...base, '--', rel], projectRoot);
  if (!result.ok) {
    return null;
  }
  let added = 0;
  for (const line of result.stdout.split('\n')) {
    const m = line.match(/^(\d+)\s+(\d+)\s/);
    if (m) {
      added += Number(m[1]);
    }
  }
  return added;
}

// ドリフト判定と STATUS 書き換え。フラグが変われば検出結果を返す
async function detectDrift(projectRoot, abs) {
  const rel = relative(projectRoot, abs);
  if (!isCodeFile(rel) || !isRegularFile(abs)) {
    return null;
  }
  const parsed = parseHeader(abs);
  if (!parsed || !parsed.fields.STATUS) {
    return null;
  }
  // 実装前（isDone: false）のヘッダーはドリフト対象外
  if (!/\(isDone: true\)/.test(parsed.fields.PURPOSE ?? '')) {
    return null;
  }

  const codeLines = parsed.codeLines;
  // sizeDrift: 実コード行数が上限を超えたら発火
  const sizeDrift = codeLines > SIZE_DRIFT_MAX_LINES;

  // driftSuspected: 実コード行数が一定以上の場合のみ、ベースライン比の累積追加で判定
  const baseline = parseBaseline(parsed.fields.STATUS);
  let driftSuspected = false;
  if (baseline) {
    const additions = await cumulativeAdditions(projectRoot, rel, baseline.baseCommit);
    driftSuspected =
      additions !== null &&
      codeLines >= DRIFT_SUSPECTED_MIN_LINES &&
      additions >= baseline.baseLines * DRIFT_SUSPECTED_RATIO;
  }

  const nextStatus = parsed.fields.STATUS.replace(
    /sizeDrift=(true|false),\s*driftSuspected=(true|false)/,
    `sizeDrift=${sizeDrift}, driftSuspected=${driftSuspected}`,
  );
  if (nextStatus === parsed.fields.STATUS) {
    return null;
  }

  // STATUS 行を書き換える（ドリフトフラグの更新のみ。ヘッダー構造は変えない）
  const newHeader = parsed.headerText.replace(parsed.fields.STATUS, nextStatus);
  const text = readFileSync(abs, 'utf8');
  writeFileSync(abs, text.replace(parsed.headerText, newHeader));
  return { rel, sizeDrift, driftSuspected, before: parsed.fields.STATUS, after: nextStatus };
}

// ヘッダー欠落・形式エラーのファイル一覧（フォローアップ案内用）
function findHeaderIssues(projectRoot, files) {
  const issues = [];
  for (const abs of files) {
    const rel = relative(projectRoot, abs);
    if (!isCodeFile(rel) || !isRegularFile(abs)) {
      continue;
    }
    const parsed = parseHeader(abs);
    if (!parsed) {
      issues.push(`${rel}: missing header`);
    } else if (!parsed.fields.FEATURES || !parsed.fields.PURPOSE || !parsed.fields.STATUS) {
      issues.push(`${rel}: incomplete header`);
    }
  }
  return issues;
}

// ヘッダー欠落のフォローアップ本文
function buildHeaderIssuesMessage(issues) {
  return [
    '[drift-gate] Edited code files need valid headers (FEATURES / PURPOSE / STATUS).',
    '',
    truncate(issues.join('\n')),
    '## Instructions',
    '- Add or fix the header comment per ' + HEADER_FORMAT_PATH,
    '- Use the charter skill to record intent (isDone: false) or update an existing header.',
  ].join('\n');
}

// ドリフト検出のフォローアップ本文（フラグの意味に応じて指示を変える）
function buildDriftMessage(detected) {
  const lines = ['[drift-gate] Drift flags were raised on edited files.', '', '## Flagged files'];
  for (const { rel, sizeDrift, driftSuspected } of detected) {
    lines.push(`- ${rel}: sizeDrift=${sizeDrift}, driftSuspected=${driftSuspected}`);
    if (sizeDrift) {
      lines.push(
        '  - sizeDrift: the file exceeds the size limit. Refactoring is needed, and its PURPOSE will change — re-charter it.',
      );
    }
    if (driftSuspected) {
      lines.push(
        '  - driftSuspected: content changed substantially. PURPOSE has likely drifted — rewrite it. Whether refactoring is needed is case-by-case.',
      );
    }
  }
  lines.push(
    '## Instructions',
    '- Use the charter skill to re-charter the PURPOSE or propose the refactor.',
    '- After the change, the flags are reset and the baseline updated by the structure review.',
  );
  return lines.join('\n');
}
