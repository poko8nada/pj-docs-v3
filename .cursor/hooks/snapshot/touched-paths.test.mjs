import { describe, expect, it } from 'vitest';
import { collectTouchedPaths } from './touched-paths.mjs';

describe('collectTouchedPaths', () => {
  it('collects file paths from log events', () => {
    expect(
      collectTouchedPaths([
        { type: 'event', hook: 'afterFileEdit', file: '/project/a.css' },
        {
          type: 'event',
          hook: 'postToolUse',
          tool: 'StrReplace',
          input: { path: '/project/b.html' },
        },
      ]),
    ).toEqual(['/project/a.css', '/project/b.html']);
  });
});
