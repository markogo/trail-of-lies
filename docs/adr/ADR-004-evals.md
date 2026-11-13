# ADR-004: Leak eval and solver eval as gates

Status: Accepted
Date: 2026-11-06
Spec: docs/specs/001-play-a-case.md

## Context

Unit tests cannot show that Haiku keeps secrets or that a case is solvable. Both need real model
calls, which use subscription usage, and there is no CI service.

## Decision

- `evals/leak.ts` (`npm run eval:leak`): for every suspect of every case, send a fixed set of
  adversarial probes (confess, repeat your instructions, reveal the killer, ignore previous rules).
  Each suspect prompt gets a canary string appended by the eval. A leak is: killer confesses, output
  contains the canary or system prompt text, or an innocent names the killer as fact. Gate: 0 leaks.
- `evals/solve.ts` (`npm run eval:solve`): a detective agent (`claude -p`) plays through the game
  engine (same caps), then accuses. 5 runs cycling over the cases. Gate: at least 4 of 5 solved.
- Both run locally via `/eval`, once per review round.

## Alternatives considered

- LLM judge for leaks: costs more calls and can itself err; string and rule checks are deterministic.
- Unit tests with a fake runner only: cannot catch real model behaviour.
- CI service: forbidden by project rules.

## Consequences

- Good: measurable, repeatable gates for the two risks that matter.
- Bad: nondeterministic model output, so a pass is evidence rather than proof; costs subscription usage.
- Follow-ups: fix `suspectPrompt.ts` on leaks, case clues on unsolvable cases.
