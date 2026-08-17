/*
 * FEATURES: S-verify
 * PURPOSE: 監査のオーケストレーション。対象の列挙・監査チェックの実行・結果の出力を行う (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bodyOf, listSourceMd, parseFrontmatter } from './lib/md-checks.mjs';
import {
  checkBody,
  checkFrontmatter,
  checkName,
  checkRefToolPaths,
  checkSecurity,
  checkSources,
  checkUnregistered,
} from './lib/checks.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_TARGET = resolve(SCRIPT_DIR, '..', '..');

const args = process.argv.slice(2);
const dirIdx = args.indexOf('--dir');
const targetDir = resolve(dirIdx !== -1 ? args[dirIdx + 1] : DEFAULT_TARGET);
const json = args.includes('--json');

// 監査対象の列挙
// skill: SKILL.md を持つディレクトリ。agent: 親ディレクトリの agents/*.md（opencode / Cursor 共通の複数形）。
// agents の解決は skills の親を見るため、このスクリプトをどちらに配置しても自分自身の環境に従う。
function listTargets(dir) {
  if (!existsSync(dir)) {
    console.error(`[meta-md-audit] Directory not found: ${dir}`);
    process.exit(1);
  }
  const skills = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'SKILL.md')))
    .map((e) => ({ kind: 'skill', name: e.name, dir: join(dir, e.name) }));
  const agentsDir = join(dirname(dir), 'agents');
  const agents = existsSync(agentsDir)
    ? readdirSync(agentsDir)
        .filter((n) => n.endsWith('.md'))
        .map((n) => ({ kind: 'agent', name: basename(n, '.md'), dir: agentsDir }))
    : [];
  return [...skills, ...agents];
}

// 1 対象分の監査を実行し、findings を返す
function runChecks(target) {
  const file =
    target.kind === 'skill' ? join(target.dir, 'SKILL.md') : join(target.dir, `${target.name}.md`);
  const text = readFileSync(file, 'utf8');
  const findings = [];
  const fm = parseFrontmatter(text);
  checkFrontmatter(fm, findings);
  if (target.kind === 'skill') {
    checkName(fm, target.dir, findings);
  }
  checkBody(bodyOf(text), target.dir, findings);
  if (target.kind === 'skill') {
    checkRefToolPaths(target.dir, findings);
    const { sources, unregistered } = listSourceMd(target.dir);
    checkSources(sources, findings);
    checkUnregistered(unregistered, findings);
  } else {
    checkSources([{ rel: `${target.name}.md`, path: file }], findings);
  }
  checkSecurity(text, findings);
  return findings;
}

function main() {
  const targets = listTargets(targetDir);
  if (targets.length === 0) {
    console.log(`No targets found in ${targetDir}`);
    return;
  }

  const results = targets.map((target) => ({
    kind: target.kind,
    name: target.name,
    findings: runChecks(target),
  }));
  const totalErrors = results.reduce(
    (n, r) => n + r.findings.filter((f) => f.severity === 'error').length,
    0,
  );
  const totalWarnings = results.reduce(
    (n, r) => n + r.findings.filter((f) => f.severity === 'warning').length,
    0,
  );

  if (json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(`Audit ${targetDir} (${targets.length} targets)\n`);
    for (const { kind, name, findings } of results) {
      console.log(`## ${kind}: ${name}`);
      if (findings.length === 0) {
        console.log('  ✓ all checks passed\n');
        continue;
      }
      for (const f of findings) {
        const mark = f.severity === 'error' ? '✗' : f.severity === 'warning' ? '⚠' : 'i';
        console.log(`  ${mark} ${f.id}  [${f.severity}] ${f.label}`);
        console.log(`      提案: ${f.suggestion}`);
        if (f.detail) {
          console.log(`      (${f.detail})`);
        }
      }
      console.log('');
    }
    console.log(
      `Summary: ${targets.length} targets, ${totalErrors} error(s), ${totalWarnings} warning(s)`,
    );
  }

  process.exit(totalErrors > 0 ? 1 : 0);
}

main();
