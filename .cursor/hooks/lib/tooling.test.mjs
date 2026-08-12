import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getMissingVerifyTooling, hasFormatTooling } from './tooling.mjs';

describe('tooling', () => {
  it('detects missing verify packages in an empty directory', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'cursor-tooling-empty-'));

    expect(await hasFormatTooling(projectRoot)).toBe(false);
    expect(await getMissingVerifyTooling(projectRoot)).toEqual(['oxfmt', 'oxlint', 'typescript']);
  });

  it('detects installed packages in this project', async () => {
    const projectRoot = process.cwd();

    expect(await hasFormatTooling(projectRoot)).toBe(true);
    expect(await getMissingVerifyTooling(projectRoot)).toEqual([]);
  });
});
