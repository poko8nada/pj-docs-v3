# Test execution guide

How to verify a slice. Applies to the `Test` column of the session slice. Whether tests are needed was decided during interpretation (interpret skill's test-guide).

## Test angles

Choose the angles that apply and record the choice in the `Test` column:

| Angle           | Examples                                              |
| --------------- | ----------------------------------------------------- |
| Invalid         | malformed input; wrong meaning under a plausible type |
| Absent          | undefined, empty, missing required field              |
| Boundary        | 0 / 1 / max±1, min/max numbers                        |
| Excess          | too long, too many items, deep nesting                |
| Duplicate       | same id / key / email twice                           |
| Double submit   | second click, replayed command                        |
| Race / order    | stale update wins; out-of-order responses             |
| Bad transition  | illegal state move                                    |
| Authz           | signed out; other user's resource; missing role       |
| Idempotent      | delete again; act on already-absent                   |
| Transient fail  | timeout, 5xx, retry then give up                      |
| Permanent fail  | 4xx, rejected, missing remote                         |
| Partial success | one side wrote, the other did not                     |
| Empty success   | OK with empty body / zero hits                        |

## Command

When tests apply, run `pnpm test:run`.
