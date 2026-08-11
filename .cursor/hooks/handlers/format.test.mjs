import { describe, expect, it } from 'vitest';
import { extractEditedPaths } from './format.mjs';

describe('extractEditedPaths', () => {
  it('extracts afterFileEdit paths', () => {
    expect(extractEditedPaths('afterFileEdit', { file_path: '/project/src/App.tsx' })).toEqual([
      '/project/src/App.tsx',
    ]);
  });

  it('extracts postToolUse Write paths', () => {
    expect(
      extractEditedPaths('postToolUse', {
        tool_name: 'Write',
        tool_input: { path: '/project/index.html' },
      }),
    ).toEqual(['/project/index.html']);
  });

  it('ignores non-write tools', () => {
    expect(
      extractEditedPaths('postToolUse', {
        tool_name: 'Read',
        tool_input: { path: '/project/index.html' },
      }),
    ).toEqual([]);
  });
});
