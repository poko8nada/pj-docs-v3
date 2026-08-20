/*
 * FEATURES: S-source
 * PURPOSE: frontmatter（--- で挟まれた先頭ブロック）の分解とフィールド抽出の共通関数を提供する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

// frontmatter（--- で挟まれた先頭ブロック）を分解する
// 戻り値: { head: フィールド行の文字列（無ければ null）, body: frontmatter 以降の本文 }
export function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) {
    return { head: null, body: text };
  }
  return { head: m[1], body: text.slice(m[0].length) };
}
