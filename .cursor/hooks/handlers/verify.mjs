/*
 * FEATURES: H-verifier
 * PURPOSE: ターン末に lint/format/typecheck を実行し残った問題を報告する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
import {
  FORMAT_CHECK_EXTENSIONS,
  FORMAT_EXTENSIONS,
  hasExtension,
  OXLINT_EXTENSIONS,
  TYPECHECK_EXTENSIONS,
} from '../lib/file-extensions.mjs';
import { runCommand, truncateOutput } from '../lib/run-command.mjs';
import { getMissingVerifyTooling } from '../lib/tooling.mjs';

export const name = 'verify';

// stop フックの自動ループ上限 (hooks.json の loop_limit と一致させる)
const DEFAULT_LOOP_LIMIT = 3;
// 自動メッセージをユーザー発言と誤認させないための接頭辞
const MACHINE_PREFIX = '[Automated hook message — not from the user]\n\n';

/**
 * ターン末に lint --fix / format で自動修正してから lint / format-check / typecheck を走らせ、
 * 残った問題があれば followup を返す。
 */
export async function run(context) {
  const payload = isRecord(context.input) ? context.input : {};
  const loopCount = numberOr(payload.loop_count, 0);
  const loopLimit = numberOr(payload.loop_limit, DEFAULT_LOOP_LIMIT);

  if (loopCount >= loopLimit) {
    return { response: {} };
  }

  const missingTooling = await getMissingVerifyTooling(context.projectRoot);
  if (missingTooling.length > 0) {
    return {
      response: {
        followup_message: [
          MACHINE_PREFIX,
          'Required dev dependencies for lint / format / typecheck are not installed:',
          missingTooling.join(', '),
          '',
          'Run `pnpm install` in the project root, then continue your task.',
        ].join('\n'),
      },
    };
  }

  const touchedPaths = context.snapshot?.touchedPaths ?? [];
  const targets = partitionTargets(touchedPaths);

  if (
    targets.lint.length === 0 &&
    targets.formatCheck.length === 0 &&
    targets.typecheck.length === 0
  ) {
    return { response: {} };
  }

  // 自動修正を適用してからチェックする (opencode quality-gate のフロー)
  // lint --fix が整形を崩すため fix → format の順で実行する
  await autoFix(context.projectRoot, targets);

  const failures = await runChecks(context.projectRoot, targets);
  if (failures.length === 0) {
    return { response: {} };
  }

  return {
    response: {
      followup_message: [
        MACHINE_PREFIX,
        'Lint, format, or typecheck reported issues. Fix them and verify again.',
        '',
        ...failures,
      ].join('\n'),
    },
  };
}

// touchedPaths をチェック種別ごとに振り分ける
function partitionTargets(touchedPaths) {
  return {
    lint: touchedPaths.filter((filePath) => hasExtension(filePath, OXLINT_EXTENSIONS)),
    formatCheck: touchedPaths.filter((filePath) => hasExtension(filePath, FORMAT_CHECK_EXTENSIONS)),
    typecheck: touchedPaths.filter((filePath) => hasExtension(filePath, TYPECHECK_EXTENSIONS)),
    format: touchedPaths.filter((filePath) => hasExtension(filePath, FORMAT_EXTENSIONS)),
  };
}

// lint --fix と format を実行して自動修正する
async function autoFix(projectRoot, targets) {
  if (targets.lint.length > 0) {
    await runCommand('pnpm', ['lint', '--fix', ...targets.lint], projectRoot);
  }
  if (targets.format.length > 0) {
    await runCommand('pnpm', ['format', ...targets.format], projectRoot);
  }
}

// 修正後の状態で lint / format-check / typecheck を実行し、失敗一覧を返す
async function runChecks(projectRoot, targets) {
  const failures = [];

  if (targets.lint.length > 0) {
    const lint = await runCommand('pnpm', ['lint', ...targets.lint], projectRoot);
    if (!lint.ok) {
      failures.push(formatFailure('lint', lint));
    }
  }

  if (targets.formatCheck.length > 0) {
    const formatCheck = await runCommand(
      'pnpm',
      ['format:check', ...targets.formatCheck],
      projectRoot,
    );
    if (!formatCheck.ok) {
      failures.push(formatFailure('format:check', formatCheck));
    }
  }

  if (targets.typecheck.length > 0) {
    const typecheck = await runCommand(
      'pnpm',
      ['typecheck:staged', ...targets.typecheck],
      projectRoot,
    );
    if (!typecheck.ok) {
      failures.push(formatFailure('typecheck', typecheck));
    }
  }

  return failures;
}

function formatFailure(label, result) {
  const output = truncateOutput(`${result.stdout}\n${result.stderr}`.trim());
  return `## ${label} (exit ${result.code})\n${output || '(no output)'}`;
}

function numberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
