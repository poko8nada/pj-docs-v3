/*
 * FEATURES: S-sync
 * PURPOSE: opencode・Cursor・CommandCode のスキルとエージェントの同期をオーケストレーションする（対象列挙・check/push/pull 実行・結果出力） (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
/**
 * opencode・Cursor・CommandCode のスキルとエージェントを双方向同期するスクリプト（プロジェクト同士）
 *
 * 使い方:
 *   node sync.mjs check            # 差分を表示（変更なし）
 *   node sync.mjs push                # .opencode → .cursor / .commandcode にコピー
 *   node sync.mjs pull                # .cursor / .commandcode → .opencode にコピー
 *   共通オプション: --dry-run（プレビューのみ）, --force（mtime 無視で上書き）, --project=<path>
 *   --skill=<name> を繰り返し指定すると、対象をそのスキルのみに絞る（check/push/pull 共通）
 *   --agent=<name> を繰り返し指定すると、対象をそのエージェントのみに絞る（check/push/pull 共通）
 *
 * スキル: ディレクトリ全体をコピー。commandcode の when_to_use は push で維持 / pull で除外。
 * エージェント: description と body のみ同期。frontmatter（mode / model / permission / tools 等）は
 *   各ハーネスの値を維持するため、同一エージェント定義を全ハーネスで共有できる。
 *
 * コンフリクト時は mtime が新しい方が勝ち（--force で指定方向に強制コピー）。
 * exceptions.json にサイド別で列挙したスキルは同期対象外（存在しない名前は警告のみで続行）。
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listAgents, syncAgents } from './lib/agent-sync.mjs';
import {
  listSkills,
  mergeWhenToUse,
  newestMtime,
  stripWhenToUse,
  syncSkills,
} from './lib/skill-sync.mjs';

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
// --agent=<name> の繰り返し指定を収集（未指定なら全エージェント）
const agentFilter = new Set(
  args.filter((a) => a.startsWith('--agent=')).map((a) => a.split('=')[1]),
);
// プロジェクトルートをスクリプト自身の位置から導出（cwd に依存しない）
// <project>/.opencode/skills/<skill>/scripts の 4 階層上がルート
const projectRoot = projectArg ? resolve(projectArg) : resolve(SCRIPT_DIR, '..', '..', '..', '..');

// 同期対象: プロジェクト内の各ハーネスのスキル / エージェントディレクトリ（グローバルは対象外）
const SKILL_SIDES = {
  opencode: join(projectRoot, '.opencode', 'skills'),
  cursor: join(projectRoot, '.cursor', 'skills'),
  commandcode: join(projectRoot, '.commandcode', 'skills'),
};
const AGENT_SIDES = {
  opencode: join(projectRoot, '.opencode', 'agents'),
  cursor: join(projectRoot, '.cursor', 'agents'),
  commandcode: join(projectRoot, '.commandcode', 'agents'),
};

// 例外スキル一覧（サイド別）。meta-md-sync 自身は常に除外。
const exceptions = readExceptions();

// 例外対象かどうか（meta-md-sync 自身は常に除外。いずれかのサイドで除外されていれば対象外）
function isExcluded(skill) {
  return skill === 'meta-md-sync' || Object.values(exceptions).some((set) => set.has(skill));
}

// exceptions.json に存在しないスキル名を警告する（処理は止めない）
function warnUnknownExceptions(skillsBySide) {
  const known = new Set(Object.values(skillsBySide).flat());
  for (const set of Object.values(exceptions)) {
    for (const name of set) {
      if (!known.has(name)) {
        console.warn(`[meta-md-sync] exceptions.json に存在しないスキル名: ${name}（無視）`);
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
    for (const side of Object.keys(SKILL_SIDES)) {
      result[side] = new Set(Array.isArray(data[side]) ? data[side] : []);
    }
    return result;
  } catch (error) {
    console.error(`[meta-md-sync] Failed to read ${EXCEPTIONS_FILE}: ${error.message}`);
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
      console.warn(`[meta-md-sync] --skill=${wanted} は存在しないか、対象外です（無視）`);
    }
  }
  return filtered;
}

// --agent で絞り込む。存在しない名前は warning を出して対象から外す
function applyAgentFilter(agents) {
  if (agentFilter.size === 0) {
    return agents;
  }
  const filtered = agents.filter((a) => agentFilter.has(a));
  for (const wanted of agentFilter) {
    if (!filtered.includes(wanted)) {
      console.warn(`[meta-md-sync] --agent=${wanted} は存在しないか、対象外です（無視）`);
    }
  }
  return filtered;
}

// check: 3辺の状態を表示する（スキルとエージェント）
function runCheck(skillsBySide, agentsBySide) {
  const all = applySkillFilter(
    [...new Set(Object.values(skillsBySide).flat())].filter((s) => !isExcluded(s)),
  );
  for (const [name, dir] of Object.entries(SKILL_SIDES)) {
    console.log(`${name.padEnd(12)} ${dir}`);
  }
  if (all.length === 0) {
    console.log('No skills to compare.');
  } else {
    console.log('\nSkill status:');
    for (const skill of all) {
      const mtimes = {};
      for (const [name, dir] of Object.entries(SKILL_SIDES)) {
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
  // エージェントの状態
  const allAgents = applyAgentFilter([...new Set(Object.values(agentsBySide).flat())]);
  if (allAgents.length === 0) {
    console.log('\nNo agents to compare.');
  } else {
    console.log('\nAgent status:');
    for (const agent of allAgents) {
      const mtimes = {};
      for (const [name, dir] of Object.entries(AGENT_SIDES)) {
        const p = join(dir, `${agent}.md`);
        mtimes[name] = agentsBySide[name].includes(agent) ? Math.round(statSync(p).mtimeMs) : 0;
      }
      const maxMtime = Math.max(...Object.values(mtimes));
      const labels = Object.entries(mtimes).map(([name, m]) => {
        if (m === 0) {
          return `${name}:missing`;
        }
        return m === maxMtime ? `${name}:newest` : `${name}:older`;
      });
      console.log(`  ${agent.padEnd(24)} ${labels.join('  ')}`);
    }
  }
}

function main() {
  const skillsBySide = {};
  for (const [name, dir] of Object.entries(SKILL_SIDES)) {
    skillsBySide[name] = listSkills(dir);
  }
  const agentsBySide = {};
  for (const [name, dir] of Object.entries(AGENT_SIDES)) {
    agentsBySide[name] = listAgents(dir);
  }
  warnUnknownExceptions(skillsBySide);

  if (command === 'check') {
    runCheck(skillsBySide, agentsBySide);
    return;
  }

  // push: opencode → {cursor, commandcode} / pull: {cursor, commandcode} → opencode
  // commandcode との間では SKILL.md の when_to_use を維持/除外する
  /** @type {Array<[string, string, ((src: string, dest: string) => string) | null]>} */
  const skillPairs =
    command === 'push'
      ? [
          ['opencode', 'cursor', null],
          ['opencode', 'commandcode', mergeWhenToUse],
        ]
      : [
          ['cursor', 'opencode', null],
          ['commandcode', 'opencode', stripWhenToUse],
        ];

  for (const [srcSide, destSide, transform] of skillPairs) {
    const sourceDir = SKILL_SIDES[srcSide];
    const destDir = SKILL_SIDES[destSide];
    if (!existsSync(sourceDir)) {
      console.error(`[meta-md-sync] Source directory not found: ${sourceDir}`);
      process.exit(1);
    }
    const skills = applySkillFilter(listSkills(sourceDir).filter((s) => !isExcluded(s)));
    syncSkills({ srcSide, destSide, sourceDir, destDir, skills, transform, dryRun, force });

    const agentSourceDir = AGENT_SIDES[srcSide];
    const agentDestDir = AGENT_SIDES[destSide];
    if (!existsSync(agentSourceDir)) {
      console.error(`[meta-md-sync] Source agents directory not found: ${agentSourceDir}`);
      process.exit(1);
    }
    const agents = applyAgentFilter(listAgents(agentSourceDir));
    syncAgents({
      srcSide,
      destSide,
      sourceDir: agentSourceDir,
      destDir: agentDestDir,
      agents,
      dryRun,
      force,
    });
  }
}

main();
