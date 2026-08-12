import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CheckContext, RunResult } from '../idle-chain';
import { qualityCheck } from './quality';

// 一時プロジェクトを作成する（node_modules/.bin にツールの存在だけ用意する）
async function setupProject() {
  const root = await mkdtemp(join(tmpdir(), 'quality-gate-test-'));
  await mkdir(join(root, 'node_modules', '.bin'), { recursive: true });
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'node_modules', '.bin', 'oxlint'), '#!/bin/sh\n');
  await writeFile(join(root, 'node_modules', '.bin', 'oxfmt'), '#!/bin/sh\n');
  await writeFile(join(root, 'node_modules', '.bin', 'tsc'), '#!/bin/sh\n');
  await writeFile(join(root, 'tsconfig.json'), '{}');
  const target = join(root, 'src', 'a.ts');
  await writeFile(target, 'const x = 1;\n');
  return { root, target };
}

// 実行ツールを偽装する。--fix は成功し、lint / tsc は引数で渡した出力を返す
const fakeRun =
  (lintOutput = '', tscOutput = '') =>
  async (cmd: string[]): Promise<RunResult> => {
    const tool = cmd[0]?.includes('oxlint') ? 'oxlint' : cmd[0]?.includes('tsc') ? 'tsc' : '';
    if (tool === 'oxlint') {
      return cmd.includes('--fix')
        ? { exitCode: 0, stdout: '', stderr: '' }
        : { exitCode: 1, stdout: lintOutput, stderr: '' };
    }
    if (tool === 'tsc') {
      return { exitCode: 1, stdout: tscOutput, stderr: '' };
    }
    return { exitCode: 0, stdout: '', stderr: '' };
  };

describe('qualityCheck', () => {
  it('reports lint and typecheck issues in a follow-up message', async () => {
    const { root, target } = await setupProject();
    const ctx: CheckContext = {
      root,
      sessionID: 'test',
      files: [target],
      run: fakeRun('src/a.ts:1:1: error no-explicit-any: msg', 'src/a.ts(1,1): error TS7006: msg'),
      log: async () => {},
    };

    const result = await qualityCheck.run(ctx);

    expect(result.followUps).toHaveLength(1);
    expect(result.followUps[0]).toContain('Lint (oxlint): 1 error(s), 0 warning(s)');
    expect(result.followUps[0]).toContain('Typecheck (tsc): 1 error(s)');
    expect(result.followUps[0]).toContain('src/a.ts');
  });

  it('sends no follow-up when analysis is clean', async () => {
    const { root, target } = await setupProject();
    const ctx: CheckContext = {
      root,
      sessionID: 'test',
      files: [target],
      run: fakeRun('', ''),
      log: async () => {},
    };

    const result = await qualityCheck.run(ctx);

    expect(result.followUps).toEqual([]);
  });

  it('skips tools that are not installed', async () => {
    const { root, target } = await setupProject();
    // 空の bin ディレクトリに戻して oxlint / oxfmt / tsc を未インストール扱いにする
    const { rm } = await import('node:fs/promises');
    await rm(join(root, 'node_modules', '.bin'), { recursive: true, force: true });

    const calls: string[][] = [];
    const ctx: CheckContext = {
      root,
      sessionID: 'test',
      files: [target],
      run: async (cmd: string[]) => {
        calls.push(cmd);
        return { exitCode: 1, stdout: 'should not be called', stderr: '' };
      },
      log: async () => {},
    };

    const result = await qualityCheck.run(ctx);

    expect(result.followUps).toEqual([]);
    // ツール未インストール時は何も実行しない
    expect(calls).toEqual([]);
  });

  it('does not run lint/typecheck when only format targets exist', async () => {
    const { root } = await setupProject();
    // .md のみ編集（checkTargets は空、formatTargets のみ存在）
    const md = join(root, 'README.md');
    await writeFile(md, '# title\n');

    const calls: string[][] = [];
    const ctx: CheckContext = {
      root,
      sessionID: 'test',
      files: [md],
      run: async (cmd: string[]) => {
        calls.push(cmd);
        return { exitCode: 0, stdout: '', stderr: '' };
      },
      log: async () => {},
    };

    const result = await qualityCheck.run(ctx);

    expect(result.followUps).toEqual([]);
    // oxfmt は実行されるが、oxlint / tsc は実行されない（空配列で全体 lint する事故を防ぐ）
    expect(calls.some((c) => c[0]?.includes('oxfmt'))).toBe(true);
    expect(calls.some((c) => c[0]?.includes('oxlint'))).toBe(false);
    expect(calls.some((c) => c[0]?.includes('tsc'))).toBe(false);
  });
});
