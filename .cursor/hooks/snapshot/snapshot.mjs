import { readLogEvents } from './read.mjs';
import { filterExistingProjectPaths } from '../lib/project-paths.mjs';
import { collectTouchedPaths } from './touched-paths.mjs';

/**
 * ログを読み込み、スナップショットを返す（read + build のファサード）。
 */
export async function loadSnapshot(options = {}) {
  const events = await readLogEvents(options.logPath);
  const snapshot = buildSnapshot(events, options);

  if (options.projectRoot) {
    snapshot.touchedPaths = await filterExistingProjectPaths(
      snapshot.touchedPaths,
      options.projectRoot,
    );
  }

  return snapshot;
}

/**
 * 構造化イベント列からスナップショットを組み立てる。
 * 入力 events は readLogEvents が返す末尾行（上限は read.mjs 参照）まで。
 */
export function buildSnapshot(events, options = {}) {
  const sessionId = options.sessionId;
  const source = Array.isArray(events) ? events : [];

  const sessionEvents = sessionId
    ? source.filter((event) => event.type === 'event' && event.sessionId === sessionId)
    : source.filter((event) => event.type === 'event');

  const checkpoints = source.filter((event) => event.type === 'checkpoint');
  const lastCheckpoint = checkpoints.at(-1);

  return {
    sessionId: sessionId ?? findLatestSessionId(sessionEvents),
    eventCount: sessionEvents.length,
    lastCheckpoint,
    touchedPaths: collectTouchedPaths(sessionEvents),
    events: source,
  };
}

function findLatestSessionId(events) {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];
    if (event.type === 'event' && event.sessionId) {
      return event.sessionId;
    }
  }
  return undefined;
}
