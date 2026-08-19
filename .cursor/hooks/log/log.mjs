/*
 * FEATURES: H-reporter
 * PURPOSE: ログイベントの書き込みとチェックポイント管理を行う (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { buildLogEvent } from './build-event.mjs';
import { COUNT_PATH, LOG_DIRECTORY, LOG_PATH } from '../lib/paths.mjs';

export { pruneLogIfNeeded } from './prune.mjs';

const CHECKPOINT_INTERVAL = 100;

export async function logHook(input, hookName, handlerLog) {
  await logEvent(buildLogEvent(input, hookName, handlerLog));
}

export async function logEvent(event) {
  try {
    await mkdir(LOG_DIRECTORY, { recursive: true });
    const record = { type: 'event', timestamp: formatTimestamp(), ...event };
    await appendFile(LOG_PATH, `${JSON.stringify(record)}\n`, 'utf8');
    await writeCheckpointIfNeeded();
  } catch (error) {
    // ログは観測用なので、書き込み失敗をフックの拒否には変換しない。
    process.stderr.write(
      `[cursor-hook:log] ${error instanceof Error ? error.message : String(error)}\n`,
    );
  }
}

async function writeCheckpointIfNeeded() {
  const count = await readCount();
  const nextCount = count + 1;
  await writeFile(COUNT_PATH, `${nextCount}\n`, 'utf8');

  if (nextCount % CHECKPOINT_INTERVAL !== 0) {
    return;
  }

  const checkpoint = {
    type: 'checkpoint',
    timestamp: formatTimestamp(),
    events: nextCount,
  };
  await appendFile(LOG_PATH, `${JSON.stringify(checkpoint)}\n`, 'utf8');
}

function formatTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'short',
    timeStyle: 'medium',
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  // ISO 8601 / RFC 3339。JST は常に +09:00（サマータイムなし）。
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}+09:00`;
}

async function readCount() {
  try {
    const value = await readFile(COUNT_PATH, 'utf8');
    const count = Number.parseInt(value.trim(), 10);
    return Number.isFinite(count) && count >= 0 ? count : 0;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return 0;
    }
    throw error;
  }
}
