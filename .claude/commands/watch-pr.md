# /watch-pr

Monitor the CI status of the current branch's Pull Request. Poll until all checks pass or fail, then report and act.

---

## What to do

### Step 1 — Find the PR

```bash
gh pr view --json number,url,state,title,headRefName
```

If no PR exists for the current branch, tell the user and offer to create one (`/create-pr`).

### Step 1.5 — Check for merge conflicts

```bash
gh pr view --json mergeable,mergeStateStatus
```

**If `mergeable` is `CONFLICTING`:**

1. `git fetch origin main && git merge origin/main`
2. Resolve conflicts:
   - For source files: `Edit`, keeping the feature branch's change unless main introduced a structural update.
   - For `pnpm-lock.yaml`: `git checkout --theirs pnpm-lock.yaml && pnpm install --no-frozen-lockfile`
3. Commit the merge: `git commit -m "chore(merge): merge main into <branch>"`
4. Push — CI re-triggers.
5. Continue to Step 2.

**If `mergeable` is `MERGEABLE` or `UNKNOWN`:** proceed to Step 2.

### Step 2 — Poll CI checks

```bash
gh pr checks --watch --interval 30
```

While waiting, also check mergeability between iterations:

```bash
gh pr view --json mergeable,mergeStateStatus
```

If `mergeable` becomes `CONFLICTING`, stop and resolve as in Step 1.5.

### Step 3 — Interpret the final result

```bash
gh pr checks
gh pr view --json mergeable,mergeStateStatus
```

**If all checks pass AND `mergeable` is `MERGEABLE`:** proceed to Step 3.5.

**If any CI check fails:**

1. Show which check failed and the error: `gh run view <run-id> --log-failed`
2. Diagnose the root cause from the log.
3. Fix it in the code.
4. Commit on the same branch — push re-triggers CI.
5. Re-run `/watch-pr`.

### Step 3.5 — Resolve outstanding review comments

```bash
gh api repos/OWNER/REPO/pulls/PR_NUMBER/reviews
gh api repos/OWNER/REPO/pulls/PR_NUMBER/comments
```

For each review with `state: CHANGES_REQUESTED` (skipping self-reviews):

- For each inline comment, read `path` and `line`, locate the referenced code, and apply the minimal fix that satisfies the request. If the comment is ambiguous, skip it and flag at the end.
- For top-level review bodies, apply any actionable changes; skip if purely informational.

After applying:

```bash
git add <changed files>
git commit -m "fix(review): address PR review comments"
```

Push, then re-run `/watch-pr` from Step 2.

### Step 4 — Done

When CI passes, the branch is mergeable, and there are no outstanding `CHANGES_REQUESTED` reviews:

> "All CI checks passed and all review comments have been addressed — the PR is ready to merge."

Do not merge unless the user explicitly asks.
