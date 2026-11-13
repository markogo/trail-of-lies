import { DIFFICULTIES, type Case, type Difficulty } from "../shared/case";
import { GameError, type GameStore } from "./game";

export type ApiRequest = { method: string; url: string; body?: unknown };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ApiResponse = { status: number; body: any };

export function createApiHandler(store: GameStore, deps: { generate?: (difficulty: Difficulty) => Promise<Case> } = {}) {
  return async (req: ApiRequest): Promise<ApiResponse> => {
    try {
      const path = req.url.split("?")[0] ?? "";
      const raw = (req.body ?? {}) as Record<string, unknown>;
      const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");
      const body = {
        caseId: str("caseId") || undefined,
        suspectId: str("suspectId"),
        question: str("question"),
        motiveId: str("motiveId"),
      };
      if (req.method === "GET" && path === "/api/cases") {
        return { status: 200, body: store.listCases() };
      }
      if (req.method === "POST" && path === "/api/cases/generate") {
        if (!deps.generate) return { status: 404, body: { message: "not found" } };
        const d = raw.difficulty === undefined ? "medium" : raw.difficulty;
        if (!DIFFICULTIES.includes(d as Difficulty))
          return { status: 400, body: { message: "difficulty must be easy, medium or hard" } };
        try {
          const c = await deps.generate(d as Difficulty);
          store.addCase(c);
          return { status: 200, body: { caseId: c.id, title: c.title } };
        } catch (e) {
          const message = e instanceof GameError ? e.message : "case generation failed";
          return { status: 502, body: { message } };
        }
      }
      if (req.method === "POST" && path === "/api/games") {
        return { status: 201, body: store.createGame(body.caseId) };
      }
      const m = /^\/api\/games\/([^/]+)\/(ask|accuse)$/.exec(path);
      if (req.method === "POST" && m) {
        const [, id, action] = m as unknown as [string, string, string];
        if (action === "ask") {
          return { status: 200, body: await store.ask(id, body.suspectId, body.question) };
        }
        return { status: 200, body: store.accuse(id, body.suspectId, body.motiveId) };
      }
      return { status: 404, body: { message: "not found" } };
    } catch (e) {
      if (e instanceof GameError) return { status: e.status, body: { message: e.message } };
      return { status: 500, body: { message: "server error" } };
    }
  };
}
