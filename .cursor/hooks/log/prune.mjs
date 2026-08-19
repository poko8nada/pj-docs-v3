/*
 * FEATURES: H-mutator
 * PURPOSE: ログファイルの行数上限超過時に保持期間を過ぎた行を削除する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

import { readFile, writeFile } from 'node:fs/promises';
import { COUNT_PATH, LOG_PATH } from '../lib/paths.mjs';

const MAX_LOG_LINES = 20_000;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 行数が上限を超えている場合のみ、保持期間を過ぎた行を削除する。
 * どちらか一方の条件だけでは削除しない。
 */
export async function pruneLogIfNeeded(logPath = LOG_PATH, options = {}) {
  const maxLines = options.maxLines ?? MAX_LOG_LINES;
  const retentionMs = options.retentionMs ?? RETENTION_MS;

  let content;
  try {
    content = await readFile(logPath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { pruned: false, reason: 'missing' };
    }
    throw error;
  }

  const lines = content.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length <= maxLines) {
    return { pruned: false, reason: 'under_line_limit', lines: lines.length };
  }

  const cutoff = Date.now() - retentionMs;
  const kept = [];
  let removed = 0;

  for (const line of lines) {
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      kept.push(line);
      continue;
    }

    const parsed = Date.parse(record.timestamp);
    if (Number.isFinite(parsed) && parsed < cutoff) {
      removed++;
      continue;
    }

    kept.push(line);
  }

  if (removed === 0) {
    return { pruned: false, reason: 'no_old_lines', lines: lines.length };
  }

  await writeFile(logPath, kept.length > 0 ? `${kept.join('\n')}\n` : '', 'utf8');

  if (logPath === LOG_PATH) {
    await syncEventCount(kept);
  }

  return { pruned: true, lines: kept.length, removed };
}

async function syncEventCount(lines) {
  let eventCount = 0;

  for (const line of lines) {
    try {
      const record = JSON.parse(line);
      if (record.type === 'event') {
        eventCount++;
      }
    } catch {
      // 壊れた行はカウント対象外。
    }
  }

  await writeFile(COUNT_PATH, `${eventCount}\n`, 'utf8');
}
