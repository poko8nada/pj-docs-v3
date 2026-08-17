/*
 * FEATURES: H-gate
 * PURPOSE: 危険な git フラグとバイパス構文を含むコマンドを拒否する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

import type { ModApi } from '@commandcode/harness';
import {
  blockMessage,
  checkBypass,
  isMarkdownBodyCommand,
  parseCommands,
  validateGit,
} from './lib/parse-command';

// oxlint-disable-next-line no-default-export -- mod ローダーは default export を要求する
export default function (cmd: ModApi): void {
  cmd.hooks({
    beforeToolCall: async ({ toolName, input }) => {
      if (toolName !== 'shell_command') {
        return undefined;
      }

      const command = typeof input.command === 'string' ? input.command : '';
      if (!command) {
        return undefined;
      }

      // バイパス検出
      // Markdown body 系のコマンドでは backtick を許可 (process substitution / here string は引き続きブロック)
      const bypass = checkBypass(command, isMarkdownBodyCommand(command));
      if (bypass) {
        return {
          block: true,
          additionalContext: blockMessage(
            `Bypass pattern detected: ${bypass.name}`,
            command,
            'Use standard command syntax without backticks, process substitution, or here strings. ' +
              'For Markdown content, use --body-file to pass content from a file.',
          ),
        };
      }

      // コマンド解析 + 危険フラグ検出
      const commandSets = parseCommands(command);
      for (const tokens of commandSets) {
        const bin = tokens[0];
        if (!bin) {
          continue;
        }

        if (bin === 'git') {
          const error = validateGit(tokens);
          if (error) {
            return {
              block: true,
              additionalContext: blockMessage(
                error,
                command,
                'Remove the dangerous flag or use a safer alternative. Example: use `git push` instead of `git push --force`.',
              ),
            };
          }
        }
      }

      return undefined;
    },
  });
}
