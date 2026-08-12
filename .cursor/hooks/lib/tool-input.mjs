/*
 * FEATURES: H-transformer
 * PURPOSE: Cursor の tool_input をオブジェクト / JSON 文字列のどちらでも扱えるよう正規化する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
/**
 * Cursor が tool_input をオブジェクトまたは JSON 文字列で渡すため、
 * どちらの形式でも利用できるように正規化する共通ユーティリティ。
 */
export function normalizeToolInput(value) {
  if (isRecord(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
