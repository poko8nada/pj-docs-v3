import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CheckContext, RunResult } from '../idle-chain';
import { driftCheck } from './drift';

const header = (status: string) =>
  `/*\n * FEATURES: F-x.test\n * PURPOSE: test (isDone: true)\n * STATUS: ${status}\n */\n`;

// 一時プロジェクトを作成する
async function setupProject() {
  const root = await mkdtemp(join(tmpdir(), 'drift-gate-test-'));
  await mkdir(join(root, 'src'), { recursive: true });
  return root;
}

// git diff --numstat を偽装する（追加行数を返す）
// 呼び出されたコマンド配列を記録し、引数形状の検証に使う
const fakeRun = (addedLines: string, calls: string[][] = []): CheckContext['run'] => {
  return async (cmd: string[]): Promise<RunResult> => {
    calls.push(cmd);
    if (cmd[0] === 'git') {
      return { exitCode: 0, stdout: addedLines, stderr: '' };
    }
    return { exitCode: 1, stdout: '', stderr: '' };
  };
};

describe('driftCheck', () => {
  it('flips driftSuspected and rewrites the STATUS line', async () => {
    const root = await setupProject();
    const target = join(root, 'src', 'a.ts');
    // 100行以上で driftSuspected 判定が有効になる
    const body = Array.from({ length: 105 }, (_, i) => `const v${i} = ${i};`).join('\n');
    await writeFile(
      target,
      header('sizeDrift=false, driftSuspected=false, baseLines=10') + body + '\n',
    );

    const ctx: CheckContext = {
      root,
      sessionID: 'test',
      files: [target],
      run: fakeRun('10\t0\tsrc/a.ts\n'),
      log: async () => {},
    };

    const result = await driftCheck.run(ctx);

    // STATUS 行が書き換わっている（ベースラインは保持される）
    const text = await readFile(target, 'utf8');
    expect(text).toContain('STATUS: sizeDrift=false, driftSuspected=true, baseLines=10');
    expect(result.followUps).toHaveLength(1);
    expect(result.followUps[0]).toContain('driftSuspected=true');
  });

  it('flips sizeDrift when the file exceeds the size limit', async () => {
    const root = await setupProject();
    const target = join(root, 'src', 'a.ts');
    const body = Array.from({ length: 350 }, (_, i) => `const v${i} = ${i};`).join('\n');
    await writeFile(
      target,
      header('sizeDrift=false, driftSuspected=false, baseLines=10') + body + '\n',
    );

    const ctx: CheckContext = {
      root,
      sessionID: 'test',
      files: [target],
      run: fakeRun('10\t0\tsrc/a.ts\n'),
      log: async () => {},
    };

    const result = await driftCheck.run(ctx);

    const text = await readFile(target, 'utf8');
    expect(text).toContain('STATUS: sizeDrift=true, driftSuspected=true, baseLines=10');
    expect(result.followUps[0]).toContain('sizeDrift=true');
  });
});

describe('driftCheck edge cases', () => {
  it('does not flip sizeDrift for a comment-heavy file with few code lines', async () => {
    const root = await setupProject();
    const target = join(root, 'src', 'a.ts');
    // 総行数は 300 を超えるが、実コードは 60 行しかない（旧判定では誤発火したケース）
    const comments = Array.from({ length: 250 }, () => '// filler comment').join('\n');
    const body = Array.from({ length: 60 }, (_, i) => `const v${i} = ${i};`).join('\n');
    await writeFile(
      target,
      header('sizeDrift=false, driftSuspected=false, baseLines=10') +
        comments +
        '\n\n' +
        body +
        '\n',
    );

    const ctx: CheckContext = {
      root,
      sessionID: 'test',
      files: [target],
      run: fakeRun('10\t0\tsrc/a.ts\n'),
      log: async () => {},
    };

    const result = await driftCheck.run(ctx);

    // STATUS は書き換わらず、フォローアップも出ない
    const text = await readFile(target, 'utf8');
    expect(text).toContain('STATUS: sizeDrift=false, driftSuspected=false, baseLines=10');
    expect(result.followUps).toEqual([]);
  });

  it('reports missing headers without touching the file', async () => {
    const root = await setupProject();
    const target = join(root, 'src', 'a.ts');
    await writeFile(target, 'const x = 1;\n');

    const ctx: CheckContext = {
      root,
      sessionID: 'test',
      files: [target],
      run: fakeRun(''),
      log: async () => {},
    };

    const result = await driftCheck.run(ctx);

    expect(result.followUps).toHaveLength(1);
    expect(result.followUps[0]).toContain('src/a.ts: missing header');
    // ファイルは書き換えない
    expect(await readFile(target, 'utf8')).toBe('const x = 1;\n');
  });

  it('flips sizeDrift even without a baseline in STATUS', async () => {
    const root = await setupProject();
    const target = join(root, 'src', 'a.ts');
    // baseLines なしでも sizeDrift は実コード行数だけで判定できる
    const body = Array.from({ length: 350 }, (_, i) => `const v${i} = ${i};`).join('\n');
    await writeFile(target, header('sizeDrift=false, driftSuspected=false') + body + '\n');

    const ctx: CheckContext = {
      root,
      sessionID: 'test',
      files: [target],
      run: fakeRun(''),
      log: async () => {},
    };

    const result = await driftCheck.run(ctx);

    // sizeDrift のみ発火する（driftSuspected はベースライン不足で判定できない）
    const text = await readFile(target, 'utf8');
    expect(text).toContain('STATUS: sizeDrift=true, driftSuspected=false');
    expect(result.followUps[0]).toContain('sizeDrift=true');
  });

  it('does not flip anything without a baseline when the file is small', async () => {
    const root = await setupProject();
    const target = join(root, 'src', 'a.ts');
    await writeFile(target, header('sizeDrift=false, driftSuspected=false') + 'const x = 1;\n');

    const ctx: CheckContext = {
      root,
      sessionID: 'test',
      files: [target],
      run: fakeRun(''),
      log: async () => {},
    };

    const result = await driftCheck.run(ctx);

    expect(result.followUps).toEqual([]);
    expect(await readFile(target, 'utf8')).toContain('driftSuspected=false');
  });
});

describe('driftCheck baseline commit', () => {
  it('uses git diff <baseCommit> -- <rel> (not two-dot range) when a baseline commit exists', async () => {
    const root = await setupProject();
    const target = join(root, 'src', 'a.ts');
    const body = Array.from({ length: 105 }, (_, i) => `const v${i} = ${i};`).join('\n');
    await writeFile(
      target,
      header('sizeDrift=false, driftSuspected=false, baseLines=10, baseCommit=abc1234') +
        body +
        '\n',
    );

    const calls: string[][] = [];
    const ctx: CheckContext = {
      root,
      sessionID: 'test',
      files: [target],
      run: fakeRun('10\t0\tsrc/a.ts\n', calls),
      log: async () => {},
    };

    await driftCheck.run(ctx);

    // コミット対作業ツリー比較（two-dot range を使わない）で呼ばれること
    const gitCall = calls.find((c) => c[0] === 'git');
    expect(gitCall).toEqual(['git', 'diff', '--numstat', 'abc1234', '--', 'src/a.ts']);
    expect(gitCall).not.toContain('..HEAD');
  });

  it('keeps driftSuspected false when git diff fails (additions unknown)', async () => {
    const root = await setupProject();
    const target = join(root, 'src', 'a.ts');
    const body = Array.from({ length: 105 }, (_, i) => `const v${i} = ${i};`).join('\n');
    await writeFile(
      target,
      header('sizeDrift=false, driftSuspected=false, baseLines=10, baseCommit=abc1234') +
        body +
        '\n',
    );

    const ctx: CheckContext = {
      root,
      sessionID: 'test',
      files: [target],
      run: async (cmd: string[]): Promise<RunResult> => {
        if (cmd[0] === 'git') {
          return { exitCode: 1, stdout: '', stderr: 'fatal: bad revision' };
        }
        return { exitCode: 1, stdout: '', stderr: '' };
      },
      log: async () => {},
    };

    const result = await driftCheck.run(ctx);

    // git diff 失敗時は driftSuspected を発火させない
    expect(result.followUps).toEqual([]);
    expect(await readFile(target, 'utf8')).toContain('driftSuspected=false');
  });
});
