# /rules-audit

Audit the quality of the AI rules that govern this project — `CLAUDE.md`, `CONSTITUTION.md`, `decisions/`, and `.claude/`. Produces a scored report (0–10 per criterion) with concrete improvement actions.

**Run as:** `/rules-audit` — no arguments needed.

---

## What to do

### Step 1 — Read all rule sources

- `CONSTITUTION.md`
- `CLAUDE.md`
- `MVP.md`
- `AGENTS.md`
- All files in `decisions/` (if any)
- All files in `.claude/commands/`
- `.claude/settings.json`
- `.claude/settings.local.json` (if present)

### Step 2 — Score the 8 criteria

Score 0–10 per criterion. Cite a file, section, or line for every score.

#### C1 — Clarity
Specific, unambiguous instructions. Penalise vague qualifiers.

#### C2 — Completeness
Coverage of the agent's actual workflows in this repo:
- Running the generator end-to-end
- Adding a new OpenAPI feature to the normalizer
- Adding a new template or output file
- Modifying the runtime
- Writing a fixture-based test
- Making a PR or commit
- Working with the backlog

#### C3 — Consistency
Cross-file agreement. No contradictions; clear precedence between `CONSTITUTION.md`, `CLAUDE.md`, `MVP.md`.

#### C4 — Actionability
Code examples, do/don't pairs, exact commands cited. An agent should be able to act without interpretation.

#### C5 — Enforcement
Rules backed by automated checks — CI jobs, pre-commit hooks, slash commands.

#### C6 — Mission alignment
Technical rules trace back to constitution principles (e.g. "stable I/O contract", "generated code is plain JS", "agent-first").

#### C7 — `.claude/` coverage
- Every command listed in `CLAUDE.md` has a file in `.claude/commands/`
- Every file in `.claude/commands/` is referenced in `CLAUDE.md` (no orphans)
- `settings.json` permissions cover the bash commands the project actually runs

#### C8 — Freshness
- Every script in `package.json` referenced from CLAUDE.md actually exists
- Every CI gate cited matches an actual job in `.github/workflows/`
- ADRs reference tools that are still in use

### Step 3 — Print the scored report

```
/rules-audit — clity

  C1  Clarity              X/10  [✅|⚠️|❌]
  C2  Completeness         X/10  [✅|⚠️|❌]
  C3  Consistency          X/10  [✅|⚠️|❌]
  C4  Actionability        X/10  [✅|⚠️|❌]
  C5  Enforcement          X/10  [✅|⚠️|❌]
  C6  Mission alignment    X/10  [✅|⚠️|❌]
  C7  .claude/ coverage    X/10  [✅|⚠️|❌]
  C8  Freshness            X/10  [✅|⚠️|❌]

  Overall: X.X / 10

  Legend: ✅ ≥8   ⚠️ 6–7   ❌ <6
```

### Step 4 — Detail improvements for any criterion below 8

```
─────────────────────────────────────────
IMPROVEMENTS

CX  Name — X/10
    Evidence: [file, section, or specific issue]
    → Action 1
    → Action 2
─────────────────────────────────────────
```

### Step 5 — Offer quick fixes

For mechanical issues (orphaned command file, missing entry in CLAUDE.md, stale script reference), ask:

> "Would you like me to apply these fixes now?"

Apply only if the user confirms. Never apply silently.
