/*
 * FEATURES: S-source
 * PURPOSE: コメント状態 (state / draft) の純粋な操作を提供する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
// look-workshop 状態層。DOM に触れず、UI 更新が必要かどうかのフラグだけを返す。

import { hasText } from './util.js';

export function discardEmptyDraft(ctx) {
  if (ctx.draft && !hasText(ctx.draft)) {
    ctx.draft = null;
  }
}

export function pruneEmptyFromState(ctx) {
  for (const [aid, c] of ctx.state.entries()) {
    if (!hasText(c)) {
      ctx.state.delete(aid);
    }
  }
}

export function committedList(ctx) {
  return Array.from(ctx.state.values()).filter(hasText);
}

/** 下書きに文字が入ったら state へ昇格。空に戻したら state から外す。戻り値は確定状態の変化有無 */
export function syncDraftOrState(ctx, entry) {
  const { aid, selector } = entry;
  const wasCommitted = ctx.state.has(aid) && hasText(ctx.state.get(aid));
  const nowCommitted = hasText(entry);

  if (nowCommitted) {
    ctx.state.set(aid, entry);
    if (ctx.draft && ctx.draft.aid === aid) {
      ctx.draft = null;
    }
  } else {
    ctx.state.delete(aid);
    ctx.draft = { aid, selector, text: '' };
  }

  return wasCommitted !== nowCommitted;
}

export function removeComment(ctx, aid) {
  if (ctx.draft && ctx.draft.aid === aid) {
    ctx.draft = null;
  }
  ctx.state.delete(aid);
}
