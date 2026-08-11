# Session slice guide

<!--
 * REF: <file-path>
 * CONSTRAINTS:
 *   - スライスは永続ブロックから導出する（抽象テンプレートから作らない）
 *   - 検証はinterpretで決定済みのテストアングルを引き継ぐ
 *   - 確認はユーザーがスライス後に確認できる結果を明示する
 -->

Slices are derived from the persistent blocks (REF + CONSTRAINTS) in the code. Each block is a decided change at a specific location. Present the slices after the interpretation is agreed.

## Derivation

1. Collect the persistent blocks in the code.
2. Group them into slices:
   - Same REF feature → consider grouping into one slice.
   - Dependency between blocks → separate slices, prerequisite first.
   - One slice is one verifiable concern; keep slices vertical and thin.
3. Sequence slices by dependency.

## Format

### Slice 1: <タイトル>

- Target:
  - <file>:<line>（REF: <...>）
  -
- Implement: <ブロックが指示する変更>
- Test: <test angles>（<command>）/ N/A（理由）
- Confirm: <ユーザーが確認できる結果>
- Depends: <Slice N / なし>

## Fields

- **Target**: the block location (file:line) and its REF.
- **Implement**: what to write at the block position (below the insertion-point block).
- **Test**: the test angles decided during interpretation (interpret skill's test-guide) plus the command from `references/test-guide.md`; `N/A` only with a reason.
- **Confirm**: what the user can confirm after the slice (test pass, observable behavior).
- **Depends**: prerequisite slices.
