/*
 * FEATURES: S-source
 * PURPOSE: 注釈クロームのエントリ。イベント配線と初期化を担う (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
// look-workshop — メタ層（クローム）エントリ。
// クリック→下書き、テキストが入って初めてコメント確定、POST /comments を担う。
// ルートは document.body。クローム自身への操作は除外する。

import { isChrome, hasText, aidFor, cssSelector } from './util.js';
import { discardEmptyDraft } from './state.js';
import {
  createBackdrop,
  createFab,
  createPanel,
  openPanel,
  focusRow,
  renderRows,
  updateFabCount,
} from './panel.js';
import { createHoverOverlay, renderMarkers, showHover, hideHover } from './markers.js';

function bindRootEvents(ctx) {
  ctx.root.addEventListener('click', (e) => {
    if (e.target === ctx.root) {
      return;
    }
    if (isChrome(e.target)) {
      return;
    }
    e.preventDefault();
    const el = e.target;
    const aid = aidFor(el, ctx.root);
    const selector = cssSelector(el, ctx.root);

    discardEmptyDraft(ctx);

    if (ctx.state.has(aid)) {
      ctx.draft = null;
      openPanel(ctx);
      renderRows(ctx);
      focusRow(ctx, aid);
      return;
    }

    ctx.draft = { aid, selector, text: '' };
    openPanel(ctx);
    renderRows(ctx);
    renderMarkers(ctx);
    updateFabCount(ctx);
    focusRow(ctx, aid);
  });

  ctx.root.addEventListener('mouseover', (e) => {
    if (e.target === ctx.root || isChrome(e.target)) {
      hideHover(ctx);
      return;
    }
    ctx.currentHover = e.target;
    showHover(ctx, e.target);
  });
  ctx.root.addEventListener('mouseleave', () => {
    hideHover(ctx);
  });
  window.addEventListener(
    'scroll',
    () => {
      if (ctx.currentHover) {
        showHover(ctx, ctx.currentHover);
      }
    },
    true,
  );
}

export function initAnnotate({ root, comments }) {
  // 確定コメントのみ（テキストあり）。空は載せない。
  const ctx = {
    root,
    state: new Map(),
    draft: null,
    currentHover: null,
    timer: null,
  };
  for (const c of comments) {
    if (!hasText(c)) {
      continue;
    }
    ctx.state.set(c.aid, { aid: c.aid, selector: c.selector || '', text: c.text || '' });
  }

  // クリック直後の下書き。テキストが付くまで state / comments.json に入れない。
  ctx.backdrop = createBackdrop(ctx);
  ctx.fab = createFab(ctx);
  ctx.meta = createPanel(ctx);
  ctx.hover = createHoverOverlay();
  document.body.append(ctx.backdrop, ctx.fab, ctx.meta, ctx.hover);

  renderRows(ctx);
  renderMarkers(ctx);
  updateFabCount(ctx);
  bindRootEvents(ctx);
}
