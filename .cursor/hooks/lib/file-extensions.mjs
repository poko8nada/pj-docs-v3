/*
 * FEATURES: H-transformer
 * PURPOSE: 拡張子からツール適用対象を判定するユーティリティを提供する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
import { extname } from 'node:path';
import {
  CODE_EXTENSIONS,
  FORMAT_EXTENSIONS as SHARED_FORMAT_EXTENSIONS,
} from '../../../constants/index.mjs';

// constants はドット付き拡張子、このモジュールはドットなしで扱う
const codeExtensions = new Set(CODE_EXTENSIONS.map((e) => e.slice(1)));
const formatExtensions = new Set(SHARED_FORMAT_EXTENSIONS.map((e) => e.slice(1)));

/** oxfmt で整形する拡張子 */
export const FORMAT_EXTENSIONS = formatExtensions;

/** oxlint で検査する拡張子（JS/TS 系） */
export const OXLINT_EXTENSIONS = codeExtensions;

/** typecheck:staged で型検査する拡張子（opencode の CHECKABLE_EXT に合わせる） */
export const TYPECHECK_EXTENSIONS = codeExtensions;

export function extensionOf(filePath) {
  return extname(filePath).slice(1).toLowerCase();
}

export function hasExtension(filePath, extensions) {
  const extension = extensionOf(filePath);
  return extension.length > 0 && extensions.has(extension);
}
