# Constraints guide

How to write the CONSTRAINTS in a persistent block. A constraint is what must hold at this code location; it is the agreed result of the discussion, written so another agent can interpret and verify it.

## What makes a good constraint

- **Testable**: can be verified by a test or by inspection.
- **Specific**: concrete, not abstract. Name the behavior, boundary, or rule.
- **Boundary-defining**: states what must hold and what is not allowed.
- **Location-scoped**: applies at this code location, not the whole product.

## Thinking approach

Ask: "What must be true here for the agreed intent to hold?"

- What input is invalid and must be rejected?
- What state must never be reached?
- What must not be exposed or leaked?
- What is the allowed boundary (timeout, retries, size)?
- Who is allowed to do this?

## Examples

| Weak (abstract)          | Strong (constraint)                                            |
| ------------------------ | -------------------------------------------------------------- |
| ログインを改善する       | ログイン失敗時、どちらのフィールドが間違っているか特定させない |
| セキュリティを考慮する   | 認証済みユーザーのみアクセス可能                               |
| エラーを適切に扱う       | 外部APIはタイムアウト5秒・リトライ2回まで                      |
| パフォーマンスを気にする | 一覧取得はページング必須、全件取得しない                       |

## What not to write

- Implementation choices (library, framework) → the product definition's D-stack section.
- Dependencies → derive from code structure.
- Reasoning/context → keep the constraint itself, not the story.
