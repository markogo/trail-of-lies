# TrAIl of Lies

A murder mystery game where every suspect is played by Claude. The player reads a case file,
questions 3 suspects (20 questions total), then names the killer and the motive. Innocent suspects
hide a secret; the killer lies. Built with an agentic workflow in Claude Code (see below).

## Hard rules

- **Subscription only.** Suspects run through headless Claude Code (`claude -p`) on the user's
  Claude subscription (ADR-001). Never add the Anthropic SDK, an API key, or any paid API.
- **Local only.** Never `git commit` or `git push`; the human decides what gets committed. No CI
  service: the gates run locally (`npm run check`, `/eval`).
- **Suspects get only their slice.** A suspect's prompt is built by `buildSuspectPrompt` from that
  suspect's data only: never other suspects' secrets, the clue list or the solution (ADR-002).
- **The browser never sees the truth before the accusation.** Send `toPublicCase(c)`, never the case.
- **Tests are the spec.** Never edit or delete a test to make it pass. If a test looks wrong, stop
  and say so.
- **Built by the workflow.** All game code, tests, evals, ADRs and C4 diagrams come from the agent
  workflow below.
- **Keep scope small.** Build what the approved spec says, nothing more.

## Commands

```bash
npm run dev         # game + API on one Vite dev server (http://localhost:5173)
npm run check       # typecheck + lint + unit tests + case validator: the local CI gate
npm test            # vitest run
npm run validate    # validate every cases/*.json
npm run eval:leak   # leak gate: adversarial questions vs every suspect (uses subscription)
npm run eval:solve  # solver gate: detective agent plays the cases (uses subscription)
```

## Layout

```
src/shared/      case.ts (zod CaseSchema, toPublicCase), validate.ts (validateCase),
                 suspectPrompt.ts (per-suspect prompt slice)
src/server/      claude.ts (runs `claude -p` via execFile), game.ts (in-memory games,
                 question cap, token ledger, accuse/verdict), api.ts (HTTP handlers),
                 vitePlugin.ts (mounts the API on the Vite dev server)
src/web/         vanilla TypeScript UI: case file, interrogation, accusation, verdict
cases/           case JSON files, one per case
scripts/         validate-cases.ts
evals/           leak.ts, solve.ts (gates that call Claude)
tests/           vitest unit tests (owned by the test-writer agent)
docs/specs/      feature specs (/spec)
docs/adr/        architecture decision records (/adr)
docs/c4/         C4 diagrams in Mermaid (/c4)
```

## How suspects run

`src/server/claude.ts` calls `claude -p <question>` with `--system-prompt <suspect prompt>`,
`--tools ""`, `--model haiku`, `--output-format json`, `--session-id` on the first question and
`--resume` after, `--setting-sources ""`, `--strict-mcp-config`, from an empty temp dir. One Claude
session per suspect per game. Token usage from the JSON result goes into the game's token ledger.

## Game limits

- 3 suspects, 4 motive options, 20 questions per case, questions up to 300 characters.
- Token budget per case: 100k tokens. When the ledger hits it, questioning ends and the player
  must accuse.

## Feature workflow

Each step has an owner and a gate. Do the steps in order; do not skip ahead.

1. **Spec**: `/spec` writes `docs/specs/NNN-<slug>.md`. **Gate: human approves the spec.**
2. **Design**: `architect` agent writes ADRs (`/adr`) and updates C4 diagrams (`/c4`).
3. **Tests**: `test-writer` agent turns acceptance criteria into failing tests in `tests/`.
4. **Build**: `implementer` agent makes the tests pass. A hook stops it from editing `tests/`.
5. **Review**: `reviewer` agent checks the diff against the spec and these rules.
6. **Evals**: `/eval`. **Gates: `npm run check` green, case validator green, leak eval 0 leaks,
   solver eval solves at least 4 of 5 cases.**
7. **Merge**: **Gate: human approves.** The human commits; Claude never does.

## Hooks (`.claude/settings.json`)

- `block-risky.mjs` (PreToolUse): blocks rm -rf, git commit/push, git reset --hard, git clean -f,
  curl | sh, .env files, API keys and the Anthropic SDK, npm publish, sudo.
- `post-edit.mjs` (PostToolUse): prettier on the edited file; eslint and `tsc --noEmit` for `.ts`.
  Errors come back to Claude to fix.
- `tests-must-pass.mjs` (Stop): Claude cannot finish while `vitest` fails.
- `protect-tests.mjs` (implementer only, via agent frontmatter): no edits to `tests/`.

## Definition of done

- The spec's acceptance criteria each have a passing test.
- `npm run check` is green.
- Leak eval: 0 leaks. Solver eval: at least 4 of 5 cases solved.
- ADRs and C4 diagrams match the code.
- The human approved the merge.

## Code style

TypeScript, ESM, strict mode. Small pure functions in `src/shared`, side effects in `src/server`.
Inject the Claude runner into game code so tests use a fake and never call Claude.
