# C4 level 3: Components of the game server (play a case)

```mermaid
C4Component
  title Game server: components
  Container(web, "Web UI", "TypeScript", "Main menu (first screen), then case file, interrogation, verdict")
  ContainerDb(cases, "Case files", "JSON", "cases/*.json")
  Container_Boundary(server, "Game server") {
    Component(plugin, "vitePlugin.ts", "Vite plugin", "Mounts the API on the dev server")
    Component(api, "api.ts", "HTTP handlers", "GET /api/cases, POST /api/games, /ask, /accuse; 4xx JSON errors")
    Component(game, "game.ts", "Game engine", "listCases, createGame, ask, accuse; question cap, token ledger; injected runner")
    Component(claude, "claude.ts", "Runner", "Builds claude -p args, parses JSON result")
    Component(prompt, "suspectPrompt.ts", "Pure", "buildSuspectPrompt(c, suspectId): killer rules vary by c.difficulty")
    Component(schema, "case.ts", "zod", "CaseSchema, toPublicCase")
    Component(validate, "validate.ts", "Pure", "validateCase")
  }
  System_Ext(cli, "Claude Code CLI", "claude -p")
  Rel(web, plugin, "HTTP")
  Rel(plugin, api, "Routes")
  Rel(api, game, "Calls")
  Rel(game, prompt, "Builds slice")
  Rel(game, schema, "Parses, toPublicCase")
  Rel(claude, cli, "execFile")
  Rel(plugin, cases, "loadCases reads, parses with CaseSchema")
  Rel(plugin, claude, "Passes claudeRunner into createGameStore")
  Rel(validate, schema, "Uses")
```

- `game.ts` depends on the runner type only; `vitePlugin.ts` builds the store with `claudeRunner` and `loadCases()` (ADR-003). `api.ts` only receives the store.
- `claude.ts` keeps one empty temp dir per session id: Claude Code stores sessions per working directory, so `--resume` must run in the same cwd as the first call (ADR-001).
- `GET /api/cases` returns `{ caseId, title, difficulty }[]` from `store.listCases()` and nothing else; the menu uses it to list playable cases (ADR-008). Difficulty never changes the question cap or token budget.
- Prompt slicing in `suspectPrompt.ts` (ADR-002); subprocess flags in `claude.ts` (ADR-001).
