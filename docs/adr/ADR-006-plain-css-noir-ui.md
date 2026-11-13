# ADR-006: Plain CSS with custom properties for the noir UI

Status: Accepted
Date: 2026-11-06
Spec: docs/specs/003-noir-ui.md
Applies also to spec 004 (case details docked side panel)
Applies also to spec 007 (loading indicators)

## Context

Spec 003 restyles the four screens to match the noir mockups. Constraints: small scope, local only,
no new dependency, no server or API change, and the browser must keep receiving only `PublicCase`
and the existing fields. There is no DOM test environment, so only pure functions are unit-testable.

## Decision

- One static stylesheet, `src/web/styles.css`, linked from `src/web/index.html`. The spec palette is
  defined once as CSS custom properties on `:root` (`--bg`, `--panel`, `--raised`, `--border`, `--text`,
  `--muted`, `--accent`, `--danger`, `--paper`, `--ink`, `--success`, `--budget`). Components use
  `var(--...)` only. `main.ts` sets class names, no inline styles.
- Fonts: IBM Plex Mono and Inter loaded from Google Fonts via `<link>` in `index.html`; CSS font
  stacks fall back to `monospace` and `system-ui, sans-serif`, so the game stays readable offline.
- Pure UI helpers live in `src/web/format.ts`: `initials(name: string): string`,
  `percent(used: number, total: number): number` and `caseDetails` (spec 004). They have no DOM
  access so vitest can test them.
- Case details (spec 004, amended) is a docked side panel, not a popover. A toggle button shows or hides
  it. At >=1024px the layout is a three-column grid (suspects, chat, panel); below that the panel stacks
  above the chat. It never overlaps the chat. No hover behaviour and no document-level listeners; open
  state is kept in UI state so it survives re-renders. The panel is a reusable tabbed side panel: "Case
  details" now, a "Map" tab in spec 005.
- Why: the original hover/focus popover covered the chat while the player was reading and questioning,
  and the human rejected it at merge. A docked panel keeps both visible and removes the listener and
  pinning complexity.
- Loading indicator (spec 007): a CSS-only `.spinner` (border-based, no image or dependency). Its arc
  uses the accent colour on neutral backgrounds, but on amber primary and red danger buttons it uses
  the ink/text colour (an amber arc on an amber button would be invisible). Buttons showing a spinner
  stay at full opacity while disabled. Announcements go through one persistent visually-hidden
  `role="status"` live region outside `#app` (not one per spinner), whose text is
  `loadingLabel(kind, name?)` (pure, in `format.ts`). Under `prefers-reduced-motion: reduce` the spin is replaced by a static or
  pulsing-opacity indicator.
- No CSS framework, no preprocessor, no new dependency. No server or API change.

## Alternatives considered

- Tailwind or another CSS framework: new dependency and build config for four screens; overkill.
- CSS-in-JS or inline styles from `main.ts`: harder to review against the mockups, mixes style into logic.
- Self-hosted font files: adds binary assets to the repo; system fallbacks already cover offline use.
- System fonts only: loses the mockup look for no real gain.
- Inline the helpers in `main.ts`: untestable without a DOM; a separate pure module is.

## Consequences

- Good: zero new dependencies, palette changes in one place, helpers unit-tested (AC3).
- Bad / accepted trade-offs: fonts need network on first load (fallbacks used otherwise); layout, contrast
  and mockup fidelity (AC4-AC8) are reviewer-checked, not tested; dark theme only.
- Follow-ups: unit tests for `format.ts`; reviewer checks AC4-AC8 against `docs/design/mockups/`;
  `npm run check` stays green.
