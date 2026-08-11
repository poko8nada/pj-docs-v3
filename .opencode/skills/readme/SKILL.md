---
name: readme
description: Generate or improve the root README.md for external audiences. Use when creating, rewriting, or cleaning README.md. Internal planning stays in products/.
---

# readme

Root `README.md` only (unless user names another path). The README is the external-facing explanation of the product definition; internal planning stays in products/ and notes.

## Steps

1. Read the latest products/ snapshot (the source of truth) and inspect the existing README + manifests.
2. Recommend Mode A (scratch) or B (improve), sections, and any content to move out. Agree before Write.
3. Before edit → check AGENTS.md (project conventions) and the products/ sections the README derives from.
4. Relocating internal planning → propose moving it to products/ (product skill) only after user agrees.
5. Confirm what changed / moved / deferred.

### Structure (fixed order)

```text
# Project Name
[badges]
## Overview
## Getting Started
### Prerequisites
### Installation
## Usage
## Contributing
## License
```

Optional after Usage: Configuration / API Reference / Table of Contents / Content Workflow — only when applicable.

### Copy

- Overview: 2–4 sentences from G-what. Prerequisites: versions when known. Installation/Usage: copy-pasteable. License: one line.
- Badges: 3–6 factual (shields.io). Infer from repo; ask only when material and missing (license default MIT, version `0.1.0`).
- Usage: derive from the features (F-\*) in the latest products/ snapshot.

## Limits

- Do not put Concept/Goals, Stack rationale, Architecture, Roadmap, or harness internals in README.
- Do not expand into product/harness redesign under README work.
- Mode B: remove internal blocks the user agreed to move.
