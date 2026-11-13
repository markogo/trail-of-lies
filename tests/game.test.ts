import { describe, expect, it } from "vitest";
import { CaseSchema } from "../src/shared/case";
import { createGameStore } from "../src/server/game";
import { makeSmallCase } from "./fixtures/smallCase";

type Req = { systemPrompt: string; question: string; sessionId: string; resume: boolean };

function setup(tokens: { in: number; out: number } = { in: 10, out: 5 }) {
  const calls: Req[] = [];
  const runner = async (req: Req) => {
    calls.push(req);
    return { text: "an answer", inputTokens: tokens.in, outputTokens: tokens.out };
  };
  const store = createGameStore({ cases: [CaseSchema.parse(makeSmallCase())], runner });
  const { gameId, case: pub } = store.createGame();
  return { store, gameId, pub, calls };
}

const status = async (p: Promise<unknown> | (() => unknown)) => {
  try {
    await (typeof p === "function" ? p() : p);
  } catch (e: any) {
    return e.status as number;
  }
  return undefined;
};
const is4xx = (s: number | undefined) => s !== undefined && s >= 400 && s < 500;

describe("game: createGame and ask", () => {
  it("AC5: createGame returns a game id and the public case", () => {
    const { gameId, pub } = setup();
    expect(gameId).toBeTruthy();
    expect(pub.id).toBe("small");
    expect(JSON.stringify(pub)).not.toContain("SECRET-");
  });

  it("AC5: runner gets the suspect prompt; sessions start, resume, and differ per suspect", async () => {
    const { store, gameId, calls } = setup();
    await store.ask(gameId, "id-a", "q1");
    await store.ask(gameId, "id-a", "q2");
    await store.ask(gameId, "id-b", "q3");
    expect(calls[0].systemPrompt).toContain("SECRET-a");
    expect(calls[0].question).toBe("q1");
    expect(calls[0].resume).toBe(false);
    expect(calls[1].resume).toBe(true);
    expect(calls[1].sessionId).toBe(calls[0].sessionId);
    expect(calls[2].resume).toBe(false);
    expect(calls[2].sessionId).not.toBe(calls[0].sessionId);
    expect(calls[2].systemPrompt).toContain("SECRET-b");
  });

  it("AC6: rejects empty, over-300, and unknown-suspect questions without calling the runner", async () => {
    const { store, gameId, calls } = setup();
    expect(is4xx(await status(store.ask(gameId, "id-a", "")))).toBe(true);
    expect(is4xx(await status(store.ask(gameId, "id-a", "x".repeat(301))))).toBe(true);
    expect(is4xx(await status(store.ask(gameId, "id-zzz", "hi")))).toBe(true);
    expect(calls).toHaveLength(0);
    await store.ask(gameId, "id-a", "x".repeat(300));
    expect(calls).toHaveLength(1);
  });

  it("AC7: questionsLeft counts down and the 21st question is rejected without the runner", async () => {
    const { store, gameId, calls } = setup();
    for (let i = 1; i <= 20; i++) {
      const r = await store.ask(gameId, "id-a", `q${i}`);
      expect(r.questionsLeft).toBe(20 - i);
    }
    expect(is4xx(await status(store.ask(gameId, "id-a", "one more")))).toBe(true);
    expect(calls).toHaveLength(20);
  });

  it("AC8: ledger sums input+output tokens and rejects asks at 100,000", async () => {
    const { store, gameId, calls } = setup({ in: 30000, out: 20000 });
    const r1 = await store.ask(gameId, "id-a", "q1");
    expect(r1.tokensUsed).toBe(50000);
    const r2 = await store.ask(gameId, "id-b", "q2");
    expect(r2.tokensUsed).toBe(100000);
    expect(is4xx(await status(store.ask(gameId, "id-a", "q3")))).toBe(true);
    expect(calls).toHaveLength(2);
  });
});

describe("game: accuse", () => {
  it("AC9: correct accusation is solved and returns the full solution", () => {
    const { store, gameId } = setup();
    const v = store.accuse(gameId, "id-b", "m2");
    expect(v).toMatchObject({ correctKiller: true, correctMotive: true, solved: true });
    expect(v.solution).toMatchObject({ killerId: "id-b", motiveId: "m2" });
    expect(v.solution.explanation).toBe("EXPLANATION-TEXT");
  });

  it("AC9: right killer wrong motive is not solved", () => {
    const { store, gameId } = setup();
    const v = store.accuse(gameId, "id-b", "m1");
    expect(v).toMatchObject({ correctKiller: true, correctMotive: false, solved: false });
  });

  it("AC9: after accusing, ask and a second accuse are rejected", async () => {
    const { store, gameId, calls } = setup();
    store.accuse(gameId, "id-a", "m1");
    expect(is4xx(await status(store.ask(gameId, "id-a", "hi")))).toBe(true);
    expect(is4xx(await status(() => store.accuse(gameId, "id-b", "m2")))).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("AC9: accusing is allowed after the question cap", async () => {
    const { store, gameId } = setup();
    for (let i = 0; i < 20; i++) await store.ask(gameId, "id-a", `q${i}`);
    expect(store.accuse(gameId, "id-b", "m2").solved).toBe(true);
  });
});
