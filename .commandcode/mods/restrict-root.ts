/*
 * FEATURES: H-gate
 * PURPOSE: プロジェクトルート外のファイルアクセスを制限し、read ツールのみ追加の外部パスを許可する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

import type { ModApi } from '@commandcode/harness';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractPathsFromCommand } from './lib/extract-paths';

// oxlint-disable-next-line no-default-export -- mod ローダーは default export を要求する
export default function (cmd: ModApi): void {
  // cmd.cwd がプロジェクトルート。worktree が "/" の環境でもプロジェクト単位の制限を維持する
  const root = path.resolve(cmd.cwd);

  // プロジェクトルート以外で許可する外部パス（例外）
  // $XDG_CONFIG_HOME を優先、未設定なら ~/.config にフォールバック
  const xdgConfigHome = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
  const allowedExternalPaths = [
    path.join(xdgConfigHome, 'opencode'),
    // Cursor、CommandCode のグローバル設定（スキル等）を読み取れるようにする
    path.join(os.homedir(), '.cursor'),
    path.join(os.homedir(), '.commandcode'),
  ];

  // read ツールのみ許可する外部パス（例: opencode のセッションログでサブエージェントの実行内容を確認する用途）
  // bash や write では引き続き制限されるため、制限が緩くならない
  const xdgDataHome = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share');
  const allowedReadPaths = [path.join(xdgDataHome, 'opencode')];

  // ~ をホームディレクトリへ展開し、絶対パスに正規化する
  // path.resolve を使うため、root が "/" の場合も正しく判定できる
  const normalize = (filePath: string) => {
    const expanded =
      filePath === '~'
        ? os.homedir()
        : filePath.startsWith('~/')
          ? path.join(os.homedir(), filePath.slice(2))
          : filePath;
    return path.resolve(expanded.startsWith('/') ? expanded : path.join(root, expanded));
  };

  // path.relative ベースの判定: root が "/" でも正しく動く
  // （従来の startsWith(root + '/') は root が "/" のとき "//" になり全パスが弾かれる）
  const isInsideProject = (normalized: string) => {
    const rel = path.relative(root, normalized);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  };

  const isInsideAllowedExternal = (normalized: string) =>
    allowedExternalPaths.some((p) => normalized === p || normalized.startsWith(p + '/'));

  // read ツール専用の例外判定（allowedReadPaths 配下）
  const isInsideAllowedRead = (normalized: string) =>
    allowedReadPaths.some((p) => normalized === p || normalized.startsWith(p + '/'));

  const checkPath = (filePath: string, isRead: boolean): string | null => {
    const normalized = normalize(filePath);
    if (!isInsideProject(normalized) && !isInsideAllowedExternal(normalized)) {
      // read ツールのみ allowedReadPaths 配下を許可する
      if (!(isRead && isInsideAllowedRead(normalized))) {
        return (
          '[restrict-root] Access outside the project root directory is prohibited: ' + filePath
        );
      }
    }
    return null;
  };

  cmd.hooks({
    beforeToolCall: async ({ toolName, input }) => {
      // shell_command: command を parse して path を check
      if (toolName === 'shell_command') {
        const command = typeof input.command === 'string' ? input.command : '';
        for (const p of extractPathsFromCommand(command)) {
          if (p.startsWith('-')) {
            continue;
          }
          if (p === '/dev/null') {
            continue;
          }
          const err = checkPath(p, false);
          if (err) {
            return { block: true, additionalContext: err };
          }
        }
        return undefined;
      }

      // file tools (edit_file, write_file, read_file 等): file_path を check
      const fileArg: string | undefined =
        typeof input.file_path === 'string'
          ? input.file_path
          : typeof input.path === 'string'
            ? input.path
            : typeof input.file === 'string'
              ? input.file
              : undefined;

      if (!fileArg) {
        return undefined;
      }
      // read ツールのみ allowedReadPaths 配下を許可する（その他のツールは一律制限）
      const err = checkPath(fileArg, toolName === 'read_file');
      if (err) {
        return { block: true, additionalContext: err };
      }
      return undefined;
    },
  });
}
