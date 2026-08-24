# F-009 — Deduplicate shared schemas in the emitted describe document

**Status:** 🔲 Todo
**Area:** src/generator/cycles.ts, src/generator/templates.ts, src/types.ts, AGENTS.md

## Why

`parseSpec()` dereferences the spec, which inlines every `$ref` at every use
site. For a heavily cross-referenced spec that expansion is combinatorial, not
linear in the size of the source document:

| Spec | Operations | Expanded nodes | Result |
|---|---|---|---|
| Petstore 3.0.4 | 19 | ~3k | generates |
| GitHub REST API | 1221 | ~570k | generates (13MB) |
| Stripe | 589 | > 20,000,000 | refused |

F-008 added a `MAX_EXPANDED_NODES` ceiling (5,000,000) so an oversized spec
fails in ~1s with a structured `emit` error instead of exhausting the heap
after ~6 minutes. That makes the failure honest, but it is still a failure:
clity cannot currently generate a CLI for Stripe's published spec.

## Design decision required

The fix is to emit each distinct schema once and reference it elsewhere. That
changes the `describe` contract, which is versioned (`CONSTITUTION.md § 2`),
and it trades directly against `CONSTITUTION.md § 1` (agent-first): today an
agent running `describe <command>` gets a fully self-contained schema and never
has to resolve anything.

1. **Hoist shared schemas into a top-level `components` map**, referencing them
   by JSON Pointer — reusing the `x-circular-ref` resolution agents already do
   for F-008. Collapses Stripe to roughly source-spec size. Costs every agent a
   resolution step for every spec, including the small ones that never needed it.
2. **Hoist only above a size threshold**, so small specs stay fully inlined and
   only pathological ones degrade. Keeps the common case self-contained; makes
   the output shape conditional, which is harder to write an agent against.
3. **Keep inlining, but cap expansion depth per schema**, truncating beyond it.
   No new resolution step, but silently lossy — an agent cannot tell a truncated
   schema from a complete one.

Option 2 preserves the agent-first property where it matters and is the only one
that does not regress the specs that work today. It needs a `describeVersion`
bump and a documented rule for when hoisting kicks in.

## Acceptance criteria

- [ ] A fixture with a shared (non-circular) schema used from several operations
- [ ] Stripe's published spec generates successfully within the node budget
- [ ] `describe` and `describe <command>` remain resolvable without a second call
- [ ] The chosen representation is documented in the generated `AGENTS.md`
- [ ] `describeVersion` bumped, and the change recorded in an ADR under `decisions/`
- [ ] Petstore and GitHub output is unchanged, or the snapshot diff is reviewed

## Notes

- Measure with the node counter in `countExpandedNodes` rather than output bytes;
  bytes hide the object-graph cost that actually exhausts memory.
- Deduplication must stay deterministic — same spec in, same bytes out
  (`CONSTITUTION.md § Rules for Agents`). Key the table by a stable hash of the
  schema, not by insertion order of first sighting.
