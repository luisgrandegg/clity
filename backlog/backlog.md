# Backlog — clity

The MVP scope is in [`MVP.md`](../MVP.md). Items below decompose that scope into trackable work, plus future-work items captured here so they don't drift into the MVP unannounced.

> **Conventions**
> - Status: 🔲 Todo · 🚧 In progress · ✅ Done
> - Files in `backlog/todo/` are the source of truth for unfinished work
> - Completing a feature → see `CLAUDE.md § Backlog`
> - Future-work items live here too, marked `📦 Future`. Do not start one until it's promoted to `🔲 Todo`.

---

## MVP — must ship in v0.1

| ID | Status | Title |
|----|--------|-------|
| F-001 | ✅ | Generator scaffold: parse OAS, normalise to CliSpec |
| F-002 | ✅ | Emit ready-to-run npm package (package.json, README, AGENTS.md) |
| F-003 | ✅ | Generated CLI runtime: commander + native fetch + describe + auth |
| F-004 | ✅ | Stable error contract: stderr JSON + documented exit codes |
| F-005 | ✅ | Petstore smoke test wired into CI |
| F-008 | 🔲 | Recursive schemas crash the generator (circular JSON in `emit`) |

## Beyond MVP

| ID | Status | Title |
|----|--------|-------|
| F-100 | 📦 | OAuth2 flows (client_credentials first) |
| F-101 | 📦 | Multipart / file upload (`--file` flag, multipart body) |
| F-102 | 📦 | Pagination helpers (`--all` flag for paged endpoints) |
| F-103 | 📦 | Response schema validation against the spec |
| F-104 | 📦 | Shell completion scripts (bash, zsh, fish) |
| F-105 | 📦 | Native binary distribution (`pkg`, `bun compile`) |
| F-106 | 📦 | MCP server output mode (same generator, different target) |
| F-107 | 📦 | Swagger 2.0 input support |
