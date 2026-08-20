/*
 * FEATURES: H-gate, H-reporter
 * PURPOSE: ユーザープロンプトのキーワード照合で該当スキルを提案注入する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

import type { Plugin } from '@opencode-ai/plugin';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---- 設定 ----
// スキルごとの起動キーワード。ユーザーのプロンプトに対して小文字の部分一致で照合する
// （日本語はそのまま部分一致。各キーワードは SKILL.md の description の起動条件から選定した）
// priority: 小さいほど優先。複数スキルが同時にマッチした場合は最上位1件のみ採用する
// 順位の考え方: より特化（ニッチ）したスキルほど上位。汎用の入口（charter）は最下位
const RULES: { skill: string; priority: number; keywords: string[] }[] = [
  { skill: 'look-workshop', priority: 1, keywords: ['look', 'ルック', 'workshopで', '見た目'] },
  {
    skill: 'meta-md-sync',
    priority: 2,
    keywords: ['スキルの同期', 'エージェント同期', '同期して', 'meta-md-sync'],
  },
  {
    skill: 'meta-md-audit',
    priority: 3,
    keywords: ['スキル監査', 'スキルの監査', 'スキルチェック', 'audit', '監査'],
  },
  { skill: 'readme', priority: 4, keywords: ['readme', 'リードミー'] },
  { skill: 'product', priority: 5, keywords: ['プロダクト定義', 'プロダクトの', 'products/'] },
  {
    skill: 'feasibility',
    priority: 6,
    keywords: ['実現可能', '実現性', 'フィージビリティ', '候補比較', '比較して', 'どれにする'],
  },
  {
    skill: 'stack-adopt',
    priority: 7,
    keywords: ['追加拡張', '統合して', 'adopt', '採用して', 'runbook', '導入手順', 'ランブック'],
  },
  {
    skill: 'review',
    priority: 8,
    keywords: ['レビューし', 'コミットしよ', 'コミットして', 'コミット前に', 'チェックし'],
  },
  { skill: 'session', priority: 9, keywords: ['次は何', '今セッション', 'スライス'] },
  {
    skill: 'charter',
    priority: 10,
    keywords: [
      'チャーター',
      'charterし',
      '方針を決め',
      '方針決め',
      '方針をまとめ',
      '提案をまとめ',
      '方針まとめ',
      '提案まとめ',
    ],
  },
];

// 効果測定ログはプロジェクト内 .opencode/skill-trigger/ に置く
const LOG_DIR = '.opencode/skill-trigger';
const LOG_FILE = 'log.jsonl';

// ---- セッションごとの状態 ----
// 注入済みスキルの記録（セッション内で二重注入しない）
const injectedSkills = new Map<string, Set<string>>();
// chat.message から system.transform への引き継ぎ（stash）
const pendingDirectives = new Map<string, string[]>();
// サブエージェントセッション判定のキャッシュ（セッションごとに1回だけ session.get を呼ぶ）
const subagentCache = new Map<string, boolean>();

// サブエージェントセッションかどうかを判定する
// サブエージェントは task ツール経由で Session.create({ parentID }) として生成されるため、
// parentID を持つセッションはサブエージェントとみなせる（メインセッションは parentID を持たない）
// 判定結果はキャッシュし、毎回 API 呼び出ししない
const isSubagentSession = async (
  client: ReturnType<typeof import('@opencode-ai/sdk').createOpencodeClient>,
  sessionID: string,
): Promise<boolean> => {
  const cached = subagentCache.get(sessionID);
  if (cached !== undefined) {
    return cached;
  }
  let isSubagent = false;
  try {
    const res = await client.session.get({ path: { id: sessionID } });
    isSubagent = Boolean(res?.data?.parentID);
  } catch {
    // 取得失敗時は注入を続行する（fail-open）
  }
  subagentCache.set(sessionID, isSubagent);
  return isSubagent;
};

// text パーツの型ガード（type が "text" かつ text が文字列のものだけに絞る）
const isTextPart = (p: { type: string; text?: unknown }): p is { type: 'text'; text: string } =>
  p.type === 'text' && typeof p.text === 'string';

// プロンプトのテキストを取り出す（ユーザー入力の text パーツのみを連結）
const promptText = (parts: { type: string; text?: unknown }[]): string =>
  parts
    .filter(isTextPart)
    .map((p) => p.text)
    .join('\n');

// 注入文を作る。ソフトな提案文にし、モデルがプロンプトとコンテキストを判断して
// 不適切なら無視できる余地を残す（誤爆しても実害が出ないようにする）
const buildDirective = (skill: string, keyword: string): string =>
  [
    `[skill-trigger] Suggestion: the request may relate to the "${skill}" skill (matched keyword: "${keyword}").`,
    `Judge from the request and conversation context — use the skill (SKILL.md: .opencode/skills/${skill}/SKILL.md) only if it genuinely fits.`,
    'If it does not fit, ignore this note.',
  ].join(' ');

export const SkillTriggerPlugin: Plugin = async ({ client, directory, worktree }) => {
  // ログ出力（opencode のログに統一する）
  const log = async (
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    extra?: Record<string, unknown>,
  ) => {
    await client.app.log({ body: { service: 'skill-trigger', level, message, extra } });
  };

  // 測定ログに1行追記する（JSONL）。失敗しても注入は止めない（fail-open）
  // 保存先はプロジェクト内（directory を優先し、未設定なら worktree にフォールバック）
  const root = path.resolve(directory || worktree);
  const logDir = path.join(root, LOG_DIR);
  const logFile = path.join(logDir, LOG_FILE);
  const appendLog = (entry: object) => {
    try {
      fs.mkdirSync(logDir, { recursive: true });
      fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
    } catch {
      /* ログは測定用なので無視して良い */
    }
  };

  return {
    // ユーザーがプロンプトを送信した直後：キーワード照合して注入指示を準備する
    'chat.message': async (input, output) => {
      // サブエージェントセッションには注入しない
      // （サブエージェントの Mission プロンプト内の文字列がキーワードに誤マッチして
      //   無関係なスキルが注入されるのを防ぐ）
      if (await isSubagentSession(client, input.sessionID)) {
        return;
      }

      const text = promptText(output.parts);
      if (!text) {
        return;
      }

      // セッション内で未注入のスキルだけを候補にする
      const already = injectedSkills.get(input.sessionID) ?? new Set<string>();
      const candidates = RULES.flatMap((rule) => {
        if (already.has(rule.skill)) {
          return [];
        }
        const keyword = rule.keywords.find((k) => text.toLowerCase().includes(k.toLowerCase()));
        return keyword ? [{ skill: rule.skill, keyword, priority: rule.priority }] : [];
      });
      if (candidates.length === 0) {
        return;
      }

      // 複数マッチ時は最上位（priority 最小）の1件だけ採用する
      // （候補はすべて記録し、あとでキーワード調整の判断材料にする）
      const chosen = candidates.toSorted((a, b) => a.priority - b.priority)[0];

      // system.transform への引き継ぎと dedup 記録
      pendingDirectives.set(input.sessionID, [buildDirective(chosen.skill, chosen.keyword)]);
      already.add(chosen.skill);
      injectedSkills.set(input.sessionID, already);

      await log('debug', 'matched', { sessionID: input.sessionID, chosen, candidates });
      appendLog({
        type: 'inject',
        ts: new Date().toISOString(),
        sessionID: input.sessionID,
        candidates,
        chosen,
        prompt: text,
      });
    },

    // LLM 呼び出し前：準備した指示をシステムプロンプトに注入し、stash を消費する
    // （モデルの目には「ユーザーが書いた文」ではなく「注入された指示」として見える）
    'experimental.chat.system.transform': async (input, output) => {
      const sessionID = input.sessionID ?? '';
      const directives = pendingDirectives.get(sessionID);
      if (!directives || directives.length === 0) {
        return;
      }
      output.system.push(...directives);
      pendingDirectives.delete(sessionID);
    },

    // ツール実行後：モデルが実際に SKILL.md を読んだかを記録する（効果測定）
    'tool.execute.after': async (input) => {
      const filePath = input.args?.filePath;
      if (typeof filePath !== 'string' || !filePath.endsWith('SKILL.md')) {
        return;
      }
      // SKILL.md の親フォルダ名 = スキル名
      const skill = path.basename(path.dirname(filePath));
      await log('debug', 'skill loaded', { sessionID: input.sessionID, skill });
      appendLog({
        type: 'read-skill',
        ts: new Date().toISOString(),
        sessionID: input.sessionID,
        skill,
        filePath,
      });
    },
  };
};
