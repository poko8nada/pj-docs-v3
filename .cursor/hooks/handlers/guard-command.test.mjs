import { describe, expect, it } from 'vitest';
import { run } from './guard-command.mjs';

describe('guard-command git flags', () => {
  const context = {
    hookName: 'beforeShellExecution',
    input: {},
    projectRoot: '/project',
    cursorHome: '/project/.cursor',
  };

  it('denies git push --force', async () => {
    await expect(
      run({ ...context, input: { command: 'git push --force origin main' } }),
    ).resolves.toMatchObject({
      log: { handler: 'guard-command', decision: 'deny' },
      response: { permission: 'deny' },
    });
  });

  it('denies git push --force split by newline', async () => {
    await expect(
      run({ ...context, input: { command: 'cd /tmp\ngit push --force origin main' } }),
    ).resolves.toMatchObject({
      response: { permission: 'deny' },
    });
  });

  it('denies git push --force after variable assignment prefix', async () => {
    await expect(
      run({ ...context, input: { command: 'FOO=bar git push --force origin main' } }),
    ).resolves.toMatchObject({
      response: { permission: 'deny' },
    });
  });

  it('denies git reset --hard', async () => {
    await expect(
      run({ ...context, input: { command: 'git reset --hard HEAD~1' } }),
    ).resolves.toMatchObject({
      response: { permission: 'deny' },
    });
  });

  it('handles preToolUse Shell with JSON-stringified tool_input', async () => {
    await expect(
      run({
        ...context,
        hookName: 'preToolUse',
        input: { tool_name: 'Shell', tool_input: JSON.stringify({ command: 'git push --force' }) },
      }),
    ).resolves.toMatchObject({
      response: { permission: 'deny' },
    });
  });
});

describe('guard-command bypass patterns', () => {
  const context = {
    hookName: 'beforeShellExecution',
    input: {},
    projectRoot: '/project',
    cursorHome: '/project/.cursor',
  };

  it('denies backtick in chained command after markdown body command', async () => {
    await expect(
      run({ ...context, input: { command: 'git commit -m "init" && echo `cat /etc/passwd`' } }),
    ).resolves.toMatchObject({
      log: { reason: 'bypass pattern detected: backtick command substitution' },
      response: { permission: 'deny' },
    });
  });

  it('denies backtick command substitution', async () => {
    await expect(
      run({ ...context, input: { command: 'echo `cat /etc/passwd`' } }),
    ).resolves.toMatchObject({
      log: { reason: 'bypass pattern detected: backtick command substitution' },
      response: { permission: 'deny' },
    });
  });

  it('denies process substitution', async () => {
    await expect(
      run({ ...context, input: { command: 'diff <(git show HEAD) <(git show HEAD~1)' } }),
    ).resolves.toMatchObject({
      response: { permission: 'deny' },
    });
  });

  it('denies here string', async () => {
    await expect(run({ ...context, input: { command: 'cat <<< "hello"' } })).resolves.toMatchObject(
      {
        response: { permission: 'deny' },
      },
    );
  });

  it('allows markdown body backticks for git commit', async () => {
    await expect(
      run({ ...context, input: { command: 'git commit -m "fix `foo` bar"' } }),
    ).resolves.toBeUndefined();
  });

  it('allows safe commands without response', async () => {
    await expect(run({ ...context, input: { command: 'pnpm test' } })).resolves.toBeUndefined();
  });

  it('ignores non-Shell preToolUse', async () => {
    await expect(
      run({
        ...context,
        hookName: 'preToolUse',
        input: { tool_name: 'Grep', tool_input: { pattern: 'git' } },
      }),
    ).resolves.toBeUndefined();
  });
});
