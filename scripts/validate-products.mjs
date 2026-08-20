/*
 * FEATURES: M-validate
 * PURPOSE: products/ スナップショットの形式と整合性を検証する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
/**
 * products/ のスナップショットを検証する（lefthook pre-commit が実行）。
 * - 命名: YYYY-MM-DD-<seq>.md、seq は欠番なく増える
 * - frontmatter: date / context / changed / removed の形式
 * - 本文: ## <ID>: <名前> 見出し + バレットのみ
 * - 整合: changed に無いセクションは前スナップショットと同一、changed にあるセクションは変化している
 * - 削除: removed にあるセクションは前スナップショットに存在し、今回存在しない。改名は removed + changed の組み合わせ
 * - 先頭: 前スナップショットが無いため removed は宣言できない
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCTS_DIR } from '../constants/index.mjs';

const DEFAULT_PRODUCTS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  PRODUCTS_DIR,
);
const SECTION_ID = /^(G|D|B|F|C)-[A-Za-z0-9.]+$/;
const LAYER_ID = /^(Goal|Discover|Build)$/;
const FILE_NAME = /^(\d{4}-\d{2}-\d{2})-(\d{3})\.md$/;

/** セクションIDとして有効か（レイヤー見出しまたはプレフィックス付きID） */
function isValidSectionId(id) {
  return SECTION_ID.test(id) || LAYER_ID.test(id);
}

/** @returns {string[]} ソート済みのスナップショットファイル名 */
export function listSnapshots(productsDir = DEFAULT_PRODUCTS_DIR) {
  if (!fs.existsSync(productsDir)) {
    return [];
  }
  return fs
    .readdirSync(productsDir)
    .filter((f) => FILE_NAME.test(f))
    .toSorted();
}

/**
 * @param {string} text ファイル全体
 * @returns {{ date?: string, context?: string, changed?: string[], removed?: string[] } | null}
 */
export function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) {
    return null;
  }
  /** @type {Record<string, string | string[]>} */
  const fields = {};
  let listKey = null;
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z]+):\s*(.*)$/);
    if (kv) {
      listKey = kv[1];
      fields[listKey] = kv[2] === '' ? [] : kv[2];
    } else if (listKey && /^\s+- /.test(line)) {
      const list = fields[listKey];
      if (Array.isArray(list)) {
        list.push(line.trim().slice(2));
      } else {
        fields[listKey] = [line.trim().slice(2)];
      }
    }
  }
  return fields;
}

/**
 * @param {string} body frontmatter を除いた本文
 * @returns {Record<string, string[]>} セクションID → 行の配列
 */
export function parseSections(body) {
  /** @type {Record<string, string[]>} */
  const sections = {};
  let id = null;
  let lines = [];
  for (const line of body.split('\n')) {
    const layer = line.match(/^## ([^:]+)(?::|$)/);
    const child = line.match(/^### ([^:]+)(?::|$)/);
    if (layer) {
      if (id) {
        sections[id] = lines;
      }
      id = null;
      lines = [];
    } else if (child) {
      if (id) {
        sections[id] = lines;
      }
      id = child[1].trim();
      lines = [];
    } else if (id) {
      lines.push(line);
    }
  }
  if (id) {
    sections[id] = lines;
  }
  return sections;
}

/**
 * @param {string} file ファイル名
 * @param {string} productsDir スナップショットのディレクトリ
 * @returns {{ file: string, seq: number, fm: Record<string, string | string[]>, sections: Record<string, string[]>, errors: string[] }}
 */
export function validate(file, productsDir = DEFAULT_PRODUCTS_DIR) {
  const errors = [];
  const text = fs.readFileSync(path.join(productsDir, file), 'utf8');
  const fm = parseFrontmatter(text);
  if (!fm) {
    errors.push(`${file}: frontmatter is missing or malformed`);
    return { file, seq: 0, fm: {}, sections: {}, errors };
  }

  const nameMatch = file.match(FILE_NAME);
  const fileDate = nameMatch[1];
  const seq = Number(nameMatch[2]);

  if (fm.date !== fileDate) {
    errors.push(`${file}: frontmatter date (${fm.date}) does not match filename (${fileDate})`);
  }
  if (!fm.context || fm.context.trim() === '') {
    errors.push(`${file}: context is required`);
  }

  const changed = Array.isArray(fm.changed) ? fm.changed : [];
  for (const id of changed) {
    if (!isValidSectionId(id)) {
      errors.push(`${file}: invalid changed ID "${id}"`);
    }
  }

  const removed = Array.isArray(fm.removed) ? fm.removed : [];
  for (const id of removed) {
    if (!isValidSectionId(id)) {
      errors.push(`${file}: invalid removed ID "${id}"`);
    }
  }

  const body = text.replace(/^---\n[\s\S]*?\n---\n/, '');
  const sections = parseSections(body);
  for (const [id, lines] of Object.entries(sections)) {
    if (!isValidSectionId(id)) {
      errors.push(`${file}: invalid section heading ID "${id}"`);
    }
    for (const line of lines) {
      if (line.trim() !== '' && !line.startsWith('- ') && !line.startsWith('### ')) {
        errors.push(`${file}: non-bullet content in section ${id}: "${line.trim()}"`);
      }
    }
  }

  return { file, seq, fm, sections, errors };
}

/** 2つの行配列が同一か */
export function sameLines(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** @returns {string[]} 全スナップショットの検証エラー一覧 */
export function collectErrors(productsDir = DEFAULT_PRODUCTS_DIR) {
  const files = listSnapshots(productsDir);
  const errors = [];
  const parsed = files.map((f) => validate(f, productsDir));
  for (const p of parsed) {
    errors.push(...p.errors);
  }

  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i].seq !== i + 1) {
      errors.push(`${parsed[i].file}: seq ${parsed[i].seq} is out of order (expected ${i + 1})`);
    }
  }

  // 先頭スナップショットは前が無いため removed は意味を持たない
  if (parsed.length > 0) {
    const first = parsed[0];
    const removed = Array.isArray(first.fm.removed) ? first.fm.removed : [];
    if (removed.length > 0) {
      errors.push(
        `${first.file}: removed has no effect in the first snapshot (no previous snapshot)`,
      );
    }
  }

  for (let i = 1; i < parsed.length; i++) {
    const prev = parsed[i - 1];
    const curr = parsed[i];
    const changed = Array.isArray(curr.fm.changed) ? curr.fm.changed : [];
    const removed = Array.isArray(curr.fm.removed) ? curr.fm.removed : [];
    for (const id of removed) {
      if (changed.includes(id)) {
        errors.push(`${curr.file}: removed ID "${id}" overlaps changed`);
      }
      if (!prev.sections[id]) {
        errors.push(`${curr.file}: removed section ${id} does not exist in previous snapshot`);
      }
      if (curr.sections[id]) {
        errors.push(`${curr.file}: removed section ${id} still exists`);
      }
    }
    for (const [id, lines] of Object.entries(prev.sections)) {
      if (removed.includes(id)) {
        continue;
      }
      if (changed.includes(id)) {
        if (!curr.sections[id]) {
          errors.push(`${curr.file}: changed section ${id} is missing`);
        } else if (sameLines(lines, curr.sections[id])) {
          errors.push(`${curr.file}: changed section ${id} is unchanged`);
        }
      } else if (!sameLines(lines, curr.sections[id])) {
        errors.push(`${curr.file}: unchanged section ${id} differs from previous snapshot`);
      }
    }
    for (const id of Object.keys(curr.sections)) {
      if (!prev.sections[id] && !changed.includes(id)) {
        errors.push(`${curr.file}: new section ${id} is not listed in changed`);
      }
    }
  }
  return errors;
}

function main() {
  const errors = collectErrors();
  if (errors.length > 0) {
    for (const e of errors) {
      console.error(`× ${e}`);
    }
    process.exit(1);
  }
  const files = listSnapshots();
  console.log(`products/: ${files.length} snapshot(s) OK`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
