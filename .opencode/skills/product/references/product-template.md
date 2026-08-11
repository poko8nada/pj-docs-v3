# Snapshot template

The structure of a products/ snapshot. Content sentences are written in Japanese; items, symbols, function names, feature IDs (`F-<domain>.<sub>`), and commands stay in English. Follow the format rules in `products/README.md`.

## Frontmatter

```yaml
---
date: YYYY-MM-DD
context: <why this change was made, in prose>
changed:
  - <section ID>
---
```

`changed` is absent or empty for the working document (file #1).

## Body

## G-what: What is this

- <1 line: who + situation + need>
- <why: 1-3 bullets>

## G-outcome: Outcome

- <1 line outcome covenant>
- <why: 1-3 bullets>

## G-nongoal: Non-goal

- <expected-but-excluded>

## D-name: Name

- <1 line: chosen name>
- <why: 1-3 bullets>

## D-look: Look

- <フロント上の見た目の方向性・特徴（自由記述・一言に限らない）>
- <why: 1-3 bullets>
- Path: findings/look-workshop/<slug>.html（look-workshop で確定した場合のみ追記）

frontend: false のプロダクト（API / DB / library / CLI）ではこのセクションを省略する。

## D-stack: Stack

- frontend: <true / false>
- <area>: <choice>
- <area>: <choice>

## B-roadmap: Roadmap

- MVP: <scope>
- Next: <scope>

## B-test: Test strategy

- <base policy per references/test-guide.md>

## B-deploy: Deploy / Publish

- MVP: <how it ships>
- Next: <how it ships>

見出し名はタイプに合わせる（ID は B-deploy のまま）: web app / API は Deploy、library / CLI は Publish。

## B-scope: Scope

- <how far to build>

## F-<domain>.<sub>: <feature name>

- <feature definition>
