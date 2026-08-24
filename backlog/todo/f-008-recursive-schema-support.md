# F-008 — Recursive schemas crash the generator

**Status:** 🔲 Todo
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

- [ ] A fixture at `test/fixtures/recursive-api.json` with a self-referencing schema
- [ ] `clity` generates successfully from it (exit 0)
- [ ] `lib/operations.json` is valid JSON and round-trips through `JSON.parse`
- [ ] The generated CLI's `describe` and `describe <command>` both succeed
- [ ] The chosen cycle representation is documented in the generated `AGENTS.md`
      (i.e. in `src/generator/templates.ts`)
- [ ] `describeVersion` is bumped if the representation changes the contract

## Notes

- Detect cycles with a `WeakSet` of seen objects during a walk of the CliSpec,
  rather than a `try/catch` around `JSON.stringify` — the latter cannot tell you
  *where* the cycle is.
- Emitting the error as `{"error":"parse"}` is itself misleading here: the
  failure happens in `emit`, not `parse`. Worth narrowing the label while in
  this code.
