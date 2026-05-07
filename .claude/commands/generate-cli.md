# /generate-cli

Run the clity generator against a real OpenAPI spec, then walk through the output and verify it satisfies the agent contract.

**Usage:** `/generate-cli [spec-url-or-path] [--output <dir>]`

---

## What to do

### Step 1 — Get inputs

If `$ARGUMENTS` did not include a spec, ask the user for one. Suggest the Petstore as a default:

> "Which spec? Default: `https://petstore3.swagger.io/api/v3/openapi.json`"

If no `--output` was passed, default to `./generated/<sanitised-spec-name>`.

### Step 2 — Build the generator

```bash
pnpm build
```

If this fails, the generator itself is broken — stop and report.

### Step 3 — Run the generator

```bash
node bin/clity.mjs <spec> --output <output> --force
```

Capture stdout and stderr. The generator should exit 0; stderr should be empty on success.

### Step 4 — Inspect the output

Read each of the generated files:

- `<output>/package.json` — verify `bin`, `dependencies` (only `commander`), `version`
- `<output>/AGENTS.md` — verify the contract is documented
- `<output>/README.md` — verify usage examples reference real operations from the spec
- `<output>/bin/cli.js` — verify the shebang, the `commander` setup, the loop that registers operations
- `<output>/lib/runtime.js` — verify exit codes, stderr error format, auth resolution
- `<output>/lib/operations.json` — parse it; verify `operations` is a non-empty array

### Step 5 — Install and run

```bash
cd <output> && npm install --no-audit --no-fund
```

Then, from outside the directory (to avoid `cd && ...`):

```bash
node <output>/bin/cli.js describe | jq '.operations | length'
node <output>/bin/cli.js describe | jq '.operations[0]'
node <output>/bin/cli.js --help
```

### Step 6 — Smoke-test a couple of operations

For at least two operations from `describe`, run them with appropriate flags. Verify:

- Success → JSON on stdout, exit 0
- Failure → JSON on stderr, exit code matches the documented map
- `--pretty` produces multi-line JSON

### Step 7 — Report

Summarise to the user:

- Spec source and operation count
- Output directory
- Which operations were tested and their results
- Any deviations from the contract found

If the contract was violated anywhere (free-form text on stderr, exit code mismatch, missing `describe` field), flag it loudly and propose a fix.
