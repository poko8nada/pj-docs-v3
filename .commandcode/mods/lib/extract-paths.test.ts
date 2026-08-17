import { describe, expect, it } from 'vitest';
import { extractPathsFromCommand } from './extract-paths';

describe('extractPathsFromCommand', () => {
  it('extracts absolute paths', () => {
    expect(extractPathsFromCommand('cat /etc/hosts')).toEqual(['/etc/hosts']);
  });

  it('extracts home-relative paths', () => {
    expect(extractPathsFromCommand('ls ~/.config')).toEqual(['~/.config']);
  });

  it('skips quoted strings', () => {
    expect(extractPathsFromCommand('git commit -m "see /tmp/notes"')).toEqual([]);
  });

  it('skips heredoc bodies', () => {
    const cmd = 'cat <<EOF\n/tmp/inside\nEOF\nls /tmp/outside';
    expect(extractPathsFromCommand(cmd)).toEqual(['/tmp/outside']);
  });

  it('skips protocol-like double slashes', () => {
    expect(extractPathsFromCommand('curl https://example.com')).toEqual([]);
  });

  it('extracts multiple paths', () => {
    expect(extractPathsFromCommand('cp /tmp/a /tmp/b')).toEqual(['/tmp/a', '/tmp/b']);
  });

  it('returns empty for a command without paths', () => {
    expect(extractPathsFromCommand('git status')).toEqual([]);
  });
});
