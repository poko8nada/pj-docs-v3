/*
 * FEATURES: M-report
 * PURPOSE: プロジェクトの実コードファイルの冒頭ヘッダー一覧を出力する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWED_DIRS, CODE_EXTENSIONS, SKIP_DIRS } from '../../../../constants/index.mjs';

// ---- 設定（constants/index.mjs から import）----
const codeExtensions = new Set(CODE_EXTENSIONS);
const allowedDirs = new Set(ALLOWED_DIRS);
const skipDirNames = new Set(SKIP_DIRS);

// プロジェクトルート（スクリプトの場所から解決する。どの cwd からでも動く）
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

/** 実コードファイルかどうか（拡張子・テスト・ホワイトリストで判定） */
export function isCodeFile(rel) {
  const ext = path.extname(rel).toLowerCase();
  if (!codeExtensions.has(ext)) {
    return false;
  }
  const base = path.basename(rel);
  if (/\.(test|spec)\./.test(base)) {
    return false;
  }
  // 依存・生成物ディレクトリはどの階層でも対象外
  if (rel.split('/').some((seg) => skipDirNames.has(seg))) {
    return false;
  }
  // ルート直下のファイル、または許可ディレクトリ配下のみ対象
  const segments = rel.split('/');
  if (segments.length === 1) {
    return true;
  }
  return allowedDirs.has(segments[0]);
}

/** ヘッダーコメントを解析する。見つからなければ null */
export function parseHeaderText(text) {
  const match = text.match(/^\/\*\r?\n([\s\S]*?)\*\//);
  if (!match) {
    return null;
  }

  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^\s*\*\s*(FEATURES|PURPOSE|STATUS):\s*(.*?)\s*$/);
    if (m) {
      fields[m[1]] = m[2];
    }
  }
  return fields;
}

/** プロジェクト内のファイルを再帰的に集める（スキップ対象のディレクトリ名は除外） */
function walkFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirNames.has(entry.name)) {
        continue;
      }
      files.push(...walkFiles(abs));
    } else if (entry.isFile()) {
      files.push(abs);
    }
  }
  return files;
}

/** 全実コードファイルのヘッダー情報を収集する（読み取り専用。ホワイトリスト配下のみ） */
export function collectHeaders(projectRoot = PROJECT_ROOT) {
  const headers = [];
  const absFiles = [];
  for (const entry of fs.readdirSync(projectRoot, { withFileTypes: true })) {
    const abs = path.join(projectRoot, entry.name);
    if (entry.isDirectory()) {
      if (allowedDirs.has(entry.name) && !skipDirNames.has(entry.name)) {
        absFiles.push(...walkFiles(abs));
      }
    } else if (entry.isFile()) {
      absFiles.push(abs);
    }
  }
  for (const abs of absFiles) {
    const rel = path.relative(projectRoot, abs);
    if (!isCodeFile(rel)) {
      continue;
    }
    const fields = parseHeaderText(fs.readFileSync(abs, 'utf8'));
    headers.push({ rel, fields });
  }
  return headers;
}

/** ヘッダー一覧を出力する */
function main() {
  const headers = collectHeaders();
  for (const { rel, fields } of headers) {
    if (!fields) {
      console.log(`${rel}: missing header`);
      continue;
    }
    console.log(rel);
    console.log(`  FEATURES: ${fields.FEATURES ?? '-'}`);
    console.log(`  PURPOSE: ${fields.PURPOSE ?? '-'}`);
    console.log(`  STATUS: ${fields.STATUS ?? '-'}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
