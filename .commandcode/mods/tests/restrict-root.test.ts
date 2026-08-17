import { describe, expect, it } from 'vitest';
import restrictRoot from '../restrict-root';

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
    cwd: process.cwd(),
    hooks: (h: Hooks) => {
      hooks = h;
    },
  } as never;
  restrictRoot(cmd);
  if (!hooks) {
    throw new Error('hooks not registered');
  }
  return hooks;
};

describe('restrict-root mod', () => {
  it('blocks shell commands touching paths outside the root', async () => {
    const hooks = loadHooks();
    const result = await hooks.beforeToolCall({
      toolName: 'shell_command',
      input: { command: 'cat /etc/hosts' },
    });
    expect(result?.block).toBe(true);
    expect(result?.additionalContext).toContain('prohibited');
  });

  it('allows shell commands with only in-root paths', async () => {
    const hooks = loadHooks();
    const result = await hooks.beforeToolCall({
      toolName: 'shell_command',
      input: { command: 'ls .' },
    });
    expect(result).toBeUndefined();
  });

  it('blocks writes outside the root', async () => {
    const hooks = loadHooks();
    const result = await hooks.beforeToolCall({
      toolName: 'write_file',
      input: { file_path: '/tmp/x.txt' },
    });
    expect(result?.block).toBe(true);
  });

  it('allows reads inside the root', async () => {
    const hooks = loadHooks();
    const result = await hooks.beforeToolCall({
      toolName: 'read_file',
      input: { absolute_path: './package.json' },
    });
    expect(result).toBeUndefined();
  });
});
