/*
 * FEATURES: S-sync
 * PURPOSE: opencode と Cursor のスキルディレクトリを双方向同期する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
/**
 * Cursor と opencode のスキルを双方向同期するスクリプト（プロジェクト同士）
 *
 * 使い方:
 *   node sync.mjs check            # 差分を表示（変更なし）
 *   node sync.mjs push                # .opencode/skills → .cursor/skills にコピー
 *   node sync.mjs pull                # .cursor/skills → .opencode/skills にコピー
 *   共通オプション: --dry-run（プレビューのみ）, --force（mtime 無視で上書き）, --project=<path>
 *   --skill=<name> を繰り返し指定すると、対象をそのスキルのみに絞る（check/push/pull 共通）
 *
 * コンフリクト時は mtime が新しい方が勝ち（--force で指定方向に強制コピー）。
 * exceptions.json にサイド別で列挙したスキルは同期対象外（存在しない名前は警告のみで続行）。
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  utimesSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(SCRIPT_DIR, '..');
const EXCEPTIONS_FILE = join(SKILL_DIR, 'exceptions.json');

// 引数解析
const args = process.argv.slice(2);
const command = args.find((a) => ['check', 'push', 'pull'].includes(a)) ?? 'check';
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const projectArg = args.find((a) => a.startsWith('--project='))?.split('=')[1];
// --skill=<name> の繰り返し指定を収集（未指定なら全スキル）
const skillFilter = new Set(
  args.filter((a) => a.startsWith('--skill=')).map((a) => a.split('=')[1]),
);
// プロジェクトルートをスクリプト自身の位置から導出（cwd に依存しない）
// <project>/.opencode/skills/<skill>/scripts の 4 階層上がルート
const projectRoot = projectArg ? resolve(projectArg) : resolve(SCRIPT_DIR, '..', '..', '..', '..');

// 同期対象: プロジェクト内の両スキルディレクトリ（グローバルは対象外）
const opencodeSkillsDir = join(projectRoot, '.opencode', 'skills');
const cursorSkillsDir = join(projectRoot, '.cursor', 'skills');

// 例外スキル一覧（サイド別）。skill-sync 自身は常に除外。
const exceptions = readExceptions();

// 例外対象かどうか（skill-sync 自身は常に除外）
function isExcluded(skill) {
  return skill === 'skill-sync' || exceptions.opencode.has(skill) || exceptions.cursor.has(skill);
}

// exceptions.json に存在しないスキル名を警告する（処理は止めない）
function warnUnknownExceptions(openSkills, cursorSkills) {
  const known = new Set([...openSkills, ...cursorSkills]);
  for (const name of [...exceptions.opencode, ...exceptions.cursor]) {
    if (!known.has(name)) {
      console.warn(`[skill-sync] exceptions.json に存在しないスキル名: ${name}（無視）`);
    }
  }
}

function readExceptions() {
  if (!existsSync(EXCEPTIONS_FILE)) {
    return { opencode: new Set(), cursor: new Set() };
  }
  try {
    const data = JSON.parse(readFileSync(EXCEPTIONS_FILE, 'utf8'));
    if (Array.isArray(data)) {
      // 旧形式（配列）: 両側に適用
      return { opencode: new Set(data), cursor: new Set(data) };
    }
    return {
      opencode: new Set(Array.isArray(data.opencode) ? data.opencode : []),
      cursor: new Set(Array.isArray(data.cursor) ? data.cursor : []),
    };
  } catch (error) {
    console.error(`[skill-sync] Failed to read ${EXCEPTIONS_FILE}: ${error.message}`);
    process.exit(1);
    return { opencode: new Set(), cursor: new Set() };
  }
}

// --skill で絞り込む。存在しない名前は warning を出して対象から外す
function applySkillFilter(skills) {
  if (skillFilter.size === 0) {
    return skills;
  }
  const filtered = skills.filter((s) => skillFilter.has(s));
  for (const wanted of skillFilter) {
    if (!filtered.includes(wanted)) {
      console.warn(`[skill-sync] --skill=${wanted} は存在しないか、対象外です（無視）`);
    }
  }
  return filtered;
}

// ディレクトリ直下のスキル名一覧（SKILL.md を持つディレクトリのみ）
function listSkills(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'SKILL.md')))
    .map((e) => e.name);
}

// スキル内で最も新しいファイルの mtime（ミリ秒単位に丸める）
// サブミリ秒の差で同期が ping-pong するのを防ぐ
function newestMtime(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, newestMtime(p));
    } else {
      newest = Math.max(newest, Math.round(statSync(p).mtimeMs));
    }
  }
  return newest;
}

// スキルディレクトリを再帰コピー（上書きのみ、削除はしない）
function copySkill(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) {
      copySkill(from, to);
    } else {
      copyFileSync(from, to);
      // mtime をソースに合わせる（同期後の ping-pong を防ぐ）
      const stat = statSync(from);
      utimesSync(to, stat.atime, stat.mtime);
    }
  }
}

// スキルごとの状態を返す
function stateOf(skill, openMtime, cursorMtime) {
  if (cursorMtime === 0) {
    return 'only-opencode';
  }
  if (openMtime === 0) {
    return 'only-cursor';
  }
  if (openMtime === cursorMtime) {
    return 'same';
  }
  return openMtime > cursorMtime ? 'opencode-newer' : 'cursor-newer';
}

const STATE_LABELS = {
  'only-opencode': 'only in opencode (push would copy)',
  'only-cursor': 'only in Cursor (pull would copy)',
  same: 'same',
  'opencode-newer': 'newer in opencode (push would copy)',
  'cursor-newer': 'newer in Cursor (pull would copy)',
};

function main() {
  const openSkills = listSkills(opencodeSkillsDir);
  const cursorSkills = listSkills(cursorSkillsDir);
  warnUnknownExceptions(openSkills, cursorSkills);

  if (command === 'check') {
    const all = applySkillFilter(
      [...new Set([...openSkills, ...cursorSkills])].filter((s) => !isExcluded(s)),
    );
    console.log(`opencode: ${opencodeSkillsDir}`);
    console.log(`Cursor:   ${cursorSkillsDir}`);
    if (all.length === 0) {
      console.log('No skills to compare.');
    } else {
      console.log('\nSkill status:');
      for (const skill of all) {
        const openMtime = openSkills.includes(skill)
          ? newestMtime(join(opencodeSkillsDir, skill))
          : 0;
        const cursorMtime = cursorSkills.includes(skill)
          ? newestMtime(join(cursorSkillsDir, skill))
          : 0;
        const state = stateOf(skill, openMtime, cursorMtime);
        console.log(`  ${skill.padEnd(24)} ${STATE_LABELS[state]}`);
      }
    }
    // 除外スキルをサイド別に表示（check で見えるようにする）
    const exOpen = [...exceptions.opencode].filter((s) => openSkills.includes(s));
    const exCursor = [...exceptions.cursor].filter((s) => cursorSkills.includes(s));
    if (exOpen.length || exCursor.length) {
      console.log('\nExcluded:');
      if (exOpen.length) {
        console.log(`  opencode-side: ${exOpen.join(', ')}`);
      }
      if (exCursor.length) {
        console.log(`  cursor-side:   ${exCursor.join(', ')}`);
      }
    }
    return;
  }

  // push: opencode → Cursor / pull: Cursor → opencode
  const sourceDir = command === 'push' ? opencodeSkillsDir : cursorSkillsDir;
  const destDir = command === 'push' ? cursorSkillsDir : opencodeSkillsDir;

  if (!existsSync(sourceDir)) {
    console.error(`[skill-sync] Source directory not found: ${sourceDir}`);
    process.exit(1);
  }

  const sourceSkills = applySkillFilter(listSkills(sourceDir).filter((s) => !isExcluded(s)));
  let copied = 0;
  let skipped = 0;

  for (const skill of sourceSkills) {
    const src = join(sourceDir, skill);
    const dest = join(destDir, skill);
    const srcMtime = newestMtime(src);
    const destMtime = existsSync(dest) ? newestMtime(dest) : 0;

    // mtime が新しい方が勝ち。--force なら常にコピー
    if (!force && destMtime > srcMtime) {
      console.log(`  skip ${skill} (newer in destination)`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  would copy ${skill} (${command})`);
    } else {
      copySkill(src, dest);
      console.log(`  copied ${skill} (${command})`);
    }
    copied++;
  }

  console.log(`\n${dryRun ? 'Would copy' : 'Copied'} ${copied} skill(s), skipped ${skipped}.`);
}

main();
