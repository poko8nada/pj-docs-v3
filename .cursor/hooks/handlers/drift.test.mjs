import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/run-command.mjs', () => ({
  runCommand: vi.fn().mockResolvedValue({ ok: true, code: 0, stdout: '', stderr: '' }),
  truncateOutput: (text) => text,
}));

import { runCommand } from '../lib/run-command.mjs';
import { run } from './drift.mjs';

let projectRoot;
const touchedPaths = [];

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'cursor-drift-project-'));
  touchedPaths.length = 0;
  vi.resetAllMocks();
  runCommand.mockResolvedValue({ ok: true, code: 0, stdout: '', stderr: '' });
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

const context = () => ({
  hookName: 'stop',
  input: {},
  projectRoot,
  cursorHome: join(projectRoot, '.cursor'),
  snapshot: { touchedPaths: [...touchedPaths] },
});

// ヘッダー付きコードファイルをプロジェクト内に作る
async function writeCodeFile(
  rel,
  headerStatus,
  purpose = 'テスト用モジュール',
  codeBody = 'export const a = 1;',
) {
  const abs = join(projectRoot, rel);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(
    abs,
    `/*\n * FEATURES: H-test\n * PURPOSE: ${purpose} (isDone: true)\n * STATUS: ${headerStatus}\n */\n${codeBody}`,
  );
  touchedPaths.push(abs);
  return abs;
}

describe('drift detection', () => {
  it('detects sizeDrift when code lines exceed the limit', async () => {
    const code = Array.from({ length: 310 }, (_, i) => `export const v${i} = ${i};`).join('\n');
    await writeCodeFile('src/ok.ts', 'sizeDrift=false, driftSuspected=false', 'テスト', code);

    const result = await run(context());

    expect(result.response.followup_message).toContain('sizeDrift=true');
    const text = await (
      await import('node:fs/promises')
    ).readFile(join(projectRoot, 'src/ok.ts'), 'utf8');
    expect(text).toContain('sizeDrift=true, driftSuspected=false');
  });

  it('detects driftSuspected and rewrites the STATUS line', async () => {
    const code = Array.from({ length: 120 }, (_, i) => `export const v${i} = ${i};`).join('\n');
    const abs = await writeCodeFile(
      'src/ok.ts',
      'sizeDrift=false, driftSuspected=false, baseLines=100, baseCommit=abc123',
      'テスト',
      code,
    );
    runCommand.mockResolvedValue({ ok: true, code: 0, stdout: '60\t0\tsrc/ok.ts\n', stderr: '' });

    const result = await run(context());

    expect(result.response.followup_message).toContain('driftSuspected=true');
    const text = await (await import('node:fs/promises')).readFile(abs, 'utf8');
    expect(text).toContain('sizeDrift=false, driftSuspected=true');
  });

  it('uses git diff HEAD when no baseCommit is recorded', async () => {
    const code = Array.from({ length: 120 }, (_, i) => `export const v${i} = ${i};`).join('\n');
    await writeCodeFile(
      'src/ok.ts',
      'sizeDrift=false, driftSuspected=false, baseLines=100',
      'テスト',
      code,
    );
    runCommand.mockResolvedValue({ ok: true, code: 0, stdout: '60\t0\tsrc/ok.ts\n', stderr: '' });

    await run(context());

    const gitCall = runCommand.mock.calls.find(([cmd]) => cmd === 'git');
    expect(gitCall).toBeDefined();
    expect(gitCall[1]).toEqual(['diff', '--numstat', 'HEAD', '--', 'src/ok.ts']);
  });
});

describe('drift header issues', () => {
  it('reports missing headers for code files without one', async () => {
    await mkdir(join(projectRoot, 'src'), { recursive: true });
    await writeFile(join(projectRoot, 'src/naked.ts'), 'export const b = 2;\n');
    touchedPaths.push(join(projectRoot, 'src/naked.ts'));

    const result = await run(context());

    expect(result.response.followup_message).toContain('missing header');
  });

  it('reports incomplete headers missing required fields', async () => {
    await mkdir(join(projectRoot, 'src'), { recursive: true });
    await writeFile(
      join(projectRoot, 'src/partial.ts'),
      '/*\n * FEATURES: H-test\n */\nexport const b = 2;\n',
    );
    touchedPaths.push(join(projectRoot, 'src/partial.ts'));

    const result = await run(context());

    expect(result.response.followup_message).toContain('incomplete header');
  });

  it('skips files whose header is not done (isDone: false)', async () => {
    await writeCodeFile(
      'src/wip.ts',
      'sizeDrift=false, driftSuspected=false',
      '計画中 (isDone: false)',
    );

    const result = await run(context());

    expect(result).toBeUndefined();
  });

  it('ignores non-code files and test files', async () => {
    await mkdir(join(projectRoot, 'src'), { recursive: true });
    await writeFile(join(projectRoot, 'src/plain.md'), '# doc\n');
    touchedPaths.push(join(projectRoot, 'src/plain.md'));
    await writeFile(join(projectRoot, 'src/plain.test.ts'), 'export const c = 3;\n');
    touchedPaths.push(join(projectRoot, 'src/plain.test.ts'));

    const result = await run(context());

    expect(result).toBeUndefined();
  });

  it('resolves relative touchedPaths against the project root', async () => {
    await writeCodeFile('src/ok.ts', 'sizeDrift=false, driftSuspected=false');
    touchedPaths.length = 0;
    touchedPaths.push('src/ok.ts');

    const result = await run(context());

    expect(result).toBeUndefined();
  });

  it('ignores directory paths mixed into touchedPaths', async () => {
    await mkdir(join(projectRoot, 'src'), { recursive: true });
    touchedPaths.push(join(projectRoot, 'src'));

    const result = await run(context());

    expect(result).toBeUndefined();
  });

  it('returns empty response when nothing drifts', async () => {
    await writeCodeFile('src/ok.ts', 'sizeDrift=false, driftSuspected=false');

    const result = await run(context());

    expect(result).toBeUndefined();
  });
});
