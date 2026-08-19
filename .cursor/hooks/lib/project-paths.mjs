/*
 * FEATURES: H-transformer
 * PURPOSE: プロジェクト内に存在するファイルパスのみをフィルタリングする (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

import { access } from 'node:fs/promises';
import { filterProjectPaths } from './allowed-paths.mjs';

/**
 * プロジェクト内に存在するファイルだけを返す。
 */
export async function filterExistingProjectPaths(paths, projectRoot) {
  const inProject = filterProjectPaths(paths, projectRoot);
  const results = await Promise.all(
    inProject.map(async (filePath) => {
      try {
        await access(filePath);
        return true;
      } catch {
        // 削除済みなどは検査対象から外す
        return false;
      }
    }),
  );
  return inProject.filter((_, i) => results[i]);
}
