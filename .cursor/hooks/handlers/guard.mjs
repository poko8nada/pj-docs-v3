import { isAllowedPath } from '../lib/allowed-paths.mjs';
import { extractShellPaths } from '../lib/shell-paths.mjs';

export const name = 'guard';

const PATH_TOOLS = new Set(['Read', 'Write', 'Grep', 'Glob', 'StrReplace', 'Delete']);

const PERMISSION_HOOKS = new Set([
  'beforeReadFile',
  'preToolUse',
  'beforeShellExecution',
  'beforeMCPExecution',
  'subagentStart',
]);

/**
 * プロジェクトルートと ~/.cursor 以外への読み書きを拒否する。
 */
export async function run(context) {
  const result = evaluate(context);
  if (!result.applies) {
    return undefined;
  }

  const log = {
    handler: name,
    decision: result.decision,
    ...(result.reason ? { reason: result.reason } : {}),
  };

  if (result.decision === 'deny') {
    const reason = result.reason ?? 'Blocked by guard handler.';
    return {
      log,
      response: PERMISSION_HOOKS.has(context.hookName)
        ? {
            permission: 'deny',
            user_message: reason,
            agent_message: reason,
          }
        : { decision: 'allow' },
    };
  }

  return {
    log,
    response: PERMISSION_HOOKS.has(context.hookName)
      ? { permission: 'allow' }
      : { decision: 'allow' },
  };
}

function evaluate({ hookName, input, projectRoot, cursorHome }) {
  const paths = extractPaths(hookName, input, projectRoot);
  if (paths.length === 0) {
    return { applies: false };
  }

  for (const filePath of paths) {
    if (!isAllowedPath(filePath, projectRoot, cursorHome)) {
      return {
        applies: true,
        decision: 'deny',
        reason: `path outside allowed roots: ${filePath}`,
      };
    }
  }

  return { applies: true, decision: 'allow' };
}

function extractPaths(hookName, input, projectRoot) {
  const payload = isRecord(input) ? input : {};

  if (hookName === 'beforeShellExecution') {
    return extractShellPaths(payload.command, payload.cwd, projectRoot);
  }

  if (hookName === 'beforeReadFile') {
    return stringPath(payload.file_path);
  }

  if (hookName === 'preToolUse') {
    const toolName = payload.tool_name;
    if (toolName === 'Shell') {
      const toolInput = normalizeToolInput(payload.tool_input);
      return extractShellPaths(toolInput?.command, toolInput?.cwd ?? payload.cwd, projectRoot);
    }

    if (typeof toolName !== 'string' || !PATH_TOOLS.has(toolName)) {
      return [];
    }

    const toolInput = normalizeToolInput(payload.tool_input);
    return [...stringPath(toolInput?.path), ...stringPath(toolInput?.file_path)];
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
