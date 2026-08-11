#!/usr/bin/env node
/**
 * isDone: true の NOTE 行を機械的に削除する。
 * interpret が isDone を true にした後、lefthook pre-commit が実行する。
 * NOTE 行だけが消え、永続ブロック（REF + CONSTRAINTS）は残る。
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const DONE_NOTE = /NOTE:.*isDone: true/;

function findFiles() {
  try {
    const out = execFileSync(
      'rg',
      [
        '--hidden',
        '-l',
        'NOTE:.*isDone: true',
        '.',
        '--glob',
        '!node_modules/**',
        '--glob',
        '!.git/**',
        '--glob',
        '!dist/**',
        '--glob',
        '!.opencode/plugins/**',
        '--glob',
        '!.opencode/node_modules/**',
        '--glob',
        '!.cursor/**',
        '--glob',
        '!scripts/remove-done-notes.mjs',
        '--glob',
        '!scripts/list-removed.mjs',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return out.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function main() {
  const files = findFiles();
  let removed = 0;
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    const kept = lines.filter((line) => !DONE_NOTE.test(line));
    if (kept.length !== lines.length) {
      fs.writeFileSync(file, kept.join('\n'));
      removed += lines.length - kept.length;
    }
  }
  if (removed > 0) {
    process.stdout.write(`Removed ${removed} done note line(s).\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
