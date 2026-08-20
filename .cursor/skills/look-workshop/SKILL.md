---
name: look-workshop
description: 'Soft skill: lock look via disposable Vite HTML workshop in cmux; build to findings/look-workshop/<slug>.html. Use for Discover Look (or Build re-lock). Commands: scripts/dev.mjs, build.mjs, reset.mjs.'
---

# look-workshop

Co-edit workshop look; durable result only via **build**. No GitHub issues.

Steps 2–3 may loop; mid-run build OK without reset.

## Language

- User-facing output (what the skill presents in chat) is written in Japanese.
- Item labels, symbols, IDs, and commands stay in English.

## Commands (skill base)

- `node scripts/dev.mjs` — Vite + cmux
- `node scripts/build.mjs` — singlefile → `findings/look-workshop/<slug>.html` (+ assets merge)
- `node scripts/reset.mjs` — restore workshop; keeps findings intact

## Steps

1. **dev** — workshop open. Stop if slicing.
2. **Co-edit** — tokens in `look.css`, structure in `index.html`; `data-aid` on units.
3. **Apply queue** — read `comments.json` → edit → delete handled `aid` → reload if needed. Repeat 2–3 until eye OK (or build mid-run).
4. **build** — findings path exists for slug.
5. **Handoff** (+ optional reset). Close when: eye confirmed (or mid-run accepted); build written; handoff done; applied comments cleared (or user kept unapplied).

## Conventions

### Look vs chrome

- Look = HTML under `body`. No chrome markup in HTML.
- Tokens in `look.css` only — no raw hex / `bg-[#…]` in markup. Token names follow shadcn variables (`--background`, `--primary`, …).
- Build merges images emitted from `workspace/dist/` into `findings/look-workshop/assets/` (shared, kept across builds).
- SVG icons: inline in HTML.
- FAB/drawer = dev chrome only (`src/chrome/` — `annotate.js` + `chrome.css`).

### data-aid

Stable key from element → comment row. Prefer hosts that can take children; wrap void tags.

### Comments queue

- `comments.json` is queue truth (gitignored) — not findings.
- Apply a note → delete **that** entry by `aid` only.
- Empty drafts discarded; no marker.

### Layout

```
look-workshop/
├── SKILL.md
├── defaults/index.html   # defaults for new index.html (copied to workspace on dev/build)
├── scripts/{dev,build,reset,_paths}.mjs
└── workspace/            # Vite workbench — src/ is source; index.html / dist / comments.json are generated
```

## Handoff

Topic / Path (`.html`) / Why / Summary / Axes touched.

## Limits

- Use `dev.mjs`, not root `pnpm dev`.
- Derive the finished look from the workshop content, not from an empty workshop.
- Treat `comments.json` as transient workshop notes, not durable design docs.
- Overwrite the slug only with intent; ship the workshop only as a workshop artifact.
- Leave issues to the issue tracker.
