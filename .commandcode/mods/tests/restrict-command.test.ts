import { describe, expect, it } from 'vitest';
import restrictCommand from '../restrict-command';

// モック cmd でファクトリを実行し、登録されたフックを取り出す
type Hooks = {
  beforeToolCall: (args: {
    toolName: string;
    input: Record<string, unknown>;
  }) => Promise<{ block?: boolean; additionalContext?: string } | undefined>;
};

const loadHooks = () => {
  let hooks: Hooks | undefined;
  // oxlint-disable-next-line no-unsafe-type-assertion
  const cmd = {
    hooks: (h: Hooks) => {
      hooks = h;
    },
  } as never;
  restrictCommand(cmd);
  if (!hooks) {
    throw new Error('hooks not registered');
  }
  return hooks;
};

describe('restrict-command mod', () => {
  it('blocks dangerous git flags', async () => {
    const hooks = loadHooks();
    const result = await hooks.beforeToolCall({
      toolName: 'shell_command',
      input: { command: 'git push --force' },
    });
    expect(result?.block).toBe(true);
    expect(result?.additionalContext).toContain('BLOCKED');
  });

  it('blocks bypass patterns', async () => {
    const hooks = loadHooks();
    const result = await hooks.beforeToolCall({
      toolName: 'shell_command',
      input: { command: 'echo `whoami`' },
    });
    expect(result?.block).toBe(true);
  });

  it('allows safe commands', async () => {
    const hooks = loadHooks();
    const result = await hooks.beforeToolCall({
      toolName: 'shell_command',
      input: { command: 'git status' },
    });
    expect(result).toBeUndefined();
  });

  it('ignores non-shell tools', async () => {
    const hooks = loadHooks();
    const result = await hooks.beforeToolCall({
      toolName: 'read_file',
      input: { absolute_path: '/x' },
    });
    expect(result).toBeUndefined();
  });
});
