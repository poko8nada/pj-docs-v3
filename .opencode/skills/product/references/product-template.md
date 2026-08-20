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

## Goal

### G-what: What is this

- <1 line: who + situation + need>
- <why: 1-3 bullets>

### G-outcome: Outcome

- <1 line outcome covenant>
- <why: 1-3 bullets>

### G-nongoal: Non-goal

- <expected-but-excluded>

## Discover

### D-name: Name

- <1 line: chosen name>
- <why: 1-3 bullets>

### D-look: Look

- <frontend look direction and traits; free-form, not limited to one line>
- <why: 1-3 bullets>
- Path: findings/look-workshop/<slug>.html (append only when the look is locked via look-workshop)

For products with `frontend: false` (API / DB / library / CLI), omit this section.

### D-stack: Stack

- frontend: <true / false>
- <area>: <choice>
- <area>: <choice>

## Build

### B-roadmap: Roadmap

- MVP: <scope>
- Next: <scope>

### B-test: Test strategy

- <base policy per references/test-guide.md>

### B-deploy: Deploy

- MVP: <how it ships>
- Next: <how it ships>

Match the heading to the type: web app / API → Deploy, library / CLI → Publish.

### B-scope: Scope

- <how far to build>

### Feature

- F-<domain>.<sub>: <feature name>
  - <feature definition>

### Common

- C-<name>: <common unit name>
  - <what it provides, in one line>
  - <why: 1-3 bullets>

Common units are optional: include them only when multiple features share the unit. Features depend on Common; Common is independent of features.
