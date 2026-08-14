import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/run-command.mjs', () => ({
  runCommand: vi.fn().mockResolvedValue({ ok: true, code: 0, stdout: '', stderr: '' }),
  truncateOutput: (text) => text,
}));

import { runCommand } from '../lib/run-command.mjs';
import { run } from './verify.mjs';

const bin = (name) => join(process.cwd(), 'node_modules', '.bin', name);

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

  it('applies oxlint --fix and oxfmt before checks', async () => {
    const result = await run(context(['src/a.ts', 'index.html']));

    const calls = runCommand.mock.calls.map(([command, args]) => `${command} ${args.join(' ')}`);
    expect(calls).toEqual([
      `${bin('oxlint')} --fix src/a.ts`,
      `${bin('oxfmt')} src/a.ts index.html`,
      `${bin('oxlint')} --format=agent src/a.ts`,
      `node scripts/typecheck-staged.mjs src/a.ts`,
    ]);
    expect(result).toEqual({ response: {} });
  });

  it('does nothing without touched paths', async () => {
    const result = await run(context([]));

    expect(runCommand).not.toHaveBeenCalled();
    expect(result).toEqual({ response: {} });
  });

  it('returns followup_message when lint reports errors', async () => {
    runCommand
      .mockResolvedValueOnce({ ok: true, code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ ok: true, code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({
        ok: true,
        code: 0,
        stdout: 'src/a.ts:1:1: error no-unused-vars [Error]',
        stderr: '',
      });

    const result = await run(context(['src/a.ts']));

    expect(result.response.followup_message).toContain('1 error(s), 0 warning(s)');
  });

  it('returns followup_message when lint reports warnings only', async () => {
    runCommand
      .mockResolvedValueOnce({ ok: true, code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ ok: true, code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({
        ok: true,
        code: 0,
        stdout: 'src/a.ts:1:1: warning no-unused-vars [Warning]',
        stderr: '',
      });

    const result = await run(context(['src/a.ts']));

    expect(result.response.followup_message).toContain('0 error(s), 1 warning(s)');
  });

  it('returns followup_message when typecheck fails', async () => {
    runCommand
      .mockResolvedValueOnce({ ok: true, code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ ok: true, code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ ok: true, code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({
        ok: false,
        code: 2,
        stdout: 'src/a.ts(3,5): error TS2339',
        stderr: '',
      });

    const result = await run(context(['src/a.ts']));

    expect(result.response.followup_message).toContain('typecheck');
  });

  it('returns followup_message when lint crashes with no matching output', async () => {
    runCommand
      .mockResolvedValueOnce({ ok: true, code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ ok: true, code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({
        ok: false,
        code: 1,
        stdout: '',
        stderr: 'oxlint: internal error',
      });

    const result = await run(context(['src/a.ts']));

    expect(result.response.followup_message).toContain('Lint (oxlint): 0 error(s), 0 warning(s)');
  });

  it('stops when loop limit reached', async () => {
    const result = await run(context(['src/a.ts'], 3));

    expect(runCommand).not.toHaveBeenCalled();
    expect(result).toEqual({ response: {} });
  });
});
