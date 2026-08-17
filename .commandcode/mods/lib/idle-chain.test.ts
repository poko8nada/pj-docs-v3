import { describe, expect, it } from 'vitest';
import { runIdleChain, type CheckContext, type IdleCheck } from './idle-chain';

const baseContext = (): CheckContext => ({
  root: '/tmp',
  sessionID: 'test',
  files: ['/tmp/a.ts'],
  run: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
  log: async () => {},
});

describe('runIdleChain', () => {
  it('runs checks in order and sends follow-ups only after all checks complete', async () => {
    const order: string[] = [];
    const checks: IdleCheck[] = [
      {
        name: 'first',
        run: async () => {
          order.push('run:first');
          return { followUps: ['msg-1'] };
        },
      },
      {
        name: 'second',
        run: async () => {
          order.push('run:second');
          return { followUps: ['msg-2', 'msg-3'] };
        },
      },
    ];

    const prompts: string[] = [];
    await runIdleChain(baseContext(), checks, async (text) => {
      order.push(`prompt:${text}`);
      prompts.push(text);
    });

    expect(order).toEqual([
      'run:first',
      'run:second',
      'prompt:msg-1',
      'prompt:msg-2',
      'prompt:msg-3',
    ]);
    expect(prompts).toEqual(['msg-1', 'msg-2', 'msg-3']);
  });

  it('continues to the next check when one throws and logs the failure', async () => {
    const logged: { service: string; message: string }[] = [];
    const ctx = baseContext();
    ctx.log = async (service, _level, message) => {
      logged.push({ service, message });
    };

    const checks: IdleCheck[] = [
      {
        name: 'broken',
        run: async () => {
          throw new Error('boom');
        },
      },
      { name: 'ok', run: async () => ({ followUps: ['msg-ok'] }) },
    ];

    const prompts: string[] = [];
    await runIdleChain(ctx, checks, async (text) => {
      prompts.push(text);
    });

    expect(prompts).toEqual(['msg-ok']);
    expect(logged).toEqual([{ service: 'broken', message: 'idle check failed' }]);
  });

  it('sends nothing when no check returns follow-ups', async () => {
    const checks: IdleCheck[] = [{ name: 'quiet', run: async () => ({ followUps: [] }) }];
    const prompts: string[] = [];

    await runIdleChain(baseContext(), checks, async (text) => {
      prompts.push(text);
    });

    expect(prompts).toEqual([]);
  });
});
