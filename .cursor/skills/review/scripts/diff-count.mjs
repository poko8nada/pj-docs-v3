/*
 * FEATURES: S-report
 * PURPOSE: 指定されたファイル群の git diff 行数（追加+削除）を集計して報告する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
import { execFileSync } from 'node:child_process';
import { basename, relative, resolve } from 'node:path';

// git diff --numstat の出力（タブ区切り: 追加行数・削除行数・パス）をファイルごとに集計する
// 戻り値: Map<相対パス, { added, deleted }>
function diffNumstat(files) {
  const out = execFileSync('git', ['diff', '--numstat', ...files], {
    encoding: 'utf8',
    cwd: process.cwd(),
  });
  const map = new Map();
  for (const line of out.split('\n')) {
    if (!line) {
      continue;
    }
    const [added, deleted, ...pathParts] = line.split('\t');
    if (!pathParts.length) {
      continue;
    }
    // 未追跡ファイル（untracked）は - と表示されるため 0 として扱う
    const a = added === '-' ? 0 : Number(added);
    const d = deleted === '-' ? 0 : Number(deleted);
    map.set(pathParts.join('\t'), { added: a, deleted: d });
  }
  return map;
}

function main() {
  const args = process.argv.slice(2);
  const cached = args.includes('--cached');
  const files = args.filter((a) => a !== '--cached').map((f) => resolve(f));

  if (files.length === 0) {
    console.error('Usage: node scripts/diff-count.mjs [--cached] <file...>');
    process.exit(1);
  }

  const stat = diffNumstat(cached ? ['--cached', ...files] : files);
  let total = 0;
  for (const f of files) {
    // git はリポジトリルートからの相対パスで出力するため、キーを相対パスで引く
    const key = relative(process.cwd(), f);
    const s = stat.get(key) ?? { added: 0, deleted: 0 };
    const sum = s.added + s.deleted;
    total += sum;
    console.log(`${basename(f)}  +${s.added} / -${s.deleted}  (${sum} 行)`);
  }
  console.log(`--- total: ${total} 行`);
}

main();
