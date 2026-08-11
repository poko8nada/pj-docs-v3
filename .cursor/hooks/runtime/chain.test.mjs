import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runChain } from './chain.mjs';

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
});
