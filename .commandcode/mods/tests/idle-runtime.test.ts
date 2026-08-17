import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import idleRuntime from '../idle-runtime';

type Exec = (opts: {
  command: string;
  args?: string[];
}) => Promise<{ stdout: string; stderr: string; code: number }>;

// 全ツールがクリーンに成功する exec モック
const cleanExec: Exec = async () => ({ stdout: '', stderr: '', code: 0 });

// モック cmd でファクトリを実行し、登録されたフックとイベントハンドラを取り出す
const loadMod = (exec: Exec) => {
  let hooks:
    | {
        afterToolCall: (args: {
          toolName: string;
          input: Record<string, unknown>;
        }) => Promise<unknown>;
      }
    | undefined;
  let turnEndHandler: ((data: unknown) => Promise<void> | void) | undefined;
  const queued: { content: string; deliverAs?: string }[] = [];
  const notified: string[] = [];

  // oxlint-disable-next-line no-unsafe-type-assertion
  const cmd = {
    cwd: process.cwd(),
    hooks: (h: typeof hooks) => {
      hooks = h;
    },
    on: (event: string, handler: (data: unknown) => Promise<void> | void) => {
      if (event === 'turn_end') {
        turnEndHandler = handler;
      }
    },
    queueMessage: (opts: { content: string; deliverAs?: string }) => {
      queued.push(opts);
    },
    ui: { notify: (msg: string) => notified.push(msg) },
    exec,
  } as never;

  idleRuntime(cmd);
  if (!hooks || !turnEndHandler) {
    throw new Error('hooks or turn_end handler not registered');
  }
  const afterToolCall = hooks.afterToolCall;
  const handler = turnEndHandler;
  return {
    afterToolCall,
    turnEnd: () => handler({}),
    queued,
    notified,
  };
};

// プロジェクトルート内の一時ディレクトリ（テスト後にディレクトリごと削除する）
const tempDirs: string[] = [];
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

const makeTempFile = async () => {
  const dir = await mkdtemp(join(process.cwd(), '.commandcode', 'mods', 'tests', '.tmp-'));
  const file = join(dir, 'a.ts');
  await writeFile(
    file,
    '/*\n * FEATURES: F-x.test\n * PURPOSE: test (isDone: true)\n * STATUS: sizeDrift=false, driftSuspected=false\n */\nconst x = 1;\n',
  );
  tempDirs.push(dir);
  return file;
};

// oxlint --format=agent に lint エラーを返す exec モック
const lintErrorExec: Exec = async (opts) => {
  if (opts.args?.includes('--format=agent')) {
    return { stdout: 'a.ts:1:1: error no-explicit-any: msg', stderr: '', code: 1 };
  }
  return { stdout: '', stderr: '', code: 0 };
};

describe('idle-runtime mod', () => {
  it('tracks edited files and runs the chain without follow-ups when clean', async () => {
    const mod = loadMod(cleanExec);
    const file = await makeTempFile();
    await mod.afterToolCall({ toolName: 'edit_file', input: { file_path: file } });
    await mod.turnEnd();

    expect(mod.queued).toEqual([]);
  });

  it('queues a follow-up when the quality check finds issues', async () => {
    const mod = loadMod(lintErrorExec);
    const file = await makeTempFile();
    await mod.afterToolCall({ toolName: 'edit_file', input: { file_path: file } });
    await mod.turnEnd();

    expect(mod.queued.length).toBeGreaterThan(0);
    expect(mod.queued[0].content).toContain('quality-gate');
    expect(mod.queued[0].deliverAs).toBe('follow-up');
  });

  it('does not track files outside the project root', async () => {
    const mod = loadMod(cleanExec);
    await mod.afterToolCall({ toolName: 'edit_file', input: { file_path: '/tmp/outside.ts' } });
    await mod.turnEnd();

    expect(mod.queued).toEqual([]);
  });
});
