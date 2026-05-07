## Summary

<!-- 1–3 sentences. What does this PR change and why? -->

## Constitution check

- [ ] I read [`CONSTITUTION.md`](../CONSTITUTION.md) and this change does not violate any principle.
- [ ] If this changes the generated CLI's stable I/O contract (`describe` shape, error shape, exit codes), the version is bumped to a new major and the change is called out below.
- [ ] No new runtime dependency was added to the generated CLI.

## Backlog

- [ ] If this PR completes a feature in `backlog/todo/`, the file has been moved to `backlog/completed/` and the index updated in this same PR.

## Test plan

- [ ] `pnpm type-check` passes
- [ ] `pnpm test` passes
- [ ] `pnpm smoke` against the bundled Petstore fixture prints a positive operation count and the contract holds (stdout JSON / stderr JSON / documented exit codes)
- [ ] Manual: `<describe what you ran by hand, if anything>`

## Notes

<!-- Anything reviewers should know: trade-offs, follow-ups, things deliberately out of scope. -->
