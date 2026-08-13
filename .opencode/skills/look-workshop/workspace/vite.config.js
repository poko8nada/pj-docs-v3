/*
 * FEATURES: S-source
 * PURPOSE: ワークスペースの Vite 設定。dev の comments 永続化と singlefile ビルドを担う (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
// look-workshop 作業場用 Vite 設定。
// - Tailwind: @tailwindcss/vite
// - comments: dev（configureServer）のみ。comments.json を fs で読み書きし、
//   ブラウザの GET/POST /comments でユーザーの編集を永続化する。
//   configureServer は dev server でのみ動く = ビルド（vite build）では無効。
// - build: singlefile（CSS/JS を HTML にインライン）＋ public 画像は外出し
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // .../workspace
const commentsFile = join(here, 'comments.json');

function commentsPlugin() {
  return {
    name: 'look-workshop-comments',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/comments') {
          next();
          return;
        }

        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          // ファイル欠落時は空配列を返す（初回起動・削除後の耐性）。
          res.end(existsSync(commentsFile) ? readFileSync(commentsFile, 'utf8') : '[]');
          return;
        }

        if (req.method === 'POST') {
          // エラーは next に転送する（async ハンドラの未処理 rejection 防止）。
          void readBody(req)
            .then((body) => {
              writeFileSync(commentsFile, body);
              res.statusCode = 204;
              res.end();
            })
            .catch(next);
          return;
        }

        res.statusCode = 405;
        res.setHeader('Allow', 'GET, POST');
        res.end();
      });
    },
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      resolve(data);
    });
    req.on('error', reject);
  });
}

const port = Number(process.env.LOOK_WORKSHOP_PORT) || 5173;

export default defineConfig(({ command }) => ({
  plugins: [tailwindcss(), ...(command === 'serve' ? [commentsPlugin()] : [viteSingleFile()])],
  base: './',
  server: {
    port,
    strictPort: true,
    host: '127.0.0.1',
    watch: {
      ignored: ['**/comments.json'],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
}));
