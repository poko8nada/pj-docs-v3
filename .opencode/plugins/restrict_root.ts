/*
 * FEATURES: H-gate
 * PURPOSE: プロジェクトルート外のファイルアクセスを制限し、read ツールのみ追加の外部パスを許可する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
import type { Plugin } from '@opencode-ai/plugin';
import * as os from 'node:os';
import * as path from 'node:path';
import { HOME_DIRS } from '../../constants/index.mjs';

// bash command から絶対 path を抽出（heuristic）
//  /path or ~/path で始まり、空白/引用/特殊文字以外が続くものを path とみなす
// heredoc の中身、quoted strings の中身はスキップする
const extractPathsFromCommand = (command: string): string[] => {
  // heredoc を除去（<<EOF, <<"EOF", <<'EOF', <<-EOF 対応）
  let cleaned = command.replace(/<<-?\s*["']?(\w+)["']?[\s\S]*?\n\s*\1/g, '');
  // quoted strings を除去（-m "..." などの誤検出を防ぐ）
  cleaned = cleaned.replace(/(["'])(?:\\.|(?!\1)[^\\])*\1/g, '');
  const paths: string[] = [];
  const matches = cleaned.matchAll(/(?:^|[\s>|&;"'])([/~][^\s'"<>|&;]+)/g);
  for (const m of matches) {
    const p = m[1];
    if (p && !p.startsWith('//')) {
      paths.push(p);
    }
  }
  return paths;
};

export const RestrictRootPlugin: Plugin = async ({ worktree, directory }) => {
  // directory（プロジェクトディレクトリ）を優先し、未設定なら worktree にフォールバック
  // worktree が "/" の環境でもプロジェクト単位の制限を維持するため
  const root = path.resolve(directory || worktree);

  // プロジェクトルート以外で許可する外部パス（例外）
  // $XDG_CONFIG_HOME を優先、未設定なら ~/.config にフォールバック
  const xdgConfigHome = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
  const allowedExternalPaths = [
    path.join(xdgConfigHome, HOME_DIRS.opencode),
    // Cursor、CommandCodeのグローバル設定（スキル等）を読み取れるようにする
    path.join(os.homedir(), HOME_DIRS.cursor),
    path.join(os.homedir(), HOME_DIRS.commandcode),
  ];

  // read ツールのみ許可する外部パス（例: opencode のセッションログでサブエージェントの実行内容を確認する用途）
  // bash や write では引き続き制限されるため、制限が緩くならない
  const xdgDataHome = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share');
  const allowedReadPaths = [path.join(xdgDataHome, HOME_DIRS.opencode)];

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

  const checkPath = (filePath: string, isRead: boolean) => {
    const normalized = normalize(filePath);
    if (!isInsideProject(normalized) && !isInsideAllowedExternal(normalized)) {
      // read ツールのみ allowedReadPaths 配下を許可する
      if (!(isRead && isInsideAllowedRead(normalized))) {
        throw new Error(
          '[restrict-root] Access outside the project root directory is prohibited: ' + filePath,
        );
      }
    }
  };

  return {
    'tool.execute.before': async (input, output) => {
      // bash tool: command を parse して path を check
      if (input.tool === 'bash' || input.tool === 'shell') {
        const command = String(output?.args?.command ?? '');
        for (const p of extractPathsFromCommand(command)) {
          if (p.startsWith('-')) {
            continue;
          }
          if (p === '/dev/null') {
            continue;
          }
          checkPath(p, false);
        }
        return;
      }

      // file tool (edit, write, apply_patch, read 等): fileArg を check
      const fileArg: string | undefined =
        output?.args?.filePath ?? output?.args?.path ?? output?.args?.file ?? undefined;

      if (!fileArg) {
        return;
      }
      // read ツールのみ allowedReadPaths 配下を許可する（その他のツールは一律制限）
      checkPath(fileArg, input.tool === 'read');
    },
  };
};
