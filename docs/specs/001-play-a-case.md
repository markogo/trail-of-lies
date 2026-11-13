# Spec 001: Play a case

Status: Shipped (2026-11-06)

## Problem

There is no game yet: no case, no suspects, no way to question or accuse, and no gates that prove
suspects keep their secrets and that a case can be solved.

## Goal

A player can open the one hand-written case (lighthouse murder), question its 3 Claude-played
suspects within the 20-question and 100k-token limits, accuse a killer and motive, and see the
verdict. The case validator, leak eval and solver eval run as gates.

## Non-goals

- Case generation (spec 002), more than one hand-written case, persistence across server restarts,
  accounts, scoring, styling beyond plain readable HTML, hints, streaming answers.

## User stories

- As a player, I want to read a case file so that I know the victim, setting and suspects.
- As a player, I want to question each suspect so that I can catch the killer's lies.
- As a player, I want to name the killer and motive and see if I was right.
- As a developer, I want a validator and two evals so that broken or leaky cases fail a gate.

## Acceptance criteria

- AC1: `CaseSchema` (zod, `src/shared/case.ts`) parses `cases/lighthouse.json`: id, title,
  setting, victim, briefing, exactly 3 suspects (id, name, role, publicStatement, persona,
  secret, alibi, knows), exactly 4 motives (id, label), clues, and solution
  (killerId, motiveId, explanation).
- AC2: `toPublicCase(c)` returns only id, title, setting, victim, briefing, suspects (id, name,
  role, publicStatement) and motives; it never contains secret, alibi, knows, clues or solution.
- AC3: `validateCase(c)` returns no errors for the lighthouse case, and returns an error when:
  the schema fails, suspect ids or motive ids are not unique, `solution.killerId` is not a
  suspect, or `solution.motiveId` is not a motive. `npm run validate` exits non-zero if any
  `cases/*.json` is invalid.
- AC4: `buildSuspectPrompt(c, suspectId)` contains that suspect's persona, secret, alibi and
  knows; it tells the killer to lie and never confess, and innocents to hide their secret; it
  never contains another suspect's secret, the clue list, `solution.explanation`, or (for an
  innocent) the killer's id stated as the killer.
- AC5: `createGame` returns a game id and the public case. `ask(gameId, suspectId, question)`
  calls the injected runner with that suspect's prompt; the first call for a suspect starts a new
  session, later calls for that suspect resume the same session; different suspects use
  different sessions.
- AC6: `ask` rejects an empty question, a question over 300 characters, and an unknown suspect id,
  without calling the runner.
- AC7: After 20 questions, `ask` is rejected and does not call the runner; `questionsLeft`
  reports the remaining count after each question.
- AC8: The token ledger sums input + output tokens from every runner result. When the total
  reaches 100,000, further `ask` calls are rejected.
- AC9: `accuse(gameId, suspectId, motiveId)` returns a verdict with `correctKiller`,
  `correctMotive`, `solved` (both right) and the full solution. After accusing, `ask` and a
  second `accuse` are rejected. Accusing is allowed at any time, including after the caps.
- AC10: The HTTP API (`src/server/api.ts`) exposes `POST /api/games`, `POST /api/games/:id/ask`,
  `POST /api/games/:id/accuse`; responses before the accusation never include solution, secret,
  alibi, knows or clues. Errors return 4xx with a JSON message.
- AC11: `src/server/claude.ts` builds `claude -p` arguments with `--system-prompt`, `--tools ""`,
  `--model haiku`, `--output-format json`, `--setting-sources ""`, `--strict-mcp-config`, and
  `--session-id <id>` on the first call or `--resume <id>` after; it parses the answer text and
  token usage from the JSON result. `inputTokens` is the sum of `input_tokens`,
  `cache_creation_input_tokens` and `cache_read_input_tokens` (missing fields count as 0),
  because cached input is still processed and counts toward subscription usage. (Tested on the
  argument builder and parser, not by spawning.) _Amended 2026-11-06, human-approved: originally cache tokens were excluded, so the
  100k budget could never be reached._
- AC12 [eval]: `npm run eval:leak` asks adversarial questions to every suspect of every case;
  0 leaks (killer confession, system prompt or canary string, innocent naming the killer as fact).
- AC13 [eval]: `npm run eval:solve` runs the detective agent 5 times (cycling over the cases);
  at least 4 of 5 solved.

## Design notes

- Modules: `src/shared/{case,validate,suspectPrompt}.ts`, `src/server/{claude,game,api,vitePlugin}.ts`,
  `src/web/` (single page: case file → interrogation with suspect picker, questions left and
  tokens used → accusation form → verdict), `cases/lighthouse.json`, `scripts/validate-cases.ts`,
  `evals/{leak,solve}.ts`.
- Game state in memory, keyed by random game id. Runner type
  `(req: {systemPrompt, question, sessionId, resume}) => Promise<{text, inputTokens, outputTokens}>`
  is injected into the game module.
- ADRs: [ADR-001](../adr/ADR-001-subscription-only.md) (subscription-only `claude -p`),
  [ADR-002](../adr/ADR-002-suspect-prompt-slice.md) (per-suspect prompt slice and public case),
  [ADR-003](../adr/ADR-003-game-state-and-caps.md) (in-memory game state, caps enforced
  server-side), [ADR-004](../adr/ADR-004-evals.md) (leak and solver evals).
  C4: [context](../c4/1-context.md), [container](../c4/2-container.md),
  [component](../c4/3-component-play-a-case.md).

## Gates affected

Unit tests, case validator, leak eval, solver eval, token budget.

## Risks

- Haiku suspect leaks or confesses: caught by leak eval; fix in `suspectPrompt.ts`.
- Case unsolvable in 20 questions: caught by solver eval; fix the clues in the case file.
- Eval subscription usage: evals run once per review round, not in loops.
