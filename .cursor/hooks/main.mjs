/*
 * FEATURES: H-chain
 * PURPOSE: 入力読み取りと runtime への委譲を行うエントリポイント (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

const failSafeResult = { decision: 'allow' };

async function readInput() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = Buffer.concat(chunks).toString('utf8');
  if (!input.trim()) {
    return {};
  }
  return JSON.parse(input);
}

try {
  const input = await readInput();
  const hookName = process.argv[2];
  const { run } = await import('./runtime.mjs');
  const result = await run(input, hookName);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  // ログ機能の不具合で、通常のエージェント操作まで停止させない。
  process.stderr.write(`[cursor-hook] ${error instanceof Error ? error.message : String(error)}\n`);
  process.stdout.write(`${JSON.stringify(failSafeResult)}\n`);
}
