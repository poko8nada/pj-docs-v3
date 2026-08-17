import { describe, expect, it } from 'vitest';
import {
  blockMessage,
  checkBypass,
  isMarkdownBodyCommand,
  parseCommands,
  validateGit,
} from './parse-command';

describe('parseCommands', () => {
  it('splits commands on &&, ||, |, and ;', () => {
    expect(parseCommands('git status && pnpm test; echo done')).toEqual([
      ['git', 'status'],
      ['pnpm', 'test'],
      ['echo', 'done'],
    ]);
  });

  it('removes heredoc bodies', () => {
    expect(parseCommands('cat <<EOF\nhello world\nEOF')).toEqual([['cat']]);
  });

  it('keeps quoted tokens without surrounding quotes', () => {
    expect(parseCommands('git commit -m "fix"')).toEqual([['git', 'commit', '-m', 'fix']]);
  });

  it('handles command substitution inside a variable assignment', () => {
    expect(parseCommands('MSG=$(git log -1) && echo $MSG')).toEqual([
      ['git', 'log', '-1'],
      ['echo', '$MSG'],
    ]);
  });

  it('drops variable-only segments without command substitution', () => {
    expect(parseCommands('FOO=bar && git status')).toEqual([['git', 'status']]);
  });
});

describe('checkBypass', () => {
  it('detects backtick command substitution', () => {
    expect(checkBypass('echo `whoami`', false)).toEqual({
      detected: true,
      name: 'backtick command substitution',
    });
  });

  it('detects process substitution', () => {
    expect(checkBypass('diff <(echo a) <(echo b)', false)).toEqual({
      detected: true,
      name: 'process substitution',
    });
  });

  it('detects here strings', () => {
    expect(checkBypass('cat <<< "text"', false)).toEqual({
      detected: true,
      name: 'here string',
    });
  });

  it('skips backticks when allowBackticks is true but still detects others', () => {
    expect(checkBypass('echo `whoami`', true)).toBeNull();
    expect(checkBypass('diff <(echo a) <(echo b)', true)).toEqual({
      detected: true,
      name: 'process substitution',
    });
  });

  it('returns null for a clean command', () => {
    expect(checkBypass('git status', false)).toBeNull();
  });
});

describe('validateGit', () => {
  it('detects dangerous flags', () => {
    expect(validateGit(['git', 'push', '--force'])).toContain('--force');
    expect(validateGit(['git', 'reset', '--hard'])).toContain('--hard');
  });

  it('returns null for safe git commands', () => {
    expect(validateGit(['git', 'status'])).toBeNull();
    expect(validateGit(['git', 'push'])).toBeNull();
  });

  it('returns null when there is no subcommand', () => {
    expect(validateGit(['git'])).toBeNull();
  });
});

describe('isMarkdownBodyCommand', () => {
  it('recognizes markdown-body commands', () => {
    expect(isMarkdownBodyCommand('git commit -m "msg"')).toBe(true);
    expect(isMarkdownBodyCommand('gh pr create --title "t"')).toBe(true);
  });

  it('rejects other commands', () => {
    expect(isMarkdownBodyCommand('git push')).toBe(false);
    expect(isMarkdownBodyCommand('echo hi')).toBe(false);
  });
});

describe('blockMessage', () => {
  it('includes reason, command, and alternatives', () => {
    const msg = blockMessage('dangerous flag', 'git push --force', 'use git push');
    expect(msg).toContain('BLOCKED: dangerous flag');
    expect(msg).toContain('Command: git push --force');
    expect(msg).toContain('Alternatives: use git push');
  });
});
