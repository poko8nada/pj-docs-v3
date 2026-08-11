#!/usr/bin/env node
// foundation reset — 作業場をデフォルトに戻す。findings は消さない。
// workspace/index.html（生成物）と comments.json、dist を削除する。
// index.html は次回 dev/build 時に defaults から復元される。
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { commentsFile, distDir, workspaceDir } from './_paths.mjs';

const workspaceIndex = join(workspaceDir, 'index.html');

if (existsSync(workspaceIndex)) {
  rmSync(workspaceIndex);
}
if (existsSync(commentsFile)) {
  rmSync(commentsFile);
}
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
}

process.stdout.write('[look-workshop] workspace reset to defaults (findings untouched)\n');
