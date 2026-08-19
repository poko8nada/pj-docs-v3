/*
 * FEATURES: H-state
 * PURPOSE: JSONL ログの末尾からイベントを読み取る (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

import { open } from 'node:fs/promises';
import { LOG_PATH as DEFAULT_LOG_PATH } from '../lib/paths.mjs';

/** verify 用。末尾から読む JSONL 行数の上限。 */
const MAX_READ_LOG_LINES = 5_000;

/**
 * 計測時の平均行サイズ（tool_input 込み）。末尾チャンクの読み込み量推定に使う。
 * 838 行・約 1MB の実測では 1 行あたり約 1,176 バイト。
 */
const ESTIMATED_BYTES_PER_LINE = 1_200;

/**
 * JSONL 1行をイベントオブジェクトへ変換する。
 */
export function parseLogLine(line) {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * セッションログ（JSONL）の末尾から読み込む。
 *
 * 性能目安（Node.js / このリポジトリで計測）:
 * - 838 行・約 1MB を全文 read + parse: 約 3ms
 * - 20,000 行・約 22MB を全文 JSON.parse: 約 40ms（prune 上限時の最悪付近）
 * - 末尾 5,000 行に抑えると、parse 対象はおおよそ 6MB・十数 ms 以下を想定
 *
 * verify の「直近で触ったファイル」用途向け。それより古い行は意図的に捨てる。
 */
export async function readLogEvents(logPath = DEFAULT_LOG_PATH, options = {}) {
  const maxLines = options.maxLines ?? MAX_READ_LOG_LINES;
  const lines = await readTailLines(logPath, maxLines);
  return lines.map((line) => parseLogLine(line)).filter(Boolean);
}

async function readTailLines(logPath, maxLines) {
  let handle;

  try {
    handle = await open(logPath, 'r');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  try {
    const { size } = await handle.stat();
    if (size === 0) {
      return [];
    }

    const chunkBytes = Math.min(size, maxLines * ESTIMATED_BYTES_PER_LINE + 4096);
    const start = size - chunkBytes;
    const buffer = Buffer.alloc(chunkBytes);
    await handle.read(buffer, 0, chunkBytes, start);

    let content = buffer.toString('utf8');
    if (start > 0) {
      const firstNewline = content.indexOf('\n');
      if (firstNewline !== -1) {
        content = content.slice(firstNewline + 1);
      }
    }

    const lines = content.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length <= maxLines) {
      return lines;
    }
    return lines.slice(-maxLines);
  } finally {
    await handle.close();
  }
}
