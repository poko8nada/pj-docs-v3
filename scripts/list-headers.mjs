/*
 * FEATURES: M-report
 * PURPOSE: 実コードファイルのヘッダー一覧を表示する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isCodeFile, parseHeader } from './validate-headers.mjs';

// プロジェクトルート配下の実コードファイルを再帰的に収集する
// （依存・生成物ディレクトリは isCodeFile 側で除外される）
function collectCodeFiles(projectRoot, dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectCodeFiles(projectRoot, abs));
    } else if (entry.isFile() && isCodeFile(projectRoot, abs)) {
      files.push(abs);
    }
  }
  return files;
}

function main() {
  const projectRoot = process.cwd();
  const files = collectCodeFiles(projectRoot, projectRoot).toSorted();

  if (files.length === 0) {
    console.log('No code files found.');
    return;
  }

  for (const abs of files) {
    const rel = path.relative(projectRoot, abs);
    const fields = parseHeader(abs);
    if (!fields) {
      console.log(`${rel}: (no header)`);
      continue;
    }
    const features = fields.FEATURES ?? '';
    const purpose = fields.PURPOSE ?? '';
    const status = fields.STATUS ?? '';
    console.log(`${rel}: FEATURES=${features} | PURPOSE=${purpose} | STATUS=${status}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
