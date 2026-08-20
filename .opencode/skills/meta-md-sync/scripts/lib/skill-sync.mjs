/*
 * FEATURES: S-source
 * PURPOSE: スキル同期のロジック（ディレクトリコピー・when_to_use 維持/除外・mtime 判定）を提供する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { SKIP_DIRS } from '../../../../../constants/index.mjs';
import { splitFrontmatter } from './frontmatter.mjs';

// 同期対象外の生成物ディレクトリ（どの階層でも除外。コピーにも mtime 判定にも含めない）
const skipDirNames = new Set(SKIP_DIRS);

// ディレクトリ直下のスキル名一覧（SKILL.md を持つディレクトリのみ）
export function listSkills(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'SKILL.md')))
    .map((e) => e.name);
}

// スキル内で最も新しいファイルの mtime（ミリ秒単位に丸める）
// サブミリ秒の差で同期が ping-pong するのを防ぐ
export function newestMtime(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // 生成物ディレクトリは mtime 判定から除外する
    if (entry.isDirectory() && skipDirNames.has(entry.name)) {
      continue;
    }
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, newestMtime(p));
    } else {
      newest = Math.max(newest, Math.round(statSync(p).mtimeMs));
    }
  }
  return newest;
}

// when_to_use 行を抽出する（無ければ null）
function extractWhenToUse(text) {
  const { head } = splitFrontmatter(text);
  if (!head) {
    return null;
  }
  return head.split('\n').find((l) => l.startsWith('when_to_use:')) ?? null;
}

// コピー先の when_to_use を維持した SKILL.md を合成する（push → commandcode 用）
export function mergeWhenToUse(srcText, destText) {
  const whenToUse = extractWhenToUse(destText);
  if (!whenToUse) {
    return srcText;
  }
  const src = splitFrontmatter(srcText);
  if (!src.head) {
    return srcText;
  }
  const lines = src.head.split('\n').filter((l) => !l.startsWith('when_to_use:'));
  lines.push(whenToUse);
  return `---\n${lines.join('\n')}\n---\n${src.body}`;
}

// when_to_use を除外した SKILL.md を返す（pull ← commandcode 用）
export function stripWhenToUse(text) {
  const fm = splitFrontmatter(text);
  if (!fm.head) {
    return text;
  }
  const lines = fm.head.split('\n').filter((l) => !l.startsWith('when_to_use:'));
  return `---\n${lines.join('\n')}\n---\n${fm.body}`;
}

// スキルディレクトリを再帰コピー（上書きのみ、削除はしない）
// transform が指定されている場合は SKILL.md にだけ適用する（サイド固有フロントマターの維持/除外）
function copySkill(src, dest, transform = null) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    // 生成物ディレクトリはコピーしない（node_modules のソケット等で失敗するため）
    if (entry.isDirectory() && skipDirNames.has(entry.name)) {
      continue;
    }
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) {
      copySkill(from, to, transform);
    } else if (transform && entry.name === 'SKILL.md') {
      const srcText = readFileSync(from, 'utf8');
      const destText = existsSync(to) ? readFileSync(to, 'utf8') : '';
      writeFileSync(to, transform(srcText, destText));
    } else {
      copyFileSync(from, to);
    }
    // mtime をソースに合わせる（同期後の ping-pong を防ぐ）
    const stat = statSync(from);
    utimesSync(to, stat.atime, stat.mtime);
  }
}

// スキルを同期する（mtime が新しい方が勝ち。--force なら常にコピー）
export function syncSkills({
  srcSide,
  destSide,
  sourceDir,
  destDir,
  skills,
  transform,
  dryRun,
  force,
}) {
  let copied = 0;
  let skipped = 0;

  for (const skill of skills) {
    const src = join(sourceDir, skill);
    const dest = join(destDir, skill);
    const srcMtime = newestMtime(src);
    const destMtime = existsSync(dest) ? newestMtime(dest) : 0;

    if (!force && destMtime > srcMtime) {
      console.log(`  skip ${skill} (newer in destination)`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  would copy ${skill} (${srcSide} → ${destSide})`);
    } else {
      copySkill(src, dest, transform);
      console.log(`  copied ${skill} (${srcSide} → ${destSide})`);
    }
    copied++;
  }

  console.log(
    `\n${srcSide} → ${destSide}: ${dryRun ? 'Would copy' : 'Copied'} ${copied} skill(s), skipped ${skipped}.`,
  );
}
