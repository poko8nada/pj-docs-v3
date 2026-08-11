import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const MAX_OUTPUT_CHARS = 8_000;

/**
 * 子プロセスを実行し、終了コードと出力を返す。
 */
export async function runCommand(command, args, cwd) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd,
      maxBuffer: 1024 * 1024,
      env: process.env,
    });

    return {
      ok: true,
      code: 0,
      stdout: stdout ?? '',
      stderr: stderr ?? '',
    };
  } catch (error) {
    const execError = isExecError(error) ? error : {};

    return {
      ok: false,
      code: typeof execError.code === 'number' ? execError.code : 1,
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
    };
  }
}

/**
 * @param {unknown} error
 * @returns {error is { stdout?: string; stderr?: string; code?: number }}
 */
function isExecError(error) {
  return typeof error === 'object' && error !== null;
}

export function truncateOutput(text) {
  if (text.length <= MAX_OUTPUT_CHARS) {
    return text;
  }
  return `${text.slice(0, MAX_OUTPUT_CHARS)}\n... (truncated)`;
}
