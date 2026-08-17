/*
 * FEATURES: S-source
 * PURPOSE: コメント保存のデバウンスと POST /comments を担う (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
// look-workshop 保存層。state の確定コメントをデバウンス付きで永続化する。

import { pruneEmptyFromState, committedList } from './state.js';

const SAVE_DEBOUNCE_MS = 400;

export function saveSoon(ctx) {
  if (ctx.timer) {
    clearTimeout(ctx.timer);
  }
  ctx.timer = setTimeout(() => {
    void saveNow(ctx);
  }, SAVE_DEBOUNCE_MS);
}

async function saveNow(ctx) {
  if (ctx.timer) {
    clearTimeout(ctx.timer);
    ctx.timer = null;
  }
  pruneEmptyFromState(ctx);
  const payload = JSON.stringify(committedList(ctx));
  try {
    await fetch('/comments', { method: 'POST', body: payload });
  } catch {
    // dev server が落ちている場合は黙って無視。
  }
}
