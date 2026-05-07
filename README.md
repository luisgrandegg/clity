# clity

> Turn any OpenAPI spec into a CLI that an AI agent can drive. No MCP server, no SDK, no custom tool definitions — just a shell command.

```bash
npx clity https://petstore3.swagger.io/api/v3/openapi.json --output ./petstore-cli
cd petstore-cli && npm install
node bin/cli.js describe | jq '.operations[] | .command'
```

Read [`CONSTITUTION.md`](./CONSTITUTION.md) for the principles that govern every product and technical decision in this repo. The MVP scope is in [`MVP.md`](./MVP.md).

---

## What this is

The universal interface to APIs is the shell, and the universal client is the agent. clity makes that bet shippable: feed it an OpenAPI spec, get back a Node.js CLI where every operation is a subcommand, every flag is documented, errors are structured JSON, and there is a `describe` command that hands back the entire surface as machine-readable JSON.

An agent that can run a shell command can use any API.

| Without clity | With clity |
|---|---|
| Write an MCP server per API | `npx clity <spec> --output ./cli` |
| Bundle an SDK into your agent prompt | `npx <generated-cli> describe` |
| Hand-write tool definitions | They are the `describe` JSON |
| Handle auth differently per integration | `--token`, `<CLI>_TOKEN`, `~/.<cli>/config.json` |

---

## How it works

```
OpenAPI spec  →  clity  →  npm package
                          ├── bin/cli.js          # the agent-facing CLI
                          ├── lib/operations.json # the dereferenced spec
                          ├── lib/runtime.js      # request, auth, exit codes
                          └── AGENTS.md           # the contract
```

The generator is TypeScript. The generated package is plain JavaScript with one runtime dependency (Commander) and uses native `fetch`. You can read every file in the output, fork it, and check it into your own repo.

---

## Install and use

### Run the generator

```bash
npx clity <spec-url-or-path> --output ./my-cli [--name my-cli] [--version 0.1.0] [--force]
```

Generates a complete npm package at `./my-cli`.

### Install the generated CLI

```bash
cd ./my-cli
npm install
node bin/cli.js describe                    # full machine-readable surface
node bin/cli.js describe get-pet-by-id      # single operation
node bin/cli.js get-pet-by-id --pet-id 1    # call an endpoint
```

### Auth

```bash
node bin/cli.js auth set --token "$MY_API_TOKEN"
# Or per-call:
node bin/cli.js --token "$MY_API_TOKEN" get-pet-by-id --pet-id 1
# Or via env:
MYCLI_TOKEN=$MY_API_TOKEN node bin/cli.js get-pet-by-id --pet-id 1
```

---

## The contract

Every clity-generated CLI exposes the same agent contract:

| Channel | Contract |
|---|---|
| stdout (success) | Compact JSON, one document, trailing newline |
| stderr (failure) | `{ "error": <string>, ... }` JSON, one document, trailing newline |
| `--pretty` | Pretty-print stdout JSON (off by default — agents read compact) |
| Exit codes | `0` ok · `1` usage · `2` API 4xx · `3` API 5xx · `4` network |
| `describe` | Full surface as JSON |
| `describe <command>` | One operation as JSON |
| Auth precedence | flag → env var → `~/.<cli-name>/config.json` |

This contract is versioned. See [`CONSTITUTION.md § 2`](./CONSTITUTION.md#2-stable-io-contract).

---

## Limitations (MVP)

These are tracked as future work and are deliberately not in v0.1:

- OAuth2 flows (only API-key header and bearer token are supported)
- Multipart / file uploads
- Response schema validation
- Pagination helpers
- Shell completion scripts
- Native binary distribution (`pkg`, `bun compile`)
- An MCP-server output mode (interesting future direction: same generator, different target)

If you need one of these, file a backlog item.

---

## Development

```bash
pnpm install
pnpm build           # tsc → dist/
pnpm test            # node --test against dist/
pnpm smoke           # generate against the petstore fixture and run describe
node bin/clity.mjs --help
```

### Repo layout

```
bin/clity.mjs         # user-facing binary — thin wrapper around dist/cli.js
src/cli.ts            # generator entrypoint
src/types.ts          # internal model
src/generator/
  parse.ts            # OpenAPI parsing + dereferencing
  normalize.ts        # OAS → CliSpec
  emit.ts             # CliSpec → file array
  templates.ts        # package.json, README, AGENTS.md
  runtime/            # static .js shipped verbatim into every output
test/                 # unit tests + fixtures
```

---

## License

MIT
