import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isAllowedPath, isProjectPath, filterProjectPaths } from '../lib/allowed-paths.mjs';
import { run } from './guard.mjs';

describe('isAllowedPath', () => {
  it('allows paths inside the project root', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cursor-guard-project-'));
    expect(isAllowedPath(join(projectRoot, 'README.md'), projectRoot, '/tmp/cursor')).toBe(true);
  });

  it('allows paths inside ~/.cursor', () => {
    const cursorHome = '/Users/me/.cursor';
    expect(isAllowedPath(join(cursorHome, 'hooks.json'), '/project', cursorHome)).toBe(true);
  });

  it('denies paths outside allowed roots', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cursor-guard-project-'));
    expect(isAllowedPath('/etc/passwd', projectRoot, join(projectRoot, '.cursor'))).toBe(false);
  });

  it('does not allow prefix collisions', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cursor-guard-project-'));
    expect(
      isAllowedPath(`${projectRoot}-other/file.txt`, projectRoot, join(projectRoot, '.cursor')),
    ).toBe(false);
  });
});

describe('isProjectPath', () => {
  it('allows paths inside the project root', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cursor-guard-project-'));
    expect(isProjectPath(join(projectRoot, 'README.md'), projectRoot)).toBe(true);
  });

  it('denies paths under ~/.cursor outside the project', () => {
    const cursorHome = '/Users/me/.cursor';
    expect(isProjectPath(join(cursorHome, 'plugins/cache/skill.md'), '/project')).toBe(false);
  });

  it('filters touched paths to the project root', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cursor-guard-project-'));
    const inProject = join(projectRoot, 'src/app.ts');
    const outside = '/Users/me/.cursor/plugins/cache/skill.md';

    expect(filterProjectPaths([inProject, outside], projectRoot)).toEqual([inProject]);
  });
});

describe('guard.run', () => {
  it('allows beforeReadFile inside the project', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cursor-guard-project-'));

    await expect(
      run({
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

  it('denies beforeReadFile outside allowed roots', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cursor-guard-project-'));

    await expect(
      run({
        hookName: 'beforeReadFile',
        input: { file_path: '/etc/passwd' },
        projectRoot,
        cursorHome: join(projectRoot, '.cursor'),
      }),
    ).resolves.toEqual({
      log: {
        handler: 'guard',
        decision: 'deny',
        reason: 'path outside allowed roots: /etc/passwd',
      },
      response: {
        permission: 'deny',
        user_message: 'path outside allowed roots: /etc/passwd',
        agent_message: 'path outside allowed roots: /etc/passwd',
      },
    });
  });

  it('denies preToolUse Read outside allowed roots', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cursor-guard-project-'));

    await expect(
      run({
        hookName: 'preToolUse',
        input: {
          tool_name: 'Read',
          tool_input: { path: '/etc/passwd' },
        },
        projectRoot,
        cursorHome: join(projectRoot, '.cursor'),
      }),
    ).resolves.toMatchObject({
      log: { handler: 'guard', decision: 'deny' },
      response: { permission: 'deny' },
    });
  });

  it('skips hooks without path targets', async () => {
    await expect(
      run({
        hookName: 'afterAgentThought',
        input: { session_id: 'session-1' },
        projectRoot: '/project',
        cursorHome: '/project/.cursor',
      }),
    ).resolves.toBeUndefined();
  });
});
