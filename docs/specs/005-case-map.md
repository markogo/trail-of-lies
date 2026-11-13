# Spec 005: Case map

Status: Shipped (2026-11-06)

## Problem

Alibis are just sentences. The player has to picture the island, the house or the ship in their
head to see who claims to have been where, and how far that was from the body.

## Goal

Every case has a small map drawn from its story: the places in the setting, where the victim was
found, and where each suspect says they were at the time of the murder. The player opens it from a
"Map" button on the interrogation screen, the same way as the case details panel (spec 004).

## Non-goals

- True positions. The map shows only what suspects claim; the killer's claimed spot is a lie, as in
  their statement. No movement paths, timelines, distances or zoom/pan.
- Images or tiles. The map is a schematic SVG drawn from coordinates.
- Editing the map or placing pins as a player.

## User stories

- As a player, I want to see where everyone claims they were so that I can spot whose story
  doesn't fit the place the body was found and what the witnesses say.

## Acceptance criteria

- AC1: `CaseSchema` gains `map: { locations: {id, name, x, y}[], victimLocationId }` with 3 to 8
  locations and `x`, `y` numbers from 0 to 100, and each suspect gains `claimedLocationId`.
- AC2: `validateCase` returns an error when location ids are not unique, `victimLocationId` or a
  suspect's `claimedLocationId` is not a location, or a location name contains any suspect's name (checking only the killer's name would itself
  hint at the killer: every suspect but one could have a named place). Names match as whole words
  (so "Grand hall" does not match a suspect called Rand).
- AC2b (added in review, 2026-11-06): `validateCase` returns an error when fewer than two innocent
  suspects mention the killer by name (full name or a name word of 3+ letters) in their `knows`. This
  is a structural check that the case has two independent witnesses; the reviewer found a generated
  case where one "witness" actually backed up the killer's alibi.
- AC2c (added after the solver gate failed, 2026-11-06, human chose this fix): `solution` gains
  `motiveKeyword` (private, never in `PublicCase`). `validateCase` returns an error unless the
  keyword appears as a whole word (case-insensitive) in the true motive's label, in no other motive
  label, and in the `knows` of at least two innocent suspects. The generator prompt also requires
  that the killer's own secret does not match any wrong motive option and that the innocents' knows
  rule out every wrong motive. `cases/lighthouse.json` gets `motiveKeyword: "fraud"` and two
  innocents who know about the fraud. Evidence: in `gen-6c9af6f2` the killer's secret (selling brass
  parts) matched the wrong option "brass parts theft"; the detective took her admission as the motive
  in 3 of 3 runs.
- AC3: `toPublicCase` includes `map` and each suspect's `claimedLocationId`, and still never
  includes secret, alibi, knows, clues or solution (spec 001 AC2 test updated by the test-writer).
- AC4: `src/web/format.ts` exports `mapView(c: PublicCase)`, a pure function returning the points to
  draw: one per location `{name, x, y, victim: boolean, suspects: {name, initials}[]}`, built only
  from the public case, with no other keys.
- AC5: `cases/lighthouse.json` gets a hand-written map that matches its story (jetty, keepers'
  quarters, kitchen, lamp-room stairs where Harold was found, oil store), and each suspect's
  `claimedLocationId` matches their public statement.
- AC6: The generator prompt asks for the map and `claimedLocationId`s, consistent with the setting,
  the public statements and the time of death; generated cases without a valid map are retried like
  any other validation error.
- AC7: The interrogation header gets a "Map" toggle button that opens the map in the same docked
  panel as "Case details" (spec 004). Only one shows at a time; the buttons act as tabs.
- AC8: The map is an inline SVG in the noir paper style: locations as labelled dots, the victim
  location marked with a red cross and "Victim found here", each suspect as an initials badge at
  their claimed location, a legend, and a text list of the same facts below it (screen readers,
  small screens). It fits the panel at 390 px wide and meets the 4.5:1 contrast rule. All text via
  `textContent` or SVG text nodes, never `innerHTML`.
- AC4 and AC7–AC8 rendering is checked by the reviewer; AC1–AC4 have unit tests.
- AC9 [eval]: the leak eval stays at 0 leaks and the solver eval at least 4 of 5 with the map in the
  public case (the detective sees the map data in its case file).

## Design notes

- `src/shared/case.ts` (schema, `PublicCase`, `toPublicCase`), `src/shared/validate.ts`,
  `src/server/generator.ts` (prompt), `src/web/format.ts` (`mapView`), `src/web/main.ts` (Map tab),
  `src/web/styles.css`. `cases/lighthouse.json` updated by the implementer; the generated case is
  regenerated with `npm run generate` (replaces `gen-c94560c3`).
- `evals/solve.ts`: the detective's case file includes the map, and the eval prints per-case
  results.
- ADR-007 (docs/adr/ADR-007-case-map-data-model.md): map data model (claimed, public locations
  only; schematic SVG; no true positions).
  C4: no new container.

## Gates affected

Unit tests, case validator, leak eval, solver eval.

## Risks

- Map leaks the answer (a location named after the weapon's hiding place, or the killer's true
  spot): only claimed positions are stored; AC2 rejects location names containing any suspect's name; the
  leak eval and the reviewer check generated maps.
- Map makes the case too easy (the killer's claimed spot is obviously far from witnesses): fine for
  easy cases; difficulty is handled in spec 006.
