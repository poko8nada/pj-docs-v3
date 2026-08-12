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

  // セッションごとのフォローアップ送信回数（連続ループの上限ガード）
  // 問題が解消しない限り idle → prompt → idle が繰り返されるため、
  // 上限到達後は送信を停止してログに記録する
  const followUpCounts = new Map<string, number>();
  const MAX_FOLLOW_UPS_PER_SESSION = 5;
  const canFollowUp = (sessionID: string) => {
    const count = followUpCounts.get(sessionID) ?? 0;
    if (count >= MAX_FOLLOW_UPS_PER_SESSION) {
      return false;
    }
    followUpCounts.set(sessionID, count + 1);
    return true;
  };

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
      if (files.length === 0) {
        return;
      }

      // フォローアップ送信回数の上限に達したセッションはチェーンを実行しない
      if (!canFollowUp(sessionID)) {
        await log('idle-runtime', 'warn', 'follow-up limit reached, skipping idle chain', {
          sessionID,
        });
        return;
      }

      const ctx: CheckContext = { root, sessionID, files, run, log };
      try {
        await runIdleChain(ctx, [qualityCheck, driftCheck], (text) => prompt(sessionID, text));
      } catch (error) {
        await log('idle-runtime', 'error', 'idle chain failed', {
          sessionID,
          error: String(error),
        });
      }
    },
  };
};
