# Interpretation template

Presented for discussion. Nothing is written until the user agrees.

## State check

<!-- Report the project state first. Handle missing/incomplete product definition and missing notes here. -->

- プロダクト定義: <あり（products/ 最新スナップショット）/ なし / 未完成（<不足>）>
- note: <あり（<件数>件）/ なし>
- 関連機能: <F-<domain>.<sub> または 未定義>

## Purpose reconstruction

<!-- Reconstruct intent top-down from the product definition: goal → features → notes. -->

- ゴール: <プロダクト定義のゴールを1行で>
- 実現したいこと: <このnote群が実現するもの>
- 必要な機能: <機能リスト>

## Note map

<!-- Map features to files. The State column shows whether a note is undiscussed (NOTE present) or decided (persistent block present). -->

| Feature | File   | State             |
| ------- | ------ | ----------------- |
| <機能>  | <path> | 未議論 / 決定済み |

## Proposed constraints

<!-- Propose the constraints that would be written to each note's persistent block. These become the code comment after agreement. Follow references/constraints-guide.md. -->

- <path>: <制約の対象>
  - <制約1>
  - <制約2>

## Coverage and proposals

<!-- Coverage check result. New note proposals go here; write them only after user agreement. -->

- <不足しているもの（テスト・ヘルパー・機能）> → <提案するnote>

## Dependencies and order

<!-- Derive from code structure and imports. Do not rely on user-written DEPENDS_ON. -->

1. <path>（依存: <依存元>）
2. ...

## Confirmation items

<!-- Separate the agent's guesses so the user can correct them. -->

- [ ] <ゴール解釈・制約候補・不足判断など、ユーザーに確認したいこと>
