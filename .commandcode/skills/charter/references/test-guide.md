# Test decision guide

Decides whether tests are needed for the discussed work. Applied during chartering, when the proposal is compiled.

## Required when applicable

- New or changed domain or pure logic includes error paths and edges, not only the happy path.
- A new logic module includes a colocated `*.test.ts` or `*.test.tsx` in the same feature folder.
- Mappers and error mapping are tested as pure functions while I/O remains at the edge.
- Complex client transitions extract decision logic to a pure function and test that function.

## Test exclusions

Tests are not needed when the work is:

- CSS or visual-only.
- Playwright, end-to-end, or browser automation work.
- Component render or click-heavy UI work whose main path is covered by Surface.
- Configuration-only work verified manually.
- A trivial getter or thin pass-through mapping.
- External plugin internals where the boundary is stubbed and the mapping is tested instead.

The execution details (test angles, command) are the session skill's job.
