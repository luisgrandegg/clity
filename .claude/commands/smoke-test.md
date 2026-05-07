# /smoke-test

End-to-end smoke test of the clity generator against the bundled Petstore fixture. Use this before opening a PR if you've touched the generator.

---

## What to do

### Step 1 — Build

```bash
pnpm build
```

Stop if this fails.

### Step 2 — Generate

```bash
node bin/clity.mjs ./test/fixtures/petstore.json --output ./test/.tmp/petstore-cli --force
```

Stop if this fails. Read stderr — any output here is a generator error.

### Step 3 — Install the generated package

```bash
node -e "process.chdir('./test/.tmp/petstore-cli'); require('child_process').execSync('npm install --no-audit --no-fund', { stdio: 'inherit' })"
```

### Step 4 — Run `describe`

```bash
node ./test/.tmp/petstore-cli/bin/cli.js describe | jq '.operations | length'
```

Expected: a positive integer (Petstore has ~19 operations).

### Step 5 — Run `describe <command>`

Pick the first operation:

```bash
FIRST=$(node ./test/.tmp/petstore-cli/bin/cli.js describe | jq -r '.operations[0].command')
node ./test/.tmp/petstore-cli/bin/cli.js describe "$FIRST" | jq '.command,.method,.path'
```

Expected: the same `FIRST` command name, an HTTP method, and a path.

### Step 6 — Run a successful call

For Petstore:

```bash
node ./test/.tmp/petstore-cli/bin/cli.js get-pet-by-id --pet-id 1
```

Expected: a JSON document on stdout, exit 0. (If the public Petstore is down, an exit-4 network error is acceptable — note it but don't fail.)

### Step 7 — Run a failing call

```bash
node ./test/.tmp/petstore-cli/bin/cli.js get-pet-by-id --pet-id 999999999
```

Expected: a JSON object on stderr starting with `{"error":"http","status":404,...`, exit code 2.

### Step 8 — Verify usage error

```bash
node ./test/.tmp/petstore-cli/bin/cli.js get-pet-by-id
```

Expected: a JSON object on stderr containing `"error":"usage"`, exit code 1.

### Step 9 — Report

Summarise to the user. If any step deviated from expectations, surface it loudly — the contract is a versioned API.
