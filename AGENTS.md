# AGENTS.md — clity (the generator)

> This file describes how an AI agent should *use the clity generator*. For the contract every clity-generated CLI exposes to its agents, see the `AGENTS.md` that ships inside each generated package.

---

## What clity is

clity reads an OpenAPI 3.x spec and writes an npm package whose binary is a CLI an agent can drive. One operation in the spec becomes one subcommand. The generated package depends only on Commander and uses native `fetch` (Node 20+).

## Running the generator

```bash
npx clity <spec-url-or-path> --output ./my-cli
```

| Flag | Effect |
|---|---|
| `--output <dir>` | Where to write the generated package. **Required.** |
| `--name <name>` | Override the CLI's package name (defaults to the spec's `info.title` slugged) |
| `--description <text>` | Override the description (defaults to `info.description`) |
| `--package-version <semver>` | Set the generated package's version (defaults to the spec's `info.version`). Note `--version` is Commander's built-in and prints clity's own version. |
| `--force` | Overwrite the output directory if it exists |
| `--base-url <url>` | Bake a base URL override into the generated CLI |

Exit codes: `0` ok · `1` usage / parse error · `4` network error fetching the spec.

All errors are JSON on stderr: `{ "error": "...", "message": "..." }`. The
`error` field names the stage that failed, so a failure is attributable without
reading the message:

| `error` | Meaning |
|---|---|
| `usage` | Bad flags or arguments |
| `parse` | The spec could not be loaded, validated, or dereferenced |
| `normalize` | The spec parsed but could not be mapped to a CliSpec |
| `emit` | The CliSpec could not be rendered (e.g. the spec is too large to embed) |
| `write` | The output files could not be written to disk |
| `network` | The spec URL could not be fetched |

### Spec size

Dereferencing inlines every shared schema at each use site. For a heavily
cross-referenced spec that expansion is combinatorial — Stripe's spec reaches
tens of millions of nodes from 589 operations, where GitHub's 1221 operations
expand to ~570k. clity refuses a spec that expands past 5,000,000 nodes with an
`emit` error rather than exhausting memory. Generating from a subset of the
spec is the workaround; deduplicating shared schemas is tracked as F-009.

### Recursive schemas

A schema that refers to itself is emitted with a
`{ "x-circular-ref": "<json-pointer>" }` marker at the point where it would
repeat. See the generated package's `AGENTS.md` for how to resolve it.

## What it produces

```
<output>/
├── package.json          # name, version, bin, deps (commander only)
├── README.md             # human-readable summary derived from the spec
├── AGENTS.md             # the generated CLI's agent contract — read this first
├── bin/
│   └── cli.js            # entrypoint with shebang
└── lib/
    ├── operations.json   # the dereferenced CliSpec — one source of truth
    └── runtime.js        # request, auth, exit codes, error formatting
```

After generation:

```bash
cd ./my-cli && npm install && node bin/cli.js describe | jq '.operations | length'
```

Or publish with `npm publish` and run via `npx <name>`.

## Agent workflow

1. **Discover.** Run `<generated-cli> describe` once; cache the JSON. The shape is documented in the constitution and is stable within a major version.
2. **Pick an operation.** Each entry in `operations[]` has `command`, `summary`, `params`, `requestBody`, `responses`, `security`. Use `command` literally — it is the subcommand name.
3. **Build the call.** Path / query / header params map to flags by their `flagName` (kebab-case). Required params are `required`. Bodies go via `--body <json>` or `--body-file <path>`.
4. **Read the result.** Success → JSON on stdout, exit 0. Failure → JSON on stderr, exit 1–4 by category (see below).

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Usage error (bad flags, missing required input, invalid body JSON) |
| `2` | API error 4xx |
| `3` | Server error 5xx |
| `4` | Network error (DNS, refused, timeout) |

## Auth

Every generated CLI accepts auth via three sources, in order of precedence:

1. `--token <t>` / `--api-key <k>` flag
2. Environment variable `<CLI>_TOKEN` / `<CLI>_API_KEY` (CLI name uppercased, non-alnum → `_`)
3. `~/.<cli-name>/config.json` written by `<cli> auth set --token <t>` (one-shot, non-interactive)

The CLI never prompts. Missing auth on a secured operation results in the API returning 401, which surfaces as an exit-2 error with the API's response body.

## What's out of scope

The MVP does not handle: OAuth2 flows, multipart uploads, response schema validation, pagination helpers, shell completion, native binary distribution. These are documented in the README's _Limitations_ section and tracked in `backlog/backlog.md`.
