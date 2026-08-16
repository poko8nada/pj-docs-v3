# Feature identification guide

## Matching a change to a feature

- A change belongs to a feature if it implements or alters that capability. Map it to the feature ID from the latest products/ snapshot.
- A change that touches multiple features is a split-chartering sign: prefer one proposal per feature.
- **Nothing matches** → do not invent an ID. Propose adding the feature to the product definition (product skill) and hold the proposal until it exists.

## Granularity judgment (three questions)

1. **Product capability or implementation detail?** — A user-visible capability (or API boundary) is a feature. Functions, helpers, and DB queries are implementation details and belong inside a feature.
2. **Can it be implemented and verified independently?** — A unit that can be implemented and verified without depending on other features is one feature. Otherwise split it.
3. **Does it map to one or a few charted headers?** — If one feature has many headers hanging off it, it is too coarse. If headers span features, it is too fine.
