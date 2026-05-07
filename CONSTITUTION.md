# clity — Constitution

> This document governs every product, design, and technical decision in this repo.
> Agents: read this before acting. If a request conflicts with these principles, flag it before proceeding.

---

## Mission

clity turns any OpenAPI specification into a CLI that an AI agent can drive over stdin / stdout. It is the integration layer between any HTTP API and any agent that can run a shell command — no MCP server, no SDK, no custom tool definitions, no provider lock-in.

The bet is simple: **the universal interface to APIs is the shell, and the universal client is the agent.** clity makes that bet shippable.

---

## Core Principles

Every change in this repository must follow all of these principles. No exceptions without a new ADR.

### 1. Agent-first contract
The generated CLI exists to be driven by an LLM agent, not by a human at a terminal. Every design choice favours machine consumption:
- `describe` (machine-readable JSON) is the canonical surface — `--help` is a courtesy
- Output defaults to compact JSON; pretty-printing is opt-in
- Errors are structured JSON on stderr, never free-form text
- No interactive prompts, ever — missing input fails fast with a usage error

If a feature would help a human at the cost of agent ergonomics, the agent wins.

### 2. Stable I/O contract
The shape of `describe`, the shape of error objects, and the meaning of exit codes form a versioned API. Once a major version ships, these shapes can grow but cannot break.

| Channel | Contract |
|---|---|
| stdout (success) | Compact JSON, one document, trailing newline |
| stderr (failure) | `{ "error": <string>, ... }` JSON, one document, trailing newline |
| Exit codes | `0` ok · `1` usage / client error · `2` API error 4xx · `3` server error 5xx · `4` network error |

Any change to these is a breaking change and requires a major version bump.

### 3. Generated code is plain JavaScript
The generator's output ships as readable, forkable JavaScript with zero build step. No TypeScript, no bundler, no source maps, no transpilation. A user must be able to open `bin/cli.js` and follow exactly what it does.

The generator itself may be TypeScript. The output may not.

### 4. No runtime magic
The generated CLI prefers code generation (`.js` files written to disk) over runtime interpretation. The dereferenced spec is embedded as JSON; commands are registered statically; flags are derived once at generate-time. No dynamic plugin loading, no monkey-patching, no proxies.

### 5. Conservative dependencies
The generated CLI's only runtime dependency is Commander. It uses native `fetch` (Node 20+). It does not pull in axios, node-fetch, dotenv, chalk, ora, inquirer, or anything that prints to stdout uninvited.

The generator itself depends on a small, well-maintained set: an OpenAPI parser, Commander, and TypeScript. Adding a runtime dep requires an ADR.

### 6. Forkable output
The generated package is something a user could check into their own repo and modify. It is not a black box updated by republishing — it is a starting point. Names, structure, and code style are chosen with that in mind: short files, clear names, no clever tricks.

### 7. Honest scope
The MVP supports OpenAPI 3.0 / 3.1, API key + bearer auth, JSON request and response bodies. Anything beyond that — OAuth2, multipart uploads, pagination helpers, response validation — is **out of scope until the MVP works end-to-end**, and is documented as future work in the README rather than half-implemented.

If a request would expand scope before the MVP ships, flag it.

---

## Rules for Agents

When working in this repository, apply the following checks before implementing any feature.

**On every change:**
- Ask: "Does this preserve the stable I/O contract above?"
- Ask: "Does this make the generated CLI more or less agent-friendly?"
- Ask: "Could a developer read the generated output and understand it without running it?"

**On the generator:**
- Generated files must be deterministic — same spec in, same bytes out
- Templates are kept separate from logic (string templates or `ejs`, not interleaved with parsing)
- New OpenAPI features must come with a fixture and a test that locks the generated output

**On the generated CLI:**
- No new runtime deps without an ADR
- No new exit codes without a major version bump
- No interactive prompts — ever
- Help text is human-friendly; `describe` is machine-friendly; do not blur them

**On dependencies:**
- Prefer the standard library (native `fetch`, `URL`, `fs`, `path`) over a package
- Pin major versions; let minor / patch float

**On scope:**
- The MVP scope is defined in [`MVP.md`](./MVP.md). Do not add features outside that scope without updating MVP.md or opening an ADR
- "Future work" items belong in the README's _Limitations_ section, not as half-implemented features

---

## Versioning

clity follows semver strictly because the generated CLI's contract is consumed programmatically by agents.

| Change | Version bump |
|---|---|
| Add a new OpenAPI feature without changing existing output | minor |
| Add a new flag to the generator | minor |
| Change the shape of `describe` output | major |
| Change exit code meaning | major |
| Change the structure of stderr error objects | major |
| Add a new runtime dependency to the generated CLI | major (it changes the install footprint of every downstream package) |
| Bug fix that does not change generated output for valid input | patch |

---

## Modifying AI Rules

**This block is active only when the current task modifies this file, `CLAUDE.md`, or any file in `.claude/commands/`. Skip it otherwise.**

Run `/rules-audit` before and after any change to AI-governing files. Changes must not reduce any criterion score without an explicit explanation in the PR description.
