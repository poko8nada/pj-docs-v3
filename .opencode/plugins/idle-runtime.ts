/*
 * FEATURES: H-chain
 * PURPOSE: プラグインエントリ。編集ファイルの追跡とアイドルチェーンの起動を配線する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

import type { Plugin } from '@opencode-ai/plugin';
import * as path from 'node:path';
import { driftCheck } from './lib/checks/drift';
import { qualityCheck } from './lib/checks/quality';
import { runIdleChain, type CheckContext } from './lib/idle-chain';
import { createFileTracker, isInsideRoot } from './lib/track-files';

// 連続「問題ありサイクル」数の上限（ループガード）。
// チェックは常に実行し、止めるのはプロンプト送信のみ。
// クリーンサイクル（フォローアップ 0 件）で 0 にリセットされるため、
// 異なる問題を順に解決する健全なセッションは制限に達しない。
const MAX_CONSECUTIVE_ISSUE_CYCLES = 3;

// チェーンを実行し、フォローアップを集約してから送信可否を判断する
async function runIdleChainGated(
  ctx: CheckContext,
  prompt: (sessionID: string, text: string) => Promise<void>,
  log: CheckContext['log'],
  issueCycleCounts: Map<string, number>,
) {
  // 編集なしのアイドルはクリーンサイクルとしてカウンタをリセットする
  if (ctx.files.length === 0) {
    issueCycleCounts.set(ctx.sessionID, 0);
    return;
  }

  const collected: string[] = [];
  await runIdleChain(ctx, [qualityCheck, driftCheck], async (text) => {
    collected.push(text);
  });

  // フォローアップなしのクリーンサイクルも同様にリセットする
  if (collected.length === 0) {
    issueCycleCounts.set(ctx.sessionID, 0);
    return;
  }

  const count = issueCycleCounts.get(ctx.sessionID) ?? 0;
  if (count >= MAX_CONSECUTIVE_ISSUE_CYCLES) {
    // 連続で問題が解消しないループを止める。チェック自体は実行され続ける
    await log('idle-runtime', 'warn', 'consecutive issue cycles exceeded, prompting stopped', {
      sessionID: ctx.sessionID,
      count,
    });
    return;
  }
  for (const text of collected) {
    // oxlint-disable-next-line no-await-in-loop -- ストリーム混線を防ぐため直列送信
    await prompt(ctx.sessionID, text);
  }
  // 送信が完了して初めてサイクルを消費する（送信失敗時はカウントしない）
  issueCycleCounts.set(ctx.sessionID, count + 1);
}

export const IdleRuntimePlugin: Plugin = async ({ client, directory, worktree, $ }) => {
  // directory（プロジェクトディレクトリ）を優先し、未設定なら worktree にフォールバック
  const root = path.resolve(directory || worktree);
  const tracker = createFileTracker();

  // ログ出力（opencode のログに統一する）
  const log: CheckContext['log'] = async (service, level, message, extra) => {
    await client.app.log({ body: { service, level, message, extra } });
  };

  // コマンドを実行し、exitCode / stdout / stderr を返す（失敗しても throw しない）
  const run: CheckContext['run'] = async (cmd, cwd) => {
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

  // フォローアップメッセージを送信する
  const prompt = async (sessionID: string, text: string) => {
    await client.session.prompt({
      path: { id: sessionID },
      body: { parts: [{ type: 'text', text }] },
    });
  };

  const issueCycleCounts = new Map<string, number>();

  return {
    // 編集ツールの実行後にファイルを記録する
    'tool.execute.after': async (input) => {
      if (input.tool !== 'edit' && input.tool !== 'write') {
        return;
      }
      const filePath = input.args?.filePath;
      if (typeof filePath !== 'string' || !filePath) {
        return;
      }

      const abs = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
      if (!isInsideRoot(root, abs)) {
        return;
      }
      tracker.add(input.sessionID, abs);
    },

    // セッションがアイドルになったらチェーンを直列実行する
    // （quality → drift の順。書込系を先に、検出系は確定状態に対して行う）
    // opencode 本体は event フックを fire-and-forget で呼ぶため、ここで発生した
    // 未捕捉エラーは unhandled rejection になる。全体を try/catch で包み、
    // エラーをログに記録してプロセスを汚染しないようにする
    event: async ({ event }) => {
      if (event.type !== 'session.idle') {
        return;
      }
      const sessionID = event.properties.sessionID;
      const files = tracker.take(sessionID);

      const ctx: CheckContext = { root, sessionID, files, run, log };
      try {
        await runIdleChainGated(ctx, prompt, log, issueCycleCounts);
      } catch (error) {
        await log('idle-runtime', 'error', 'idle chain failed', {
          sessionID,
          error: String(error),
        });
      }
    },
  };
};
