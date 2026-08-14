import { describe, expect, it } from 'vitest';
import { buildLogEvent } from './build-event.mjs';

describe('buildLogEvent shell and read hooks', () => {
  it('maps beforeShellExecution fields', () => {
    expect(
      buildLogEvent(
        {
          command: 'pnpm test',
          cwd: '/project',
          session_id: 'session-1',
        },
        'beforeShellExecution',
      ),
    ).toEqual({
      hook: 'beforeShellExecution',
      command: 'pnpm test',
      cwd: '/project',
      sessionId: 'session-1',
    });
  });

  it('maps beforeReadFile fields', () => {
    expect(
      buildLogEvent(
        {
          file_path: '/project/README.md',
          session_id: 'session-1',
        },
        'beforeReadFile',
      ),
    ).toEqual({
      hook: 'beforeReadFile',
      file: '/project/README.md',
      sessionId: 'session-1',
    });
  });

  it('maps afterFileEdit fields', () => {
    expect(
      buildLogEvent(
        {
          file_path: '/project/src/app.ts',
          edits: [{ old_string: 'a', new_string: 'b' }],
          session_id: 'session-1',
        },
        'afterFileEdit',
      ),
    ).toEqual({
      hook: 'afterFileEdit',
      file: '/project/src/app.ts',
      sessionId: 'session-1',
    });
  });
});

describe('buildLogEvent tool hooks', () => {
  it('maps preToolUse fields', () => {
    expect(
      buildLogEvent(
        {
          tool_name: 'Grep',
          tool_input: { pattern: 'hooks', path: '/project' },
          tool_use_id: 'tool-1',
          cwd: '/project',
          session_id: 'session-1',
        },
        'preToolUse',
      ),
    ).toEqual({
      hook: 'preToolUse',
      tool: 'Grep',
      input: { pattern: 'hooks', path: '/project' },
      id: 'tool-1',
      cwd: '/project',
      sessionId: 'session-1',
    });
  });

  it('maps beforeMCPExecution fields', () => {
    expect(
      buildLogEvent(
        {
          tool_name: 'web_fetch_exa',
          tool_input: { url: 'https://example.com' },
          command: 'exa',
          session_id: 'session-1',
        },
        'beforeMCPExecution',
      ),
    ).toEqual({
      hook: 'beforeMCPExecution',
      tool: 'web_fetch_exa',
      input: { url: 'https://example.com' },
      command: 'exa',
      sessionId: 'session-1',
    });
  });
});

describe('buildLogEvent edge cases', () => {
  it('omits fields that are not present', () => {
    expect(buildLogEvent({ session_id: 'session-1' }, 'afterAgentThought')).toEqual({
      hook: 'afterAgentThought',
      sessionId: 'session-1',
    });
  });

  it('includes handler fields when provided', () => {
    expect(
      buildLogEvent({ file_path: '/etc/passwd', session_id: 'session-1' }, 'beforeReadFile', {
        handler: 'guard',
        decision: 'deny',
        reason: 'path outside allowed roots: /etc/passwd',
      }),
    ).toEqual({
      hook: 'beforeReadFile',
      handler: 'guard',
      decision: 'deny',
      reason: 'path outside allowed roots: /etc/passwd',
      file: '/etc/passwd',
      sessionId: 'session-1',
    });
  });
});
