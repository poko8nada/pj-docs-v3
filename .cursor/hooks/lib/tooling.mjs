/*
 * FEATURES: H-transformer
 * PURPOSE: フォーマット / 検証ツールのインストール有無を判定する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
import { access } from 'node:fs/promises';
import { join } from 'node:path';

const FORMAT_PACKAGES = ['oxfmt'];
// typecheck は scripts/typecheck-staged.mjs が tsc を直接実行するため tsc-files は不要
const VERIFY_PACKAGES = ['oxfmt', 'oxlint', 'typescript'];

export async function hasFormatTooling(projectRoot) {
  return hasPackages(projectRoot, FORMAT_PACKAGES);
}

export async function getMissingVerifyTooling(projectRoot) {
  const results = await Promise.all(VERIFY_PACKAGES.map((name) => hasPackage(projectRoot, name)));
  return VERIFY_PACKAGES.filter((_, i) => !results[i]);
}

async function hasPackages(projectRoot, packageNames) {
  for (const packageName of packageNames) {
    // oxlint-disable-next-line no-await-in-loop -- 最初の欠落で即 return する意図的な短絡評価
    if (!(await hasPackage(projectRoot, packageName))) {
      return false;
    }
  }

  return true;
}

async function hasPackage(projectRoot, packageName) {
  try {
    await access(join(projectRoot, 'node_modules', packageName));
    return true;
  } catch {
    return false;
  }
}
