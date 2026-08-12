/*
 * FEATURES: H-verifier, H-mutator, H-reporter
 * PURPOSE: 編集済みコードファイルのドリフト検出と STATUS 書込、ヘッダー欠落の案内を行う (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CheckContext, IdleCheck } from '../idle-chain';

// ---- 設定 ----
// ヘッダー対象の拡張子（実コードのみ。テスト / md / 設定は対象外）
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
// ドリフト判定の閾値（緩めに開始し、実データで調整する）
// sizeDrift: 実コード行数（コメント・空行を除く）の上限。超えたらリファクタ前提で PURPOSE も変わる
const SIZE_DRIFT_MAX_LINES = 300;
// driftSuspected: ベースライン比の累積追加が割合を超えたら発火。
// 小さいファイルは割合が跳ねるため、実コード行数が一定以上の場合のみ判定する
const DRIFT_SUSPECTED_RATIO = 0.5;
const DRIFT_SUSPECTED_MIN_LINES = 100;
// ヘッダー対象ディレクトリ（ホワイトリスト。ルート直下のディレクトリ名）
// スタータープロジェクトのため、将来のプロダクトコード置き場も含める
const ALLOWED_DIRS = new Set([
  // プロダクトコードの一般的な置き場
  'src',
  'app',
  'pages',
  'client',
  'server',
  'web',
  'api',
  'frontend',
  'backend',
  'packages',
  'apps',
  'libs',
  // メタ / 管理系
  '.opencode',
  '.cursor',
  'scripts',
  'products',
]);
// 依存・生成物ディレクトリ（どの階層でも除外）
const SKIP_DIR_NAMES = new Set(['node_modules', 'dist', '.git']);
// フォローアップメッセージに含める出力の最大行数
const MAX_OUTPUT_LINES = 40;

const SERVICE = 'drift-gate';

// 実コードファイルかどうか（拡張子・テスト・ホワイトリストで判定）
const isCodeFile = (rel: string) => {
  const ext = path.extname(rel).toLowerCase();
  if (!CODE_EXTENSIONS.has(ext)) {
    return false;
  }
  const base = path.basename(rel);
  if (/\.(test|spec)\./.test(base)) {
    return false;
  }
  // 依存・生成物ディレクトリはどの階層でも対象外
  // （Windows では path.relative がバックスラッシュ区切りを返すため、posix 形式に正規化してから分割する）
  const posixRel = rel.split(path.sep).join('/');
  if (posixRel.split('/').some((seg) => SKIP_DIR_NAMES.has(seg))) {
    return false;
  }
  // 許可ディレクトリ配下のみ対象（ルート直下は設定ファイル等が置かれるため一律対象外）
  // ルート直下の .ts/.js（forConfig.ts 等）を実コードと誤判定しないための規約
  const segments = posixRel.split('/');
  return segments.length > 1 && ALLOWED_DIRS.has(segments[0]);
};

// 実コード行数を数える（コメント・空行を除く。ドリフト判定としては十分な近似）
const countCodeLines = (text: string) => {
  // ブロックコメント（ヘッダー含む）と行コメントを除去する
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  let count = 0;
  for (const line of stripped.split('\n')) {
    if (line.trim() !== '') {
      count++;
    }
  }
  return count;
};

// ファイル冒頭のヘッダーコメントを解析する。見つからなければ null
const parseHeader = (filePath: string) => {
  const text = fs.readFileSync(filePath, 'utf8');
  const match = text.match(/^\/\*\r?\n([\s\S]*?)\*\//);
  if (!match) {
    return null;
  }

  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^\s*\*\s*(FEATURES|PURPOSE|STATUS):\s*(.*?)\s*$/);
    if (m) {
      fields[m[1]] = m[2];
    }
  }
  return { fields, headerText: match[0], codeLines: countCodeLines(text) };
};

// STATUS 行のベースライン（baseLines / baseCommit）を抽出する
const parseBaseline = (statusLine: string) => {
  const m = statusLine.match(/baseLines=(\d+)(?:,\s*baseCommit=([0-9a-f]+))?/);
  if (!m) {
    return null;
  }
  return { baseLines: Number(m[1]), baseCommit: m[2] ?? null };
};

// 出力を最大行数に切り詰める
const truncate = (text: string) => {
  const lines = text.trim().split('\n');
  if (lines.length <= MAX_OUTPUT_LINES) {
    return text.trim();
  }
  return [
    ...lines.slice(0, MAX_OUTPUT_LINES),
    `... and ${lines.length - MAX_OUTPUT_LINES} more lines`,
  ].join('\n');
};

// baseCommit 以降（無ければ未コミット分）の累積追加行数を git で求める
// baseCommit 存在時は git diff <baseCommit> -- <rel>（コミット対作業ツリー比較）を使う。
// これにより baseCommit 以降のコミット済み + staged + unstaged を全て含む。
// （git diff <baseCommit>..HEAD の two-dot range はコミット対コミット比較のため
//   未コミット分を数えず、driftSuspected が実質発火しなくなる）
async function cumulativeAdditions(ctx: CheckContext, rel: string, baseCommit: string | null) {
  const base = baseCommit ? [baseCommit] : ['HEAD'];
  const result = await ctx.run(['git', 'diff', '--numstat', ...base, '--', rel], ctx.root);
  if (result.exitCode !== 0) {
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
async function detectDrift(ctx: CheckContext, abs: string) {
  const rel = path.relative(ctx.root, abs);
  if (!isCodeFile(rel) || !fs.existsSync(abs)) {
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
  // sizeDrift: 実コード行数が上限を超えたら発火（リファクタ前提・PURPOSE も変わる）
  // ベースラインの有無に関わらず判定する（ベースラインは driftSuspected のためだけのもの）
  const sizeDrift = codeLines > SIZE_DRIFT_MAX_LINES;

  // driftSuspected: 実コード行数が一定以上の場合のみ、ベースライン比の累積追加で判定
  // （小さいファイルは割合が跳ねるため対象外にする）
  // ベースラインがなければ判定できないため sizeDrift のまま維持する
  const baseline = parseBaseline(parsed.fields.STATUS);
  let driftSuspected = false;
  if (baseline) {
    const additions = await cumulativeAdditions(ctx, rel, baseline.baseCommit);
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
  const text = fs.readFileSync(abs, 'utf8');
  fs.writeFileSync(abs, text.replace(parsed.headerText, newHeader));
  return { rel, sizeDrift, driftSuspected, before: parsed.fields.STATUS, after: nextStatus };
}

// ヘッダー欠落・形式エラーのファイル一覧（フォローアップ案内用）
function findHeaderIssues(ctx: CheckContext) {
  const issues: string[] = [];
  for (const abs of ctx.files) {
    const rel = path.relative(ctx.root, abs);
    if (!isCodeFile(rel) || !fs.existsSync(abs)) {
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
function buildHeaderIssuesMessage(issues: string[]): string {
  return [
    '[drift-gate] Edited code files need valid headers (FEATURES / PURPOSE / STATUS).',
    '',
    truncate(issues.join('\n')),
    '## Instructions',
    '- Add or fix the header comment per .opencode/skills/charter/references/header-format.md',
    '- Use the charter skill to record intent (isDone: false) or update an existing header.',
  ].join('\n');
}

// ドリフト検出のフォローアップ本文（フラグの意味に応じて指示を変える）
function buildDriftMessage(
  detected: { rel: string; sizeDrift: boolean; driftSuspected: boolean }[],
): string {
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

// ドリフト検出チェック。quality チェック完了後の確定状態を読む
export const driftCheck: IdleCheck = {
  name: SERVICE,
  run: async (ctx) => {
    const detected: {
      rel: string;
      sizeDrift: boolean;
      driftSuspected: boolean;
      before: string;
      after: string;
    }[] = [];

    for (const abs of ctx.files) {
      // oxlint-disable-next-line no-await-in-loop -- ドリフト検出は git diff を伴う直列処理
      const result = await detectDrift(ctx, abs);
      if (result) {
        detected.push(result);
      }
    }

    // 検出結果のログは並列で送る（順序は要求しない）
    await Promise.all(
      detected.map(({ rel, before, after }) =>
        ctx.log(SERVICE, 'info', 'drift flags updated', {
          sessionID: ctx.sessionID,
          file: rel,
          before,
          after,
        }),
      ),
    );

    const followUps: string[] = [];
    const issues = findHeaderIssues(ctx);
    if (issues.length > 0) {
      followUps.push(buildHeaderIssuesMessage(issues));
    }
    if (detected.length > 0) {
      followUps.push(buildDriftMessage(detected));
    }
    return { followUps };
  },
};
