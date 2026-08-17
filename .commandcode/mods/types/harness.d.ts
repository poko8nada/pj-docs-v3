// @commandcode/harness の型スタブ。
// 本物の型は CLI にバンドルされており npm 配布されないため、
// このプロジェクトの mod が使う面だけを宣言する。
// tsconfig の paths で @commandcode/harness をこのファイルに解決する。
// cmd のバージョン更新時はこの宣言を実態に合わせて更新する。

export interface Disposable {
  dispose(): void;
}

export interface ModSessionApi {
  appendCustomEntry(entry: { customType: string; data?: unknown }): void;
  appendCustomMessageEntry(entry: {
    customType: string;
    content: string;
    display?: boolean;
    details?: unknown;
  }): { entryId: string; message: unknown };
  getCustomEntries(opts: { customType: string }): unknown[];
}

export interface ModUi {
  notify(message: string): void;
  confirm(opts: { title: string; message?: string }): Promise<boolean>;
  select(opts: { title: string; options: unknown[] }): Promise<unknown>;
  input(opts: { title: string; placeholder?: string }): Promise<unknown>;
  setStatus(text: string | null): Disposable;
  widget(opts: {
    placement: 'above-editor' | 'below-editor';
    render: () => readonly string[];
  }): Disposable;
  refreshWidgets(): void;
  capabilities: { status: boolean };
}

export interface ModContext {
  emit(channel: string, data?: unknown): void;
  signal?: AbortSignal;
  cwd: string;
  session?: ModSessionApi;
}

export interface BeforeToolCallResult {
  block?: boolean;
  additionalContext?: string;
  input?: Record<string, unknown>;
  terminate?: boolean;
}

export interface AfterToolCallResult {
  content?: string;
  terminate?: boolean;
  additionalContext?: string;
  isError?: boolean;
  modState?: Record<string, unknown>;
}

export interface ModHooks {
  transformContext?(
    args: { messages: unknown[]; state: unknown; signal?: AbortSignal },
    ctx?: ModContext,
  ): unknown[] | Promise<unknown[]>;
  appendSystemPrompt?(
    args: { state: unknown },
    ctx?: ModContext,
  ): string | undefined | Promise<string | undefined>;
  beforeToolCall?(
    args: {
      toolCallId: string;
      toolName: string;
      input: Record<string, unknown>;
      state: unknown;
    },
    ctx?: ModContext,
  ): BeforeToolCallResult | undefined | Promise<BeforeToolCallResult | undefined>;
  afterToolCall?(
    args: {
      toolCallId: string;
      toolName: string;
      input: Record<string, unknown>;
      result: string;
      isError: boolean;
      state: unknown;
    },
    ctx?: ModContext,
  ): AfterToolCallResult | undefined | Promise<AfterToolCallResult | undefined>;
  onTurnStart?(args: { state: unknown; turnNumber: number }, ctx?: ModContext): unknown;
  onTurnEnd?(
    args: { state: unknown; turnNumber: number; hadToolCalls: boolean; usage: unknown },
    ctx?: ModContext,
  ): unknown;
  shouldStopAfterTurn?(
    args: { state: unknown; turnNumber: number },
    ctx?: ModContext,
  ): boolean | Promise<boolean>;
  prepareNextTurn?(
    args: { state: unknown; turnNumber: number },
    ctx?: ModContext,
  ):
    | { model?: string; effort?: string }
    | undefined
    | Promise<{ model?: string; effort?: string } | undefined>;
  onRunEnd?(args: { state: unknown; result: unknown }, ctx?: ModContext): void | Promise<void>;
  onStop?(
    args: { state: unknown; stopReason: string; turnNumber: number; lastAssistantText: string },
    ctx?: ModContext,
  ):
    | { continue?: boolean; reason?: string }
    | undefined
    | Promise<{ continue?: boolean; reason?: string } | undefined>;
  transformInput?(
    args: { text: string },
    ctx?: ModContext,
  ):
    | { action: 'continue' }
    | { action: 'transform'; text: string }
    | { action: 'handled'; message?: string }
    | undefined
    | Promise<
        | { action: 'continue' }
        | { action: 'transform'; text: string }
        | { action: 'handled'; message?: string }
        | undefined
      >;
  onSessionStart?(args: { source: string }, ctx?: ModContext): void | Promise<void>;
  onSessionEnd?(args: { reason: string }, ctx?: ModContext): void | Promise<void>;
}

export type AgentEventType =
  | 'run_start'
  | 'run_end'
  | 'turn_start'
  | 'turn_end'
  | 'model_request_start'
  | 'model_request_end'
  | 'tool_running'
  | 'tool_completed'
  | 'tool_errored'
  | 'subagent_start'
  | 'subagent_stop'
  | 'subagent_progress'
  | 'compaction_start'
  | 'compaction_done'
  | 'notice'
  | 'session_titled'
  | 'permission_mode_changed'
  | 'config_setting_changed'
  | 'mod_error'
  | 'interrupted'
  | 'run_error';

export interface ModApi {
  name: string;
  cwd: string;
  session?: ModSessionApi;
  ui: ModUi;
  hooks(hooks: ModHooks): Disposable;
  on(
    event: AgentEventType | 'session_start' | 'session_shutdown',
    handler: (data: unknown) => void | Promise<void>,
  ): Disposable;
  queueMessage(opts: { content: string; deliverAs?: 'steer' | 'follow-up' }): void;
  exec(opts: {
    command: string;
    args?: string[];
    cwd?: string;
    signal?: AbortSignal;
  }): Promise<{ stdout: string; stderr: string; code: number }>;
  showEntry(customType: string, data?: unknown): void;
  addCommand(command: {
    name: string;
    description?: string;
    argumentHint?: string;
    handler: (args: {
      args: string;
      ui: ModUi;
      cwd: string;
      exec: ModApi['exec'];
    }) => { prompt?: string; message?: string } | void;
  }): Disposable;
  addRenderer(customType: string, renderer: (data: unknown) => readonly string[]): Disposable;
  addTool(tool: {
    schema: {
      name: string;
      description: string;
      input_schema: Record<string, unknown>;
    };
    run: (args: {
      input: Record<string, unknown>;
      runtime: unknown;
      signal?: AbortSignal;
    }) => Promise<
      { ok: true; content: { type: 'text'; text: string }[] } | { ok: false; error: string }
    >;
  }): Disposable;
  addFlag(
    name: string,
    opts: { type: 'boolean' | 'string'; default?: boolean | string; description?: string },
  ): Disposable;
  getFlag(name: string): boolean | string | undefined;
  setSessionName(value: string): void;
  setModel(value: string): void;
  setEffort(value: string): void;
  getAllTools(): readonly string[];
  getActiveTools(): readonly string[];
  setActiveTools(names: readonly string[]): void;
}

export type ModFactory = (cmd: ModApi) => void | Promise<void>;
