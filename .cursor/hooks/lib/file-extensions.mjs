import { extname } from 'node:path';

const CODE_EXTENSIONS = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'];
const MARKUP_EXTENSIONS = ['html', 'htm', 'xhtml'];
const STYLE_EXTENSIONS = ['css', 'scss', 'sass', 'less'];
const DOC_EXTENSIONS = ['md', 'mdx'];
const DATA_EXTENSIONS = ['json', 'jsonc'];

/** oxfmt で整形する拡張子 */
export const FORMAT_EXTENSIONS = new Set([
  ...CODE_EXTENSIONS,
  ...MARKUP_EXTENSIONS,
  ...STYLE_EXTENSIONS,
  ...DOC_EXTENSIONS,
  ...DATA_EXTENSIONS,
]);

/** oxlint で検査する拡張子（JS/TS 系） */
export const OXLINT_EXTENSIONS = new Set(CODE_EXTENSIONS);

/** stop 時に oxfmt --check する拡張子（HTML/CSS 系を含む） */
export const FORMAT_CHECK_EXTENSIONS = new Set([
  ...MARKUP_EXTENSIONS,
  ...STYLE_EXTENSIONS,
  ...DOC_EXTENSIONS,
  ...DATA_EXTENSIONS,
]);

/** tsc-files で型検査する拡張子 */
export const TYPECHECK_EXTENSIONS = new Set(['ts', 'tsx']);

export function extensionOf(filePath) {
  return extname(filePath).slice(1).toLowerCase();
}

export function hasExtension(filePath, extensions) {
  const extension = extensionOf(filePath);
  return extension.length > 0 && extensions.has(extension);
}
