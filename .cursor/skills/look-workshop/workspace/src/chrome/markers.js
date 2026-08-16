/*
 * FEATURES: S-source
 * PURPOSE: マーカーとホバー補助線の描画・表示を担う (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
// look-workshop マーカー層。確定コメントの位置にマーカーを置き、ホバー補助線を表示する。

import { isChrome, aidFor, findByAid, canHostMarker } from './util.js';
import { committedList } from './state.js';

export function createHoverOverlay() {
  const box = document.createElement('div');
  box.className = 'vl-hover';
  box.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'vl-hover-label';
  box.append(label);
  return box;
}

export function renderMarkers(ctx) {
  for (const m of ctx.root.querySelectorAll('.vl-marker')) {
    m.remove();
  }
  for (const el of ctx.root.querySelectorAll('.vl-anchored, .vl-anchored-void')) {
    if (isChrome(el)) {
      continue;
    }
    el.classList.remove('vl-anchored', 'vl-anchored-void');
  }

  for (const c of committedList(ctx)) {
    const el = findByAid(c.aid, ctx.root);
    if (!el) {
      continue;
    }
    const pos = getComputedStyle(el).position;
    if (pos === 'static') {
      el.classList.add('vl-anchored');
    }
    if (!canHostMarker(el)) {
      el.classList.add('vl-anchored-void');
      continue;
    }
    const marker = document.createElement('span');
    marker.className = 'vl-marker';
    marker.title = c.aid;
    el.append(marker);
  }
}

export function showHover(ctx, el) {
  if (isChrome(el)) {
    hideHover(ctx);
    return;
  }
  const r = el.getBoundingClientRect();
  ctx.hover.style.display = 'block';
  ctx.hover.style.left = r.left + window.scrollX + 'px';
  ctx.hover.style.top = r.top + window.scrollY + 'px';
  ctx.hover.style.width = r.width + 'px';
  ctx.hover.style.height = r.height + 'px';
  const label = ctx.hover.querySelector('.vl-hover-label');
  if (label) {
    label.textContent = aidFor(el, ctx.root);
  }
}

export function hideHover(ctx) {
  ctx.hover.style.display = 'none';
  ctx.currentHover = null;
}
