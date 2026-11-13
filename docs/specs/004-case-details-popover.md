# Spec 004: Case details panel

Status: Shipped (2026-11-06, amendment 1; first version was rejected at merge)

## Problem

Once questioning starts, the case file is gone. To check the victim, the setting, a suspect's
public statement or the possible motives, the player has to remember them; there is no way back
to the case file without leaving the interrogation.

## Goal

On the interrogation screen, a "Case details" button opens the case file in a docked side panel.
Nothing overlaps the transcript: on wide screens the panel sits in its own column next to the chat,
so the player sees the case details, the conversation and the question box at the same time.

Amendment 1: the first version opened a floating popover on hover. At the merge gate the human
found it covered the messages and asked to see everything on screen at once.

## Non-goals

- New data: the popover shows only what the case-file screen already shows (`PublicCase`).
- The mockups' notebook, pinned clues or player notes. A panel on other screens.
- Any server, API or test-environment change.

## User stories

- As a player, I want to glance at the case details while questioning so that I can check facts
  without losing my place.

## Acceptance criteria

- AC1: `src/web/format.ts` exports `caseDetails(c: PublicCase)`, a pure function returning
  `{ title, setting, victim, briefing, suspects: {name, role, publicStatement}[], motives: string[] }`
  built only from the public case.
- AC2: `caseDetails` output contains every suspect's name, role and public statement and every
  motive label, in case order; it has no other keys (so a later field added to `PublicCase` does
  not leak into the popover without a spec).
- AC3: The interrogation header has a "Case details" toggle `<button>` with `aria-expanded` and
  `aria-controls` pointing at the panel. Click, tap, `Enter` or `Space` opens and closes it; it
  stays open while the player asks questions until toggled closed. Hover does not open it (a
  docked panel opening on hover would make the layout jump).
- AC4: Layout, at 1024 px width and up: suspects | chat | panel side by side; opening the panel
  narrows the chat column instead of covering it, and the transcript, question input and Ask
  button stay fully visible. Below 1024 px the panel is shown full-width above the chat, collapsed by default, and pushes content
  down rather than covering it. Nothing is ever positioned over the transcript.
- AC5: The panel uses the noir paper style (paper background, ink text, mono section labels:
  SETTING, VICTIM, BRIEFING, SUSPECTS, MOTIVES), scrolls on its own when taller than the screen
  (sticky, `max-height: calc(100vh - <header>)`), and meets the 4.5:1 contrast rule.
- AC6: Opening or closing the panel does not change the transcript, the selected suspect, the
  question input or the counters, does not call the API, and keeps its open/closed state when the
  screen re-renders after an answer.
- AC7: All panel text is set with `textContent` (no `innerHTML`). No document-level listeners.
- AC3–AC7 are checked by the reviewer (no DOM test environment).

## Design notes

- `src/web/format.ts`: `caseDetails` (unchanged). `src/web/main.ts`: replace the popover with a
  panel column in `showInterrogation`; remember open/closed across re-renders. `src/web/styles.css`:
  three-column grid when open, `.panel` in the paper style. Spec 005 reuses this panel for the map.
- No ADR needed unless the architect disagrees (follows ADR-006: plain CSS, no dependency).
  C4 unchanged.

## Gates affected

Unit tests (AC1, AC2), `npm run check`. No prompt or case change: leak and solver evals not needed.

## Risks

- Three columns get cramped on small laptops. Columns are 200 | flexible | 300 px with 16 px gaps
  from 1024 to 1279 px (chat about 440 px at 1024) and 260 | flexible | 340 px from 1280 px; the
  chat column uses `minmax(0, 1fr)` so it can never force horizontal scroll. Below 1024 px the panel
  stacks above the chat. (Corrected in review: the first sizes, 340 panel and 420 chat minimum,
  did not fit at 1024 px.)
