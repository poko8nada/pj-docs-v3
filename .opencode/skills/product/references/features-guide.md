# Features granularity guide

A feature is a capability unit that can be implemented and verified independently. Feature names use the `F-<domain>.<sub>` form (e.g., `F-auth.login`). Do not use sequential numbers (F-01): functional names keep existing IDs stable across additions, reordering, and splits.

## Granularity judgment (three questions)

1. **Product capability or implementation detail?** — A user-visible capability (or API boundary) is a feature. Functions, helpers, and DB queries are implementation details and belong inside a feature.
2. **Can it be implemented and verified independently?** — A unit that can be implemented and verified without depending on other features is one feature. Otherwise split it.
3. **Does it map to one or a few notes?** — If one feature has many notes hanging off it, it is too coarse. If notes span features, it is too fine.

## Example (notes app)

- F-note: note management
  - F-note.create: create a note
  - F-note.list: list notes
  - F-note.edit: edit a note
  - F-note.delete: delete a note
- F-search: search
  - F-search.fulltext: full-text search
- F-sync: sync
  - F-sync.manual: manual sync

## Bad examples

- Too coarse: `F-note` alone → create/list/edit/delete are mixed and many notes hang off it → split it.
- Too fine: `F-note.create.validate` → input validation is an implementation detail → include it in `F-note.create`.
