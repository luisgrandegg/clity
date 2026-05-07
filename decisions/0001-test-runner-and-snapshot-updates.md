# ADR-0001: Test runner and snapshot updates

**Status:** Accepted
**Date:** 2026-05-07
**Affects:** `package.json` test scripts, `test/`, future test infrastructure
**Related:** F-006 (snapshot tests for `describe` output)

---

## Context

clity needs a test runner. The constitution favours conservative dependencies (`CONSTITUTION.md § 5`) and small, transparent tooling, so the repo uses Node's built-in `node --test` runner with `node:assert/strict`.

F-006 introduced a snapshot test that locks the shape of the generated CLI's `describe` output (`CONSTITUTION.md § 2`). The feature spec asked for `pnpm test -- --update` to regenerate the snapshot, mirroring the convention popularised by Jest and Vitest.

That exact wording is not workable with `node --test`:

- Node's CLI parser consumes flags before they reach test files. Unknown flags (`--update`) error out at the runner level rather than being forwarded.
- Even with `process.argv` slicing, the offsets shift between Node versions, and every test file would need its own parsing logic or a shared helper.

Two alternatives were considered to deliver the spec's *intent* (a one-shot way to overwrite snapshots) without its literal command form:

1. **Custom argv parsing inside each test.** Brittle (depends on Node-version argv layout), bleeds boilerplate across files, and requires a workaround for the runner consuming unknown flags.
2. **Env-var convention with a cross-platform wrapper.** The snapshot test reads `process.env.UPDATE_SNAPSHOTS`; a 14-line `scripts/update-snapshots.mjs` sets the env var and re-spawns `pnpm test`, exposed as `pnpm test:update`. Same UX, no argv gymnastics, prior art across the ecosystem (`UPDATE_SNAPSHOT` in Jest, `INSTA_UPDATE` in insta).

Switching the runner entirely to **Vitest** was also considered. It would deliver `--update` natively but pulls ~80 transitive dev deps, requires migrating four test files to `vitest`/`expect`, and would force F-006's standalone JSON snapshot into Vitest's escaped-string `.snap` format — actively worse for review of a structured `describe` contract. The vitest swap also collides with two open PRs (F-006 and F-007) mid-MVP. Rejected on cost vs. ergonomic gain (`CONSTITUTION.md § 5`, § 7).

## Decision

1. **Test runner.** Continue using Node's built-in `node --test` plus `node:assert/strict`. No third-party test framework is introduced for the MVP.
2. **Snapshot updates.** Use the env-var-plus-wrapper pattern (alternative 2 above):
   - Snapshot tests check `process.env.UPDATE_SNAPSHOTS === '1'` and overwrite the snapshot file when set.
   - `scripts/update-snapshots.mjs` is the canonical entry point. It sets the env var and re-runs `pnpm test`, working identically on Windows / macOS / Linux without shell quoting or `set` / `export` differences.
   - Exposed as the npm script `pnpm test:update`.
3. **Future contributors who propose Vitest** must justify the swap against this ADR and open a follow-up ADR rather than a drive-by migration.

## Consequences

**Positive**

- Zero new dev dependencies. Test surface stays small and forkable, in line with `CONSTITUTION.md § 5`.
- The snapshot update flow works identically on every supported platform without shell-portability shims.
- The locked describe contract (F-006's snapshot) is reviewable as a plain JSON file rather than an escaped-string `.snap` blob.
- The `node --test` runner is part of Node 20+, which is already the engines floor — no version coupling.

**Negative / accepted tradeoffs**

- The npm script is `pnpm test:update`, not the spec's literal `pnpm test -- --update`. Documented in the F-006 PR body, in the test file's top comment, and now here.
- `node --test` lacks features Jest/Vitest provide out of the box: rich expectation matchers, watch mode, focused-test ergonomics, built-in coverage. If those become load-bearing, revisit via a follow-up ADR.
- Snapshot file format is hand-rolled (pretty-printed JSON with trailing newline). Adding a second snapshot file in the future means deciding the format again or extracting a tiny helper.

## Revisit when

- The test suite grows past ~50 tests and `node --test`'s feature set becomes a real bottleneck.
- A second snapshot use case appears that doesn't fit the F-006 standalone-JSON pattern (e.g. inline snapshots inside test code).
- Coverage reporting becomes load-bearing for ADR or roadmap decisions.
