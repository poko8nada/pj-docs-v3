/*
 * FEATURES: M-source
 * PURPOSE: プロジェクト共通の機械可読定数（拡張子・ディレクトリ名・パス・パターンID）を提供する (isDone: true)
 * STATUS: sizeDrift=false, driftSuspected=false
 */

// 人間向けパターン表は各ハーネスの skills/charter/references/patterns.md を参照。
// パターンIDを追加・変更するときは patterns.md と同期すること。

// ---- 拡張子 ----
// 実コード（ヘッダー対象・lint/typecheck 対象）
// 注意: .d.ts はヘッダー対象外（宣言・設定扱い）。ヘッダー判定する consumer は個別に除外すること
export const CODE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
// lint / typecheck の対象拡張子（CODE_EXTENSIONS の別名。将来ヘッダー対象と分岐し得る）
export const CHECKABLE_EXT = CODE_EXTENSIONS;
// フォーマット対象（CODE_EXTENSIONS + マークアップ/スタイル/ドキュメント/データ）
export const FORMAT_EXTENSIONS = [
  ...CODE_EXTENSIONS,
  '.json',
  '.jsonc',
  '.md',
  '.mdx',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.yaml',
  '.yml',
  '.graphql',
  '.gql',
  '.toml',
  '.html',
  '.htm',
  '.xhtml',
];

// ---- ディレクトリ名 ----
// ヘッダー対象ディレクトリ（ホワイトリスト。ルート直下のディレクトリ名）
export const ALLOWED_DIRS = [
  // プロダクトコードの一般的な置き場
  'src',
  'app',
  'pages',
  'client',
  'server',
  'web',
  'api',
  'worker',
  'frontend',
  'backend',
  'packages',
  'apps',
  'libs',
  // メタ / 管理系
  '.opencode',
  '.cursor',
  '.commandcode',
  'scripts',
  'products',
  'constants',
];
// 依存・生成物ディレクトリ（どの階層でも除外）
export const SKIP_DIRS = ['node_modules', 'dist', '.git'];
// 専用 tsconfig を持つハーネスディレクトリ
export const OPENCODE_DIR = '.opencode';
export const COMMANDCODE_DIR = '.commandcode';
// プロダクト定義スナップショットの置き場
export const PRODUCTS_DIR = 'products';

// ---- パス ----
// ヘッダー形式ドキュメント（ツール非依存表記。各ハーネスの skills/ 配下に解決される）
export const HEADER_FORMAT_PATH = 'skills/charter/references/header-format.md';

// ---- パターンID（patterns.md の機械可読形。追加時は patterns.md と同期する）----
export const PATTERN_IDS = [
  // H-* — Harness and hook code
  'H-chain',
  'H-handler',
  'H-gate',
  'H-mutator',
  'H-verifier',
  'H-state',
  'H-reporter',
  'H-transformer',
  // M-* — Meta scripts and tools
  'M-validate',
  'M-transform',
  'M-report',
  'M-sync',
  'M-scaffold',
  'M-audit',
  'M-migrate',
  'M-source',
  // S-* — Skill scripts
  'S-serve',
  'S-build',
  'S-reset',
  'S-report',
  'S-verify',
  'S-sync',
  'S-source',
];

// ---- 外部ホームディレクトリ名（restrict_root 系が ~ 配下に解決する）----
export const HOME_DIRS = {
  cursor: '.cursor',
  commandcode: '.commandcode',
  opencode: 'opencode',
};
