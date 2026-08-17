---
name: meta-md-audit
description: Audit skills and agent definitions in the directory this skill lives in against best practices and personal conventions. Use when the user asks to check, audit, review, or lint skills, or when a skill may fail to load.
when_to_use: 'スキル監査, スキルの監査, スキルチェック, audit, 監査'
---

# meta-md-audit

Audits the skills and agent definitions in the directory this skill lives in, in two steps: mechanical checks by script, then content checks by the agent.

## Language

- User-facing output (what the skill presents in chat) is written in Japanese.
- Item labels, symbols, IDs, and commands stay in English.

## Targets

- **Skills**: directories containing a `SKILL.md` in the parent of this skill's directory.
- **Agents**: `*.md` files in the `<parent>/agents/` directory. The script resolves `agents/` from the skills directory, so the same code works in both opencode and Cursor.

## Step 1 — Mechanical check (script)

Run `node scripts/audit.mjs` from this skill's directory. The agent resolves the skill's base directory, so no `cd` is needed:

```bash
node scripts/audit.mjs
node scripts/audit.mjs --dir <path>
node scripts/audit.mjs --json
```

- Default target: the parent of this skill's directory (skills) plus its `agents/`.
- `--dir <path>`: audit a different skills directory (its `agents/` sibling is used as well).
- `--json`: machine-readable output.

Mechanical checks cover:

- **Frontmatter**: parse, duplicate keys.
- **Name**: format (lowercase-hyphen, ≤64 chars) and directory match. SKILL.md only — agents carry no `name` field.
- **Description**: required, length, block-scalar, single-line, unquoted-colon.
- **Body**: empty, line count, mid-paragraph breaks, dead links.
- **Line length**: max 240 chars per line, excluding code blocks, tables, and HTML comments.
  - Lists, headings, and inline code are included.
  - The frontmatter description is excluded (it is one-line by rule and capped at 1024 chars by the Description check).
  - A hit is a **structuring flag**: the line packs multiple concepts; restructure it (e.g. split a paragraph into an intro line plus bullets) instead of merely shortening text.
  - Mid-paragraph breaks stay forbidden (Body check).
- **Tool-agnostic paths**: no tool-specific path prefixes in SKILL.md, references/\*.md, or agents/\*.md.
- **Japanese extraction**: whitelist .md files only — root SKILL.md plus registered source directories (e.g. references/), recursive; agents are the single agents/\*.md file. Notes:
  - Whitelist `MD_SOURCE_DIRS` and skip list `SKIP_DIRS` live in scripts/audit.mjs.
  - The script only extracts; the agent judges (Step 2).
- **Unregistered .md directories**: warns when .md exists outside the whitelist, so future source directories are never silently missed. SKILL.md only.
- **Security patterns**: destructive commands, sensitive paths, prompt injection.

## Step 2 — Content check (agent)

After the mechanical check passes, review each target's content and present findings in chat. Do not re-run the script. Review scope:

- For skills: review the SKILL.md **and** the skill's `references/*.md` files.
- For agents: review the single agents/\*.md file.
- The script only checks paths inside references, not their content.

- Description: does it convey what the skill/agent does and when to use it? Is it third person?
- Body: are the steps clear and numbered? Are there concrete examples?
- Gotchas: does the skill/agent mention failure patterns or pitfalls?
- Structure: is detail split into reference/ files when the body approaches 500 lines? Are references one level deep?
- Structuring: for every `md-line-length` hit reported by the script, propose a restructuring (intro line plus bullets, one concept per line) rather than text shortening. Mid-paragraph breaks stay forbidden.
- Language:
  - Is the terminology consistent?
  - Is everything written in English? Agents are agent-facing: the output rules must be explicit.
  - If the output format is intended for users, is it explicitly stated that it should be written in Japanese?
  - For every `md-japanese` hit reported by the script, check manually whether the file explicitly states that its user-facing output is written in Japanese:
    - Allowed when the statement exists; otherwise propose English conversion in the findings.
    - The script only extracts, it does not judge.
- Independence: does the skill avoid external references? External things are allowed only as procedure outputs (e.g., products/ snapshots). Rules:
  - Skill-specific artifacts belong inside the skill.
  - If multiple skills share something, consider separating responsibility.

## Workflow (mandatory)

1. Run the script (Step 1) and present mechanical findings in chat.
2. Apply mechanical fixes only after user confirmation.
3. Perform the content check (Step 2) and present findings in chat.
4. Apply content fixes only after user confirmation.

## Output

Per-skill checklist with ✓/✗ and an upgrade suggestion for each failed item. Exit code 1 when any error-level check fails.
