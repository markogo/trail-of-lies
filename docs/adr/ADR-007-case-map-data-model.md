# ADR-007: Case map data model (claimed, public locations only)

Status: Accepted
Date: 2026-11-06
Spec: docs/specs/005-case-map.md

## Context

Spec 005 adds a map of where suspects claim to have been. The browser may only see `PublicCase`
(CLAUDE.md), suspect prompts are sliced per suspect (ADR-002), the generator output must pass
`validateCase` (ADR-005), and the solver detective is given `JSON.stringify(toPublicCase(c))` as its
case file (`evals/solve.ts`). There is no DOM test environment (ADR-006), so only pure functions are
unit-testable. Spec 006 (difficulty) builds on this and adds more fields to the same schema.

## Decision

- Schema (`src/shared/case.ts`): `map: { locations: {id, name, x, y}[] (3 to 8), victimLocationId }`;
  `x`, `y` are numbers 0 to 100 in an abstract square; each suspect gets `claimedLocationId`.
- Only public, claimed facts are stored: location names, the place the body was found, and where each
  suspect says they were. The killer's true position is never stored, so it cannot leak. The killer's
  claimed spot is a lie, as in their statement.
- `PublicCase` gets `map` (same shape) and `suspects[].claimedLocationId`. `toPublicCase` copies them
  explicitly; it still omits secret, alibi, knows, clues, solution.
- `validateCase` adds errors for: duplicate location ids; `victimLocationId` not a location; a
  suspect's `claimedLocationId` not a location; a location name containing any suspect's name (not only the killer's: a killer-only rule would
  itself hint at the killer)
  (case-insensitive, full name or any name word of 3+ letters). Counts and 0-100 ranges are schema rules.
- Rendering: a schematic inline SVG built from coordinates, no images or tiles. The pure
  `mapView(c: PublicCase)` in `src/web/format.ts` returns the points to draw; `main.ts` renders them
  with SVG text nodes and `textContent` only, plus a text list of the same facts.
- The map is the second tab of the spec-004 docked panel (ADR-006); no new layout mechanism.
- The detective gets the map for free because the solver already serializes the public case. The
  suspect prompt slice (`buildSuspectPrompt`) is unchanged: suspects do not receive the map.
- The generator prompt asks for the map and `claimedLocationId`s; invalid maps are retried by the
  existing ADR-005 loop.

## Alternatives considered

- Store true positions too (for later movement or timelines): any server bug could leak the killer;
  out of scope. Rejected.
- Free-form location text on each suspect, no shared location list: nothing to draw and no
  validation. Rejected.
- Grid or tile map, or generated or static images: needs assets or a library; schematic SVG is
  enough and unit-testable through `mapView`.
- Draw with canvas or an SVG library: new dependency or untestable; plain SVG is accessible and styleable
  with the ADR-006 CSS variables.
- Derive positions in the browser with auto-layout: coordinates must match the story and be
  hand-written for the lighthouse; the model can supply them.
- Reject only exact killer-name matches: misses first-name-only names such as "Harold's cabin";
  word matching is stricter at little cost.
- A separate map endpoint: the public case already travels to the browser; one more route is needless.

## Consequences

- Good: no new leak surface beyond what the public case already shows; schema-level and validator
  checks catch bad generated maps through existing retries; detective sees the map with no solver change.
- Bad / accepted trade-offs: name-based leak check is heuristic (a location could still hint at the
  weapon); the leak eval and reviewer cover that. The killer's claimed spot may make easy cases easier
  (spec 006 handles difficulty). Existing cases without a map become invalid until regenerated.
- Follow-ups: unit tests for schema, `validateCase`, `toPublicCase` (spec 001 AC2 test updated) and
  `mapView`; `cases/lighthouse.json` hand-written map; leak and solver evals re-run.
