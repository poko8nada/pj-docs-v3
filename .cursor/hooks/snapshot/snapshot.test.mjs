import { describe, expect, it } from 'vitest';
import { buildSnapshot } from './snapshot.mjs';

const sampleEvents = [
  {
    type: 'event',
    timestamp: '2026-08-07T14:03:07+09:00',
    hook: 'preToolUse',
    tool: 'Grep',
    sessionId: 'session-a',
  },
  {
    type: 'checkpoint',
    timestamp: '2026-08-07T14:04:16+09:00',
    events: 100,
  },
  {
    type: 'event',
    timestamp: '2026-08-07T14:04:20+09:00',
    hook: 'postToolUse',
    tool: 'Read',
    sessionId: 'session-b',
  },
];

describe('buildSnapshot', () => {
  it('builds a snapshot from provided events', () => {
    const snapshot = buildSnapshot(sampleEvents);

    expect(snapshot).toEqual({
      sessionId: 'session-b',
      eventCount: 2,
      lastCheckpoint: sampleEvents[1],
      touchedPaths: [],
      events: sampleEvents,
    });
  });

  it('filters by sessionId when provided', () => {
    const snapshot = buildSnapshot(sampleEvents, { sessionId: 'session-a' });

    expect(snapshot.sessionId).toBe('session-a');
    expect(snapshot.eventCount).toBe(1);
    expect(snapshot.touchedPaths).toEqual([]);
    expect(snapshot.events).toEqual(sampleEvents);
  });
});

describe('loadSnapshot', () => {
  it('reads session.jsonl and returns a snapshot', async () => {
    const { loadSnapshot } = await import('./snapshot.mjs');
    const snapshot = await loadSnapshot();

    expect(snapshot.eventCount).toBeGreaterThan(0);
    expect(snapshot.events.length).toBeGreaterThan(0);
  });
});
