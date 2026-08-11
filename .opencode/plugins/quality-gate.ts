import type { Plugin } from '@opencode-ai/plugin';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---- 設定 ----
// フォーマット実行のデバウンス時間（連続編集をまとめる）
const FORMAT_DEBOUNCE_MS = 500;
// フォローアップメッセージに含める出力の最大行数
const MAX_OUTPUT_LINES = 40;
// oxfmt のフォーマット対象拡張子
const FORMATTABLE_EXT = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.jsonc',
  '.md',
  '.mdx',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.yaml',
  '.yml',
  '.graphql',
  '.gql',
  '.toml',
  '.html',
]);
// lint / typecheck の対象拡張子
const CHECKABLE_EXT = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
// 専用 tsconfig を持つディレクトリ（.opencode 配下は別 tsconfig で型チェックする）
const OPENCODE_DIR = '.opencode';

// ---- セッションごとの状態 ----
interface SessionState {
  files: Set<string>; // 触ったファイル（絶対パス）
  formatTimer: ReturnType<typeof setTimeout> | null; // フォーマットのデバウンスタイマー
  followUpSent: boolean; // フォローアップ送信済み（1セッションにつき1回のみ）
}

const sessions = new Map<string, SessionState>();

const getSessionState = (sessionID: string): SessionState => {
  let state = sessions.get(sessionID);
  if (!state) {
    state = { files: new Set(), formatTimer: null, followUpSent: false };
    sessions.set(sessionID, state);
  }
  return state;
};

export const QualityGatePlugin: Plugin = async ({ client, directory, worktree, $ }) => {
  // directory（プロジェクトディレクトリ）を優先し、未設定なら worktree にフォールバック
  const root = path.resolve(directory || worktree);

  // node_modules/.bin 配下の実行ファイル（pnpm 環境でも symlink 経由で直接実行できる）
  const bin = (name: string) => path.join(root, 'node_modules', '.bin', name);
  // ツールがインストールされていない場合はスキップする（フォールバック）
  const hasTool = (name: string) => fs.existsSync(bin(name));

  // ログ出力（opencode のログに統一する）
  const log = async (
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    extra?: Record<string, unknown>,
  ) => {
    await client.app.log({ body: { service: 'quality-gate', level, message, extra } });
  };

  // コマンドを実行し、exitCode / stdout / stderr を返す（失敗しても throw しない）
  const run = async (cmd: string[], cwd: string) => {
    try {
      const result = await $`${cmd}`.cwd(cwd).nothrow().quiet();
      return {
        exitCode: result.exitCode,
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
      };
    } catch (error) {
      return { exitCode: 1, stdout: '', stderr: String(error) };
    }
  };

  // プロジェクトルート内のファイルかどうか（外部ディレクトリの編集は対象外）
  const isInsideRoot = (file: string) => {
    const rel = path.relative(root, file);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  };

  // フォーマッタ（oxfmt）を実行する
  const formatFiles = async (files: string[]) => {
    if (!hasTool('oxfmt')) {
      await log('warn', 'oxfmt is not installed. Skipping format.');
      return;
    }
    // 存在しないファイル・フォーマット対象外の拡張子は除外する
    const targets = files.filter((f) => fs.existsSync(f) && FORMATTABLE_EXT.has(path.extname(f)));
    if (targets.length === 0) {
      return;
    }
    const result = await run([bin('oxfmt'), ...targets], root);
    if (result.exitCode !== 0) {
      await log('warn', 'oxfmt failed', {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(0, 500),
      });
    }
  };

  // リンター（oxlint）を実行し、警告数・エラー数を数える
  const lintFiles = async (files: string[]) => {
    if (!hasTool('oxlint')) {
      await log('warn', 'oxlint is not installed. Skipping lint.');
      return { warnings: 0, errors: 0, output: '' };
    }
    const targets = files.filter((f) => fs.existsSync(f) && CHECKABLE_EXT.has(path.extname(f)));
    if (targets.length === 0) {
      return { warnings: 0, errors: 0, output: '' };
    }
    const result = await run([bin('oxlint'), ...targets], root);
    const text = `${result.stdout}\n${result.stderr}`;
    // oxlint の出力形式: "file:line:col: warning rule: msg" / "file:line:col: error rule: msg"
    const warnings = (text.match(/: warning /g) ?? []).length;
    const errors = (text.match(/: error /g) ?? []).length;
    return { warnings, errors, output: text };
  };

  // リンター（oxlint）の安全な自動修正を適用する（危険な修正は適用しない）
  const lintFixFiles = async (files: string[]) => {
    if (!hasTool('oxlint')) {
      return;
    }
    const targets = files.filter((f) => fs.existsSync(f) && CHECKABLE_EXT.has(path.extname(f)));
    if (targets.length === 0) {
      return;
    }
    const result = await run([bin('oxlint'), '--fix', ...targets], root);
    if (result.exitCode !== 0) {
      await log('warn', 'oxlint --fix failed', {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(0, 500),
      });
    }
  };

  // 型チェック（tsc）を実行する。.opencode 配下は専用 tsconfig を使う
  const typecheckFiles = async (files: string[]) => {
    if (!hasTool('tsc')) {
      await log('warn', 'tsc is not installed. Skipping typecheck.');
      return { errors: 0, output: '' };
    }
    const targets = files.filter((f) => fs.existsSync(f) && CHECKABLE_EXT.has(path.extname(f)));
    if (targets.length === 0) {
      return { errors: 0, output: '' };
    }

    // tsconfig ごとにファイルをグループ化する
    const groups = new Map<string, string[]>();
    for (const file of targets) {
      const rel = path.relative(root, file);
      const tsconfig = rel.startsWith(`${OPENCODE_DIR}${path.sep}`)
        ? path.join(root, OPENCODE_DIR, 'tsconfig.json')
        : path.join(root, 'tsconfig.json');
      if (!fs.existsSync(tsconfig)) {
        continue;
      }
      groups.set(tsconfig, [...(groups.get(tsconfig) ?? []), file]);
    }

    // 一時 tsconfig を extends 元と同じディレクトリに置く
    // （types や relative パスの解決が tsconfig の位置基準になるため）
    const runTypecheckGroup = async (tsconfig: string, groupFiles: string[]) => {
      const configDir = path.dirname(tsconfig);
      const tmp = path.join(
        configDir,
        `.qg-tsconfig-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
      );
      const config = JSON.stringify(
        {
          extends: './tsconfig.json',
          files: groupFiles.map((f) => path.relative(configDir, f)),
          include: [],
        },
        null,
        2,
      );
      await fs.promises.writeFile(tmp, config);
      try {
        const result = await run([bin('tsc'), '-p', tmp, '--noEmit'], root);
        const text = `${result.stdout}\n${result.stderr}`;
        // tsc の出力形式: "file(line,col): error TSxxxx: msg"
        return { errors: (text.match(/error TS/g) ?? []).length, output: text };
      } finally {
        await fs.promises.rm(tmp, { force: true });
      }
    };

    let errors = 0;
    let output = '';
    for (const [tsconfig, groupFiles] of groups) {
      // oxlint-disable-next-line no-await-in-loop -- tsc はグループ毎に直列実行（リソース競合回避）
      const result = await runTypecheckGroup(tsconfig, groupFiles);
      errors += result.errors;
      output += result.output;
    }
    return { errors, output };
  };

  // 出力を最大行数に切り詰める
  const truncate = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length <= MAX_OUTPUT_LINES) {
      return text.trim();
    }
    return [
      ...lines.slice(0, MAX_OUTPUT_LINES),
      `... and ${lines.length - MAX_OUTPUT_LINES} more lines`,
    ].join('\n');
  };

  // フォローアップメッセージを送信する（1セッションにつき1回のみ）
  const sendFollowUp = async (
    sessionID: string,
    files: string[],
    lint: { warnings: number; errors: number; output: string },
    tsc: { errors: number; output: string },
  ) => {
    const lines = [
      '[quality-gate] Static analysis found issues in the files you modified.',
      '',
      `Checked files: ${files.map((f) => path.relative(root, f)).join(', ')}`,
      '',
    ];
    if (lint.warnings + lint.errors > 0) {
      lines.push(`## Lint (oxlint): ${lint.errors} error(s), ${lint.warnings} warning(s)`);
      lines.push(truncate(lint.output));
      lines.push('');
    }
    if (tsc.errors > 0) {
      lines.push(`## Typecheck (tsc): ${tsc.errors} error(s)`);
      lines.push(truncate(tsc.output));
    }
    lines.push('## Instructions');
    lines.push('- Errors: fix them immediately.');
    lines.push(
      "- Warnings: propose to the user how to handle each one (fix / inline-disable with a reason / leave as-is). Do not fix warnings without the user's agreement.",
    );
    await client.session.prompt({
      path: { id: sessionID },
      body: { parts: [{ type: 'text', text: lines.join('\n') }] },
    });
    await log('info', 'follow-up message sent', { sessionID });
  };

  // アイドル時のチェック処理（自動修正 → フォーマット → lint → typecheck → 必要ならフォローアップ）
  const checkOnIdle = async (sessionID: string) => {
    const state = sessions.get(sessionID);
    if (!state || state.files.size === 0) {
      return;
    }

    // 保留中のフォーマットを先に実行する（lint が整形後のコードを見るため）
    if (state.formatTimer) {
      clearTimeout(state.formatTimer);
      state.formatTimer = null;
      await formatFiles([...state.files]);
    }

    const files = [...state.files];

    // 安全な自動修正を適用してから再フォーマットする
    // （curly 等の修正結果を oxfmt が正規化するため、fix → format の順）
    await lintFixFiles(files);
    await formatFiles(files);

    const lint = await lintFiles(files);
    const tsc = await typecheckFiles(files);

    const hasIssues = lint.warnings + lint.errors > 0 || tsc.errors > 0;
    if (hasIssues && !state.followUpSent) {
      state.followUpSent = true;
      await sendFollowUp(sessionID, files, lint, tsc);
    }

    // チェック済みのファイルはクリアする（次の編集から再チェック）
    state.files.clear();
  };

  return {
    // 編集ツールの実行後にファイルを記録し、フォーマットを予約する
    'tool.execute.after': async (input) => {
      if (input.tool !== 'edit' && input.tool !== 'write') {
        return;
      }
      const filePath = input.args?.filePath;
      if (typeof filePath !== 'string' || !filePath) {
        return;
      }

      const abs = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
      if (!isInsideRoot(abs)) {
        return;
      }

      const state = getSessionState(input.sessionID);
      state.files.add(abs);

      // デバウンスしてフォーマットを実行する（連続編集をまとめる）
      if (state.formatTimer) {
        clearTimeout(state.formatTimer);
      }
      state.formatTimer = setTimeout(() => {
        state.formatTimer = null;
        void formatFiles([...state.files]);
      }, FORMAT_DEBOUNCE_MS);
    },

    // セッションがアイドルになったら静的解析を実行する
    event: async ({ event }) => {
      if (event.type === 'session.idle') {
        await checkOnIdle(event.properties.sessionID);
      }
    },
  };
};
