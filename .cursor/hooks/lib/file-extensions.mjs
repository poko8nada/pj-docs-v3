/*
 * FEATURES: H-transformer
 * PURPOSE: 拡張子からツール適用対象を判定するユーティリティを提供する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
import { extname } from 'node:path';

const CODE_EXTENSIONS = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'];
const MARKUP_EXTENSIONS = ['html', 'htm', 'xhtml'];
const STYLE_EXTENSIONS = ['css', 'scss', 'sass', 'less'];
const DOC_EXTENSIONS = ['md', 'mdx'];
// opencode の FORMATTABLE_EXT に合わせる (toml / yaml / graphql 系を含む)
const DATA_EXTENSIONS = ['json', 'jsonc', 'yaml', 'yml', 'graphql', 'gql', 'toml'];

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

/** stop 時に oxfmt --check する拡張子（js/ts 系以外。lint が担うコードは含まない） */
export const FORMAT_CHECK_EXTENSIONS = new Set([
  ...MARKUP_EXTENSIONS,
  ...STYLE_EXTENSIONS,
  ...DOC_EXTENSIONS,
  ...DATA_EXTENSIONS,
]);

/** typecheck:staged で型検査する拡張子 */
export const TYPECHECK_EXTENSIONS = new Set(['ts', 'tsx']);

export function extensionOf(filePath) {
  return extname(filePath).slice(1).toLowerCase();
}

export function hasExtension(filePath, extensions) {
  const extension = extensionOf(filePath);
  return extension.length > 0 && extensions.has(extension);
}
