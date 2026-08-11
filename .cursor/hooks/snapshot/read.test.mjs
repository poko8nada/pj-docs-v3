import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOG_PATH } from '../lib/paths.mjs';
import { parseLogLine, readLogEvents } from './read.mjs';

describe('parseLogLine', () => {
  it('parses JSONL event records', () => {
    const line = JSON.stringify({
      type: 'event',
      timestamp: '2026-08-07T14:03:07+09:00',
      hook: 'preToolUse',
      tool: 'Grep',
      input: { pattern: 'hooks' },
      sessionId: 'session-a',
    });

    expect(parseLogLine(line)).toEqual({
      type: 'event',
      timestamp: '2026-08-07T14:03:07+09:00',
      hook: 'preToolUse',
      tool: 'Grep',
      input: { pattern: 'hooks' },
      sessionId: 'session-a',
    });
  });

  it('parses JSONL checkpoint records', () => {
    const line = JSON.stringify({
      type: 'checkpoint',
      timestamp: '2026-08-07T14:04:16+09:00',
      events: 100,
    });

    expect(parseLogLine(line)).toEqual({
      type: 'checkpoint',
      timestamp: '2026-08-07T14:04:16+09:00',
      events: 100,
    });
  });
});

describe('readLogEvents', () => {
  it('reads JSONL files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cursor-hook-log-'));
    const logPath = join(directory, 'session.jsonl');
    const records = [
      {
        type: 'event',
        timestamp: '2026-08-07T14:22:03+09:00',
        hook: 'beforeShellExecution',
        command: 'pnpm test',
        cwd: '/project',
        sessionId: 'session-1',
      },
      {
        type: 'checkpoint',
        timestamp: '2026-08-07T14:22:04+09:00',
        events: 100,
      },
    ];

    await writeFile(
      logPath,
      `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
      'utf8',
    );

    expect(await readLogEvents(logPath)).toEqual(records);
  });

  it('reads only the tail up to maxLines', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cursor-hook-log-'));
    const logPath = join(directory, 'session.jsonl');
    const records = Array.from({ length: 10 }, (_, index) => ({
      type: 'event',
      timestamp: '2026-08-07T14:22:03+09:00',
      hook: 'stop',
      sessionId: `line-${index}`,
    }));

    await writeFile(
      logPath,
      `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
      'utf8',
    );

    expect(await readLogEvents(logPath, { maxLines: 3 })).toEqual(records.slice(-3));
  });

  it('reads the live session log when present', async () => {
    const events = await readLogEvents(LOG_PATH);

    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => event.type === 'event' || event.type === 'checkpoint')).toBe(
      true,
    );
  });
});
