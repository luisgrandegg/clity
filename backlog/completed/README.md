# Completed features

Each file is a backlog feature that was finished. The completion block at the top of each file records the date, commit, and notes.

```markdown
---
**Completed:** 2026-05-07
**Notes:** Implemented in commit abc1234. <1–3 sentence summary.>
---

# F-XXX — <feature name>

**Status:** ✅ Done

<original content>
```

The pre-commit hook (`scripts/check-backlog-consistency.mjs`) blocks any commit that leaves a feature file in both `backlog/todo/` and `backlog/completed/`. If you see that error, delete the `todo/` copy.
