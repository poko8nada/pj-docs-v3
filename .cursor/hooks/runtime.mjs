import { homedir } from 'node:os';
import { join } from 'node:path';
import { logHook, pruneLogIfNeeded } from './log/log.mjs';
import { runChain } from './runtime/chain.mjs';
import { loadSnapshot } from './snapshot/snapshot.mjs';

const PROJECT_ROOT = process.cwd();
const CURSOR_HOME = join(homedir(), '.cursor');

/** snapshot が必要なフック。ログ読取は runtime のみが担う。 */
const SNAPSHOT_HOOKS = new Set(['stop']);

/**
 * Hook 実行のオーケストレーター。
 */
export async function run(input, hookName) {
  if (hookName === 'sessionStart') {
    await pruneLogIfNeeded();
  }

  const context = await buildContext(input, hookName);
  const { log, response } = await runChain(context);

  await logHook(input, hookName, log);

  return response;
}

async function buildContext(input, hookName) {
  const context = {
    hookName,
    input,
    projectRoot: PROJECT_ROOT,
    cursorHome: CURSOR_HOME,
  };

  if (!SNAPSHOT_HOOKS.has(hookName)) {
    return context;
  }

  const payload = isRecord(input) ? input : {};
  const sessionId = firstString(payload.session_id, payload.sessionId);
  context.snapshot = await loadSnapshot({ sessionId, projectRoot: PROJECT_ROOT });

  return context;
}

function firstString(...values) {
  return values.find((value) => typeof value === 'string' && value.length > 0);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
