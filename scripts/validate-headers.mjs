/*
 * FEATURES: M-validate
 * PURPOSE: コミットゲートとして実コードファイルの冒頭ヘッダーを検証する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALLOWED_DIRS,
  CODE_EXTENSIONS,
  PATTERN_IDS,
  PRODUCTS_DIR,
  SKIP_DIRS,
} from '../constants/index.mjs';

// ---- 設定（constants/index.mjs から import）----
const codeExtensions = new Set(CODE_EXTENSIONS);
const allowedDirs = new Set(ALLOWED_DIRS);
const skipDirNames = new Set(SKIP_DIRS);

/**
 * 実コードファイルかどうか（拡張子・テスト・ホワイトリストで判定）
 */
export function isCodeFile(projectRoot, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!codeExtensions.has(ext)) {
    return false;
  }
  const base = path.basename(filePath);
  if (/\.(test|spec)\./.test(base)) {
    return false;
  }
  // 型宣言ファイル（.d.ts）は設定・宣言扱いでヘッダー対象外
  if (base.endsWith('.d.ts')) {
    return false;
  }
  const rel = path.relative(projectRoot, filePath);
  // 依存・生成物ディレクトリはどの階層でも対象外
  if (rel.split('/').some((seg) => skipDirNames.has(seg))) {
    return false;
  }
  // 許可ディレクトリ配下のみ対象（ルート直下は設定ファイル等が置かれるため一律対象外）
  // ルート直下の .ts/.js（forConfig.ts 等）を実コードと誤判定しないための規約
  const segments = rel.split('/');
  return segments.length > 1 && allowedDirs.has(segments[0]);
}

/**
 * ヘッダーコメントのテキストを解析する。見つからなければ null。
 */
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

/**
 * ファイル冒頭のヘッダーコメントを解析する。見つからなければ null。
 */
export function parseHeader(filePath) {
  return parseHeaderText(fs.readFileSync(filePath, 'utf8'));
}

/**
 * 最新の products/ スナップショットから F-* 機能ID を収集する。
 */
export function loadFeatureIds(projectRoot) {
  const dir = path.join(projectRoot, PRODUCTS_DIR);
  if (!fs.existsSync(dir)) {
    return new Set();
  }
  const snapshots = fs
    .readdirSync(dir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}-\d{3}\.md$/.test(name))
    .toSorted()
    .toReversed();
  if (snapshots.length === 0) {
    return new Set();
  }
  const text = fs.readFileSync(path.join(dir, snapshots[0]), 'utf8');
  const ids = new Set();
  for (const m of text.matchAll(/F-[a-z][a-z0-9]*(\.[a-z0-9]+)+/g)) {
    ids.add(m[0]);
  }
  return ids;
}

/**
 * ヘッダー検証。違反の一覧を返す（空配列なら問題なし）。
 */
export function collectViolations(projectRoot, files) {
  const patternIds = new Set(PATTERN_IDS);
  const featureIds = loadFeatureIds(projectRoot);
  const violations = [];

  for (const filePath of files) {
    if (!isCodeFile(projectRoot, filePath)) {
      continue;
    }
    const fields = parseHeader(filePath);
    if (!fields) {
      violations.push(`${path.relative(projectRoot, filePath)}: missing header`);
      continue;
    }

    const features = (fields.FEATURES ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (features.length === 0) {
      violations.push(`${path.relative(projectRoot, filePath)}: FEATURES is empty`);
    }
    for (const id of features) {
      if (id.startsWith('H-') || id.startsWith('M-')) {
        if (!patternIds.has(id)) {
          violations.push(`${path.relative(projectRoot, filePath)}: unknown pattern ID "${id}"`);
        }
      } else if (id.startsWith('F-') && !featureIds.has(id)) {
        violations.push(`${path.relative(projectRoot, filePath)}: unknown feature ID "${id}"`);
      }
    }
    if (!fields.PURPOSE) {
      violations.push(`${path.relative(projectRoot, filePath)}: PURPOSE is missing`);
    } else if (!/\(isDone: (true|false)\)/.test(fields.PURPOSE)) {
      violations.push(
        `${path.relative(projectRoot, filePath)}: PURPOSE must end with (isDone: true|false)`,
      );
    }
    if (
      !fields.STATUS ||
      !/sizeDrift=(true|false)/.test(fields.STATUS) ||
      !/driftSuspected=(true|false)/.test(fields.STATUS)
    ) {
      violations.push(
        `${path.relative(projectRoot, filePath)}: STATUS must declare sizeDrift and driftSuspected`,
      );
    }
  }

  return violations;
}

// ---- エントリポイント ----
function main() {
  const [, , mode, ...files] = process.argv;
  const projectRoot = process.cwd();

  if (mode !== 'check') {
    process.stderr.write(`Usage: node scripts/validate-headers.mjs check <files...>\n`);
    process.exit(1);
  }

  const violations = collectViolations(
    projectRoot,
    files.map((f) => path.resolve(projectRoot, f)),
  );
  if (violations.length > 0) {
    process.stderr.write(`Header check failed:\n${violations.map((v) => `- ${v}`).join('\n')}\n`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
