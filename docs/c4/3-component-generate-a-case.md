# C4 level 3: Components of the case generator

```mermaid
C4Component
  title Case generator: components
  Container(web, "Web UI", "TypeScript", "Main menu: difficulty radio group and Generate button")
  ContainerDb(cases, "Case files", "JSON", "cases/*.json")
  Container_Boundary(server, "Game server") {
    Component(plugin, "vitePlugin.ts", "Vite plugin", "Wires generateCase with generatorRunner")
    Component(api, "api.ts", "HTTP handlers", "POST /api/cases/generate { difficulty } -> { caseId, title }, 400 invalid difficulty, 502")
    Component(game, "game.ts", "Game engine", "addCase(c): case becomes playable in memory")
    Component(generator, "generator.ts", "Retry loop", "generateCase({ runner, maxAttempts, difficulty }): buildGeneratorPrompt(difficulty), sets case difficulty, JSON extraction, error feedback, gen-id")
    Component(claude, "claude.ts", "Runner", "generatorRunner: buildClaudeArgs(req, { model: sonnet }), sessionDir")
    Component(validate, "validate.ts", "Pure", "validateCase")
    Component(schema, "case.ts", "zod", "CaseSchema")
  }
  Container(script, "scripts/generate-case.ts", "tsx", "npm run generate")
  System_Ext(cli, "Claude Code CLI", "claude -p")
  Rel(web, plugin, "HTTP")
  Rel(plugin, api, "Routes; passes generate dep")
  Rel(api, generator, "Calls injected generate()")
  Rel(api, game, "store.addCase")
  Rel(generator, claude, "Injected runner")
  Rel(generator, schema, "safeParse")
  Rel(generator, validate, "validateCase")
  Rel(claude, cli, "execFile, 180 s")
  Rel(script, generator, "generateCase")
  Rel(script, cases, "Writes cases/<id>.json")
```

- `generator.ts` depends on the runner type only; retries resume the same session with validation errors (ADR-005).
- `api.ts` takes the generator as an optional dependency, so tests use a fake; `createApiHandler(store)` still works.
- Generation tokens are not charged to game ledgers (ADR-005).
- Difficulty (ADR-008): `api.ts` validates the body (default medium, else 400) and calls `generate(difficulty)`; the generator prompt carries the level's rules, the validator rules of spec 005 are unchanged; `npm run generate -- --difficulty <level>` passes the same value.
