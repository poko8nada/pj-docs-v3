/*
 * FEATURES: S-verify
 * PURPOSE: プロダクト作業ドキュメントの完成度（必須セクション・F-* 定義・C-* 形式）を検証する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
/**
 * 作業ドキュメント（1件目）の完成度を確認する。
 * productスキルの Create 手順の最後にエージェントが実行する。
 * - 1件目に必須セクションIDが全て揃っているか
 * - 機能（F-*）が定義されているか
 * - 未完成のまま2件目以降のスナップショットが作られていないか
 * exit 0 = 完成 / exit 1 = 未完成またはルール違反
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCTS_DIR } from '../../../../constants/index.mjs';

const PRODUCTS_DIR_ABS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../',
  PRODUCTS_DIR,
);
const FILE_NAME = /^(\d{4}-\d{2}-\d{2})-(\d{3})\.md$/;
const REQUIRED_IDS = [
  'G-what',
  'G-outcome',
  'G-nongoal',
  'D-name',
  'D-stack',
  'B-roadmap',
  'B-test',
  'B-deploy',
  'B-scope',
];
// frontend: true の場合のみ必須（D-stack の frontend は必須項目）
const FRONTEND_IDS = ['D-look'];

/** @returns {string[]} ソート済みのスナップショットファイル名 */
function listSnapshots() {
  if (!fs.existsSync(PRODUCTS_DIR_ABS)) {
    return [];
  }
  return fs
    .readdirSync(PRODUCTS_DIR_ABS)
    .filter((f) => FILE_NAME.test(f))
    .toSorted();
}

/** @param {string} text @returns {string[]} 本文中のセクションID */
function sectionIds(text) {
  const ids = [];
  for (const line of text.split('\n')) {
    const h = line.match(/^## ([^:]+):/);
    if (h) {
      ids.push(h[1].trim());
    }
  }
  return ids;
}

/** @param {string} text @param {string} id @returns {string} セクション本文（見出し行含む） */
function sectionContent(text, id) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`## ${id}:`));
  if (start === -1) {
    return '';
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

/** @param {string} stackSection @returns {boolean | null} frontend 値（未定義なら null） */
function frontendValue(stackSection) {
  const m = stackSection.match(/^\s*-\s*frontend:\s*(true|false)\s*$/m);
  return m ? m[1] === 'true' : null;
}

function main() {
  const files = listSnapshots();
  if (files.length === 0) {
    console.log('products/: no snapshots yet. Nothing to check.');
    return;
  }

  const first = files[0];
  const text = fs.readFileSync(path.join(PRODUCTS_DIR_ABS, first), 'utf8');
  const ids = sectionIds(text);
  const errors = [];

  const missing = REQUIRED_IDS.filter((id) => !ids.includes(id));
  // D-look は frontend: true の場合のみ必須。frontend 自体は必須項目。
  const frontend = frontendValue(sectionContent(text, 'D-stack'));
  if (frontend === null) {
    errors.push(`working document (${first}) is missing frontend: <true/false> in D-stack`);
  } else if (frontend) {
    for (const id of FRONTEND_IDS) {
      if (!ids.includes(id)) {
        missing.push(id);
      }
    }
  }
  if (missing.length > 0) {
    errors.push(`working document (${first}) is incomplete; missing: ${missing.join(', ')}`);
  }
  if (!ids.some((id) => id.startsWith('F-'))) {
    errors.push(`working document (${first}) has no feature (F-*) section`);
  }
  // C-*（Common）は任意。存在する場合は命名形式を検証する
  for (const cId of ids.filter((id) => id.startsWith('C-'))) {
    if (!/^C-[a-z][a-z0-9]*$/.test(cId)) {
      errors.push(`working document (${first}) has an invalid Common ID: ${cId}`);
    }
  }
  if (missing.length > 0 && files.length > 1) {
    errors.push(
      `snapshot #2+ exists while the working document is incomplete: ${files.slice(1).join(', ')}`,
    );
  }

  if (errors.length > 0) {
    for (const e of errors) {
      console.error(`× ${e}`);
    }
    process.exit(1);
  }
  console.log(`working document (${first}) is complete. v1 can be frozen.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
