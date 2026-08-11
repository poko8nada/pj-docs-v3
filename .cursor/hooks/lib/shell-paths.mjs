import { resolve } from 'node:path';

/**
 * shell コマンドから検査対象のパスを抽出する。
 */
export function extractShellPaths(command, cwd, projectRoot) {
  const base = typeof cwd === 'string' && cwd.length > 0 ? cwd : projectRoot;
  const paths = new Set();

  if (typeof cwd === 'string' && cwd.length > 0) {
    paths.add(cwd);
  }

  if (typeof command !== 'string' || command.length === 0) {
    return [...paths];
  }

  for (const match of command.matchAll(/"(\/[^"]+)"/g)) {
    paths.add(match[1]);
  }

  for (const match of command.matchAll(/'(\/[^']+)'/g)) {
    paths.add(match[1]);
  }

  for (const match of command.matchAll(/(?:^|[\s;=])(\/[^\s;|&><'"]+)/g)) {
    paths.add(match[1]);
  }

  for (const match of command.matchAll(/(?:^|\s)((?:\.\.?\/)[^\s;|&><'"]+)/g)) {
    addResolvedPath(paths, match[1], base);
  }

  for (const match of command.matchAll(/\bcd\s+([^\s;|&><]+)/g)) {
    addResolvedPath(paths, match[1], base);
  }

  return [...paths];
}

function addResolvedPath(paths, raw, base) {
  const target = raw.replace(/^['"]|['"]$/g, '');
  if (!target || target === '-') {
    return;
  }

  if (target.startsWith('/')) {
    paths.add(target);
    return;
  }

  paths.add(resolve(base, target));
}
