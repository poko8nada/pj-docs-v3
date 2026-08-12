import { mkdtemp } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractShellPaths } from '../lib/shell-paths.mjs';
import { run } from './guard.mjs';

describe('extractShellPaths', () => {
  it('extracts cwd and absolute paths', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cursor-guard-project-'));

    expect(extractShellPaths('cat /etc/passwd', projectRoot, projectRoot)).toContain('/etc/passwd');
  });

  it('extracts relative paths against cwd', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cursor-guard-project-'));

    expect(extractShellPaths('cat ../README.md', projectRoot, projectRoot)).toContain(
      join(dirname(projectRoot), 'README.md'),
    );
  });

  it('ignores heredoc contents', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cursor-guard-project-'));

    expect(
      extractShellPaths(`cat <<'EOF'\n/etc/passwd\nEOF\n`, projectRoot, projectRoot),
    ).not.toContain('/etc/passwd');
  });

  it('ignores paths inside quoted strings', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cursor-guard-project-'));

    expect(
      extractShellPaths('git commit -m "read /tmp/secret"', projectRoot, projectRoot),
    ).not.toContain('/tmp/secret');
  });

  it('expands ~ to the home directory', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cursor-guard-project-'));

    expect(extractShellPaths('cat ~/notes.md', projectRoot, projectRoot)).toContain(
      join(homedir(), 'notes.md'),
    );
  });

  it('ignores /dev/null', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cursor-guard-project-'));

    expect(extractShellPaths('cat data > /dev/null', projectRoot, projectRoot)).not.toContain(
      '/dev/null',
    );
  });
});

describe('guard shell', () => {
  it('denies beforeShellExecution outside allowed roots', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cursor-guard-project-'));
    const parentReadme = join(dirname(projectRoot), 'README.md');

    await expect(
      run({
        hookName: 'beforeShellExecution',
        input: { command: `cat ${parentReadme}`, cwd: projectRoot },
        projectRoot,
        cursorHome: join(projectRoot, '.cursor'),
      }),
    ).resolves.toMatchObject({
      log: {
        handler: 'guard',
        decision: 'deny',
        reason: `path outside allowed roots: ${parentReadme}`,
      },
      response: { permission: 'deny' },
    });
  });

  it('denies preToolUse Shell outside allowed roots', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cursor-guard-project-'));
    const parentReadme = join(dirname(projectRoot), 'README.md');

    await expect(
      run({
        hookName: 'preToolUse',
        input: {
          tool_name: 'Shell',
          tool_input: { command: `cat ${parentReadme}` },
        },
        projectRoot,
        cursorHome: join(projectRoot, '.cursor'),
      }),
    ).resolves.toMatchObject({
      log: { handler: 'guard', decision: 'deny' },
      response: { permission: 'deny' },
    });
  });

  it('allows beforeShellExecution inside the project', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cursor-guard-project-'));

    await expect(
      run({
        hookName: 'beforeShellExecution',
        input: { command: 'pnpm test', cwd: projectRoot },
        projectRoot,
        cursorHome: join(projectRoot, '.cursor'),
      }),
    ).resolves.toMatchObject({
      log: { handler: 'guard', decision: 'allow' },
      response: { permission: 'allow' },
    });
  });
});
