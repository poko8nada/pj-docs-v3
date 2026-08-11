import { isAbsolute, relative, resolve } from 'node:path';

export function isAllowedPath(filePath, projectRoot, cursorHome) {
  const resolved = resolvePath(filePath, projectRoot);
  const roots = [projectRoot, cursorHome].map((root) => resolve(root));

  return roots.some((root) => isInsideRoot(root, resolved));
}

/** lint / format / typecheck の対象はプロジェクトルート内のみ */
export function isProjectPath(filePath, projectRoot) {
  const resolved = resolvePath(filePath, projectRoot);
  return isInsideRoot(resolve(projectRoot), resolved);
}

export function filterProjectPaths(paths, projectRoot) {
  return paths.filter((filePath) => isProjectPath(filePath, projectRoot));
}

function resolvePath(filePath, base) {
  return isAbsolute(filePath) ? resolve(filePath) : resolve(base, filePath);
}

function isInsideRoot(root, target) {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}
