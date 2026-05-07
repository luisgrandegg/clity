# /discover

Explore the clity repo and produce a structured discovery report. Use this when you're new to the codebase or returning after a break.

---

## Arguments

```
/discover [free-text query]
```

Optional `[free-text query]` narrows the exploration (e.g. "how does normalize handle nested $refs", "what does the generated runtime do for auth").

---

## What to do

### Step 1 — Read the rule layer

Read in parallel: `CONSTITUTION.md`, `CLAUDE.md`, `MVP.md`, `AGENTS.md`. Hold the constitution principles in mind throughout discovery.

### Step 2 — Map the source layout

Glob `src/**/*.ts` and `src/generator/runtime/**/*.js`. For each top-level file, read it and record:

- **`src/cli.ts`** — the generator entrypoint
- **`src/types.ts`** — the internal model
- **`src/generator/parse.ts`** — OpenAPI loading + dereferencing
- **`src/generator/normalize.ts`** — OAS → CliSpec
- **`src/generator/emit.ts`** — CliSpec → file array
- **`src/generator/templates.ts`** — string templates
- **`src/generator/runtime/cli.js`** — the entrypoint of every generated CLI
- **`src/generator/runtime/runtime.js`** — request, auth, exit codes

### Step 3 — Read the tests and fixtures

Read `test/**/*.ts` and `test/fixtures/*` to understand what's covered and what isn't. Note any gaps relevant to the query.

### Step 4 — Read the backlog

`backlog/backlog.md` plus any open feature in `backlog/todo/`. This is the live state of what's planned next.

### Step 5 — Produce the report

```markdown
## Discovery Report — clity

**Date:** <today>
**Query:** <query or "free exploration">

### Overview
<2–4 sentences: what clity is, current MVP status, immediate next steps>

### Pipeline
<parse → normalize → emit, with file references>

### Generated CLI runtime
<what bin/cli.js does, what runtime.js does, what gets baked in vs. read at runtime>

### Tests
<what's covered, what's missing>

### Backlog
<what's pending, what's completed>

### Constitution alignment
<any drift from principles, especially the stable I/O contract or the "no runtime magic" rule>
```

If a query was provided, add:

```markdown
### Answer to: "<query>"
<Direct answer with file:line references>
```

### Step 6 — Suggest next steps

1–3 follow-up actions based on what was found. Examples:
- "There's no fixture for OAS 3.1 — add one before working on F-XXX."
- "The runtime has no test for the network-error exit code path — write one."
- "`describe` output isn't snapshot-tested — wire up a snapshot before any change to the spec shape."
