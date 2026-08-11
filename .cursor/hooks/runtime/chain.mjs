import * as format from '../handlers/format.mjs';
import * as guard from '../handlers/guard.mjs';
import * as verify from '../handlers/verify.mjs';

/**
 * フックごとのハンドラチェーン。配列の先頭から順に実行する。
 */
export const HOOK_CHAIN = {
  beforeReadFile: [guard],
  preToolUse: [guard],
  beforeShellExecution: [guard],
  afterFileEdit: [format],
  postToolUse: [format],
  stop: [verify],
};

const ALL_HANDLERS = [guard, format, verify];

const DEFAULT_PERMISSION_HOOKS = new Set([
  'beforeReadFile',
  'preToolUse',
  'beforeShellExecution',
  'beforeMCPExecution',
  'subagentStart',
]);

assertAllHandlersRegistered(ALL_HANDLERS, HOOK_CHAIN);

/**
 * 共通 context を各ハンドラへ渡す。
 * ハンドラが使うフィールドは異なる（未使用のフィールドは無視する）。
 * - input: 今回の hook stdin（guard, format）
 * - snapshot: runtime が loadSnapshot したセッション状態（touchedPaths 等。verify が利用）
 */
export async function runChain(context) {
  const chain = HOOK_CHAIN[context.hookName];
  if (!chain?.length) {
    return { log: undefined, response: defaultResponse(context.hookName) };
  }

  let log;
  let response;

  for (const handler of chain) {
    // oxlint-disable-next-line no-await-in-loop -- ハンドラは前段の結果に依存する逐次チェーン
    const result = await handler.run(context);
    if (!result) {
      continue;
    }

    if (result.log) {
      log = result.log;
    }
    if (result.response !== undefined) {
      response = result.response;
    }
  }

  return {
    log,
    response: response ?? defaultResponse(context.hookName),
  };
}

function defaultResponse(hookName) {
  if (DEFAULT_PERMISSION_HOOKS.has(hookName)) {
    return { permission: 'allow' };
  }

  return { decision: 'allow' };
}

function assertAllHandlersRegistered(allHandlers, hookChain) {
  for (const handler of allHandlers) {
    const used = Object.values(hookChain).some((chain) => chain.includes(handler));
    if (!used) {
      throw new Error(`handler "${handler.name}" is not registered in HOOK_CHAIN`);
    }
  }
}
