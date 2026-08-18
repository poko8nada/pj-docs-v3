import { describe, expect, it } from 'vitest';
import { isReadOnlyCommand } from './restrict_root';

describe('isReadOnlyCommand', () => {
  it('returns true for read-only commands', () => {
    expect(isReadOnlyCommand('ls ~/.local/share/opencode')).toBe(true);
    expect(isReadOnlyCommand('cat ~/.local/share/opencode/log.jsonl')).toBe(true);
    expect(isReadOnlyCommand('grep foo ~/.local/share/opencode')).toBe(true);
    expect(isReadOnlyCommand('rg foo ~/.local/share/opencode')).toBe(true);
    expect(isReadOnlyCommand('head -5 ~/.local/share/opencode/log.jsonl')).toBe(true);
    expect(isReadOnlyCommand('find ~/.local/share/opencode -name "*.jsonl"')).toBe(true);
  });

  it('returns false when output redirection is present', () => {
    expect(isReadOnlyCommand('cat a > b')).toBe(false);
    expect(isReadOnlyCommand('cat a >> b')).toBe(false);
    expect(isReadOnlyCommand('ls ~/.local/share/opencode 2> err.txt')).toBe(false);
    expect(isReadOnlyCommand('echo x > ~/.local/share/opencode/foo')).toBe(false);
    expect(isReadOnlyCommand('cat a 1> b')).toBe(false);
  });

  it('returns false for write commands', () => {
    expect(isReadOnlyCommand('cp a b')).toBe(false);
    expect(isReadOnlyCommand('mv a b')).toBe(false);
    expect(isReadOnlyCommand('rm a')).toBe(false);
    expect(isReadOnlyCommand('echo x')).toBe(false);
    expect(isReadOnlyCommand('sed -i s/a/b/ file')).toBe(false);
  });

  it('handles env var and wrapper prefixes', () => {
    expect(isReadOnlyCommand('FOO=bar ls ~/.local/share/opencode')).toBe(true);
    expect(isReadOnlyCommand('sudo ls ~/.local/share/opencode')).toBe(true);
    expect(isReadOnlyCommand('env ls ~/.local/share/opencode')).toBe(true);
    expect(isReadOnlyCommand('command ls ~/.local/share/opencode')).toBe(true);
  });

  it('handles piped commands', () => {
    expect(isReadOnlyCommand('ls ~/.local/share/opencode | grep foo')).toBe(true);
  });

  it('returns false for empty or unknown commands', () => {
    expect(isReadOnlyCommand('')).toBe(false);
    expect(isReadOnlyCommand('unknowncmd x')).toBe(false);
  });
});
