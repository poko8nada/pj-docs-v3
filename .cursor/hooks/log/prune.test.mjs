import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pruneLogIfNeeded } from './prune.mjs';

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function makeLine(timestamp, index) {
  return JSON.stringify({
    type: 'event',
    timestamp,
    hook: 'preToolUse',
    tool: 'Read',
    sessionId: `session-${index}`,
  });
}

describe('pruneLogIfNeeded', () => {
  it('does nothing when the file is under the line limit', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cursor-hook-prune-'));
    const logPath = join(directory, 'session.jsonl');
    const lines = [makeLine(daysAgo(10), 1), makeLine(daysAgo(1), 2)];

    await writeFile(logPath, `${lines.join('\n')}\n`, 'utf8');

    expect(await pruneLogIfNeeded(logPath, { maxLines: 3 })).toEqual({
      pruned: false,
      reason: 'under_line_limit',
      lines: 2,
    });
    expect(await readFile(logPath, 'utf8')).toBe(`${lines.join('\n')}\n`);
  });

  it('does nothing when the file exceeds the line limit but has no old lines', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cursor-hook-prune-'));
    const logPath = join(directory, 'session.jsonl');
    const lines = Array.from({ length: 4 }, (_, index) => makeLine(daysAgo(1), index));

    await writeFile(logPath, `${lines.join('\n')}\n`, 'utf8');

    expect(
      await pruneLogIfNeeded(logPath, { maxLines: 3, retentionMs: 7 * 24 * 60 * 60 * 1000 }),
    ).toEqual({
      pruned: false,
      reason: 'no_old_lines',
      lines: 4,
    });
    expect((await readFile(logPath, 'utf8')).split('\n').filter(Boolean)).toHaveLength(4);
  });

  it('removes old lines only when the file exceeds the line limit', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cursor-hook-prune-'));
    const logPath = join(directory, 'session.jsonl');
    const oldLine = makeLine(daysAgo(10), 1);
    const recentLines = Array.from({ length: 3 }, (_, index) => makeLine(daysAgo(1), index + 2));
    const lines = [oldLine, ...recentLines];

    await writeFile(logPath, `${lines.join('\n')}\n`, 'utf8');

    expect(
      await pruneLogIfNeeded(logPath, { maxLines: 3, retentionMs: 7 * 24 * 60 * 60 * 1000 }),
    ).toEqual({
      pruned: true,
      lines: 3,
      removed: 1,
    });

    const kept = (await readFile(logPath, 'utf8')).split('\n').filter(Boolean);
    expect(kept).toHaveLength(3);
    expect(kept).not.toContain(oldLine);
  });
});
