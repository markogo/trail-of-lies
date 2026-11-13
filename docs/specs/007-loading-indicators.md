# Spec 007: Loading indicators

Status: Shipped (2026-11-06)

## Problem

Every action that waits on Claude takes seconds (a suspect's answer) or close to a minute
(generating a case). Today the only sign is a disabled button or a "Generating…" label, so the game
looks frozen.

## Goal

Whenever the game waits on the server, the player sees a noir-style spinner with a short status
line next to the thing they are waiting for.

## Non-goals

- Progress percentages or time estimates (the server does not report progress).
- Streaming answers word by word. Cancel buttons.

## User stories

- As a player, I want to see that the suspect is "thinking" and that a case is being written, so
  that I know the game has not frozen.

## Acceptance criteria

- AC1: `src/web/format.ts` exports `loadingLabel(kind, name?)`, a pure function:
  `"ask"` → `"<name> is thinking…"`, `"generate"` → `"Writing a new case…"`,
  `"start"` → `"Opening the case file…"`, `"accuse"` → `"Weighing the evidence…"`.
- AC2: While waiting for an answer, a typing-style bubble with a spinner and
  `loadingLabel("ask", suspectName)` appears at the end of the transcript, and is replaced by the
  answer (or removed on error).
- AC3: While generating a case, starting a game or accusing, the clicked button shows a spinner and
  the matching label; the existing disabled-buttons behaviour stays.
- AC4: The spinner is CSS only (no image, no dependency), uses the accent colour, has
  `role="status"` with the label as text so screen readers announce it, and respects
  `prefers-reduced-motion` (no spinning; a static or pulsing-opacity indicator instead).
- AC5: No behaviour change otherwise: same API calls, same data, all existing tests pass.
- AC2–AC5 are checked by the reviewer (no DOM test environment); AC1 has unit tests.

## Design notes

- `src/web/format.ts` (`loadingLabel`), `src/web/main.ts` (show/hide around each `api()` call),
  `src/web/styles.css` (`.spinner`, `.thinking` bubble). Follows ADR-006; no new ADR, C4 unchanged.
- Built after spec 006 so the main menu's generate button gets it too.

## Gates affected

Unit tests (AC1), `npm run check`. No prompt or case change: leak and solver evals not needed.

## Risks

- A spinner left behind after an error: AC2 and AC3 require removal on error; the reviewer checks
  every `api()` call site.
