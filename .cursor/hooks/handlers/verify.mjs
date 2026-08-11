import {
  FORMAT_CHECK_EXTENSIONS,
  hasExtension,
  OXLINT_EXTENSIONS,
  TYPECHECK_EXTENSIONS,
} from '../lib/file-extensions.mjs';
import { runCommand, truncateOutput } from '../lib/run-command.mjs';
import { getMissingVerifyTooling } from '../lib/tooling.mjs';

export const name = 'verify';

const DEFAULT_LOOP_LIMIT = 3;
const MACHINE_PREFIX = '[Automated hook message — not from the user]\n\n';

/**
 * ターン末に lint / format-check / typecheck を走らせ、問題があれば followup を返す。
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

  const lintTargets = touchedPaths.filter((filePath) => hasExtension(filePath, OXLINT_EXTENSIONS));
  const formatCheckTargets = touchedPaths.filter((filePath) =>
    hasExtension(filePath, FORMAT_CHECK_EXTENSIONS),
  );
  const typecheckTargets = touchedPaths.filter((filePath) =>
    hasExtension(filePath, TYPECHECK_EXTENSIONS),
  );

  if (
    lintTargets.length === 0 &&
    formatCheckTargets.length === 0 &&
    typecheckTargets.length === 0
  ) {
    return { response: {} };
  }

  const failures = [];

  if (lintTargets.length > 0) {
    const lint = await runCommand('pnpm', ['lint', ...lintTargets], context.projectRoot);
    if (!lint.ok) {
      failures.push(formatFailure('lint', lint));
    }
  }

  if (formatCheckTargets.length > 0) {
    const formatCheck = await runCommand(
      'pnpm',
      ['format:check', ...formatCheckTargets],
      context.projectRoot,
    );
    if (!formatCheck.ok) {
      failures.push(formatFailure('format:check', formatCheck));
    }
  }

  if (typecheckTargets.length > 0) {
    const typecheck = await runCommand(
      'pnpm',
      ['typecheck:staged', ...typecheckTargets],
      context.projectRoot,
    );
    if (!typecheck.ok) {
      failures.push(formatFailure('typecheck', typecheck));
    }
  }

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
