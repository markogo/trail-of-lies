import { describe, expect, it, vi } from "vitest";

// Importing scripts/generate-case.ts may run its top-level code. Never let that reach Claude or disk.
vi.mock("../src/server/claude", () => ({
  generatorRunner: async () => ({ text: "not json", inputTokens: 1, outputTokens: 1 }),
  cleanupSession: () => undefined,
}));
vi.mock("node:fs", async (orig) => ({
  ...(await orig<typeof import("node:fs")>()),
  writeFileSync: () => undefined,
}));

import { CaseSchema, toPublicCase } from "../src/shared/case";
import { buildSuspectPrompt } from "../src/shared/suspectPrompt";
import { buildGeneratorPrompt, generateCase } from "../src/server/generator";
import { createGameStore } from "../src/server/game";
import { createApiHandler } from "../src/server/api";
import { makeSmallCase } from "./fixtures/smallCase";

const runner = async () => ({ text: "x", inputTokens: 1, outputTokens: 1 });
const levels = ["easy", "medium", "hard"] as const;
const withDifficulty = (d: string) => CaseSchema.parse({ ...makeSmallCase(), difficulty: d });

describe("AC1: difficulty in the schema", () => {
  it("AC1: CaseSchema accepts easy, medium and hard", () => {
    for (const d of levels) expect(CaseSchema.parse({ ...makeSmallCase(), difficulty: d }).difficulty).toBe(d);
  });
  it("AC1: CaseSchema rejects a missing or unknown difficulty", () => {
    const { difficulty: _omit, ...rest } = makeSmallCase();
    expect(CaseSchema.safeParse(rest).success).toBe(false);
    expect(CaseSchema.safeParse({ ...makeSmallCase(), difficulty: "extreme" }).success).toBe(false);
    expect(CaseSchema.safeParse({ ...makeSmallCase(), difficulty: "" }).success).toBe(false);
  });
  it("AC1: toPublicCase includes difficulty", () => {
    for (const d of levels) expect((toPublicCase(withDifficulty(d)) as any).difficulty).toBe(d);
  });
});

describe("AC2: generator prompt per difficulty", () => {
  it("AC2: the default prompt equals the medium prompt and has no difficulty block", () => {
    expect(buildGeneratorPrompt()).toBe(buildGeneratorPrompt("medium"));
    expect(buildGeneratorPrompt("medium")).not.toMatch(/Difficulty:/);
  });
  it("AC2: easy prompt has an Easy block with plain contradiction, outright motive, minor secrets", () => {
    const p = buildGeneratorPrompt("easy");
    expect(p).toMatch(/Difficulty: easy/i);
    expect(p).toMatch(/plain/i);
    expect(p).toMatch(/outright/i);
    expect(p).toMatch(/minor/i);
  });
  it("AC2: hard prompt has a Hard block with combining facts, inferred motive, wrong-motive secret", () => {
    const p = buildGeneratorPrompt("hard");
    expect(p).toMatch(/Difficulty: hard/i);
    expect(p).toMatch(/combin/i);
    expect(p).toMatch(/infer/i);
    expect(p).toMatch(/wrong motive/i);
  });
  it("AC2: every level keeps the two-witness rule and motiveKeyword", () => {
    for (const d of levels) {
      const p = buildGeneratorPrompt(d);
      expect(p).toMatch(/two independent witnesses/i);
      expect(p).toContain("motiveKeyword");
    }
  });
  it("AC2: the prompt sent to the runner carries the requested difficulty", async () => {
    const seen: string[] = [];
    const r = async (req: any) => {
      seen.push(String(req.systemPrompt));
      return { text: JSON.stringify(makeSmallCase()), inputTokens: 1, outputTokens: 1 };
    };
    await generateCase({ runner: r, difficulty: "hard" });
    expect(seen[0]).toMatch(/Difficulty: hard/i);
  });
  it("AC2: generateCase returns the requested difficulty when the JSON omits or mislabels it", async () => {
    const { difficulty: _omit, ...omitted } = makeSmallCase();
    const mislabeled = { ...makeSmallCase(), difficulty: "easy" };
    for (const raw of [omitted, mislabeled]) {
      const r = async () => ({ text: JSON.stringify(raw), inputTokens: 1, outputTokens: 1 });
      expect((await generateCase({ runner: r, difficulty: "hard" })).difficulty).toBe("hard");
    }
  });
  it("AC2: generateCase defaults to medium", async () => {
    const { difficulty: _omit, ...omitted } = makeSmallCase();
    const r = async () => ({ text: JSON.stringify(omitted), inputTokens: 1, outputTokens: 1 });
    expect((await generateCase({ runner: r })).difficulty).toBe("medium");
  });
});

describe("AC3: killer prompt per difficulty", () => {
  const killer = (d: string) => buildSuspectPrompt(withDifficulty(d), "id-b");
  it("AC3: easy killer is nervous and slips", () => {
    expect(killer("easy")).toMatch(/nervous/i);
    expect(killer("easy")).toMatch(/slip/i);
  });
  it("AC3: hard killer is calm, consistent and gives way only on a contradiction", () => {
    const p = killer("hard");
    expect(p).toMatch(/calm/i);
    expect(p).toMatch(/consistent/i);
    expect(p).toMatch(/contradiction/i);
  });
  it("AC3: medium killer has none of those lines", () => {
    expect(killer("medium")).not.toMatch(/nervous|slip|calm|consistent|contradiction/i);
  });
  it("AC3: killer never confesses at every level and still lies", () => {
    for (const d of levels) {
      expect(killer(d)).toMatch(/never confess/i);
      expect(killer(d)).toMatch(/lie/i);
    }
  });
  it("AC3: killer prompts still hide other suspects' secrets, clues and explanation", () => {
    for (const d of levels) {
      const p = killer(d);
      for (const s of ["SECRET-a", "SECRET-c", "CLUE-ONE-TEXT", "CLUE-TWO-TEXT", "EXPLANATION-TEXT"])
        expect(p).not.toContain(s);
    }
  });
  it("AC3: innocent prompts are identical across levels and have no difficulty lines", () => {
    for (const id of ["id-a", "id-c"]) {
      const base = buildSuspectPrompt(withDifficulty("medium"), id);
      expect(buildSuspectPrompt(withDifficulty("easy"), id)).toBe(base);
      expect(buildSuspectPrompt(withDifficulty("hard"), id)).toBe(base);
      expect(base).not.toMatch(/nervous|slip|calm|consistent|contradiction/i);
    }
  });
});

describe("AC4: cases list and generate difficulty", () => {
  const store = () => createGameStore({ cases: [CaseSchema.parse(makeSmallCase())], runner });

  it("AC4: store.listCases returns caseId, title, difficulty and includes added cases", () => {
    const s = store();
    expect(s.listCases()).toEqual([{ caseId: "small", title: "Small Case", difficulty: "medium" }]);
    s.addCase({ ...withDifficulty("hard"), id: "gen-1", title: "Gen One" });
    expect(s.listCases()).toEqual([
      { caseId: "small", title: "Small Case", difficulty: "medium" },
      { caseId: "gen-1", title: "Gen One", difficulty: "hard" },
    ]);
  });

  it("AC4: GET /api/cases returns exactly caseId, title, difficulty", async () => {
    const s = store();
    s.addCase({ ...withDifficulty("easy"), id: "gen-2", title: "Gen Two" });
    const r = await createApiHandler(s)({ method: "GET", url: "/api/cases" });
    expect(r.status).toBe(200);
    expect(r.body).toEqual([
      { caseId: "small", title: "Small Case", difficulty: "medium" },
      { caseId: "gen-2", title: "Gen Two", difficulty: "easy" },
    ]);
    for (const item of r.body) expect(Object.keys(item).sort()).toEqual(["caseId", "difficulty", "title"]);
  });

  it("AC4: generate defaults to medium for no body and {}", async () => {
    const seen: unknown[] = [];
    const h = createApiHandler(store(), {
      generate: async (d: any) => {
        seen.push(d);
        return { ...withDifficulty("medium"), id: "gen-m" };
      },
    });
    expect((await h({ method: "POST", url: "/api/cases/generate" })).status).toBe(200);
    expect((await h({ method: "POST", url: "/api/cases/generate", body: {} })).status).toBe(200);
    expect(seen).toEqual(["medium", "medium"]);
  });

  it("AC4: generate passes an explicit valid difficulty through", async () => {
    const seen: unknown[] = [];
    const h = createApiHandler(store(), {
      generate: async (d: any) => {
        seen.push(d);
        return { ...withDifficulty(d), id: `gen-${d}` };
      },
    });
    for (const d of levels) {
      const r = await h({ method: "POST", url: "/api/cases/generate", body: { difficulty: d } });
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ caseId: `gen-${d}`, title: "Small Case" });
    }
    expect(seen).toEqual(["easy", "medium", "hard"]);
  });

  it("AC4: invalid difficulty returns 400 with a message and does not call generate", async () => {
    let calls = 0;
    const h = createApiHandler(store(), {
      generate: async () => {
        calls++;
        return { ...withDifficulty("medium"), id: "gen-x" };
      },
    });
    for (const bad of ["extreme", "", 5, null, "HARD"]) {
      const r = await h({ method: "POST", url: "/api/cases/generate", body: { difficulty: bad } });
      expect(r.status).toBe(400);
      expect(typeof r.body.message).toBe("string");
    }
    expect(calls).toBe(0);
  });
});

async function loadParse(): Promise<(argv: string[]) => string> {
  const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  try {
    const mod = (await import("../scripts/generate-case")) as any;
    return (argv) => mod.parseDifficultyArg(argv);
  } finally {
    exit.mockRestore();
    err.mockRestore();
    log.mockRestore();
  }
}

describe("AC6: generate script argument", () => {
  it("AC6: defaults to medium", async () => {
    const parseDifficultyArg = await loadParse();
    expect(parseDifficultyArg([])).toBe("medium");
    expect(parseDifficultyArg(["--other"])).toBe("medium");
  });
  it("AC6: parses --difficulty <level>", async () => {
    const parseDifficultyArg = await loadParse();
    for (const d of levels) expect(parseDifficultyArg(["--difficulty", d])).toBe(d);
  });
  it("AC6: an invalid or missing value throws", async () => {
    const parseDifficultyArg = await loadParse();
    expect(() => parseDifficultyArg(["--difficulty", "extreme"])).toThrow();
    expect(() => parseDifficultyArg(["--difficulty"])).toThrow();
  });
});
