---
name: meta-md-sync
description: Sync skills and agent definitions between the project's opencode, Cursor, and CommandCode directories. Skills sync fully; agents sync description and body only, preserving each harness's frontmatter. Use when the user asks to sync, push, pull, check, or compare skills or agents between harnesses, or when skill or agent contents may have drifted.
---

# meta-md-sync

Syncs skill directories and agent definitions between the project's opencode, Cursor, and CommandCode directories. Global directories are out of scope.

## Language

- User-facing output (what the skill presents in chat) is written in Japanese.
- Item labels, symbols, IDs, and commands stay in English.

## Commands

Run `node scripts/sync.mjs` from this skill's directory. The agent resolves the skill's base directory, so no `cd` is needed:

```bash
node scripts/sync.mjs check
node scripts/sync.mjs push --dry-run
node scripts/sync.mjs pull --dry-run
node scripts/sync.mjs pull --skill=readme --skill=look-workshop
node scripts/sync.mjs push --agent=feasibility
```

- `check` — show per-skill and per-agent status across the three sides without changing anything.
- `push` — copy opencode → Cursor + CommandCode.
- `pull` — copy Cursor + CommandCode → opencode.
- `--dry-run` — preview what would be copied without writing.
- `--force` — copy regardless of mtime.
- `--skill=<name>` — repeatable; restrict the operation to the listed skills (works with check/push/pull). Unlisted skills are untouched.
- `--agent=<name>` — repeatable; restrict the operation to the listed agents (works with check/push/pull). Unlisted agents are untouched.
- `--project=<path>` — override the project root (default: current working directory).

## Sync scope

- **Skills**: the whole skill directory is copied (SKILL.md, references/, scripts/). Side-specific frontmatter is preserved:
  - CommandCode's `when_to_use` is kept on push and stripped on pull.
- **Agents**: only `description` and the body are synced. Each harness's frontmatter (mode, model, permission, tools, ...) stays untouched, so the same agent definition works across harnesses.

## Workflow (mandatory)

1. Run `check` to see the current status.
2. Run `push --dry-run` or `pull --dry-run` for the requested direction.
3. Present the dry-run output to the user in chat and wait for explicit confirmation.
4. Only after the user confirms, run the actual `push` or `pull` (without `--dry-run`).

Run `--dry-run` before every `push` or `pull`.

## Conflict policy

When a skill or agent exists on both sides of a pair, the side with the newer mtime wins. Use `--force` to force the copy direction.

## Side-specific frontmatter

CommandCode's `SKILL.md` carries a `when_to_use` frontmatter field (skill-trigger keywords) that the other sides lack. The sync preserves it:

- `push` to CommandCode keeps the destination's existing `when_to_use`.
- `pull` from CommandCode strips `when_to_use`, keeping it out of opencode / Cursor.

Agent frontmatter differs per harness (opencode: mode/model/permission; Cursor: model/is_background; CommandCode: maxTurns/tools). The sync keeps each side's frontmatter and replaces only `description` and the body.

## Exceptions

`exceptions.json` (next to this SKILL.md) lists skills excluded from sync, per side:

- `opencode`: skills that live only on the opencode side (copied only within the opencode directory).
- `cursor`: skills that live only on the Cursor side (copied only within the Cursor directory).
- `commandcode`: skills that live only on the CommandCode side (copied only within the CommandCode directory).

A flat array (old format) applies to all sides. Unknown skill names warn without stopping the operation. `meta-md-sync` itself is always excluded.

## Notes

- Only directories containing `SKILL.md` are treated as skills; only `*.md` files in `agents/` are treated as agents.
- Copy is overwrite-only; files are kept.
- A missing source directory exits with an error.
