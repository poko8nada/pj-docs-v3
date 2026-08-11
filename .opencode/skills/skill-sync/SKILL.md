---
name: skill-sync
description: Sync skills between the project's Cursor skills directory and opencode skills directory. Use when the user asks to sync, push, pull, check, or compare skills between Cursor and opencode, or when skill contents may have drifted.
---

# skill-sync

Syncs skill directories between the project's Cursor skills directory and the project's opencode skills directory. Global skill directories are out of scope.

## Commands

Run `node scripts/sync.mjs` from this skill's directory. The agent resolves the skill's base directory, so no `cd` is needed:

```bash
node scripts/sync.mjs check
node scripts/sync.mjs push --dry-run
node scripts/sync.mjs pull --dry-run
node scripts/sync.mjs pull --skill=readme --skill=look-workshop
```

- `check` — show per-skill status without changing anything.
- `push` — copy opencode skills → Cursor skills.
- `pull` — copy Cursor skills → opencode skills.
- `--dry-run` — preview what would be copied without writing.
- `--force` — copy regardless of mtime.
- `--skill=<name>` — repeatable; restrict the operation to the listed skills (works with check/push/pull). Unlisted skills are untouched.
- `--project=<path>` — override the project root (default: current working directory).

## Workflow (mandatory)

1. Run `check` to see the current status.
2. Run `push --dry-run` or `pull --dry-run` for the requested direction.
3. Present the dry-run output to the user in chat and wait for explicit confirmation.
4. Only after the user confirms, run the actual `push` or `pull` (without `--dry-run`).

Never run `push` or `pull` without `--dry-run` first.

## Conflict policy

When a skill exists on both sides, the side with the newer mtime wins. Use `--force` to force the copy direction.

## Exceptions

`exceptions.json` (next to this SKILL.md) lists skills that are never synced, per side:

- `opencode`: skills that live only on the opencode side (never copied to or from the opencode directory).
- `cursor`: skills that live only on the Cursor side (never copied to or from the Cursor directory).

A flat array (old format) applies to both sides. Unknown skill names are warned about but do not stop the operation. `skill-sync` itself is always excluded.

## Notes

- Only directories containing `SKILL.md` are treated as skills.
- Copy is overwrite-only; files are never deleted.
- A missing source directory exits with an error.
