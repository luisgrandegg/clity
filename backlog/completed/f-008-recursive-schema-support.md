---
**Completed:** 2026-08-24
**Notes:** Added `src/generator/cycles.ts`. `breakCycles()` deep-copies the CliSpec, replacing each cycle back-edge with an RFC 6901 JSON Pointer marker (`{"x-circular-ref": "#/operations/0/responses/0/schema"}`) that resolves against the describe document itself — design option 1. Wired into `emit()` so every template receives a serialisable spec. Only back-edges to ancestors on the current walk path are replaced, so a repeated-but-acyclic subtree (a DAG) is still emitted in full; the petstore snapshot is byte-identical apart from a deliberately stabilised `generator.version`, confirming no change to output for specs that already generated. `describeVersion` stays at 1: the marker only appears where generation previously failed outright, so the shape grows without breaking (`CONSTITUTION.md § 2`). Error labels now name the failing pipeline stage, so an emit failure is no longer reported as `parse`. Discovered while verifying against Stripe that cycles were masking a second, separate defect — combinatorial DAG expansion — so `MAX_EXPANDED_NODES` (5,000,000) now refuses an oversized spec in ~1s with a structured `emit` error instead of a ~6-minute heap exhaustion; the real fix is tracked as F-009.
---

# F-008 — Recursive schemas crash the generator

**Status:** ✅ Done
**Area:** src/generator/templates.ts, src/generator/emit.ts, AGENTS.md

## Why

`parseSpec()` dereferences the spec with `@readme/openapi-parser`, which inlines
`$ref`s. For a self-referencing schema this produces a genuinely circular
JavaScript object. `operationsJson()` then calls `JSON.stringify(spec)` and
throws `TypeError: Converting circular structure to JSON`, so generation fails
with exit 1 and the catch-all `{"error":"parse"}` label.

This is not an edge case. It reproduces on a 25-line spec with a single
self-referencing `Node` schema (a tree, a linked list, a comment thread), and it
blocks generation against Stripe's published OpenAPI 3.0 spec entirely. Both the
Petstore and GitHub REST specs generate fine, so the failure is specific to
recursion, not spec size.

Minimal repro:

```jsonc
// components.schemas.Node.properties.children.items.$ref -> '#/components/schemas/Node'
```

## Design decision required

`describe` is a versioned contract (`CONSTITUTION.md § 2`), so how a cycle is
represented in `lib/operations.json` needs a deliberate choice before
implementation:

1. **Cycle marker** — replace a back-edge with `{"x-circular-ref": "<path>"}`.
   Keeps the whole schema shape, adds a token agents must understand.
2. **Depth cap** — expand recursive schemas to a fixed depth, then truncate.
   No new token, but silently lossy.
3. **Keep the `$ref`** — leave the back-edge as a `$ref` string pointing into a
   `components` block re-emitted alongside the operations. Most faithful to the
   source spec, largest change to the describe payload.

Option 1 is the smallest change that loses no structural information.

## Acceptance criteria

- [x] A fixture at `test/fixtures/recursive-api.json` with a self-referencing schema
- [x] `clity` generates successfully from it (exit 0)
- [x] `lib/operations.json` is valid JSON and round-trips through `JSON.parse`
- [x] The generated CLI's `describe` and `describe <command>` both succeed
- [x] The chosen cycle representation is documented in the generated `AGENTS.md`
      (i.e. in `src/generator/templates.ts`)
- [x] `describeVersion` is bumped if the representation changes the contract — not bumped: existing output is byte-identical, so the shape grows without breaking

## Notes

- Detect cycles with a `WeakSet` of seen objects during a walk of the CliSpec,
  rather than a `try/catch` around `JSON.stringify` — the latter cannot tell you
  *where* the cycle is.
- Emitting the error as `{"error":"parse"}` is itself misleading here: the
  failure happens in `emit`, not `parse`. Worth narrowing the label while in
  this code.
