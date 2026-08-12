# Session slice guide

The slice output is user-facing: the filled template is presented in chat, so write the filled fields in Japanese. This file defines the format only.

Slices are derived from the charted headers (FEATURES / PURPOSE / STATUS, isDone: false) in the code. Each header is a decided change for its file. Present the slices after the charter is agreed.

## Derivation

1. Collect the charted headers in the code.
2. Group them into slices:
   - Same FEATURES ID → consider grouping into one slice.
   - Dependency between headers → separate slices, prerequisite first.
   - One slice is one verifiable concern; keep slices vertical and thin.
3. Sequence slices by dependency.

## Format

### Slice 1: <title in Japanese>

- Target:
  - <file>:<line> (FEATURES: <...>)
  -
- Implement: <the change the header declares>
- Test: <test angles> (<command>) / N/A (<reason>)
- Confirm: <what the user can confirm after the slice>
- Depends: <Slice N / none>

## Fields

- **Target**: the header location (file:line) and its FEATURES.
- **Implement**: what the header declares for that file.
- **Test**: the test angles decided during chartering (charter skill's test-guide) plus the command from `references/test-guide.md`; `N/A` only with a reason.
- **Confirm**: what the user can confirm after the slice (test pass, observable behavior).
- **Depends**: prerequisite slices.
