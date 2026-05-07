# /setup-environment

Walk the user through setting up their local development environment for clity. Detect their OS and tailor every step accordingly. Be conversational — check in after each major step before proceeding.

---

## What to do

### Step 1 — Detect OS

Ask the user which OS they are on if not already known:

- **macOS** → Homebrew / curl
- **Linux** → distro package manager / curl
- **Windows** → winget or MSI

### Step 2 — Install Node 20+

clity targets Node 20+ (for native `fetch`).

**macOS / Linux (via Volta — recommended):**

```bash
curl https://get.volta.sh | bash
# Restart terminal, then:
volta install node@22
```

**Windows (winget):**

```powershell
winget install Volta.Volta
# Restart terminal, then:
volta install node@22
```

Verify:

```bash
node --version   # should print v22.x.x or v20.x.x
```

### Step 3 — Install pnpm

```bash
volta install pnpm@10
```

Verify:

```bash
pnpm --version   # 10.x.x
```

### Step 4 — Install jq

`jq` is used by slash commands and by smoke tests to parse JSON output from the generated CLI.

**macOS:** `brew install jq`
**Linux:** `apt-get install jq` or `dnf install jq`
**Windows:** `winget install jqlang.jq`

Verify: `jq --version`

### Step 5 — Install GitHub CLI and authenticate

```bash
# macOS:    brew install gh
# Linux:    see https://github.com/cli/cli/blob/trunk/docs/install_linux.md
# Windows:  winget install GitHub.cli

gh auth login
gh auth status
```

### Step 6 — Install dependencies

From the repo root:

```bash
pnpm install
```

Expected: no errors, lockfile unchanged.

### Step 7 — Verify the build and tests

```bash
pnpm type-check
pnpm build
pnpm test
pnpm smoke
```

`pnpm smoke` runs the generator against the bundled Petstore fixture and prints the operation count. If you see a number, everything works.

### Step 8 — Verify git hooks

```bash
git config core.hooksPath githooks
git commit --allow-empty -m "chore(setup): verify hooks work"
git reset HEAD~1
```

### Troubleshooting

| Problem | Fix |
|---|---|
| `pnpm install` fails with frozen-lockfile | `pnpm install --no-frozen-lockfile` once, then commit the updated lockfile |
| `node` is the wrong version | Make sure you're inside the repo — Volta switches per-project |
| `gh auth login` opens wrong browser | Use `gh auth login --web` or `--with-token` with a PAT |
| `pnpm smoke` errors with "fetch failed" | The bundled fixture is local — there's no network call. The error is likely a parser issue; rerun `pnpm build` |

### Done

When all steps pass, confirm to the user:

- Node 20+ and pnpm 10+ are installed and managed by Volta
- GitHub CLI is authenticated
- The generator builds, tests pass, and the petstore smoke test prints an operation count
- They're ready to start on the backlog — `backlog/backlog.md`
