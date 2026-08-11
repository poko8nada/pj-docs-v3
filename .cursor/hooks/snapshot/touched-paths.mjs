const WRITE_TOOLS = new Set(['Write', 'StrReplace', 'ApplyPatch', 'EditNotebook']);

/**
 * ログイベントからセッション内に触れたファイルパスを集める。
 */
export function collectTouchedPaths(events) {
  const paths = new Set();

  for (const event of events) {
    if (event?.type !== 'event') {
      continue;
    }

    if (typeof event.file === 'string' && event.file.length > 0) {
      paths.add(event.file);
    }

    if (
      event.hook === 'postToolUse' &&
      typeof event.tool === 'string' &&
      WRITE_TOOLS.has(event.tool)
    ) {
      const input = event.input;
      if (!isRecord(input)) {
        continue;
      }

      for (const path of [
        ...stringPath(input.path),
        ...stringPath(input.file_path),
        ...stringPath(input.target_notebook),
      ]) {
        paths.add(path);
      }
    }
  }

  return [...paths];
}

function stringPath(value) {
  return typeof value === 'string' && value.length > 0 ? [value] : [];
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
