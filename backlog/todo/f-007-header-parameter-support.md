# F-007 — Header parameter support: fixture + tests

**Status:** 🔲 Todo
**Area:** src/generator/normalize.ts, src/generator/runtime/runtime.js, test/fixtures/

## Why

Header parameters are part of OAS 3.x and the runtime already maps `param.in === 'header'` to a request header. There is no dedicated fixture or test exercising this path, so a regression would slip through the petstore smoke test.

## Acceptance criteria

- [ ] A fixture at `test/fixtures/headers-api.json` defining at least one operation with a required header parameter and one with an optional header parameter
- [ ] A test that generates the CLI from this fixture, intercepts the outbound `fetch` (mock or local server), and asserts the header is set when the flag is provided and absent when it isn't
- [ ] Documentation: a one-line note in `AGENTS.md` (the generated one — i.e. in `src/generator/templates.ts`) confirming header params are supported

## Notes

- Use Node's native `http` module for the local mock server — no new dev dep.
- Keep the fixture small (1–2 operations) to keep diffs reviewable.
