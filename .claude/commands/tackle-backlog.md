# /tackle-backlog

Read the active backlog, analyse dependencies between features, then spawn one agent per independent feature — or a coordinator agent when features share foundation code. Monitor until all agents complete.

---

## What to do

### Step 1 — Read the backlog

Read `backlog/backlog.md` and all files in `backlog/todo/` to understand:
- Which features are pending
- Their acceptance criteria and technical notes
- Which area each feature touches (parser, normalizer, runtime, templates, tests)

### Step 2 — Build the dependency graph

For each pending feature, determine:
- Which files it creates or modifies
- Which other features depend on its output
- Whether it shares foundation code (types, runtime helpers, templates) with other features

Classify features as:
- **Independent** — touches only its own files, no shared foundation
- **Dependent** — requires foundation built by another feature, or shares files with other features

### Step 3 — Decide on agents

**Independent features:** spawn one `general-purpose` agent per feature with `isolation: "worktree"`. Each agent works on its own branch.

**Dependent features:** spawn one coordinator `general-purpose` agent that:
1. Builds the shared foundation first (committed to the branch)
2. Builds each dependent feature on top, in dependency order
3. Opens a single PR covering all features in the group

When spawning agents, include in the prompt:
- The full contents of the relevant `backlog/todo/` feature file(s)
- The branch name to use: `feature/F-XXX-short-name`
- The instruction to run `pnpm type-check`, `pnpm test`, and `pnpm smoke` before committing
- The instruction to complete the backlog item(s) before running `/create-pr`

### Step 4 — Spawn agents

Call the Agent tool for each planned agent. Independent agents run in parallel (`run_in_background: true`).

### Step 5 — Report results

When all agents complete, summarise:
- Which features were implemented
- Which PRs were opened
- Any failures or gaps that need follow-up
