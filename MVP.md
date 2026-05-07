# Build an OpenAPI → Agent-Ready CLI Generator (MVP)

## Goal
Create a Node.js tool that takes an OpenAPI/Swagger spec URL (or local file) 
and generates a CLI wrapper that AI agents can use to interact with the API.

The generated CLI is the integration layer between any API and any agent — 
no MCP server, no SDK, no custom tool definitions required. An agent that 
can run shell commands can use the API.

Distribution is via `npx` for the MVP (native binaries are future work).

## Scope (MVP)
Two pieces of software:

1. **The generator** — a CLI tool that reads an OpenAPI spec and outputs a 
   ready-to-publish npm package containing the agent-ready CLI.
2. **The generated CLI** — what the generator produces. Each API endpoint 
   becomes a subcommand, designed for non-interactive subprocess use.

## Generator requirements

- Written in TypeScript, runnable via `npx <generator-name> <spec-url-or-path> 
  --output ./my-cli`
- Accepts OpenAPI 3.0 and 3.1 (use `@readme/openapi-parser` or 
  `@apidevtools/swagger-parser` for parsing + dereferencing)
- Supports Swagger 2.0 as a stretch goal (parser above handles conversion)
- Outputs a complete npm package directory with:
  - `package.json` with a `bin` entry so the result works via `npx`
  - `README.md` with usage examples derived from the spec
  - An `AGENTS.md` (or equivalent) explaining the CLI's contract to agents: 
    discovery commands, I/O format, error format, auth
  - Source files for the generated CLI
  - Ship as plain JS to skip a build step in the generated package
- Configurable: CLI name, description, version (flags or a config file)

## Generated CLI requirements (agent-first)

### Core
- Built on **Commander.js**
- Uses native `fetch` (Node 18+) — no axios dependency
- Each operation in the spec becomes a subcommand. Use `operationId` when 
  present, otherwise derive from method + path
- Path params, query params, and request body map to CLI flags
  - Required params → required flags
  - Body for POST/PUT/PATCH → `--body '<json>'` and `--body-file <path>`

### Agent-friendly contract
- **`describe` command** — outputs the full list of operations as JSON: 
  name, summary, params (name, type, required, location), request body schema, 
  response schema. An agent should be able to run `mycli describe` once and 
  know everything it can do.
- **`describe <command>` ** — same thing scoped to one operation, also JSON.
- **JSON-by-default output** — responses printed as compact JSON to stdout. 
  `--pretty` for human-readable; no pretty-printing by default.
- **Structured errors on stderr** — on HTTP error or validation failure, write 
  a JSON object to stderr: 
  `{"error": "...", "status": 404, "body": {...}}`. Exit non-zero.
- **No interactive prompts, ever** — missing required flags should fail fast 
  with a clear error, not prompt.
- **Stable exit codes** — 0 success, 1 client/usage error, 2 API error (4xx), 
  3 server error (5xx), 4 network error.

### Auth
- API key in header and bearer token (MVP). Read from:
  1. `--token` / `--api-key` flag
  2. Environment variable (e.g. `MYCLI_TOKEN`)
  3. Config file at `~/.<cli-name>/config.json`
- An `auth login` or `auth set` command to write the config file (one-shot, 
  non-interactive: takes the value as a flag).

### Other
- `--base-url` flag to override the spec's server URL
- `--help` per command, generated from the spec's `summary` / `description`, 
  but `describe` is the canonical machine-readable source

## Out of scope for MVP (note in README as future work)
- OAuth2 flows
- Pagination helpers
- File uploads (multipart)
- Response schema validation
- Shell completion
- Native binary distribution (pkg, bun compile, etc.)
- An MCP-server output mode (interesting future direction: same generator, 
  different target)

## Deliverables
1. The generator package, ready to publish
2. A working example: run the generator against the Petstore spec 
   (https://petstore3.swagger.io/api/v3/openapi.json) and verify:
   - `<cli> describe` returns valid JSON listing all operations
   - At least 3 endpoints can be called successfully
   - An error response produces the structured stderr format
3. README for the generator explaining install, usage, limitations
4. AGENTS.md template that ships with each generated CLI

## Design notes
- The generated CLI's contract with agents should be documented and stable. 
  Treat `describe` output as a versioned API.
- Keep the generator's output human-readable and forkable. Avoid runtime magic.
- Prefer code generation (write `.js` files) over a runtime interpreter.
- Use string templates or `ejs` — keep templates separate from logic.

Start by proposing the project structure, the `describe` JSON schema, and 
the generator's CLI surface before writing code. Then we'll iterate.
