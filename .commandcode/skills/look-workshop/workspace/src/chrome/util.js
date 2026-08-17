/*
 * FEATURES: S-source
 * PURPOSE: ワークスペース共通の汎用 DOM ヘルパーを提供する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
// look-workshop 共通ヘルパー。UI と状態から独立した純粋関数のみ。

const CHROME_SEL = '#meta, .vl-fab, .vl-backdrop, .vl-hover, .vl-marker';

export function isChrome(el) {
  return Boolean(el && el.closest && el.closest(CHROME_SEL));
}

export function hasText(c) {
  return Boolean(c && String(c.text || '').trim());
}

// 要素の安定キー。data-aid 優先、無ければ生成セレクタ（fallback・やや脆い）。
export function aidFor(el, root) {
  if (el.dataset && el.dataset.aid) {
    return el.dataset.aid;
  }
  return cssSelector(el, root);
}

export function cssSelector(el, root) {
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1 && node !== root) {
    let part = node.tagName.toLowerCase();
    if (node.id) {
      parts.unshift('#' + node.id);
      break;
    }
    const parent = node.parentElement;
    if (parent) {
      const sibs = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
      if (sibs.length > 1) {
        part += ':nth-of-type(' + (sibs.indexOf(node) + 1) + ')';
      }
    }
    parts.unshift(part);
    node = parent;
  }
  return parts.join(' > ');
}

export function findByAid(aid, root) {
  const matches = root.querySelectorAll('[data-aid="' + cssEscape(aid) + '"]');
  for (const el of matches) {
    if (!isChrome(el)) {
      return el;
    }
  }
  if (!/[\s>#:.]/.test(aid)) {
    return null;
  }
  try {
    const el = root.querySelector(aid);
    if (el && !isChrome(el)) {
      return el;
    }
    return null;
  } catch {
    return null;
  }
}

const VOID_TAGS = new Set([
  'img',
  'input',
  'br',
  'hr',
  'meta',
  'link',
  'area',
  'base',
  'col',
  'embed',
  'source',
  'track',
  'wbr',
]);

export function canHostMarker(el) {
  return el && el.nodeType === 1 && !VOID_TAGS.has(el.tagName.toLowerCase());
}

export function cssEscape(s) {
  return String(s).replace(/["\\]/g, '\\$&');
}
