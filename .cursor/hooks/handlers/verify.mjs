/*
 * FEATURES: H-verifier
 * PURPOSE: ターン末に lint/typecheck を実行し残った問題（warning 含む）を報告する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
import { join } from 'node:path';
import {
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
// node_modules/.bin 配下の実行ファイル（pnpm 環境でも symlink 経由で直接実行できる）
const bin = (projectRoot, tool) => join(projectRoot, 'node_modules', '.bin', tool);

/**
 * ターン末に oxlint --fix / oxfmt で自動修正してから lint / typecheck を走らせ、
 * 残った問題（warning 含む）があれば followup を返す。
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

  if (targets.lint.length === 0 && targets.format.length === 0 && targets.typecheck.length === 0) {
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
        'Lint or typecheck reported issues. Fix them and verify again.',
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
    format: touchedPaths.filter((filePath) => hasExtension(filePath, FORMAT_EXTENSIONS)),
    typecheck: touchedPaths.filter((filePath) => hasExtension(filePath, TYPECHECK_EXTENSIONS)),
  };
}

// oxlint --fix と oxfmt を実行して自動修正する
async function autoFix(projectRoot, targets) {
  if (targets.lint.length > 0) {
    await runCommand(bin(projectRoot, 'oxlint'), ['--fix', ...targets.lint], projectRoot);
  }
  if (targets.format.length > 0) {
    await runCommand(bin(projectRoot, 'oxfmt'), [...targets.format], projectRoot);
  }
}

// 修正後の状態で lint / typecheck を実行し、失敗一覧を返す
async function runChecks(projectRoot, targets) {
  const failures = [];

  if (targets.lint.length > 0) {
    // --format=agent: 出力形式を path:line:col: error rule に固定する
    // （TTY ではフレーム表示になり、数え上げ正規表現が不一致になるため）
    const lint = await runCommand(
      bin(projectRoot, 'oxlint'),
      ['--format=agent', ...targets.lint],
      projectRoot,
    );
    // oxlint の出力形式: "file:line:col: warning rule: msg" / "file:line:col: error rule: msg"
    const text = `${lint.stdout}\n${lint.stderr}`;
    const warnings = (text.match(/: warning /g) ?? []).length;
    const errors = (text.match(/: error /g) ?? []).length;
    // 数え上げで検出できず、かつ exit code が非零の場合はツール障害として失敗扱い
    // （クラッシュや起動失敗がクリーン扱いで通過するのを防ぐ）
    if (warnings + errors > 0 || !lint.ok) {
      failures.push(formatLintFailure(errors, warnings, lint));
    }
  }

  if (targets.typecheck.length > 0) {
    const typecheck = await runCommand(
      'node',
      ['scripts/typecheck-staged.mjs', ...targets.typecheck],
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

function formatLintFailure(errors, warnings, result) {
  const output = truncateOutput(`${result.stdout}\n${result.stderr}`.trim());
  return `## Lint (oxlint): ${errors} error(s), ${warnings} warning(s)\n${output || '(no output)'}`;
}

function numberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
