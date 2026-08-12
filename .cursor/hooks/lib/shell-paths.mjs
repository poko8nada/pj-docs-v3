/*
 * FEATURES: H-transformer
 * PURPOSE: shell コマンドから検査対象のパスを抽出する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
import { homedir } from 'node:os';
import { resolve } from 'node:path';

/**
 * shell コマンドから検査対象のパスを抽出する。
 * heredoc と quoted string は本文とみなし除去してから抽出する (opencode restrict_root の流儀)。
 */
export function extractShellPaths(command, cwd, projectRoot) {
  const base = typeof cwd === 'string' && cwd.length > 0 ? cwd : projectRoot;
  const paths = new Set();

  if (typeof cwd === 'string' && cwd.length > 0) {
    paths.add(cwd);
  }

  if (typeof command !== 'string' || command.length === 0) {
    return [...paths];
  }

  // heredoc を除去 (<<EOF, <<"EOF", <<'EOF', <<-EOF 対応)
  const withoutHeredoc = command.replace(/<<-?\s*["']?(\w+)["']?[\s\S]*?\n\s*\1/g, '');

  // quoted string 内の絶対パス / ~ パスを先に抽出して検査対象に残す
  // （`cat "/etc/hosts"` や `rm '/etc/passwd'` のように引用符で囲まれたパスが
  //   quoted string 除去で消えて検査を回避されるのを防ぐ）
  // 引用符直後にパスが始まる場合のみ対象（`-m "read /tmp/secret"` のような
  //  Markdown 本文内のパスは誤検出しない）
  for (const match of withoutHeredoc.matchAll(/["']([/][^\s'"<>|&;]+)["']/g)) {
    const target = expand(match[1], base);
    if (target) {
      paths.add(target);
    }
  }

  // quoted string を除去 (-m "text with /path" などの誤検出を防ぐ)
  const cleaned = withoutHeredoc.replace(/(["'])(?:\\.|(?!\1)[^\\])*\1/g, '');

  // 絶対パス / ~ パス
  for (const match of cleaned.matchAll(/(?:^|[\s>|&;"'=])([/~][^\s'"<>|&;=]+)/g)) {
    const target = expand(match[1], base);
    if (target) {
      paths.add(target);
    }
  }

  // 相対パス (../foo, ./foo)
  for (const match of cleaned.matchAll(/(?:^|\s)((?:\.\.?\/)[^\s;|&><'"]+)/g)) {
    const target = expand(match[1], base);
    if (target) {
      paths.add(target);
    }
  }

  // cd ターゲット
  for (const match of cleaned.matchAll(/\bcd\s+([^\s;|&><]+)/g)) {
    const target = expand(match[1], base);
    if (target) {
      paths.add(target);
    }
  }

  return [...paths];
}

// ~ をホームディレクトリへ展開し、絶対パスへ解決する
// 検査不要のパス (オプション, /dev/null) は null を返す
function expand(raw, base) {
  const target = raw.replace(/^['"]|['"]$/g, '');
  if (!target || target === '-' || target.startsWith('-')) {
    return null;
  }
  if (target === '/dev/null') {
    return null;
  }

  if (target === '~') {
    return homedir();
  }
  if (target.startsWith('~/')) {
    return resolve(homedir(), target.slice(2));
  }
  if (target.startsWith('/')) {
    return target;
  }
  return resolve(base, target);
}
