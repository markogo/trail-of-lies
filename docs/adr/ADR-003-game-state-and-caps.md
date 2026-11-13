# ADR-003: In-memory game state, server-enforced caps, injected runner

Status: Accepted
Date: 2026-11-06
Spec: docs/specs/001-play-a-case.md

## Context

The game has limits: 20 questions, 300 characters per question, 100k tokens per case. Tests must
never call Claude.

## Decision

- `src/server/game.ts` keeps games in a `Map` keyed by random game id; state is lost on restart.
- All limits are enforced in `ask`, before the runner is called: empty or over 300 chars, unknown
  suspect, 20 questions used, ledger at or above 100,000 (input incl. cached + output tokens, see amendment), already accused.
  `accuse` is always allowed once.
- The runner is injected into the game module:
  `type ClaudeRunner = (req: {systemPrompt: string; question: string; sessionId: string; resume: boolean}) => Promise<{text: string; inputTokens: number; outputTokens: number}>`.
  Production passes the `claude.ts` runner; tests pass a fake.

## Alternatives considered

- Client-side counters: trivially bypassed and the client must not hold state about the truth.
- Database or file persistence: out of scope (non-goal), adds setup for no gain.
- Importing `claude.ts` directly in `game.ts`: tests would spawn Claude.

## Consequences

- Good: caps are testable with a fake; no cost when testing.
- Bad: restart loses games; single-process only.
- Follow-ups: AC5 to AC9 tests with a fake runner.

## Amendment 2026-11-06: ledger counts cached input

Spec 001 AC11 was amended (human-approved). The ledger now counts `input_tokens +
cache_creation_input_tokens + cache_read_input_tokens + output_tokens`, replacing "input + output
tokens" above. Why: cached input is still processed and counts toward subscription usage; counting
only fresh input and output meant the 100k budget never fired. Consequence: a long game can now hit
the budget and force an accusation early; the solver eval may run into it, so watch it. The
`ClaudeRunner` type does not change: `parseClaudeResult` pre-sums `input_tokens +
cache_creation_input_tokens + cache_read_input_tokens` into `inputTokens`, so the result stays
`{text, inputTokens, outputTokens}`.
