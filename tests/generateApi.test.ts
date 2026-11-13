import { describe, expect, it } from "vitest";
import { CaseSchema, type Case } from "../src/shared/case";
import { createGameStore, GameError } from "../src/server/game";
import { createApiHandler } from "../src/server/api";
import { makeSmallCase } from "./fixtures/smallCase";

const runner = async () => ({ text: "x", inputTokens: 1, outputTokens: 1 });
const newCase = (): Case => ({ ...CaseSchema.parse(makeSmallCase()), id: "gen-abc12345" });
const emptyStore = () => createGameStore({ cases: [CaseSchema.parse(makeSmallCase())], runner });

describe("case generator wiring", () => {
  it("AC6: addCase makes the case playable", () => {
    const store = emptyStore();
    store.addCase(newCase());
    const g = store.createGame("gen-abc12345");
    expect(g.case.id).toBe("gen-abc12345");
    expect(g.case.title).toBe("Small Case");
  });

  it("AC7: POST /api/cases/generate returns only caseId and title and the case is playable", async () => {
    const store = emptyStore();
    const h = createApiHandler(store, { generate: async () => newCase() });
    const r = await h({ method: "POST", url: "/api/cases/generate" });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ caseId: "gen-abc12345", title: "Small Case" });
    expect(store.createGame("gen-abc12345").case.id).toBe("gen-abc12345");
  });

  it("AC7: failures return 502 with a message", async () => {
    const h1 = createApiHandler(emptyStore(), {
      generate: async () => {
        throw new GameError(502, "generation failed");
      },
    });
    const r1 = await h1({ method: "POST", url: "/api/cases/generate" });
    expect(r1.status).toBe(502);
    expect(r1.body.message).toBe("generation failed");
    const h2 = createApiHandler(emptyStore(), {
      generate: async () => {
        throw new Error("boom");
      },
    });
    const r2 = await h2({ method: "POST", url: "/api/cases/generate" });
    expect(r2.status).toBe(502);
    expect(typeof r2.body.message).toBe("string");
  });
});
