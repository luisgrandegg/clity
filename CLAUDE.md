# CLAUDE.md — clity

> This file is automatically read by Claude Code at session start.
> It provides full project context so every session begins with shared understanding.
> **Read this before doing anything else.**

---

## Constitution

**Read [`CONSTITUTION.md`](./CONSTITUTION.md) before anything else.**
Every product, design, and technical decision in this repo is governed by the constitution.
If a request conflicts with the constitution's principles, flag it explicitly before proceeding.

The MVP scope is defined in [`MVP.md`](./MVP.md). Anything beyond that scope must be flagged before implementation.

---

## Project Overview

clity is an OpenAPI → agent-ready CLI generator. Given an OpenAPI 3.x spec, it emits a Node.js npm package whose binary turns each operation into a subcommand designed for non-interactive subprocess use by AI agents.

**Two pieces of software live in this repo:**

1. **The generator** — a TypeScript CLI shipped as `clity`. Run `npx clity <spec-url-or-path> --output ./my-cli` to produce a package.
2. **The generated CLI** — plain JavaScript output. Each operation becomes a subcommand. The contract with agents is defined in `AGENTS.md` (shipped with every generated package).

The generator is the implementation. The generated CLI is the product the user installs.

---

## Repository Structure

```
/
├── bin/
│   └── clity.mjs              # User-facing binary; thin wrapper around dist/cli.js
├── src/
│   ├── cli.ts                 # Generator entrypoint (Commander)
│   ├── types.ts               # Internal model: CliSpec, CliOperation, CliParam, ...
│   ├── generator/
│   │   ├── parse.ts           # Loads + dereferences the OpenAPI spec
│   │   ├── normalize.ts       # OpenAPI → internal CliSpec
│   │   ├── emit.ts            # Writes the output package to disk
│   │   ├── templates.ts       # String templates for package.json, README, AGENTS.md
│   │   └── runtime/           # Static .js files copied verbatim into every output
│   │       ├── cli.js         # Generated CLI entrypoint (template-free)
│   │       └── runtime.js     # request, auth, exit codes, error formatting
│   └── utils.ts
├── test/
│   ├── fixtures/              # Sample OpenAPI specs (petstore, minimal, edge cases)
│   ├── normalize.test.ts      # Unit tests for the normalizer
│   └── generator.test.ts      # Generates against fixtures and asserts on output
├── backlog/
│   ├── backlog.md             # Active feature list — check this for project state
│   ├── todo/                  # Individual feature files
│   └── completed/             # Finished features
├── decisions/                 # Architecture Decision Records (ADRs)
├── .claude/
│   ├── settings.json          # Claude Code permissions for this repo
│   └── commands/              # Custom slash commands
├── githooks/
│   └── pre-commit             # Backlog consistency check
├── scripts/
│   └── check-backlog-consistency.js
├── .github/
│   ├── workflows/ci.yml       # lint + typecheck + test
│   └── pull_request_template.md
├── CLAUDE.md                  # This file
├── CONSTITUTION.md            # Governing principles
├── MVP.md                     # Scope for v0.1
├── AGENTS.md                  # Contract for agents using a clity-generated CLI
├── README.md
├── package.json
└── tsconfig.json
```

---

## Architecture: how the generator works

```
OpenAPI spec  →  parse()  →  raw OAS document
              ↓
              normalize()  →  CliSpec  (operations[], params[], security[])
              ↓
              emit()       →  filesystem (package.json, bin/cli.js, lib/*.js, AGENTS.md, README.md)
```

- **`parse.ts`** — loads from URL or path, validates, dereferences `$ref`s using `@readme/openapi-parser`. Handles OAS 3.0 and 3.1.
- **`normalize.ts`** — pure function: OAS document → `CliSpec`. Derives kebab-case command names from `operationId` (or method+path), maps params to flags, extracts request-body schemas, resolves security per operation.
- **`emit.ts`** — pure function: `CliSpec` → array of `{ path, content }` files. The actual filesystem writes happen in `cli.ts` and are the only impure step.
- **`runtime/`** — `.js` files copied verbatim into every generated package. They are **not** templated. The data they need (operations, security, baseUrl, cliName) is loaded from `lib/operations.json` at runtime.

**Why split runtime from templates?** Because the runtime is forkable JavaScript that users will read and modify. Keeping it template-free means it is checked, linted, and runnable as-is in this repo's tests, without going through a generation step.

---

## The generated CLI's contract

Documented in detail in `AGENTS.md` (shipped with every generated package). Summary:

| Channel | Contract |
|---|---|
| stdout (success) | Compact JSON, one document, trailing newline |
| stderr (failure) | `{ "error": <string>, ... }` JSON, one document, trailing newline |
| Exit codes | `0` ok · `1` usage / client error · `2` API error 4xx · `3` server error 5xx · `4` network error |
| `describe` | Returns the full CliSpec as JSON. Canonical machine-readable surface. |
| `describe <command>` | Returns one `CliOperation` as JSON. |
| Auth | `--token` / `--api-key` flag → env var `<CLI>_TOKEN` / `<CLI>_API_KEY` → `~/.<cli>/config.json` |
| `auth set --token X` | One-shot non-interactive write to the config file. |

This contract is versioned. See `CONSTITUTION.md § 2`.

---

## Development Lifecycle

**Never commit directly to `main`.** All changes go through a Pull Request.

### Branch Naming

| Type       | Pattern                     |
| ---------- | --------------------------- |
| Feature    | `feature/F-XXX-short-name`  |
| Fix        | `fix/short-description`     |
| Chore      | `chore/short-description`   |

### Workflow

1. **Sync main first** — `git checkout main && git pull origin main`
2. **Install dependencies** — `pnpm install`
3. **Start a branch** — `git checkout -b feature/F-XXX-description`
4. **Work and commit** — conventional commits on the branch
5. **Build and smoke-test** — `pnpm build && pnpm smoke` should print the operation count for the petstore fixture
6. **Create a PR** — use `/create-pr`
7. **Wait for CI** — use `/watch-pr`

### CI gates (run on every PR)

- `pnpm lint` — `tsc --noEmit` succeeds
- `pnpm type-check` — TypeScript strict, zero errors
- `pnpm build` — clean build to `dist/`
- `pnpm test` — unit + smoke tests pass

---

## Custom Commands

Slash commands live in `.claude/commands/`.

| Command                   | Purpose                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| `/generate-cli`           | Run the generator against a spec URL/path and inspect the output       |
| `/smoke-test`             | Generate against the bundled Petstore fixture and run `describe` on it |
| `/create-pr`              | Create a PR for the current branch and start CI watch                  |
| `/watch-pr`               | Poll CI on the current PR; fix failures automatically                  |
| `/review-pr`              | Review a PR, post inline comments per finding, submit REQUEST_CHANGES  |
| `/rules-audit`            | Score the quality of AI rules across 8 criteria                        |
| `/setup-environment`      | Walk a new machine through Node, pnpm, gh CLI, and verify hooks        |
| `/complete-feature`       | Move a backlog item from `todo/` to `completed/` with a commit         |
| `/tackle-backlog`         | Spawn one agent per backlog feature                                    |
| `/discover`               | Explore the repo's architecture for a new contributor                  |

---

## Backlog

Current feature status is always in [`backlog/backlog.md`](./backlog/backlog.md). Check it before starting work.

### When to complete a backlog item

Complete the backlog item when **all of the following are true**:
- The feature's code is committed on the current branch
- `pnpm type-check` and `pnpm lint` report zero errors
- `pnpm test` passes
- You are about to run `/create-pr`

### How to complete a backlog item

1. Append the completion block to the feature file (see `backlog/completed/README.md`)
2. Copy the file to `backlog/completed/`
3. **Delete** the original from `backlog/todo/` — leaving it in both places will block the commit
4. Remove the row from `backlog/backlog.md`
5. **Create a git commit**:
   ```
   git commit -m "feat(backlog): complete F-XXX — <feature name>"
   ```

> The pre-commit hook checks that no file exists in both `backlog/todo/` and `backlog/completed/`.

---

## Shell Command Rules

To avoid surprising permission prompts:

- **Never prefix commands with `cd path && ...`** — run from the repo root
- **Use `git -C <path>`** if an explicit path is needed
- **Use the dedicated file tools** (`Write`, `Edit`, `Read`) for filesystem changes
- **Allowed Bash commands and the subcommands used in this project:**

  | Command   | Allowed subcommands |
  | --------- | ------------------- |
  | `git`     | `status`, `diff`, `add`, `commit`, `push`, `pull`, `fetch`, `merge`, `log`, `checkout`, `branch`, `rev-parse`, `stash`, `cherry-pick`, `config`, `rm` |
  | `pnpm`    | `install`, `build`, `lint`, `type-check`, `test`, `smoke`, `--filter <pkg> <script>`, `add`, `remove` |
  | `node`    | any |
  | `npx`     | `clity`, `tsc` |
  | `gh`      | `pr view`, `pr create`, `pr checks --watch --interval 30`, `run view --log-failed`, `repo edit`, `api` |
  | `jq`      | any |

  Commands not in this table require user confirmation.

---

## Modifying AI Rules

**This section applies only when the current task involves editing one of these files:**
- `CLAUDE.md`
- `CONSTITUTION.md`
- Any file in `decisions/`
- Any file in `.claude/commands/`

**If none of those files are being modified, skip this section.**

When modifying AI rules:

1. Run `/rules-audit` before making changes to record the baseline score.
2. Make your changes.
3. Run `/rules-audit` again to confirm the score improved or did not regress.
4. Include the before / after scores in the PR description.
