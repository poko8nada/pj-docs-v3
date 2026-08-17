/*
 * FEATURES: S-source
 * PURPOSE: パネル層。FAB・backdrop・右ドロワーとコメント行の描画を担う (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
// look-workshop パネル層。クロームの DOM 生成とパネル開閉、コメント行の描画を担う。

import { cssEscape, hasText } from './util.js';
import {
  discardEmptyDraft,
  pruneEmptyFromState,
  syncDraftOrState,
  committedList,
  removeComment,
} from './state.js';
import { saveSoon } from './save.js';
import { renderMarkers } from './markers.js';

export function createBackdrop(ctx) {
  const el = document.createElement('div');
  el.className = 'vl-backdrop';
  el.setAttribute('aria-hidden', 'true');
  el.addEventListener('click', () => {
    closePanel(ctx);
  });
  return el;
}

export function createFab(ctx) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'vl-fab';
  btn.title = 'Comments';
  btn.setAttribute('aria-label', 'Comments');
  btn.textContent = '💬';
  const count = document.createElement('span');
  count.className = 'vl-fab-count';
  count.textContent = '0';
  btn.append(count);
  btn.addEventListener('click', () => {
    togglePanel(ctx);
  });
  return btn;
}

export function createPanel(ctx) {
  const aside = document.createElement('aside');
  aside.id = 'meta';
  aside.setAttribute('aria-label', 'Comments');
  const h = document.createElement('div');
  h.className = 'vl-h';
  const title = document.createElement('span');
  title.textContent = 'Comments';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'vl-close';
  close.title = 'close';
  close.setAttribute('aria-label', 'Close comments');
  close.textContent = '×';
  close.addEventListener('click', () => {
    closePanel(ctx);
  });
  h.append(title, close);
  aside.append(h);
  const list = document.createElement('div');
  list.className = 'vl-list';
  aside.append(list);
  return aside;
}

export function togglePanel(ctx) {
  if (ctx.meta.classList.contains('vl-open')) {
    closePanel(ctx);
  } else {
    openPanel(ctx);
  }
}

export function openPanel(ctx) {
  ctx.meta.classList.add('vl-open');
  ctx.backdrop.classList.add('vl-open');
  ctx.fab.dataset.open = 'true';
  ctx.backdrop.setAttribute('aria-hidden', 'false');
}

export function closePanel(ctx) {
  discardEmptyDraft(ctx);
  pruneEmptyFromState(ctx);
  ctx.meta.classList.remove('vl-open');
  ctx.backdrop.classList.remove('vl-open');
  ctx.fab.dataset.open = 'false';
  ctx.backdrop.setAttribute('aria-hidden', 'true');
  renderRows(ctx);
  renderMarkers(ctx);
  updateFabCount(ctx);
  saveSoon(ctx);
}

export function focusRow(ctx, aid) {
  const row = ctx.meta.querySelector('.vl-row[data-aid="' + cssEscape(aid) + '"]');
  if (row) {
    const ta = row.querySelector('textarea');
    if (ta) {
      ta.focus();
    }
  }
}

export function renderRows(ctx) {
  const list = ctx.meta.querySelector('.vl-list');
  list.innerHTML = '';
  const committed = committedList(ctx);
  const showDraft = ctx.draft && !ctx.state.has(ctx.draft.aid);

  if (committed.length === 0 && !showDraft) {
    const empty = document.createElement('div');
    empty.className = 'vl-empty';
    empty.textContent =
      '要素をクリックして下書きを開き、文字を入れるとコメントになります。空のまま閉じると付きません。';
    list.append(empty);
    return;
  }

  if (showDraft) {
    list.append(buildRow(ctx, ctx.draft, true));
  }
  for (const c of committed) {
    list.append(buildRow(ctx, c, false));
  }
}

export function updateFabCount(ctx) {
  const count = ctx.fab.querySelector('.vl-fab-count');
  if (count) {
    count.textContent = String(committedList(ctx).length);
  }
}

// 行の表示状態（draft クラスとラベル）を現在の確定状態に合わせる
function updateRowState(rowEl, aid, committed) {
  rowEl.classList.toggle('vl-row-draft', !committed);
  const label = rowEl.querySelector('.vl-aid');
  if (label) {
    label.textContent = committed ? aid : aid + ' (draft)';
  }
}

function buildRow(ctx, c, isDraft) {
  const row = document.createElement('div');
  row.className = 'vl-row' + (isDraft ? ' vl-row-draft' : '');
  row.dataset.aid = c.aid;

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'vl-del';
  del.title = 'delete';
  del.textContent = '×';
  del.addEventListener('click', () => {
    removeComment(ctx, c.aid);
    renderRows(ctx);
    renderMarkers(ctx);
    updateFabCount(ctx);
    saveSoon(ctx);
  });
  row.append(del);

  const label = document.createElement('div');
  label.className = 'vl-aid';
  label.textContent = isDraft ? c.aid + ' (draft)' : c.aid;
  row.append(label);

  const ta = document.createElement('textarea');
  ta.className = 'vl-text';
  ta.value = c.text || '';
  ta.placeholder = isDraft
    ? 'コメントを書く…（空のまま閉じると付きません）'
    : 'comment…  (⌘/Ctrl + Enter で保存して閉じる)';

  // 入力のたびに状態を同期し、確定状態が変わったときだけ UI を更新する
  const syncFromTextarea = () => {
    const entry = { aid: c.aid, selector: c.selector, text: ta.value };
    const committedChanged = syncDraftOrState(ctx, entry);
    updateRowState(row, c.aid, hasText(entry));
    if (committedChanged) {
      renderMarkers(ctx);
      updateFabCount(ctx);
    }
    saveSoon(ctx);
  };
  ta.addEventListener('input', syncFromTextarea);
  ta.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      syncFromTextarea();
      if (hasText({ text: ta.value })) {
        closePanel(ctx);
      }
    }
  });
  row.append(ta);

  return row;
}
