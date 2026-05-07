# F-006 — Snapshot tests for `describe` output

**Status:** 🔲 Todo
**Area:** test/, src/generator/

## Why

The shape of `describe` output is a versioned API (see `CONSTITUTION.md § 2`). Without a snapshot test, an accidental field rename or shape change could ship as a patch release and break every downstream agent.

## Acceptance criteria

- [ ] A snapshot file at `test/__snapshots__/petstore-describe.json` capturing the full `describe` output for the bundled Petstore fixture
- [ ] A test that regenerates the petstore CLI, runs `describe`, parses it, and asserts byte-equality against the snapshot (modulo a known small set of allowed fields like `cliVersion` if needed)
- [ ] The CI `test` job runs this and fails on diff
- [ ] An updater script: `pnpm test -- --update` regenerates the snapshot

## Notes

- Snapshot must be deterministic. Ensure `normalize.ts` does not depend on Map iteration order, current time, or anything else non-stable.
- Update snapshots intentionally — do not check in a regenerated snapshot without reading the diff.
