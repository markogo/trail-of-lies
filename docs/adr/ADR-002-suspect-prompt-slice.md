# ADR-002: Per-suspect prompt slice and public case

Status: Accepted
Date: 2026-11-06
Spec: docs/specs/001-play-a-case.md

## Context

Suspects are LLMs and can be talked into revealing anything in their prompt. The browser is also an
exposure point: anything sent before the accusation can be read by the player.

## Decision

- `buildSuspectPrompt(c, suspectId)` (pure, `src/shared/suspectPrompt.ts`) is built from that
  suspect's data only: persona, secret, alibi, knows, public case context. It never includes other
  suspects' secrets, the clue list, `solution.explanation`, or the killer's id for an innocent. The
  killer's prompt says to lie and never confess; innocents' say to hide their secret.
- `toPublicCase(c)` (`src/shared/case.ts`) is the only case shape sent to the browser before the
  accusation. The full solution is returned only in the verdict.

## Alternatives considered

- One shared prompt with the whole case and "do not reveal X": a single jailbreak leaks everything.
- Filtering suspect output for secrets: brittle and incomplete; prevention beats detection.
- Sending the full case and hiding fields in the UI: the player can read network responses.

## Consequences

- Good: a suspect cannot leak what it was never given; leak surface is one suspect's own data.
- Bad: suspects cannot cross-reference each other, so cases must put shared facts in each `knows`.
- Follow-ups: AC2 and AC4 unit tests; leak eval (ADR-004).
