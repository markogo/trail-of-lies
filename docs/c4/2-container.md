# C4 level 2: Containers

```mermaid
C4Container
  title TrAIl of Lies: containers
  Person(player, "Player", "Plays a case in the browser")
  Person(dev, "Developer", "Runs npm run generate")
  System_Boundary(sys, "TrAIl of Lies") {
    Container(web, "Web UI", "TypeScript, Vite", "Case file, interrogation with details and map tabs (inline SVG), accusation, verdict; main menu with case list and difficulty-aware Generate")
    Container(server, "Game server", "Node, Vite plugin", "HTTP API, game engine, case generator, Claude runners")
    ContainerDb(cases, "Case files", "JSON in cases/", "Full cases incl. secrets and solution")
    Container(gen, "Generate script", "tsx scripts/generate-case.ts", "Generates one case, writes cases/<id>.json")
    Container(evals, "Evals and validator", "tsx scripts", "validate-cases, leak eval, solver eval")
  }
  System_Ext(claude, "Claude Code CLI", "claude -p, subscription")
  Rel(player, web, "Plays, generates")
  Rel(dev, gen, "Runs")
  Rel(web, server, "JSON over /api, public case only", "HTTP")
  Rel(server, cases, "Loads at start")
  Rel(server, claude, "Spawns per question (haiku) and per generation (sonnet)", "execFile")
  Rel(gen, claude, "Spawns generation (sonnet)", "execFile")
  Rel(gen, cases, "Writes")
  Rel(evals, cases, "Validates and attacks")
  Rel(evals, server, "Uses game engine")
  Rel(evals, claude, "Spawns probes and detective")
```

- Browser only receives `toPublicCase` data before the accusation (ADR-002); the generate route returns `{ caseId, title }` only.
- The public case includes the claimed-locations map, never true positions (ADR-007).
- Game state and button-generated cases live in server memory (ADR-003, ADR-005); only `npm run generate` writes `cases/`.
- Case generation uses sonnet with validation-error retries (ADR-005, spec 002). Evals are in ADR-004.
