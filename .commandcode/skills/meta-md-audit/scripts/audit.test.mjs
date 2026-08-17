// findMidParagraphBreaks / findLongLines の md 構文カバレッジ検証用 vitest テスト
import { describe, expect, it } from 'vitest';
import { findLongLines, findMidParagraphBreaks } from './lib/md-checks.mjs';

describe('findMidParagraphBreaks', () => {
  const body = [
    '# Heading',
    '',
    'Normal paragraph on one line.',
    '',
    '| col1 | col2 |',
    '| --- | --- |',
    '| a | b |',
    '',
    'no leading pipe | still table |',
    '--- | ---',
    '',
    'Text before hr.',
    '---',
    'Text after hr.',
    '',
    '- item one',
    '- item two',
    '',
    '1. first',
    '2. second',
    '',
    '> quote line',
    '',
    '```js',
    'const x = 1;',
    'const y = 2;',
    '```',
    '',
    '<!-- multi',
    'line comment',
    '-->',
    '',
    '    indented code',
    '    more code',
    '',
    'term',
    ': definition',
    '',
    'Real paragraph',
    'broken across two lines',
  ].join('\n');

  it('flags only the mid-paragraph break', () => {
    // 最終行の「broken across two lines」のみが段落内改行としてフラグされる
    expect(findMidParagraphBreaks(body)).toEqual([40]);
  });
});

describe('findLongLines', () => {
  const long = 'x'.repeat(250);

  it('flags long lines in paragraphs, lists, and inline code', () => {
    const body = [
      'Normal paragraph with a very long line: ' + long + ' (should be flagged)',
      '',
      '- list item with a very long line: ' + long + ' (should be flagged)',
      '',
      'Inline `code with a very long line: ' + long + '` (should be flagged)',
    ].join('\n');

    expect(findLongLines(body, 200, 'test')).toHaveLength(3);
  });

  it('excludes code blocks, tables, and HTML comments', () => {
    const body = [
      '```js',
      'code block with a very long line: ' + long + ' (must NOT be flagged)',
      '```',
      '',
      '| col1 | col2 |',
      '| --- | --- |',
      '| ' + long + ' | b |',
      '',
      '<!-- HTML comment with a very long line: ' + long + ' (must NOT be flagged)',
      '-->',
    ].join('\n');

    expect(findLongLines(body, 200, 'test')).toEqual([]);
  });

  it('does not flag lines at or under the limit', () => {
    const ok = 'a'.repeat(200);
    const body = ['short line', ok].join('\n');

    expect(findLongLines(body, 200, 'test')).toEqual([]);
  });
});
