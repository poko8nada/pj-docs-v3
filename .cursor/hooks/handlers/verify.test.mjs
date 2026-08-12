import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/run-command.mjs', () => ({
  runCommand: vi.fn().mockResolvedValue({ ok: true, code: 0, stdout: '', stderr: '' }),
  truncateOutput: (text) => text,
}));

import { runCommand } from '../lib/run-command.mjs';
import { run } from './verify.mjs';

const context = (touchedPaths, loopCount = 0) => ({
  hookName: 'stop',
  input: { loop_count: loopCount },
  projectRoot: process.cwd(),
  cursorHome: process.cwd(),
  snapshot: { touchedPaths },
});

describe('verify', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    runCommand.mockResolvedValue({ ok: true, code: 0, stdout: '', stderr: '' });
  });

  it('applies lint --fix and format before checks', async () => {
    const result = await run(context(['src/a.ts', 'index.html']));

    const calls = runCommand.mock.calls.map(([command, args]) => `${command} ${args.join(' ')}`);
    expect(calls).toEqual([
      'pnpm lint --fix src/a.ts',
      'pnpm format src/a.ts index.html',
      'pnpm lint src/a.ts',
      'pnpm format:check index.html',
      'pnpm typecheck:staged src/a.ts',
    ]);
    expect(result).toEqual({ response: {} });
  });

  it('does nothing without touched paths', async () => {
    const result = await run(context([]));

    expect(runCommand).not.toHaveBeenCalled();
    expect(result).toEqual({ response: {} });
  });

  it('returns followup_message when lint fails', async () => {
    runCommand
      .mockResolvedValueOnce({ ok: true, code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ ok: true, code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({
        ok: false,
        code: 2,
        stdout: '',
        stderr: 'src/a.ts:1:1: error no-unused-vars',
      })
      .mockResolvedValueOnce({ ok: true, code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ ok: true, code: 0, stdout: '', stderr: '' });

    const result = await run(context(['src/a.ts', 'index.html']));

    expect(result.response.followup_message).toContain('lint');
  });

  it('stops when loop limit reached', async () => {
    const result = await run(context(['src/a.ts'], 3));

    expect(runCommand).not.toHaveBeenCalled();
    expect(result).toEqual({ response: {} });
  });
});
