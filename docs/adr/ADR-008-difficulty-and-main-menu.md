# ADR-008: Difficulty is a case property; fixed limits; cases list route; main menu

Status: Accepted
Date: 2026-11-06
Spec: docs/specs/006-difficulty-and-main-menu.md

## Context

Spec 006 adds Easy / Medium / Hard and a main menu. Constraints: game limits are fixed (CLAUDE.md:
20 questions, 100k tokens); suspect prompts are built from one suspect's data only (ADR-002); the
browser gets `toPublicCase` only; generated cases must pass `validateCase` with the spec 005 rules
(two independent witnesses, `motiveKeyword` in two innocents' `knows`, map rules; ADR-005, ADR-007);
there is no DOM test environment (ADR-006), so logic must live in pure functions.

## Decision

- **Difficulty is a property of the case.** `CaseSchema.difficulty: "easy" | "medium" | "hard"`
  (required), exported as `type Difficulty` plus `DIFFICULTIES` from `src/shared/case.ts`.
  `PublicCase.difficulty` is copied by `toPublicCase` (it is not a secret: the menu shows it). It
  shapes two prompts only: the generator prompt and the killer's suspect prompt. Limits
  (`MAX_QUESTIONS`, `TOKEN_BUDGET`) do not read it.
- **Generator.** `buildGeneratorPrompt(difficulty = "medium")` appends a "Difficulty: <level>" block
  to the existing rules; medium adds nothing new (today's rules). `generateCase({ runner,
maxAttempts?, difficulty? = "medium", cleanup? })` injects `difficulty` into the parsed JSON before
  `CaseSchema`/`validateCase`, so the model need not emit it and the returned case always has the
  requested difficulty. Existing fake-runner tests still pass.
- **Hard keeps the spec 005 validator rules.** Two innocents still name the killer by name in `knows`
  (AC2b) and the motive keyword still sits in two innocents' `knows` (AC2c). Hard only changes the
  content: innocent A states a direct contradiction of the killer's claim; innocent B names the killer
  but states a fact (for example what the killer carried or when they were seen) that exposes the
  alibi only when combined with a fact from A or the killer's public statement. The motive is split
  across two facts, no single fact states it. One innocent's secret fits a wrong motive option (the
  killer's secret still must not). Easy: both witnesses contradict plainly, one innocent states the
  motive outright (keyword rule still holds), innocents' secrets are clearly minor. No new validator
  rule: difficulty content is prompt-level, checked by the solver eval.
- **Killer prompt.** `buildSuspectPrompt` appends one difficulty line to the killer's rules only:
  Easy, nervous and slips on small details; Medium, nothing extra (today's text); Hard, calm and
  consistent, gives way only when shown a contradiction. All keep "Never confess". Innocent rules are
  byte-identical to today. The slice still contains only that suspect's data (ADR-002); the line uses
  `c.difficulty`, which is not a secret.
- **Listing.** `store.listCases(): { caseId, title, difficulty }[]` in `game.ts` (maps
  `deps.cases`, includes cases added by generation). `GET /api/cases` returns exactly that array.
- **Generate route.** `POST /api/cases/generate` takes `{ difficulty }`; missing means `"medium"`; any
  other value (wrong string, non-string) returns 400 `{ message }` before the generator is called.
  The injected dep becomes `generate?: (difficulty: Difficulty) => Promise<Case>`. The response stays
  `{ caseId, title }`; the menu starts a game with the returned `caseId` straight away (no list
  re-fetch). The generator prompt asks the killer's persona to fit the difficulty and asks for
  varied settings.
- **Main menu.** New first screen in `src/web/main.ts`: title, `GET /api/cases` list (title,
  difficulty badge, Play: `POST /api/games {caseId}`), and a generate section (radio group,
  Generate, existing loading and error behaviour). Case-file and verdict screens get "Main menu"
  instead of "Generate a new case". Text through `textContent` only. Pure helpers for the badge label
  go in `src/web/format.ts` if needed.
- **Script.** `scripts/generate-case.ts` parses `--difficulty <level>`; invalid value exits 1 with a
  message; default medium. Shipped cases: lighthouse (medium), the existing generated medium case
  (add `"difficulty": "medium"`, regenerated with a map by spec 005), one new easy, one new hard.
- **Solver eval.** `evals/solve.ts` keeps 5 runs and the 4-of-5 gate. Cases are sorted by id and run
  `i` plays `cases[i % cases.length]`; with 4 cases every case, hard included, plays at least once and
  case 0 plays twice. Each run prints and writes `run i case <id> (<difficulty>): <result>`. A
  never-solved hard case is reported, not hidden; changing the gate needs a new ADR and the human.

## Alternatives considered

- **Difficulty only in the generator, not stored.** Then the killer's prompt and the menu cannot
  know it. Rejected.
- **Difficulty changes limits** (more questions for Hard): conflicts with CLAUDE.md game limits and
  the spec non-goal; also makes token budget tests difficulty-dependent.
- **Difficulty chosen per game at `POST /api/games`.** Would need the same case in three variants,
  but difficulty is baked into the case content. Rejected.
- **Trust the model's `difficulty` field.** It may omit or mislabel it; the server override is
  deterministic.
- **New validator rules per difficulty** (count contradictions, detect motive inference): not
  reliably checkable by string rules; false confidence. Left to prompt plus solver eval.
- **Weaken AC2b/AC2c on Hard** to make cases harder: breaks fairness; hardness comes from fact
  combination instead.
- **List cases through `POST /api/games`-style new route per field or return full public cases:**
  more data than the menu needs; `{ caseId, title, difficulty }` only keeps the surface minimal.
- **Client-side routing library or separate HTML page for the menu:** new dependency or build entry
  for one screen; the existing screen switching in `main.ts` is enough.
- **Solver eval over every case with N runs, or one run per case:** cost grows with case count and
  breaks the "5 runs, 4 solved" gate; cycling keeps cost fixed.
- **Random case choice per run:** non-reproducible, could skip the hard case.

## Consequences

- Good: small diff in existing modules; tests use fake runners and pure functions; limits and leak
  surface unchanged (difficulty is public).
- Bad: difficulty quality is prompt-driven and only measured by the solver eval (5 runs, noisy);
  Hard may be unsolvable at times. An Easy killer that "slips" risks a confession: the leak eval's
  confession check covers it. Existing case files without `difficulty` become invalid until edited.
- Follow-ups: tests for schema/`toPublicCase`, prompt text, `generateCase` override, `listCases`, API
  routes (including 400), script arg parsing if extracted as a pure function; regenerate easy and
  hard cases; solver and leak evals re-run.
