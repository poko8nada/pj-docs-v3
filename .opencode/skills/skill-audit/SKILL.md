---
name: skill-audit
description: Audit skills in the directory this skill lives in against best practices and personal conventions. Use when the user asks to check, audit, review, or lint skills, or when a skill may fail to load.
---

# skill-audit

Audits the skills in the directory this skill lives in, in two steps: mechanical checks by script, then content checks by the agent.

## Step 1 — Mechanical check (script)

Run `node scripts/audit.mjs` from this skill's directory. The agent resolves the skill's base directory, so no `cd` is needed:

```bash
node scripts/audit.mjs
node scripts/audit.mjs --dir <path>
node scripts/audit.mjs --json
```

- Default target: the parent of this skill's directory.
- `--dir <path>`: audit a different skills directory.
- `--json`: machine-readable output.

Mechanical checks cover: frontmatter parse and duplicate keys, name format and directory match, description required/length/block-scalar/single-line/unquoted-colon, body empty/line count/mid-paragraph breaks/dead links, tool-agnostic paths (no tool-specific path prefixes in SKILL.md or references/\*.md), and security patterns (destructive commands, sensitive paths, prompt injection).

## Step 2 — Content check (agent)

After the mechanical check passes, review each skill's content and present findings in chat. Do not re-run the script.

- Description: does it convey what the skill does and when to use it? Is it third person?
- Body: are the steps clear and numbered? Are there concrete examples?
- Gotchas: does the skill mention failure patterns or pitfalls?
- Structure: is detail split into reference/ files when the body approaches 500 lines? Are references one level deep?
- Language: is terminology consistent?
- Independence: does the skill avoid external references? External things are allowed only as procedure outputs (e.g., products/ snapshots). Skill-specific artifacts belong inside the skill; if multiple skills share something, consider separating responsibility.

## Workflow (mandatory)

1. Run the script (Step 1) and present mechanical findings in chat.
2. Apply mechanical fixes only after user confirmation.
3. Perform the content check (Step 2) and present findings in chat.
4. Apply content fixes only after user confirmation.

## Output

Per-skill checklist with ✓/✗ and an upgrade suggestion for each failed item. Exit code 1 when any error-level check fails.
