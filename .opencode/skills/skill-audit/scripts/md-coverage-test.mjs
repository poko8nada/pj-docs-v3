// findMidParagraphBreaks の md 構文カバレッジ検証用スクリプト
import { readFileSync } from 'node:fs';

const src = readFileSync('.opencode/skills/skill-audit/scripts/audit.mjs', 'utf8');
const isStructuralSrc = src.match(/function isStructural[\s\S]*?\n}/)[0];
const fnSrc = src.match(/function findMidParagraphBreaks[\s\S]*?\n}/)[0];
// oxlint-disable-next-line no-implied-eval -- ソースから関数を抽出して実行する検証用ヘルパー
const findMidParagraphBreaks = new Function(
  isStructuralSrc + '\n' + fnSrc + '\nreturn findMidParagraphBreaks;',
)();

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

console.log('flagged lines:', findMidParagraphBreaks(body));
