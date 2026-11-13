# Spec 003: Noir case-file UI

Status: Shipped (2026-11-06)

## Problem

The game renders as unstyled browser-default HTML: black text on white, no layout. It works but
does not feel like a murder mystery, and the interrogation screen is hard to scan.

## Goal

The four existing screens (case file, interrogation, accusation, verdict) look like the dark noir
case-file mockups in `docs/design/mockups/` (copied from the design canvas "TrAIl of Lies UI
Mockups"), with no change to game rules, API or what the browser is allowed to see.

## Non-goals

The mockups show more than the game does. These parts are out of scope:

- Notebook and "Pin as clue", the "Contradicts: …" hint, suspect "Mood".
- Score ("questions to spare"), the verdict timeline and "Key clues you found / missed" (the
  verdict shows `solution.explanation` as one paragraph instead).
- "Replay this case", a case number in the header, "CONFIDENTIAL"/"CASE CLOSED" variants beyond
  the two stamps listed below.
- Any new API field, server change or new data sent to the browser. Dark only (no light theme).

## User stories

- As a player, I want the game to look like a noir case file so that it feels like a mystery.
- As a player, I want to see at a glance which suspect I'm questioning, how many questions and
  tokens are left, and the conversation as chat bubbles.

## Acceptance criteria

- AC1: `src/web/styles.css` exists, is linked from `src/web/index.html`, and defines the mockup
  palette as CSS custom properties on `:root`: background `#14161B`, panel `#1D2027`, raised
  `#262A33`, border `#2C313A`, text `#ECE8E1`, muted `#A3A9B3`, accent `#E8A33D`, danger `#B3261E`,
  paper `#F3EEE4`, ink `#2A2620`, success `#2E7D32`, budget `#6FA8DC`.
- AC2: `index.html` loads IBM Plex Mono and Inter from Google Fonts, and `styles.css` falls back
  to `monospace` and `system-ui, sans-serif`.
- AC3: `src/web/format.ts` exports pure helpers used by the UI:
  `initials(name)` (first letters of the first and last name, ignoring a title such as "Dr.":
  "Dr. Oskar Lind" → "OL", "Mara Quill" → "MQ"), and `percent(used, total)` (0–100, clamped,
  rounded; `percent(38000, 100000)` → 38, `total` 0 → 0).
- AC4: Case file screen: paper-coloured case-file panel with a rotated red "CONFIDENTIAL" stamp,
  title, briefing, victim and setting; suspect cards with an initials avatar, name, role and
  public statement; "Begin investigation" accent button; the "Generate a new case" button.
- AC5: Interrogation screen: header with the case title and two progress bars ("Questions left
  N / 20" in accent, "Case token budget Xk / 100k" in budget blue, widths from `percent`);
  suspect list as buttons with `aria-pressed` on the selected one and per-suspect questions asked
  (counted in the browser); transcript as chat bubbles (player right, suspect left); question
  input with a visible `<label>` and an "Ask" button; "Make accusation" danger button.
- AC6: Accusation screen: suspects as radio cards and motives as radio rows, the selected one
  outlined in accent; "Back to questioning (N questions left)" link; danger button whose text
  is "Accuse <name>" for the selected suspect.
- AC7: Verdict screen: paper panel with a rotated stamp, "CASE CLOSED" in green when solved and
  "CASE UNSOLVED" in red otherwise; heading with the result; Killer and Motive each "Right" or
  "Wrong"; the solution explanation; "Generate a new case" button.
- AC8: Layout works at 390 px width (grids stack to one column, no horizontal page scroll);
  buttons and inputs are at least 44 px high; text contrast is at least 4.5:1; errors use the
  danger colour.
- AC9: Behaviour is unchanged: all existing tests pass, the browser still receives only
  `PublicCase`, `answer`, `questionsLeft`, `tokensUsed`, `{caseId, title}` and the verdict.
- AC4–AC8 are checked by the reviewer against the mockups (no DOM test environment).

## Design notes

- New `src/web/styles.css` and `src/web/format.ts`; `src/web/index.html` adds the stylesheet and
  font links; `src/web/main.ts` gets class names and structure for the four screens. Static CSS
  classes, no inline styles, no CSS framework, no new dependency.
- Mockups (reference only, not shipped): `docs/design/mockups/{Main,Interrogation,Accuse,Verdict}.dc.html`.
- ADR-006 (small): plain CSS with custom properties, Google Fonts with system fallbacks, no
  framework. C4: no container change; note `styles.css` in the web component if shown.
- Design: [ADR-006](../adr/ADR-006-plain-css-noir-ui.md). C4 diagrams unchanged: the web UI is a single
  container box and no diagram shows its internals.
- Signatures: `initials(name: string): string`, `percent(used: number, total: number): number`
  in `src/web/format.ts`.

## Gates affected

Unit tests (AC3, AC9), `npm run check`. No suspect, prompt or case change, so the leak and solver
evals are not needed for this feature.

## Risks

- Scope creep from the mockups' extra features: the non-goals list them; the reviewer rejects them.
- Google Fonts unavailable offline: system font fallbacks keep the game readable.
