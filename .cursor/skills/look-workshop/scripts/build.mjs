/*
 * FEATURES: S-build
 * PURPOSE: look-workshop 作業場を singlefile HTML にビルドし、findings/ へ出力する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
// look-workshop build — chrome 無し Vite build（singlefile）→ findings/look-workshop/<slug>.html
// 画像など外出し資産は findings/look-workshop/assets/ へマージ（既存は残す・同名は上書き）。
// 作業場（index.html / comments.json）は変更しない。
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  distDir,
  ensureDeps,
  ensureWorkspace,
  findingsLookWorkshopDir,
  makeSlug,
  repoRoot,
  workspaceDir,
} from './_paths.mjs';

const IMAGE_EXT = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.svg',
  '.ico',
  '.bmp',
]);

/** 画像ファイルかどうか（拡張子判定）。 */
function isImage(name) {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf('.');
  const ext = dot >= 0 ? lower.slice(dot) : '';
  return IMAGE_EXT.has(ext);
}

ensureDeps();
ensureWorkspace();

const build = spawnSync('pnpm', ['--ignore-workspace', '--dir', workspaceDir, 'run', 'build'], {
  stdio: 'inherit',
});
if (build.error || build.status !== 0) {
  process.stderr.write('[look-workshop] vite build に失敗しました\n');
  process.exit(build.status ?? 1);
}

const htmlSrc = join(distDir, 'index.html');
if (!existsSync(htmlSrc)) {
  process.stderr.write('[look-workshop] dist/index.html がありません\n');
  process.exit(1);
}

const slug = makeSlug();
const outputDir = findingsLookWorkshopDir();
const sharedAssets = join(outputDir, 'assets');
const htmlOut = join(outputDir, `${slug}.html`);

mkdirSync(outputDir, { recursive: true });
mkdirSync(sharedAssets, { recursive: true });
copyFileSync(htmlSrc, htmlOut);

/** dist 配下の画像を共有 assets へマージ（同名上書き・既存は残す）。 */
function mergeImageFiles(srcDir, destDir) {
  if (!existsSync(srcDir)) {
    return;
  }
  for (const name of readdirSync(srcDir)) {
    if (name === 'index.html') {
      continue;
    }
    const src = join(srcDir, name);
    const st = statSync(src);
    if (st.isDirectory()) {
      // dist/assets 配下のサブフォルダだけ辿る（dist 直下の assets ディレクトリ自体は別呼び出し）
      const dest = join(destDir, name);
      mkdirSync(dest, { recursive: true });
      mergeImageFiles(src, dest);
      continue;
    }
    if (!isImage(name)) {
      continue;
    }
    copyFileSync(src, join(destDir, name));
  }
}

// dist 直下の画像ファイル
if (existsSync(distDir)) {
  for (const name of readdirSync(distDir)) {
    if (name === 'index.html' || name === 'assets') {
      continue;
    }
    const src = join(distDir, name);
    if (!statSync(src).isFile()) {
      continue;
    }
    if (!isImage(name)) {
      continue;
    }
    copyFileSync(src, join(sharedAssets, name));
  }
}
mergeImageFiles(join(distDir, 'assets'), sharedAssets);

const relHtml = relative(repoRoot(), htmlOut);
process.stdout.write(`[look-workshop] Path: ${relHtml}\n`);
process.stdout.write(`[look-workshop] assets (shared): ${relative(repoRoot(), sharedAssets)}/\n`);
