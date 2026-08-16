/*
 * FEATURES: S-source
 * PURPOSE: ワークスペースのエントリ。見た目 CSS と dev 専用のコメントクロームを読み込む (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
// look-workshop — エントリ。
// 見た目は index.html（body 配下）。コメント用クロームは dev のみ。
import './look.css';

if (import.meta.env.DEV) {
  await import('./chrome/chrome.css');
  const { initAnnotate } = await import('./chrome/annotate.js');
  const comments = await loadComments();
  initAnnotate({ root: document.body, comments });
}

async function loadComments() {
  try {
    const res = await fetch('/comments');
    if (!res.ok) {
      return [];
    }
    return await res.json();
  } catch {
    return [];
  }
}
