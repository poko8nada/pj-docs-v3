import { describe, expect, it } from 'vitest';
import { createFileTracker, isInsideRoot } from './track-files';

describe('isInsideRoot', () => {
  it('returns true for files inside the root', () => {
    expect(isInsideRoot('/proj', '/proj/a.ts')).toBe(true);
    expect(isInsideRoot('/proj', '/proj/sub/a.ts')).toBe(true);
    expect(isInsideRoot('/proj', '/proj')).toBe(true);
  });

  it('returns false for files outside the root', () => {
    expect(isInsideRoot('/proj', '/other/a.ts')).toBe(false);
    expect(isInsideRoot('/proj', '/proj2/a.ts')).toBe(false);
  });
});

describe('createFileTracker', () => {
  it('accumulates files per session and takes them out on read', () => {
    const tracker = createFileTracker();
    tracker.add('s1', '/proj/a.ts');
    tracker.add('s1', '/proj/b.ts');
    tracker.add('s2', '/proj/c.ts');

    expect(tracker.take('s1')).toEqual(['/proj/a.ts', '/proj/b.ts']);
    // take 後はクリアされる
    expect(tracker.take('s1')).toEqual([]);
    expect(tracker.take('s2')).toEqual(['/proj/c.ts']);
  });

  it('deduplicates repeated adds of the same file', () => {
    const tracker = createFileTracker();
    tracker.add('s1', '/proj/a.ts');
    tracker.add('s1', '/proj/a.ts');
    expect(tracker.take('s1')).toEqual(['/proj/a.ts']);
  });
});
