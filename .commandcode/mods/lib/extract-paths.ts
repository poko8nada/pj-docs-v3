/*
 * FEATURES: H-transformer
 * PURPOSE: bash コマンドから検査対象の絶対パスを抽出する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

// bash command から絶対 path を抽出（heuristic）
//  /path or ~/path で始まり、空白/引用/特殊文字以外が続くものを path とみなす
// heredoc の中身、quoted strings の中身はスキップする
export const extractPathsFromCommand = (command: string): string[] => {
  // heredoc を除去（<<EOF, <<"EOF", <<'EOF', <<-EOF 対応）
  let cleaned = command.replace(/<<-?\s*["']?(\w+)["']?[\s\S]*?\n\s*\1/g, '');
  // quoted strings を除去（-m "..." などの誤検出を防ぐ）
  cleaned = cleaned.replace(/(["'])(?:\\.|(?!\1)[^\\])*\1/g, '');
  const paths: string[] = [];
  const matches = cleaned.matchAll(/(?:^|[\s>|&;"'])([/~][^\s'"<>|&;]+)/g);
  for (const m of matches) {
    const p = m[1];
    if (p && !p.startsWith('//')) {
      paths.push(p);
    }
  }
  return paths;
};
