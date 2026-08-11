import { FORMAT_EXTENSIONS, hasExtension } from '../lib/file-extensions.mjs';
import { filterProjectPaths } from '../lib/allowed-paths.mjs';
import { runCommand } from '../lib/run-command.mjs';
import { hasFormatTooling } from '../lib/tooling.mjs';

export const name = 'format';

const WRITE_TOOLS = new Set(['Write', 'StrReplace', 'ApplyPatch', 'EditNotebook']);

/**
 * 編集直後のファイルを oxfmt で整形する。
 */
export async function run(context) {
  if (!(await hasFormatTooling(context.projectRoot))) {
    return undefined;
  }

  const paths = filterProjectPaths(
    extractEditedPaths(context.hookName, context.input),
    context.projectRoot,
  );
  const targets = paths.filter((filePath) => hasExtension(filePath, FORMAT_EXTENSIONS));
  if (targets.length === 0) {
    return undefined;
  }

  await runCommand('pnpm', ['format', ...targets], context.projectRoot);

  return undefined;
}

/** @internal format 用。stdin から編集パスを取り出す。 */
export function extractEditedPaths(hookName, input) {
  const payload = isRecord(input) ? input : {};

  if (hookName === 'afterFileEdit') {
    return stringPath(payload.file_path);
  }

  if (hookName === 'postToolUse') {
    const toolName = payload.tool_name;
    if (typeof toolName !== 'string' || !WRITE_TOOLS.has(toolName)) {
      return [];
    }

    const toolInput = normalizeToolInput(payload.tool_input);
    if (!toolInput) {
      return [];
    }

    if (toolName === 'EditNotebook') {
      return stringPath(toolInput.target_notebook);
    }

    return [...stringPath(toolInput.path), ...stringPath(toolInput.file_path)];
  }

  return [];
}

function normalizeToolInput(value) {
  if (isRecord(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function stringPath(value) {
  return typeof value === 'string' && value.length > 0 ? [value] : [];
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
