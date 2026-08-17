/*
 * FEATURES: H-chain
 * PURPOSE: ターン末のチェックを定義順に直列実行し、フォローアップを集約送信する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

// ---- チェック間で共有するコンテキスト ----

/** コマンド実行結果（失敗しても throw しない） */
export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** 各チェックへ渡すコンテキスト（mod エントリが生成する） */
export interface CheckContext {
  root: string; // プロジェクトルート（絶対パス）
  sessionID: string;
  files: string[]; // 編集済みファイル（絶対パス）
  run: (cmd: string[], cwd: string) => Promise<RunResult>; // コマンド実行
  log: (
    service: string,
    level: LogLevel,
    message: string,
    extra?: Record<string, unknown>,
  ) => Promise<void>;
}

/** ターン末に実行する1つのチェック。フォローアップ本文を返す */
export interface IdleCheck {
  name: string; // ログ用のサービス名
  run: (ctx: CheckContext) => Promise<{ followUps: string[] }>;
}

// チェーンを直列実行する。フォローアップは全チェック完了後にまとめて送る
// （ファイル書込を伴うチェック同士の競合と、プロンプト送信の混線を防ぐ）
export async function runIdleChain(
  ctx: CheckContext,
  checks: IdleCheck[],
  prompt: (text: string) => Promise<void>,
): Promise<void> {
  const followUps: string[] = [];
  for (const check of checks) {
    let result;
    try {
      // oxlint-disable-next-line no-await-in-loop -- 後段は前段の結果に依存する逐次チェーン
      result = await check.run(ctx);
    } catch (error) {
      // 1つのチェックが失敗してもチェーン全体は止めない（fail-open）
      // oxlint-disable-next-line no-await-in-loop -- 失敗記録は逐次でよい
      await ctx.log(check.name, 'error', 'idle check failed', { error: String(error) });
      continue;
    }
    followUps.push(...result.followUps);
  }

  // 全チェック完了後に、チェックの完了順でまとめて送信する
  for (const text of followUps) {
    // oxlint-disable-next-line no-await-in-loop -- ストリーム混線を防ぐため直列送信
    await prompt(text);
  }
}
