/*
 * FEATURES: S-source
 * PURPOSE: エージェント同期のロジック（description と body のみの同期・frontmatter 維持）を提供する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { basename, join } from 'node:path';
import { splitFrontmatter } from './frontmatter.mjs';

// ディレクトリ直下のエージェント名一覧（*.md のみ）
export function listAgents(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((n) => n.endsWith('.md'))
    .map((n) => basename(n, '.md'));
}

// frontmatter から description 行を抽出する（無ければ null）
function extractDescriptionLine(text) {
  const { head } = splitFrontmatter(text);
  if (!head) {
    return null;
  }
  return head.split('\n').find((l) => l.startsWith('description:')) ?? null;
}

// エージェントファイルを合成する: 宛先の frontmatter を維持しつつ description を差し替え、
// body をソースで置換する（description と body のみ同期）
export function mergeAgent(srcText, destText) {
  const srcDesc = extractDescriptionLine(srcText);
  const srcBody = splitFrontmatter(srcText).body;
  const destFm = splitFrontmatter(destText);
  if (!destFm.head) {
    // 宛先に frontmatter が無い場合はソースの内容をそのまま使う
    return srcText;
  }
  const lines = destFm.head.split('\n');
  const idx = lines.findIndex((l) => l.startsWith('description:'));
  if (idx === -1) {
    if (srcDesc) {
      lines.push(srcDesc);
    }
  } else if (srcDesc) {
    lines[idx] = srcDesc;
  } else {
    lines.splice(idx, 1);
  }
  return `---\n${lines.join('\n')}\n---\n${srcBody}`;
}

// エージェントを同期する（mtime が新しい方が勝ち。--force なら常にコピー）
export function syncAgents({ srcSide, destSide, sourceDir, destDir, agents, dryRun, force }) {
  let copied = 0;
  let skipped = 0;

  for (const agent of agents) {
    const src = join(sourceDir, `${agent}.md`);
    const dest = join(destDir, `${agent}.md`);
    const srcMtime = Math.round(statSync(src).mtimeMs);
    const destMtime = existsSync(dest) ? Math.round(statSync(dest).mtimeMs) : 0;

    if (!force && destMtime > srcMtime) {
      console.log(`  skip ${agent} (newer in destination)`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  would copy ${agent} (${srcSide} → ${destSide})`);
    } else {
      const srcText = readFileSync(src, 'utf8');
      const destText = existsSync(dest) ? readFileSync(dest, 'utf8') : '';
      mkdirSync(destDir, { recursive: true });
      writeFileSync(dest, mergeAgent(srcText, destText));
      // mtime をソースに合わせる（同期後の ping-pong を防ぐ）
      const stat = statSync(src);
      utimesSync(dest, stat.atime, stat.mtime);
      console.log(`  copied ${agent} (${srcSide} → ${destSide})`);
    }
    copied++;
  }

  console.log(
    `\n${srcSide} → ${destSide}: ${dryRun ? 'Would copy' : 'Copied'} ${copied} agent(s), skipped ${skipped}.`,
  );
}
