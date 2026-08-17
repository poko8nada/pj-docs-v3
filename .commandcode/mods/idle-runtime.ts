/*
 * FEATURES: H-chain
 * PURPOSE: mod エントリ。編集ファイルの追跡とターン末チェーンの起動、フォローアップ送信を配線する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

import type { ModApi } from '@commandcode/harness';
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
  prompt: (text: string) => Promise<void>,
  log: CheckContext['log'],
  issueCycleCounts: Map<string, number>,
) {
  // 編集なしのターン末はクリーンサイクルとしてカウンタをリセットする
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
    await prompt(text);
  }
  // 送信が完了して初めてサイクルを消費する（送信失敗時はカウントしない）
  issueCycleCounts.set(ctx.sessionID, count + 1);
}

// oxlint-disable-next-line no-default-export -- mod ローダーは default export を要求する
export default function (cmd: ModApi): void {
  // cmd.cwd がプロジェクトルート
  const root = path.resolve(cmd.cwd);
  const tracker = createFileTracker();

  // ログ出力（warn / error のみ TUI に通知する）
  const log: CheckContext['log'] = async (service, level, message, extra) => {
    if (level === 'warn' || level === 'error') {
      const suffix = extra ? ' ' + JSON.stringify(extra) : '';
      cmd.ui.notify(`[${service}] ${message}${suffix}`);
    }
  };

  // コマンドを実行し、exitCode / stdout / stderr を返す（失敗しても throw しない）
  const run: CheckContext['run'] = async (cmdArgs, cwd) => {
    try {
      const [command, ...args] = cmdArgs;
      const result = await cmd.exec({ command, args, cwd });
      return { exitCode: result.code, stdout: result.stdout, stderr: result.stderr };
    } catch (error) {
      return { exitCode: 1, stdout: '', stderr: String(error) };
    }
  };

  // フォローアップメッセージを送信する（run が止まるタイミングで配信される）
  const prompt = async (text: string) => {
    cmd.queueMessage({ content: text, deliverAs: 'follow-up' });
  };

  const issueCycleCounts = new Map<string, number>();

  // 編集ツールの実行後にファイルを記録する
  cmd.hooks({
    afterToolCall: async ({ toolName, input }) => {
      if (toolName !== 'edit_file' && toolName !== 'write_file') {
        return undefined;
      }
      const filePath = typeof input.file_path === 'string' ? input.file_path : '';
      if (!filePath) {
        return undefined;
      }

      const abs = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
      if (!isInsideRoot(root, abs)) {
        return undefined;
      }
      tracker.add('session', abs);
      return undefined;
    },
  });

  // ターン終了時にチェーンを直列実行する
  // （quality → drift の順。書込系を先に、検出系は確定状態に対して行う）
  cmd.on('turn_end', async (data) => {
    // イベントペイロードに sessionId があれば使う（無ければ単一セッション前提の既定値）
    const sessionID =
      typeof data === 'object' && data !== null && 'sessionId' in data
        ? typeof data.sessionId === 'string'
          ? data.sessionId
          : 'session'
        : 'session';
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
  });
}
