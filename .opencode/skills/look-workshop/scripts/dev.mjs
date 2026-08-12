/*
 * FEATURES: S-serve
 * PURPOSE: look-workshop 作業場の Vite 開発サーバーを起動し、cmux でブラウザを開く (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
// foundation dev — 作業場を Vite で起動し、準備できたら cmux で開く。
// Ctrl-C で Vite ごと終了。ルートの package.json は触らない。
import { spawn, spawnSync } from 'node:child_process';
import { get } from 'node:http';
import { ensureDeps, ensureWorkspace, workspaceDir } from './_paths.mjs';

ensureDeps();
ensureWorkspace();

const port = Number(process.env.FOUNDATION_PORT) || 5173;
const url = 'http://127.0.0.1:' + port + '/';

const vite = spawn('pnpm', ['--ignore-workspace', '--dir', workspaceDir, 'run', 'foundation:dev'], {
  stdio: 'inherit',
  env: { ...process.env, FOUNDATION_PORT: String(port) },
});

poll(url, 20000)
  .then(() => spawnSync('cmux', ['browser', 'open', url], { stdio: 'inherit' }))
  .catch(() => process.stderr.write('[look-workshop] Vite の起動を検知できませんでした\n'));

vite.on('error', (err) => {
  process.stderr.write(
    '[look-workshop] Vite の起動に失敗: ' + (err ? err.message : 'unknown') + '\n',
  );
  process.exit(1);
});
vite.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => vite.kill('SIGINT'));
process.on('SIGTERM', () => vite.kill('SIGTERM'));

function poll(target, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryOnce = () => {
      get(target, (res) => {
        res.resume();
        // 200 以外は起動完了とみなさない（404 等で誤検知しない）。
        if (res.statusCode === 200) {
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          reject(new Error('timeout'));
        } else {
          setTimeout(tryOnce, 300);
        }
      }).on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error('timeout'));
        } else {
          setTimeout(tryOnce, 300);
        }
      });
    };
    tryOnce();
  });
}
