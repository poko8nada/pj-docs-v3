/*
 * FEATURES: H-state
 * PURPOSE: セッションごとの編集済みファイルを追跡する状態ストアを提供する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

import * as path from 'node:path';

// プロジェクトルート内のファイルかどうか（外部ディレクトリの編集は追跡対象外）
export function isInsideRoot(root: string, file: string): boolean {
  const rel = path.relative(root, file);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// セッションごとの編集ファイル追跡ストア
export function createFileTracker() {
  const sessions = new Map<string, Set<string>>();

  const add = (sessionID: string, file: string) => {
    let files = sessions.get(sessionID);
    if (!files) {
      files = new Set();
      sessions.set(sessionID, files);
    }
    files.add(file);
  };

  // 追跡済みファイルを取り出してクリアする（アイドルチェック実行後に状態をリセットする）
  const take = (sessionID: string): string[] => {
    const files = sessions.get(sessionID) ?? new Set<string>();
    sessions.delete(sessionID);
    return [...files];
  };

  return { add, take };
}
