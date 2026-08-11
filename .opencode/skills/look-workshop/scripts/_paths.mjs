// foundation スクリプト共通パス。プロジェクトルートから実行想定。
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
export const skillRoot = dirname(here);
export const workspaceDir = join(skillRoot, 'workspace');
export const defaultsDir = join(skillRoot, 'defaults');
export const commentsFile = join(workspaceDir, 'comments.json');
export const distDir = join(workspaceDir, 'dist');

/** リポジトリルートを推定する（skillRoot の 3 階層上）。 */
export function repoRoot() {
  return dirname(dirname(dirname(skillRoot)));
}

export function findingsLookWorkshopDir() {
  return join(repoRoot(), 'findings', 'look-workshop');
}

/** workspace で pnpm install する。失敗したら process.exit。 */
function pnpmInstall() {
  const inst = spawnSync('pnpm', ['--ignore-workspace', '--dir', workspaceDir, 'install'], {
    stdio: 'inherit',
  });
  if (inst.error || inst.status !== 0) {
    process.stderr.write('[look-workshop] pnpm install に失敗しました\n');
    process.exit(inst.status ?? 1);
  }
}

/**
 * workspace 依存を用意する。
 * node_modules か lock が無ければ install するだけ（固定 devDeps なので冪等で速い）。
 */
export function ensureDeps() {
  const nodeModules = join(workspaceDir, 'node_modules');
  const lockFile = join(workspaceDir, 'pnpm-lock.yaml');
  if (existsSync(nodeModules) && existsSync(lockFile)) {
    return;
  }
  process.stderr.write('[look-workshop] 依存をインストール中...\n');
  pnpmInstall();
}

/**
 * workspace/index.html を用意する（defaults からコピー）。
 * index.html は生成物（gitignore）で、reset が削除する。無ければここで復元する。
 */
export function ensureWorkspace() {
  const workspaceIndex = join(workspaceDir, 'index.html');
  if (existsSync(workspaceIndex)) {
    return;
  }
  const defaultIndex = join(defaultsDir, 'index.html');
  if (!existsSync(defaultIndex)) {
    process.stderr.write('[look-workshop] defaults/index.html がありません\n');
    process.exit(1);
  }
  copyFileSync(defaultIndex, workspaceIndex);
}

/** 日時スラッグ用に 0 埋めする。 */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/** ローカル日時ベースの slug。FOUNDATION_SLUG があればそれを使う。 */
export function makeSlug() {
  if (process.env.FOUNDATION_SLUG) {
    return process.env.FOUNDATION_SLUG;
  }
  const d = new Date();
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
  );
}
