# Spec 006: Difficulty and main menu

Status: Shipped (2026-11-06)

## Problem

The game always opens straight into the lighthouse case. There is no start screen, no way to pick a
ready-made case, and no way to ask for an easier or harder mystery.

## Goal

The game opens on a main menu. The player picks a ready case (each shows its difficulty) or
generates a new case at Easy, Medium or Hard. Difficulty changes how the case is written and how
well the killer lies, not the game limits.

## Non-goals

- Changing the 20-question cap or the 100k token budget per difficulty (CLAUDE.md game limits).
- Scores, saved progress, accounts, settings, sound.
- More hand-written cases.

## User stories

- As a player, I want a main menu so that I can choose what to play.
- As a player, I want to choose Easy, Medium or Hard so that the mystery matches my mood.

## Acceptance criteria

- AC1: `CaseSchema` gains `difficulty: "easy" | "medium" | "hard"`; `PublicCase` includes it.
  `cases/lighthouse.json` is `"medium"`.
- AC2: `generateCase({ runner, difficulty })` puts the difficulty's rules in the prompt and the
  returned case has that difficulty, whatever the generated JSON says:
  - Easy: two witnesses contradict the killer's claim in plain words; an innocent states the motive
    outright; innocents' secrets are clearly minor.
  - Medium: today's rules (spec 002).
  - Hard: one direct contradiction, the second only by combining facts from two suspects; the motive
    has to be inferred from two facts; one innocent's secret fits a wrong motive option.
- AC3: `buildSuspectPrompt` adds difficulty to the killer's rules: Easy, the killer is nervous and
  slips on details; Hard, the killer is calm and consistent and only gives way when shown a
  contradiction. Innocents are unchanged. Spec 001 AC4 still holds (never confess, no other secrets).
- AC4: `GET /api/cases` returns `[{ caseId, title, difficulty }]` for every loaded case and nothing
  else. `POST /api/cases/generate` takes `{ difficulty }`, defaults to `"medium"` and rejects any
  other value with 400.
- AC5: Main menu (new first screen, noir style): the game title, a list of ready cases with title
  and a difficulty badge and a "Play" button each, and a "Generate a new case" section with an
  Easy / Medium / Hard radio group and a "Generate" button with the existing loading and error
  behaviour. The case file and verdict screens get a "Main menu" button in place of "Generate a new
  case". (Reviewer-checked.)
- AC6: `npm run generate -- --difficulty <easy|medium|hard>` writes a case of that difficulty.
  The repo ships the lighthouse case (medium) plus one generated easy and one generated hard case;
  the previously generated medium case is kept and regenerated with a map by spec 005.
- AC7: `evals/solve.ts` prints each run's case id, difficulty and result.
- AC8 [eval]: leak eval 0 leaks over all cases. Solver eval at least 4 of 5 over all cases; if a
  hard case is never solved, report it rather than lowering the gate (a gate change needs an ADR and
  the human).

## Design notes

- Depends on spec 005 (map) being merged first: generated cases need both map and difficulty.
- `src/shared/case.ts`, `src/shared/suspectPrompt.ts`, `src/server/generator.ts`, `src/server/api.ts`
  (`GET /api/cases`, generate body), `src/server/game.ts` (list cases), `scripts/generate-case.ts`,
  `src/web/main.ts` (menu screen), `src/web/styles.css`, `evals/solve.ts`.
- ADR-008: difficulty is a case property that shapes the generator prompt and the killer's prompt;
  game limits stay fixed. C4: component diagrams gain the cases list route.
- Design: [ADR-008](../adr/ADR-008-difficulty-and-main-menu.md) (builds on
  [ADR-005](../adr/ADR-005-case-generation.md), [ADR-007](../adr/ADR-007-case-map-data-model.md)).
  C4: `docs/c4/3-component-play-a-case.md` (GET /api/cases), `docs/c4/3-component-generate-a-case.md`
  (difficulty parameter), `docs/c4/2-container.md` (wording only).

## Gates affected

Unit tests, case validator, leak eval, solver eval.

## Risks

- Hard cases too hard for the solver gate: per-case eval output shows it; the generator's hard rules
  still require a solvable contradiction.
- Easy killer "slips" into a confession: the leak eval's confession check covers all difficulties.
- Three generated cases make the solver eval slower and costlier: still 5 runs; the runs cycle over
  4 cases.
