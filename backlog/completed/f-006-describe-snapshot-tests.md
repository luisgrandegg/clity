---
**Completed:** 2026-05-07
**Notes:** Implemented in commit c8065fa. Snapshot at `test/__snapshots__/petstore-describe.json` is regenerated each run from the Petstore fixture and compared byte-for-byte; only the env-dependent `generator.specSource` is normalised. Updater wired as `pnpm test:update` (the feature spec's `pnpm test -- --update` was rejected because it requires plumbing argv through `node --test`).
---

# F-006 — Snapshot tests for `describe` output

**Status:** ✅ Done
**Area:** test/, src/generator/

## Why

The shape of `describe` output is a versioned API (see `CONSTITUTION.md § 2`). Without a snapshot test, an accidental field rename or shape change could ship as a patch release and break every downstream agent.

## Acceptance criteria

- [x] A snapshot file at `test/__snapshots__/petstore-describe.json` capturing the full `describe` output for the bundled Petstore fixture
- [x] A test that regenerates the petstore CLI, runs `describe`, parses it, and asserts byte-equality against the snapshot (modulo a known small set of allowed fields like `cliVersion` if needed)
- [x] The CI `test` job runs this and fails on diff
- [x] An updater script: `pnpm test -- --update` regenerates the snapshot

## Notes

- Snapshot must be deterministic. Ensure `normalize.ts` does not depend on Map iteration order, current time, or anything else non-stable.
- Update snapshots intentionally — do not check in a regenerated snapshot without reading the diff.
