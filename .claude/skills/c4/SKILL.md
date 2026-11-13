---
name: c4
description: Create or update the C4 architecture diagrams for TrAIl of Lies (Mermaid, in docs/c4/). Use after an ADR changes containers or components, or when a feature adds a new part of the system.
---

# /c4: update the C4 diagrams

Diagrams live in `docs/c4/` as Markdown files with Mermaid blocks:

| File | Level | Shows |
| --- | --- | --- |
| `docs/c4/1-context.md` | C4Context | Player, TrAIl of Lies, Claude Code CLI on the subscription |
| `docs/c4/2-container.md` | C4Container | Browser UI, Vite dev server + API plugin, game engine, `claude -p` processes, case files |
| `docs/c4/3-component-*.md` | C4Component | Inside one container, for the feature being built |

## Steps

1. Read the code, not just the old diagram: `src/server`, `src/shared`, `src/web`, `cases/`, `evals/`.
2. Update every level the change touches. Add a component diagram for a new feature
   (`3-component-<feature>.md`) when it adds more than one module.
3. Use Mermaid C4 syntax (`C4Context`, `C4Container`, `C4Component`), e.g.:

   ```mermaid
   C4Container
     title TrAIl of Lies: containers
     Person(player, "Player", "Plays a case in the browser")
     Container(web, "Web UI", "Vite + TypeScript", "Case file, interrogation, accusation, verdict")
     Rel(player, web, "Plays")
   ```

4. Under each diagram, add 2 to 4 bullets: what changed and which ADR or spec explains it.
5. Check names match the code (file and function names) and that no element is left over from a
   removed feature.
