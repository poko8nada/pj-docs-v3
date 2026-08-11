#!/usr/bin/env node
/**
 * products/ のスナップショットを検証する（lefthook pre-commit が実行）。
 * - 命名: YYYY-MM-DD-<seq>.md、seq は欠番なく増える
 * - frontmatter: date / context / changed の形式
 * - 本文: ## <ID>: <名前> 見出し + バレットのみ
 * - 整合: changed に無いセクションは前スナップショットと同一、changed にあるセクションは変化している
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRODUCTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../products');
const SECTION_ID = /^(G|D|B|F)-[A-Za-z0-9.]+$/;
const FILE_NAME = /^(\d{4}-\d{2}-\d{2})-(\d{3})\.md$/;

/** @returns {string[]} ソート済みのスナップショットファイル名 */
function listSnapshots() {
  if (!fs.existsSync(PRODUCTS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(PRODUCTS_DIR)
    .filter((f) => FILE_NAME.test(f))
    .toSorted();
}

/**
 * @param {string} text ファイル全体
 * @returns {{ date?: string, context?: string, changed?: string[] } | null}
 */
function parseFrontmatter(text) {
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
function parseSections(body) {
  /** @type {Record<string, string[]>} */
  const sections = {};
  let id = null;
  let lines = [];
  for (const line of body.split('\n')) {
    const h = line.match(/^## ([^:]+):/);
    if (h) {
      if (id) {
        sections[id] = lines;
      }
      id = h[1].trim();
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
 * @returns {{ file: string, seq: number, fm: Record<string, string | string[]>, sections: Record<string, string[]>, errors: string[] }}
 */
function validate(file) {
  const errors = [];
  const text = fs.readFileSync(path.join(PRODUCTS_DIR, file), 'utf8');
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
    if (!SECTION_ID.test(id)) {
      errors.push(`${file}: invalid changed ID "${id}"`);
    }
  }

  const body = text.replace(/^---\n[\s\S]*?\n---\n/, '');
  const sections = parseSections(body);
  for (const [id, lines] of Object.entries(sections)) {
    if (!SECTION_ID.test(id)) {
      errors.push(`${file}: invalid section heading ID "${id}"`);
    }
    for (const line of lines) {
      if (line.trim() !== '' && !line.startsWith('- ')) {
        errors.push(`${file}: non-bullet content in section ${id}: "${line.trim()}"`);
      }
    }
  }

  return { file, seq, fm, sections, errors };
}

/** 2つの行配列が同一か */
function sameLines(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function main() {
  const files = listSnapshots();
  const errors = [];
  const parsed = files.map((f) => validate(f));
  for (const p of parsed) {
    errors.push(...p.errors);
  }

  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i].seq !== i + 1) {
      errors.push(`${parsed[i].file}: seq ${parsed[i].seq} is out of order (expected ${i + 1})`);
    }
  }

  for (let i = 1; i < parsed.length; i++) {
    const prev = parsed[i - 1];
    const curr = parsed[i];
    const changed = Array.isArray(curr.fm.changed) ? curr.fm.changed : [];
    for (const [id, lines] of Object.entries(prev.sections)) {
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

  if (errors.length > 0) {
    for (const e of errors) {
      console.error(`× ${e}`);
    }
    process.exit(1);
  }
  console.log(`products/: ${files.length} snapshot(s) OK`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
