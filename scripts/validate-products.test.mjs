import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectErrors } from './validate-products.mjs';

const tmpDirs = [];

function makeDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'products-test-'));
  tmpDirs.push(dir);
  return dir;
}

function writeSnapshot(dir, seq, frontmatter, body) {
  const date = '2026-08-13';
  const file = path.join(dir, `${date}-${String(seq).padStart(3, '0')}.md`);
  const fm = [`date: ${date}`, `context: test`, ...frontmatter].join('\n');
  fs.writeFileSync(file, `---\n${fm}\n---\n\n${body}`);
  return file;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('validate-products', () => {
  it('changed に無いセクションの差分を検出する', () => {
    const dir = makeDir();
    writeSnapshot(dir, 1, [], '## G-what: What is this\n\n- a\n');
    writeSnapshot(dir, 2, [], '## G-what: What is this\n\n- b\n');
    const errors = collectErrors(dir);
    expect(errors.some((e) => e.includes('unchanged section G-what differs'))).toBe(true);
  });

  it('changed でセクションを変更できる', () => {
    const dir = makeDir();
    writeSnapshot(dir, 1, [], '## G-what: What is this\n\n- a\n');
    writeSnapshot(dir, 2, ['changed:', '  - G-what'], '## G-what: What is this\n\n- b\n');
    expect(collectErrors(dir)).toEqual([]);
  });

  it('removed でセクションを削除できる', () => {
    const dir = makeDir();
    writeSnapshot(dir, 1, [], '## G-what: What is this\n\n- a\n\n## D-name: Name\n\n- comeback\n');
    writeSnapshot(dir, 2, ['removed:', '  - D-name'], '## G-what: What is this\n\n- a\n');
    expect(collectErrors(dir)).toEqual([]);
  });

  it('removed + changed でセクションを改名できる', () => {
    const dir = makeDir();
    writeSnapshot(dir, 1, [], '## G-what: What is this\n\n- a\n');
    writeSnapshot(
      dir,
      2,
      ['removed:', '  - G-what', 'changed:', '  - G-outcome'],
      '## G-outcome: Outcome\n\n- a\n',
    );
    expect(collectErrors(dir)).toEqual([]);
  });

  it('removed に無い ID をエラーにする', () => {
    const dir = makeDir();
    writeSnapshot(dir, 1, [], '## G-what: What is this\n\n- a\n');
    writeSnapshot(dir, 2, ['removed:', '  - D-name'], '## G-what: What is this\n\n- a\n');
    const errors = collectErrors(dir);
    expect(errors.some((e) => e.includes('removed section D-name does not exist'))).toBe(true);
  });

  it('removed なのにセクションが残っている場合をエラーにする', () => {
    const dir = makeDir();
    writeSnapshot(dir, 1, [], '## D-name: Name\n\n- comeback\n');
    writeSnapshot(dir, 2, ['removed:', '  - D-name'], '## D-name: Name\n\n- comeback\n');
    const errors = collectErrors(dir);
    expect(errors.some((e) => e.includes('removed section D-name still exists'))).toBe(true);
  });

  it('removed と changed の重複をエラーにする', () => {
    const dir = makeDir();
    writeSnapshot(dir, 1, [], '## G-what: What is this\n\n- a\n');
    writeSnapshot(
      dir,
      2,
      ['removed:', '  - G-what', 'changed:', '  - G-what'],
      '## G-what: What is this\n\n- b\n',
    );
    const errors = collectErrors(dir);
    expect(errors.some((e) => e.includes('removed ID "G-what" overlaps changed'))).toBe(true);
  });

  it('removed も changed も無しでセクションが消えた場合をエラーにする', () => {
    const dir = makeDir();
    writeSnapshot(dir, 1, [], '## G-what: What is this\n\n- a\n\n## D-name: Name\n\n- comeback\n');
    writeSnapshot(dir, 2, [], '## G-what: What is this\n\n- a\n');
    const errors = collectErrors(dir);
    expect(errors.some((e) => e.includes('unchanged section D-name differs'))).toBe(true);
  });

  it('不正な removed ID をエラーにする', () => {
    const dir = makeDir();
    writeSnapshot(dir, 1, [], '## G-what: What is this\n\n- a\n');
    writeSnapshot(dir, 2, ['removed:', '  - X-invalid'], '## G-what: What is this\n\n- a\n');
    const errors = collectErrors(dir);
    expect(errors.some((e) => e.includes('invalid removed ID "X-invalid"'))).toBe(true);
  });

  it('先頭スナップショットの removed をエラーにする', () => {
    const dir = makeDir();
    writeSnapshot(dir, 1, ['removed:', '  - D-name'], '## G-what: What is this\n\n- a\n');
    const errors = collectErrors(dir);
    expect(errors.some((e) => e.includes('removed has no effect in the first snapshot'))).toBe(
      true,
    );
  });
});
