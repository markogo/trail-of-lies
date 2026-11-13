// API shape under test (framework-free):
//   createApiHandler(store) => (req: {method: string; url: string; body?: unknown})
//                              => Promise<{status: number; body: any}>
//   POST /api/games            body {caseId?}                  -> 200/201 {gameId, case}
//   POST /api/games/:id/ask    body {suspectId, question}      -> 200 {answer, questionsLeft, tokensUsed}
//   POST /api/games/:id/accuse body {suspectId, motiveId}      -> 200 {correctKiller, correctMotive, solved, solution}
//   Errors -> status 4xx and body {message: string}.
import { describe, expect, it } from "vitest";
import { CaseSchema } from "../src/shared/case";
import { createGameStore } from "../src/server/game";
import { createApiHandler } from "../src/server/api";
import { makeSmallCase } from "./fixtures/smallCase";

function setup() {
  const runner = async () => ({ text: "an answer", inputTokens: 10, outputTokens: 5 });
  const store = createGameStore({ cases: [CaseSchema.parse(makeSmallCase())], runner });
  return createApiHandler(store);
}
const post = (h: ReturnType<typeof setup>, url: string, body: unknown) =>
  h({ method: "POST", url, body });
const FORBIDDEN = ["SECRET-", "ALIBI-", "KNOWS-", "CLUE-", "EXPLANATION", "solution", "clues"];

describe("HTTP API", () => {
  it("AC10: create, ask and accuse; nothing secret leaks before the accusation", async () => {
    const h = setup();
    const created = await post(h, "/api/games", {});
    expect(created.status).toBeGreaterThanOrEqual(200);
    expect(created.status).toBeLessThan(300);
    const { gameId } = created.body;
    expect(gameId).toBeTruthy();
    expect(created.body.case.id).toBe("small");

    const asked = await post(h, `/api/games/${gameId}/ask`, { suspectId: "id-a", question: "hi" });
    expect(asked.status).toBe(200);
    expect(asked.body).toMatchObject({ answer: "an answer", questionsLeft: 19 });

    for (const r of [created, asked]) {
      const json = JSON.stringify(r.body);
      for (const s of FORBIDDEN) expect(json).not.toContain(s);
    }

    const verdict = await post(h, `/api/games/${gameId}/accuse`, { suspectId: "id-b", motiveId: "m2" });
    expect(verdict.status).toBe(200);
    expect(verdict.body).toMatchObject({ correctKiller: true, correctMotive: true, solved: true });
    expect(verdict.body.solution.explanation).toBe("EXPLANATION-TEXT");
  });

  it("AC10: errors return 4xx with a JSON message", async () => {
    const h = setup();
    const { body } = await post(h, "/api/games", {});
    const bad = await post(h, `/api/games/${body.gameId}/ask`, { suspectId: "id-a", question: "" });
    expect(bad.status).toBeGreaterThanOrEqual(400);
    expect(bad.status).toBeLessThan(500);
    expect(typeof bad.body.message).toBe("string");

    const missing = await post(h, "/api/games/nope/ask", { suspectId: "id-a", question: "hi" });
    expect(missing.status).toBeGreaterThanOrEqual(400);
    expect(missing.status).toBeLessThan(500);
    expect(typeof missing.body.message).toBe("string");
  });
});
