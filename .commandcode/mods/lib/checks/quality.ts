/*
 * FEATURES: H-mutator, H-verifier
 * PURPOSE: 編集済みファイルに安全な自動修正とフォーマットを適用し、lint と型チェックの結果をレポートする (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CheckContext, IdleCheck } from '../idle-chain';
import {
  CHECKABLE_EXT,
  COMMANDCODE_DIR,
  FORMAT_EXTENSIONS,
  OPENCODE_DIR,
} from '../../../../constants/index.mjs';

// ---- 設定（constants/index.mjs から import）----
// フォーマット対象の拡張子
const formatExt = new Set(FORMAT_EXTENSIONS);
// lint / typecheck の対象拡張子
const checkableExt = new Set(CHECKABLE_EXT);
// フォローアップメッセージに含める出力の最大行数
const MAX_OUTPUT_LINES = 40;

const SERVICE = 'quality-gate';

// node_modules/.bin 配下の実行ファイル（pnpm 環境でも symlink 経由で直接実行できる）
const bin = (root: string, name: string) => path.join(root, 'node_modules', '.bin', name);
const hasTool = (root: string, name: string) => fs.existsSync(bin(root, name));

// 出力を最大行数に切り詰める
const truncate = (text: string) => {
  const lines = text.trim().split('\n');
  if (lines.length <= MAX_OUTPUT_LINES) {
    return text.trim();
  }
  return [
    ...lines.slice(0, MAX_OUTPUT_LINES),
    `... and ${lines.length - MAX_OUTPUT_LINES} more lines`,
  ].join('\n');
};

// リンター（oxlint）を実行し、警告数・エラー数を数える
async function lintFiles(ctx: CheckContext, files: string[]) {
  if (!hasTool(ctx.root, 'oxlint')) {
    await ctx.log(SERVICE, 'warn', 'oxlint is not installed. Skipping lint.');
    return { warnings: 0, errors: 0, output: '', exitCode: 0 };
  }
  // --format=agent: 出力形式を path:line:col: error rule に固定する
  // （TTY ではフレーム表示になり、数え上げ正規表現が不一致になるため）
  const result = await ctx.run([bin(ctx.root, 'oxlint'), '--format=agent', ...files], ctx.root);
  const text = `${result.stdout}\n${result.stderr}`;
  // oxlint の出力形式: "file:line:col: warning rule: msg" / "file:line:col: error rule: msg"
  const warnings = (text.match(/: warning /g) ?? []).length;
  const errors = (text.match(/: error /g) ?? []).length;
  return { warnings, errors, output: text, exitCode: result.exitCode };
}

// 型チェック（tsc）を実行する。.opencode / .commandcode 配下は専用 tsconfig を使う
async function typecheckFiles(ctx: CheckContext, files: string[]) {
  if (!hasTool(ctx.root, 'tsc')) {
    await ctx.log(SERVICE, 'warn', 'tsc is not installed. Skipping typecheck.');
    return { errors: 0, output: '' };
  }

  // tsconfig ごとにファイルをグループ化する
  const groups = new Map<string, string[]>();
  for (const file of files) {
    const rel = path.relative(ctx.root, file);
    let tsconfig = path.join(ctx.root, 'tsconfig.json');
    if (rel.startsWith(`${OPENCODE_DIR}${path.sep}`)) {
      tsconfig = path.join(ctx.root, OPENCODE_DIR, 'tsconfig.json');
    } else if (rel.startsWith(`${COMMANDCODE_DIR}${path.sep}`)) {
      tsconfig = path.join(ctx.root, COMMANDCODE_DIR, 'tsconfig.json');
    }
    if (!fs.existsSync(tsconfig)) {
      continue;
    }
    groups.set(tsconfig, [...(groups.get(tsconfig) ?? []), file]);
  }

  // 一時 tsconfig を extends 元と同じディレクトリに置く
  // （types や relative パスの解決が tsconfig の位置基準になるため）
  const runTypecheckGroup = async (tsconfig: string, groupFiles: string[]) => {
    const configDir = path.dirname(tsconfig);
    const tmp = path.join(
      configDir,
      `.qg-tsconfig-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    // ベース tsconfig の compilerOptions を自己完結で埋め込む。
    // extends の相対解決は実行環境に依存するため、types / paths 等が確実に効くようにする。
    const base = JSON.parse(await fs.promises.readFile(tsconfig, 'utf8'));
    const config = JSON.stringify(
      {
        compilerOptions: base.compilerOptions ?? {},
        files: groupFiles.map((f) => path.relative(configDir, f)),
        include: [],
      },
      null,
      2,
    );
    await fs.promises.writeFile(tmp, config);
    try {
      const result = await ctx.run([bin(ctx.root, 'tsc'), '-p', tmp, '--noEmit'], ctx.root);
      const text = `${result.stdout}\n${result.stderr}`;
      // tsc の出力形式: "file(line,col): error TSxxxx: msg"
      return { errors: (text.match(/error TS/g) ?? []).length, output: text };
    } finally {
      await fs.promises.rm(tmp, { force: true });
    }
  };

  let errors = 0;
  let output = '';
  for (const [tsconfig, groupFiles] of groups) {
    // oxlint-disable-next-line no-await-in-loop -- tsc はグループ毎に直列実行（リソース競合回避）
    const result = await runTypecheckGroup(tsconfig, groupFiles);
    errors += result.errors;
    output += result.output;
  }
  return { errors, output };
}

// 静的解析チェック。修正・フォーマットを適用した後に検証する
export const qualityCheck: IdleCheck = {
  name: SERVICE,
  run: async (ctx) => {
    const { root, files } = ctx;

    // 存在しないファイル・対象外の拡張子は除外する
    const checkTargets = files.filter((f) => fs.existsSync(f) && checkableExt.has(path.extname(f)));
    const formatTargets = files.filter((f) => fs.existsSync(f) && formatExt.has(path.extname(f)));
    if (checkTargets.length === 0 && formatTargets.length === 0) {
      return { followUps: [] };
    }

    // 安全な自動修正を適用してからフォーマットする
    // （curly 等の修正結果を oxfmt が正規化するため、fix → format の順）
    if (hasTool(root, 'oxlint') && checkTargets.length > 0) {
      const fix = await ctx.run([bin(root, 'oxlint'), '--fix', ...checkTargets], root);
      if (fix.exitCode !== 0) {
        await ctx.log(SERVICE, 'warn', 'oxlint --fix failed', {
          exitCode: fix.exitCode,
          stderr: fix.stderr.slice(0, 500),
        });
      }
    }
    if (hasTool(root, 'oxfmt') && formatTargets.length > 0) {
      const fmt = await ctx.run([bin(root, 'oxfmt'), ...formatTargets], root);
      if (fmt.exitCode !== 0) {
        await ctx.log(SERVICE, 'warn', 'oxfmt failed', {
          exitCode: fmt.exitCode,
          stderr: fmt.stderr.slice(0, 500),
        });
      }
    }

    // lint / typecheck は対象ファイルが存在する場合のみ実行する
    // （空配列のまま oxlint を実行すると引数なし扱いになり、プロジェクト全体を lint してしまう）
    if (checkTargets.length === 0) {
      return { followUps: [] };
    }

    // 修正後の状態で lint / typecheck を実行する
    const lint = await lintFiles(ctx, checkTargets);
    const tsc = await typecheckFiles(ctx, checkTargets);

    // 数え上げで検出できず、かつ exit code が非零の場合はツール障害として失敗扱い
    // （クラッシュや起動失敗がクリーン扱いで通過するのを防ぐ）
    const hasIssues = lint.warnings + lint.errors > 0 || lint.exitCode !== 0 || tsc.errors > 0;
    if (!hasIssues) {
      return { followUps: [] };
    }

    const lines = [
      '[quality-gate] Static analysis found issues in the files you modified.',
      '',
      `Checked files: ${files.map((f) => path.relative(root, f)).join(', ')}`,
      '',
    ];
    // 検出された問題（数え上げ or ツール障害）を出力する
    if (lint.warnings + lint.errors > 0 || lint.exitCode !== 0) {
      lines.push(`## Lint (oxlint): ${lint.errors} error(s), ${lint.warnings} warning(s)`);
      lines.push(truncate(lint.output) || '(no output — oxlint may have crashed)');
      lines.push('');
    }
    if (tsc.errors > 0) {
      lines.push(`## Typecheck (tsc): ${tsc.errors} error(s)`);
      lines.push(truncate(tsc.output));
    }
    lines.push('## Instructions');
    lines.push('- Errors: fix them immediately.');
    lines.push(
      "- Warnings: propose to the user how to handle each one (fix / inline-disable with a reason / leave as-is). Do not fix warnings without the user's agreement.",
    );
    return { followUps: [lines.join('\n')] };
  },
};
