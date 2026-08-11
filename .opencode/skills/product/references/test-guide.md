# Test strategy guide

The agreed base for the B-test section in products/ snapshots.

## Base policy

- Prefer solid TypeScript or schema checks at boundaries plus unit tests on pure-logic error paths.
- Skip browser automation and component render tests by default when the Surface adequately covers the main path for a small or medium product.
