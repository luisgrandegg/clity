# Slash Commands — clity

These commands give you guided, step-by-step workflows without needing to know prompt engineering or project conventions. Type any command into Claude Code to get started.

---

## Generating CLIs

### `/generate-cli`

**Use when:** You want to run the clity generator against an OpenAPI spec and inspect the output.

Claude will ask for the spec URL or path, the output directory, and any overrides (name, version), then run the generator and verify the output is well-formed.

> Example: `/generate-cli` → "Petstore: https://petstore3.swagger.io/api/v3/openapi.json"

---

### `/smoke-test`

**Use when:** You want to verify the generator end-to-end against the bundled Petstore fixture.

Claude builds the generator, runs it against `test/fixtures/petstore.json`, and confirms `describe` returns valid JSON listing all operations.

---

## Managing your work

### `/create-pr`

**Use when:** You're done with a piece of work and want to open a Pull Request.

Claude checks for uncommitted changes, pushes your branch, creates the PR with the right template, then immediately starts monitoring CI.

---

### `/watch-pr`

**Use when:** A PR is open and you want to know if CI has passed.

Claude polls GitHub every 30 seconds. If CI passes, it tells you the PR is ready to review. If something fails, it reads the logs and fixes it. If there are merge conflicts, it resolves them.

---

### `/review-pr`

**Use when:** You want a structured review of an open PR.

Claude reads the diff, posts inline comments per finding, and submits a `REQUEST_CHANGES` review summarising the issues.

---

### `/complete-feature`

**Use when:** You've finished a backlog feature and want to mark it as done.

Claude verifies the acceptance criteria are met, moves the feature file to `backlog/completed/`, updates the backlog index, and creates the completion commit.

---

### `/tackle-backlog`

**Use when:** You want to make broad progress on the backlog.

Claude reads `backlog/backlog.md`, identifies independent features, and spawns one agent per feature to work in parallel.

---

## Exploration

### `/discover`

**Use when:** You're new to the codebase or returning after a break.

Claude walks the repo, summarises the architecture (generator pipeline, runtime, templates), and points you to the most useful files.

---

## Environment

### `/setup-environment`

**Use when:** Setting up a new machine to work on this project.

Walks you through installing Node, pnpm, gh CLI, and verifying hooks are working — step by step, tailored to your OS.

---

## Auditing AI rules

### `/rules-audit`

**Use when:** You've modified (or are about to modify) any of the AI-governing files — `CLAUDE.md`, `CONSTITUTION.md`, `decisions/`, or `.claude/commands/`.

Claude reads every rule source, scores 8 quality criteria from 0–10, and produces a concrete improvement report for anything below 8.
