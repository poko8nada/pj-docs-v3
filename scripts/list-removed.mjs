#!/usr/bin/env node
/**
 * staged diff から削除された NOTE: 行を列挙する。
 * isDone: true の行（lefthook の機械削除）は除外する。
 * exit 0 = なし / exit 1 = あり（コミット前のユーザー確認用）
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const NOTE_MARK = 'NOTE:';
const DONE_NOTE = /NOTE:.*isDone: true/;

/**
 * @param {string} diffText `git diff --cached -U0 --no-color` の出力
 * @returns {{ file: string, line: number, content: string }[]}
 */
export function parseRemovedNotesFromDiff(diffText) {
  /** @type {{ file: string, line: number, content: string }[]} */
  const removed = [];
  let file = '';
  let oldLine = 0;

  for (const raw of diffText.split('\n')) {
    if (raw.startsWith('+++ b/')) {
      file = raw.slice(6);
      continue;
    }

    const hunk = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      oldLine = Number.parseInt(hunk[1], 10);
      continue;
    }

    if (raw.startsWith('---') || raw.startsWith('diff ') || raw.startsWith('index ')) {
      continue;
    }

    if (raw.startsWith('-')) {
      const content = raw.slice(1);
      if (content.includes(NOTE_MARK) && !DONE_NOTE.test(content)) {
        removed.push({ file, line: oldLine, content: content.trimEnd() });
      }
      oldLine += 1;
      continue;
    }

    if (raw.startsWith(' ')) {
      oldLine += 1;
    }
  }

  return removed;
}

/**
 * @param {unknown} error
 * @returns {error is { status?: number; stderr?: string }}
 */
function isGitError(error) {
  return typeof error === 'object' && error !== null;
}

function getStagedDiff() {
  try {
    return execFileSync('git', ['diff', '--cached', '-U0', '--no-color'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    if (
      isGitError(error) &&
      (error.status === 128 || /not a git repository/i.test(error.stderr ?? ''))
    ) {
      return '';
    }
    throw error;
  }
}

function main() {
  const removed = parseRemovedNotesFromDiff(getStagedDiff());
  if (removed.length === 0) {
    process.exit(0);
  }

  process.stdout.write('Removed NOTE lines (staged):\n\n');
  for (const { file, line, content } of removed) {
    process.stdout.write(`  ${file}:${line}  ${content}\n`);
  }
  process.stdout.write('\nConfirm these removals with the user before committing.\n');
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
