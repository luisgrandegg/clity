# /review-pr

Perform a thorough code review on a Pull Request, post an inline comment for each finding, and submit the review requesting changes.

**Usage:** `/review-pr <PR>` where `<PR>` is one of:
- A full GitHub PR URL: `https://github.com/owner/repo/pull/123`
- A shorthand repo + number: `owner/repo#123`
- A plain PR number (uses current repo): `123`

---

## What to do

### Step 1 — Parse the PR reference

From `$ARGUMENTS`, extract `OWNER`, `REPO`, `PR_NUMBER`. If only a number is given, resolve owner/repo via `gh repo view --json owner,name`. If parsing fails, ask the user to clarify.

### Step 2 — Fetch PR metadata

```bash
gh api repos/OWNER/REPO/pulls/PR_NUMBER
```

Record `title`, `body`, `head.sha`, `base.ref`, `head.ref`, `user.login`.

### Step 3 — Fetch changed files and read each in full

```bash
gh api repos/OWNER/REPO/pulls/PR_NUMBER/files
```

Read every non-binary, non-removed file with the Read tool.

### Step 4 — Fetch existing comments and reviews

```bash
gh api repos/OWNER/REPO/pulls/PR_NUMBER/comments
gh api repos/OWNER/REPO/pulls/PR_NUMBER/reviews
```

Avoid duplicating already-flagged findings.

### Step 5 — Review against the criteria

For every finding, record `path`, `line` (right side, integer), `summary`, `detail` (concrete fix).

**Constitution alignment** (the most important category for this repo)
- Generated CLI must not print to stdout uninvited (logs, banners) — only command output goes to stdout
- Generated CLI must not use any runtime dep besides commander (no axios, no chalk, no ora)
- Generated CLI must use native `fetch`, not a polyfill
- Errors must be JSON on stderr, never free-form text
- Exit codes must follow the documented map (0/1/2/3/4)
- `describe` output shape must not change without a major-version bump

**TypeScript / correctness**
- `any` types or implicit `any`
- Missing return types on exported functions
- Non-null assertions (`!`) without a comment
- Unsafe `as` casts that bypass type guards
- Unused imports or variables

**Generator correctness**
- Output is non-deterministic (depends on Map iteration order, current time, Math.random) — generated files must be byte-stable for the same input
- Templates inlined into logic — they should live in `templates.ts` or `runtime/`
- Missing fixture for a new OpenAPI feature

**Security**
- User-controlled values interpolated into shell commands or URLs without encoding
- Auth tokens written to logs or stdout
- `eval()` or `new Function()`

**Code quality**
- `console.log` in production code (the generator is a CLI — `process.stdout.write` is fine; `console.log` is not, because it adds extra newlines and routes via stdio in unexpected ways)
- Dead or commented-out code
- Missing error handling at system boundaries

**Do not flag:**
- Style preferences enforced by the linter
- Issues already flagged in existing comments
- Removed files

### Step 6 — Self-assign as reviewer

```bash
CURRENT_USER=$(gh api user --jq .login)
gh api repos/OWNER/REPO/pulls/PR_NUMBER/requested_reviewers \
  --method POST --field "reviewers[]=$CURRENT_USER"
```

If 422 ("cannot request from author"), continue. If `CURRENT_USER` matches `user.login`, set `IS_AUTHOR=true`.

If no findings: tell the user "No issues found." Stop without posting.

### Step 7 — Post the review

`event` is `REQUEST_CHANGES` unless `IS_AUTHOR=true`, in which case use `COMMENT` and prepend a note explaining why.

```bash
gh api repos/OWNER/REPO/pulls/PR_NUMBER/reviews \
  --method POST --input - <<'REVIEW_EOF'
{
  "event": "<REQUEST_CHANGES|COMMENT>",
  "commit_id": "<HEAD_SHA>",
  "body": "<2–4 sentence summary>",
  "comments": [
    {
      "path": "<path>",
      "line": <line>,
      "side": "RIGHT",
      "body": "**Issue:** <summary>\n\n**Suggestion:** <detail>\n\n---\n*Co-authored-by: Claude <noreply@anthropic.com>*"
    }
  ]
}
REVIEW_EOF
```

If 422 with `"line is not part of the diff"`, recompute the line from the `patch` and retry once.

### Step 8 — Confirm

Tell the user the review was submitted, list the files commented on, and link to the PR.
