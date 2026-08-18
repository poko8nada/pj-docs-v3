# プロジェクトスターター

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Status](https://img.shields.io/badge/status-template-lightgrey)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)
![pnpm](https://img.shields.io/badge/pnpm-managed-F69220?logo=pnpm&logoColor=white)

## Overview

TypeScript ベースのプロジェクトスターターです。oxlint / oxfmt（Lint / Format）、Vitest（Test）、Lefthook（Git hooks）が揃っています。テンプレとして複製し、任意のスタックを追加していく想定です。コーディングエージェント（opencode / commandcode / cursor）向けのドキュメント駆動開発基盤（スキル・ハーネス・共有定数）も含みます。

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 以上（LTS 推奨）
- [pnpm](https://pnpm.io/)

### Installation

1. テンプレとしてリポジトリを複製するか、GitHub の Use this template でコピーする。
2. [`package.json`](package.json) の `name` などをプロジェクト用に変更する。
3. 依存をインストールする（`prepare` で Lefthook が入る）。

```bash
pnpm install
```

アプリが未整備でも、TypeScript とツールだけなら次で検証できる。

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:run
```

## Usage

- `pnpm build` — `tsc` で TypeScript をコンパイル（出力先: `dist/`）
- `pnpm clean` — `dist/` を削除
- `pnpm test` / `pnpm test:run` — Vitest（ウォッチ / 一回）
- `pnpm lint` / `pnpm lint:fix` — oxlint
- `pnpm format` / `pnpm format:check` — oxfmt
- `pnpm typecheck` — プロダクト・opencode・commandcode をまとめて型チェック

## Harness

ドキュメント駆動開発のためのコーディングエージェント基盤です。

- **スキル** — charter / session / review / product などの開発ワークフロー（opencode / commandcode / cursor の3ハーネスで共有・同期）
- **ハーネス** — 各エージェントのプラグイン・モッド・フック（パーミッション制限・品質ゲート・ドリフト検出）
- **共有定数**（`constants/`）— 全ハーネス・スクリプトが参照する単一ソース
- **検証スクリプト**（`scripts/`）— ヘッダー検証・型チェック・products 検証などのコミットゲート
- **Git hooks**（`lefthook.yaml`）— pre-commit / pre-push の自動検証

## Product Flow

この基盤でプロダクトを開発する進め方です。

- **プロダクト定義**（`products/`）— 追記のみのスナップショットでプロダクトの定義を管理
- **開発ループ** — charter（意図をヘッダーに記録）→ session（スライスに分解して実装）→ review（コミット前に検証）→ product（プロダクト定義を更新）
- **成果物**（`findings/`）— レビュー・フィージビリティ・スタック評価の結果（追記のみ）

## Contributing

- コミット前に Lefthook が staged ファイルへ format / lint / typecheck を実行する。実コードファイルには FEATURES / PURPOSE / STATUS の冒頭ヘッダーが必須（header-gate）。
- プッシュ前に `pnpm typecheck`（全量）が走る。
- 方針の大きな変更は Issue か PR 説明で共有するとよい。

## License

MIT
