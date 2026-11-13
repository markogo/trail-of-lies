# ADR-005: Case generation with sonnet, validation retries, in-memory store

Status: Accepted
Date: 2026-11-06
Spec: docs/specs/002-case-generator.md

## Context

Spec 002 needs fresh cases from `claude -p`. Cases are large JSON objects that must pass
`validateCase`. Subscription only (ADR-001), local only, small scope. Generation is not a suspect
turn, so it has no per-suspect slice (ADR-002) and no game ledger (ADR-003).

## Decision

- `src/server/generator.ts` exports `generateCase({ runner, maxAttempts = 3 })`. The runner is a
  `ClaudeRunner` injected, so tests use a fake.
- Production runner (`generatorRunner` in `claude.ts`): same as `claudeRunner` but
  `buildClaudeArgs(req, { model: "sonnet" })`, using `sessionDir(sessionId)` for the cwd so
  `--resume` works, and `cleanupSession` when done. Timeout 180 s.
- Answer handling: extract the JSON object (strip a ```json fence, or take first `{` to last `}`),
  `JSON.parse`, `CaseSchema.safeParse`, then `validateCase`. Any failure counts as an invalid attempt.
- Retry: up to `maxAttempts` calls in one session. Attempt 1 uses `resume: false`; each retry uses
  `resume: true` with a question that lists the parse or validation errors. After the last failed
  attempt, throw `GameError(502, ...)` with no further runner call. A runner error is also a failed
  attempt (and counts toward the cap).
- Id: the server overrides the id with `gen-<random>` (e.g. 8 hex chars from `randomUUID`).
- Storage: the button route only does `store.addCase(c)` (in memory, lost on restart).
  `npm run generate` (`scripts/generate-case.ts`) writes `cases/<id>.json`, so validator and evals
  cover it.
- Generation tokens are not charged to any game ledger; the per-click cap is 3 attempts.

## Alternatives considered

- Haiku for generation: cheaper, but weaker at long, consistent, schema-valid JSON, so more retries.
- Retry as fresh sessions: loses the model's own draft; costs more tokens than feeding the errors back.
- Accept the model's id: risks collisions and overwriting existing cases.
- Write button-generated cases to `cases/`: unreviewed output would land in the repo and the evals
  and the human's commit; also a write surface for the web server.
- Anthropic SDK / structured output API: forbidden (ADR-001).
- Charge generation to a game ledger: no game exists yet.

## Consequences

- Good: bounded cost, reuses existing runner args and temp-dir mechanism, deterministic tests.
- Bad: valid does not mean fair or leak-free; button cases are not eval-checked. Slow (tens of seconds).
- Follow-ups: unit tests with fake runner (AC1 to AC7); AC10 eval run on a generated case.
