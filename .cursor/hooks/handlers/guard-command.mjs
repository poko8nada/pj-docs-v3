/*
 * FEATURES: H-gate
 * PURPOSE: 危険な git フラグとバイパス構文を含むコマンドを拒否する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */
import { isRecord, normalizeToolInput } from '../lib/tool-input.mjs';

export const name = 'guard-command';

// 危険な git フラグ (opencode restrict_command より移植)
const DANGEROUS_GIT_FLAGS = ['--force', '-f', '--hard', '--mirror'];

// バイパス検出パターン (ハーネス回避を試みる構文)
const BYPASS_PATTERNS = [
  { pattern: /`[^`]+`/, name: 'backtick command substitution' },
  { pattern: /<\([^)]+\)/, name: 'process substitution' },
  { pattern: /<{3}\s/, name: 'here string' },
];

// Markdown body を受け取るコマンドのホワイトリスト
// これらのコマンドでは backtick (Markdown の inline code) を許可する
// 他のバイパス (process substitution / here string) は引き続きブロック
const COMMANDS_WITH_MARKDOWN_BODY = [
  'gh issue create',
  'gh issue edit',
  'gh issue comment',
  'gh pr create',
  'gh pr edit',
  'gh pr comment',
  'gh release create',
  'gh release edit',
  'git commit',
];

/**
 * 危険な git フラグとバイパス構文を含むコマンドを拒否する。
 * 許可時は応答を返さない (deny 時のみ応答し、後段ハンドラによる allow 上書きを防ぐ)。
 */
export async function run(context) {
  const blocked = findBlockedCommand(context.hookName, context.input);
  if (!blocked) {
    return undefined;
  }

  const log = { handler: name, decision: 'deny', reason: blocked.reason };
  return {
    log,
    response: {
      permission: 'deny',
      user_message: blocked.message,
      agent_message: blocked.message,
    },
  };
}

function findBlockedCommand(hookName, input) {
  const command = extractCommand(hookName, input);
  if (!command) {
    return undefined;
  }

  // バイパス検出
  // Markdown body 系のコマンドでは backtick を許可 (process substitution / here string は引き続きブロック)
  const bypass = checkBypass(command, allowBackticks(command));
  if (bypass) {
    return {
      reason: `bypass pattern detected: ${bypass.name}`,
      message: blockMessage(
        `Bypass pattern detected: ${bypass.name}`,
        command,
        'Use standard command syntax without backticks, process substitution, or here strings. ' +
          'For Markdown content, use --body-file to pass content from a file.',
      ),
    };
  }

  // コマンド解析 + 危険フラグ検出
  for (const tokens of parseCommands(command)) {
    if (tokens[0] !== 'git') {
      continue;
    }
    const error = validateGit(tokens);
    if (error) {
      return {
        reason: error,
        message: blockMessage(
          error,
          command,
          'Remove the dangerous flag or use a safer alternative. ' +
            'Example: use `git push` instead of `git push --force`.',
        ),
      };
    }
  }

  return undefined;
}

function extractCommand(hookName, input) {
  const payload = isRecord(input) ? input : {};

  if (hookName === 'beforeShellExecution') {
    return payload.command;
  }

  if (hookName === 'preToolUse' && payload.tool_name === 'Shell') {
    const toolInput = normalizeToolInput(payload.tool_input);
    return toolInput?.command;
  }

  return undefined;
}

function isMarkdownBodyCommand(command) {
  const trimmed = command.trimStart();
  // 先頭セグメント（最初の区切りまで）がホワイトリストに一致する場合のみ
  // 部分コマンド名（git commit-x 等）や連結後コマンド（&& 以降）を許可しない
  const firstSegment = trimmed.split(/\s*(?:&&|\|\||;|\||\n)\s*/)[0].trim();
  return COMMANDS_WITH_MARKDOWN_BODY.some(
    (cmd) => firstSegment === cmd || firstSegment.startsWith(cmd + ' '),
  );
}

// backtick を許可してよいか判定する
// Markdown body 系コマンドの先頭セグメント内の backtick のみ許可する
// （`git commit -m "fix `foo` bar"` は許可、`git commit -m "x" && echo `cat /etc/passwd`` は拒否）
function allowBackticks(command) {
  if (!isMarkdownBodyCommand(command)) {
    return false;
  }
  const firstSegment = command.trimStart().split(/\s*(?:&&|\|\||;|\||\n)\s*/)[0];
  return firstSegment.includes('`');
}

// parseCommands: bash コマンドをトークンに分割
// heredoc, 引用符, コマンド置換, 変数代入に対応
function parseCommands(raw) {
  // heredoc を除去
  const command = raw.replace(/<<-?\s*["']?(\w+)["']?[\s\S]*?\n\s*\1/g, '');

  const segments = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let parenDepth = 0;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    const next = command[i + 1];

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }

    if (!inSingle && !inDouble) {
      if (ch === '$' && next === '(') {
        parenDepth++;
        current += ch;
        continue;
      }
      if (ch === ')') {
        parenDepth = Math.max(0, parenDepth - 1);
        current += ch;
        continue;
      }
      if ((ch === '&' && next === '&') || (ch === '|' && next === '|') || ch === ';') {
        segments.push(current.trim());
        current = '';
        i++;
        continue;
      }
      if (ch === '|' && next !== '|') {
        segments.push(current.trim());
        current = '';
        continue;
      }
      // 改行もコマンド区切りとして扱う
      // （シェルは改行をコマンド区切りとして実行するため、`cd /tmp` 改行 `git push --force` の
      //   ような連結で git フラグ検査を回避されるのを防ぐ）
      if (ch === '\n') {
        segments.push(current.trim());
        current = '';
        continue;
      }
    }

    current += ch;
  }

  if (current.trim()) {
    segments.push(current.trim());
  }

  return segments
    .filter(Boolean)
    .map((segment) => {
      // 変数代入 + コマンド置換のパターン (VAR=...)
      if (/^[A-Z_][A-Z0-9_]*=/.test(segment)) {
        const cmdSubMatch = segment.match(/\$\(([\s\S]+?)\)$/);
        if (cmdSubMatch) {
          const innerCmd = cmdSubMatch[1].trim();
          return innerCmd.split(/\s+/).map((t) => t.replace(/^['"]|['"]$/g, ''));
        }
        // 変数代入の接頭辞 (VAR=...) を除去した残りを検査対象にする
        // （`FOO=bar git push --force` で git フラグ検査を回避されるのを防ぐ）
        const rest = segment.replace(/^[A-Z_][A-Z0-9_]*=[^\s]*\s*/, '');
        if (!rest) {
          return [];
        }
        return rest.split(/\s+/).map((t) => t.replace(/^['"]|['"]$/g, ''));
      }
      return segment.split(/\s+/).map((t) => t.replace(/^['"]|['"]$/g, ''));
    })
    .filter((tokens) => tokens.length > 0);
}

// バイパス検出: ハーネス回避を試みる構文をチェック
// allowBt: true の場合、backtick のみスキップ (Markdown body 想定)
// process substitution / here string は引き続き検出
function checkBypass(raw, allowBt) {
  for (const { pattern, name: bypassName } of BYPASS_PATTERNS) {
    if (allowBt && bypassName === 'backtick command substitution') {
      continue;
    }
    if (pattern.test(raw)) {
      return { name: bypassName };
    }
  }
  return undefined;
}

// git 危険フラグ検出
function validateGit(tokens) {
  const subcommand = tokens[1];
  if (!subcommand) {
    return undefined;
  }

  const hasFlag = tokens.some((t) => DANGEROUS_GIT_FLAGS.includes(t));
  if (hasFlag) {
    return `git ${tokens.slice(1).join(' ')} contains a dangerous flag (${DANGEROUS_GIT_FLAGS.filter((f) => tokens.includes(f)).join(', ')}).`;
  }
  return undefined;
}

// エラーメッセージ生成: explain + コマンド明記
function blockMessage(reason, command, alternatives) {
  return [
    `[restrict-commands] BLOCKED: ${reason}`,
    '',
    `Command: ${command}`,
    '',
    `Alternatives: ${alternatives}`,
    '',
    'Please explain to the user:',
    '- What you tried to do',
    '- Why this command was needed',
    '- What alternative you suggest',
    'The user will decide.',
  ].join('\n');
}
