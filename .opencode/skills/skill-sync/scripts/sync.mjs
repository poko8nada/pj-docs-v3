/*
 * FEATURES: S-sync
 * PURPOSE: opencode・Cursor・CommandCode のスキルディレクトリを双方向同期し、サイド固有フロントマター（when_to_use）を維持する (isDone: true)
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
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKIP_DIRS } from '../../../../constants/index.mjs';

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

// 同期対象: プロジェクト内の各ハーネスのスキルディレクトリ（グローバルは対象外）
const SIDES = {
  opencode: join(projectRoot, '.opencode', 'skills'),
  cursor: join(projectRoot, '.cursor', 'skills'),
  commandcode: join(projectRoot, '.commandcode', 'skills'),
};

// 例外スキル一覧（サイド別）。skill-sync 自身は常に除外。
const exceptions = readExceptions();

// 例外対象かどうか（skill-sync 自身は常に除外。いずれかのサイドで除外されていれば対象外）
function isExcluded(skill) {
  return skill === 'skill-sync' || Object.values(exceptions).some((set) => set.has(skill));
}

// exceptions.json に存在しないスキル名を警告する（処理は止めない）
function warnUnknownExceptions(skillsBySide) {
  const known = new Set(Object.values(skillsBySide).flat());
  for (const set of Object.values(exceptions)) {
    for (const name of set) {
      if (!known.has(name)) {
        console.warn(`[skill-sync] exceptions.json に存在しないスキル名: ${name}（無視）`);
      }
    }
  }
}

function readExceptions() {
  const empty = { opencode: new Set(), cursor: new Set(), commandcode: new Set() };
  if (!existsSync(EXCEPTIONS_FILE)) {
    return empty;
  }
  try {
    const data = JSON.parse(readFileSync(EXCEPTIONS_FILE, 'utf8'));
    if (Array.isArray(data)) {
      // 旧形式（配列）: 全サイドに適用
      return { opencode: new Set(data), cursor: new Set(data), commandcode: new Set(data) };
    }
    const result = {};
    for (const side of Object.keys(SIDES)) {
      result[side] = new Set(Array.isArray(data[side]) ? data[side] : []);
    }
    return result;
  } catch (error) {
    console.error(`[skill-sync] Failed to read ${EXCEPTIONS_FILE}: ${error.message}`);
    process.exit(1);
    return empty;
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

// 同期対象外の生成物ディレクトリ（どの階層でも除外。コピーにも mtime 判定にも含めない）
const skipDirNames = new Set(SKIP_DIRS);

// スキル内で最も新しいファイルの mtime（ミリ秒単位に丸める）
// サブミリ秒の差で同期が ping-pong するのを防ぐ
function newestMtime(dir) {
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

// ---- SKILL.md のサイド固有フロントマター処理 ----
// commandcode の SKILL.md には when_to_use（スキル発動キーワード）が追加されている。
// 他サイドへコピーするときは除外し、commandcode へコピーするときは宛先の値を維持する。

// frontmatter（--- で挟まれた先頭ブロック）を分解する
function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) {
    return { head: null, body: text };
  }
  return { head: m[1], body: text.slice(m[0].length) };
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
function mergeWhenToUse(srcText, destText) {
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
function stripWhenToUse(text) {
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

// check: 3辺の状態を表示する
function runCheck(skillsBySide) {
  const all = applySkillFilter(
    [...new Set(Object.values(skillsBySide).flat())].filter((s) => !isExcluded(s)),
  );
  for (const [name, dir] of Object.entries(SIDES)) {
    console.log(`${name.padEnd(12)} ${dir}`);
  }
  if (all.length === 0) {
    console.log('No skills to compare.');
  } else {
    console.log('\nSkill status:');
    for (const skill of all) {
      const mtimes = {};
      for (const [name, dir] of Object.entries(SIDES)) {
        mtimes[name] = skillsBySide[name].includes(skill) ? newestMtime(join(dir, skill)) : 0;
      }
      const maxMtime = Math.max(...Object.values(mtimes));
      const labels = Object.entries(mtimes).map(([name, m]) => {
        if (m === 0) {
          return `${name}:missing`;
        }
        return m === maxMtime ? `${name}:newest` : `${name}:older`;
      });
      console.log(`  ${skill.padEnd(24)} ${labels.join('  ')}`);
    }
  }
  // 除外スキルをサイド別に表示（check で見えるようにする）
  const shown = Object.entries(exceptions).filter(([side, set]) =>
    [...set].some((s) => skillsBySide[side].includes(s)),
  );
  if (shown.length > 0) {
    console.log('\nExcluded:');
    for (const [side, set] of shown) {
      const names = [...set].filter((s) => skillsBySide[side].includes(s));
      console.log(`  ${side}-side: ${names.join(', ')}`);
    }
  }
}

function main() {
  const skillsBySide = {};
  for (const [name, dir] of Object.entries(SIDES)) {
    skillsBySide[name] = listSkills(dir);
  }
  warnUnknownExceptions(skillsBySide);

  if (command === 'check') {
    runCheck(skillsBySide);
    return;
  }

  // push: opencode → {cursor, commandcode} / pull: {cursor, commandcode} → opencode
  // commandcode との間では SKILL.md の when_to_use を維持/除外する
  /** @type {Array<[string, string, ((src: string, dest: string) => string) | null]>} */
  const pairs =
    command === 'push'
      ? [
          ['opencode', 'cursor', null],
          ['opencode', 'commandcode', mergeWhenToUse],
        ]
      : [
          ['cursor', 'opencode', null],
          ['commandcode', 'opencode', stripWhenToUse],
        ];

  for (const [srcSide, destSide, transform] of pairs) {
    const sourceDir = SIDES[srcSide];
    const destDir = SIDES[destSide];

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
}

main();
