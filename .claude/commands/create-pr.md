# /create-pr

Create a Pull Request for the current branch, then monitor CI until it passes.

---

## What to do

### Step 1 — Complete any finished backlog items

Before creating the PR, check whether this branch implements any feature in `backlog/todo/` or currently listed as Planned in `backlog/backlog.md`.

For each feature completed by this branch:

1. Read the feature file from `backlog/todo/`
2. Append the completion block (date, PR title placeholder, commit SHA, notes)
3. Write the file to `backlog/completed/`
4. Delete the original from `backlog/todo/`
5. Remove the row from `backlog/backlog.md`
6. Commit: `git commit -m "feat(backlog): complete F-XXX — <feature name>"`

**Do not skip this step.** Backlog drift is a recurring failure mode — the PR cannot represent done work if the backlog still says Planned.

### Step 2 — Confirm gates pass locally

Before opening the PR, verify the gates that CI will run:

```bash
pnpm type-check
pnpm test
pnpm smoke
```

If any fail, fix the failure before opening the PR. Don't push known-broken work expecting CI to flag it for you.

### Step 3 — Verify branch

```bash
git rev-parse --abbrev-ref HEAD
```

If on `main`, stop and tell the user: "You are on the main branch. Create a feature branch first with `git checkout -b feature/description`."

### Step 4 — Ensure changes are committed

```bash
git status
```

If there are uncommitted changes, ask the user if they want to commit them before opening the PR. If yes, stage and commit with an appropriate conventional-commits message.

### Step 5 — Sync with main before pushing

```bash
git fetch origin main
git merge origin/main
```

**If there are conflicts:**

1. Check conflicting files: `git diff --name-only --diff-filter=U`
2. Resolve each one with `Edit`. Keep the feature branch's change unless the base introduced a structural update that must take precedence.
3. For `pnpm-lock.yaml`: `git checkout --theirs pnpm-lock.yaml && pnpm install --no-frozen-lockfile`
4. Commit: `git commit -m "chore(merge): merge main into <branch>"`

Then push:

```bash
git push -u origin HEAD
```

### Step 6 — Check for an existing PR

```bash
gh pr view --json number,url 2>/dev/null
```

If a PR already exists, skip to Step 8.

### Step 7 — Create the PR

Use the template from `.github/pull_request_template.md`. Fill in:

- **Title:** concise, conventional-commits style (`feat:`, `fix:`, `chore:`)
- **Body:** the template sections, based on what changed

```bash
gh pr create --title "<title>" --body "<filled template>" --base main
```

### Step 8 — Monitor CI

Run `/watch-pr` to monitor CI status until done.
