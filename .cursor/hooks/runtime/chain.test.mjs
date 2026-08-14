import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../handlers/drift.mjs', () => ({
  name: 'drift',
  run: vi.fn().mockResolvedValue({ response: {} }),
}));

vi.mock('../handlers/verify.mjs', () => ({
  name: 'verify',
  run: vi.fn().mockResolvedValue({ response: {} }),
}));

import * as drift from '../handlers/drift.mjs';
import * as verify from '../handlers/verify.mjs';
import { runChain } from './chain.mjs';

afterEach(() => {
  vi.clearAllMocks();
});

describe('runChain', () => {
  it('returns a default response for unregistered hooks', async () => {
    await expect(
      runChain({
        hookName: 'afterAgentThought',
        input: { session_id: 'session-1' },
        projectRoot: '/project',
        cursorHome: '/project/.cursor',
      }),
    ).resolves.toEqual({
      log: undefined,
      response: { decision: 'allow' },
    });
  });

  it('runs guard for beforeReadFile', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cursor-handler-project-'));

    await expect(
      runChain({
        hookName: 'beforeReadFile',
        input: { file_path: join(projectRoot, 'README.md') },
        projectRoot,
        cursorHome: join(projectRoot, '.cursor'),
      }),
    ).resolves.toEqual({
      log: { handler: 'guard', decision: 'allow' },
      response: { permission: 'allow' },
    });
  });

  it('skips guard when preToolUse has no path targets', async () => {
    await expect(
      runChain({
        hookName: 'preToolUse',
        input: { tool_name: 'Task', tool_input: { description: 'explore' } },
        projectRoot: '/project',
        cursorHome: '/project/.cursor',
      }),
    ).resolves.toEqual({
      log: undefined,
      response: { permission: 'allow' },
    });
  });

  it('runs verify then drift for stop', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cursor-handler-project-'));

    await runChain({
      hookName: 'stop',
      input: { loop_count: 0 },
      projectRoot,
      cursorHome: join(projectRoot, '.cursor'),
      snapshot: { touchedPaths: [] },
    });

    expect(verify.run).toHaveBeenCalledTimes(1);
    expect(drift.run).toHaveBeenCalledTimes(1);
    // quality (verify) が先、drift は確定状態を読むため後段
    expect(verify.run.mock.invocationCallOrder[0]).toBeLessThan(
      drift.run.mock.invocationCallOrder[0],
    );
  });

  it('preserves verify followup_message when drift is a no-op', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cursor-handler-project-'));
    const message = '[Automated hook message — not from the user]\n\nLint issues found.';
    verify.run.mockResolvedValue({ response: { followup_message: message } });
    drift.run.mockResolvedValue(undefined);

    const result = await runChain({
      hookName: 'stop',
      input: { loop_count: 0 },
      projectRoot,
      cursorHome: join(projectRoot, '.cursor'),
      snapshot: { touchedPaths: [] },
    });

    expect(result.response.followup_message).toBe(message);
  });
});
