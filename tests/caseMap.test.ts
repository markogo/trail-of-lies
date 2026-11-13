import { describe, expect, it } from "vitest";
import { CaseSchema, toPublicCase } from "../src/shared/case";
import { validateCase } from "../src/shared/validate";
import { mapView } from "../src/web/format";
import { buildGeneratorPrompt, generateCase } from "../src/server/generator";
import type { ClaudeRequest } from "../src/server/claude";
import { makeSmallCase } from "./fixtures/smallCase";

const loc = (i: number, extra: Record<string, unknown> = {}) => ({
  id: `l${i}`,
  name: `Place ${i}`,
  x: i * 10,
  y: i * 10,
  ...extra,
});

describe("case map schema (spec 005 AC1)", () => {
  it("AC1: the small fixture with a map parses and keeps map and claimedLocationId", () => {
    const c = CaseSchema.parse(makeSmallCase()) as any;
    expect(c.map.locations).toHaveLength(4);
    expect(c.map.victimLocationId).toBe("loc-stairs");
    expect(c.suspects[0].claimedLocationId).toBe("loc-jetty");
  });

  it("AC1: rejects a case without a map", () => {
    const c = makeSmallCase();
    delete c.map;
    expect(CaseSchema.safeParse(c).success).toBe(false);
  });

  it("AC1: rejects a suspect without claimedLocationId", () => {
    const c = makeSmallCase();
    delete c.suspects[0].claimedLocationId;
    expect(CaseSchema.safeParse(c).success).toBe(false);
  });

  it("AC1: rejects 2 locations and 9 locations, accepts 3 and 8", () => {
    const withN = (n: number) => {
      const c = makeSmallCase();
      c.map.locations = Array.from({ length: n }, (_, i) => loc(i + 1));
      c.map.victimLocationId = "l1";
      c.suspects.forEach((s: any) => (s.claimedLocationId = "l1"));
      return c;
    };
    expect(CaseSchema.safeParse(withN(2)).success).toBe(false);
    expect(CaseSchema.safeParse(withN(9)).success).toBe(false);
    expect(CaseSchema.safeParse(withN(3)).success).toBe(true);
    expect(CaseSchema.safeParse(withN(8)).success).toBe(true);
  });

  it("AC1: rejects x or y outside 0..100 and accepts the bounds 0 and 100", () => {
    const set = (patch: Record<string, number>) => {
      const c = makeSmallCase();
      Object.assign(c.map.locations[0], patch);
      return CaseSchema.safeParse(c).success;
    };
    expect(set({ x: -1 })).toBe(false);
    expect(set({ x: 101 })).toBe(false);
    expect(set({ y: -0.5 })).toBe(false);
    expect(set({ y: 100.5 })).toBe(false);
    expect(set({ x: 0, y: 100 })).toBe(true);
    expect(set({ x: 100, y: 0 })).toBe(true);
  });
});

describe("validateCase map rules (spec 005 AC2)", () => {
  it("AC2: the fixture map is valid", () => {
    expect(validateCase(makeSmallCase())).toEqual([]);
  });

  it("AC2: error on duplicate location ids", () => {
    const c = makeSmallCase();
    c.map.locations[1].id = c.map.locations[0].id;
    expect(validateCase(c).length).toBeGreaterThan(0);
  });

  it("AC2: error when victimLocationId is not a location", () => {
    const c = makeSmallCase();
    c.map.victimLocationId = "nowhere";
    expect(validateCase(c).length).toBeGreaterThan(0);
  });

  it("AC2: error when a suspect's claimedLocationId is not a location", () => {
    const c = makeSmallCase();
    c.suspects[2].claimedLocationId = "nowhere";
    expect(validateCase(c).length).toBeGreaterThan(0);
  });

  it("AC2: error when a location name contains the killer's full name", () => {
    const c = makeSmallCase();
    c.suspects[1].name = "Bob Stone";
    c.map.locations[1].name = "bob stone's study";
    expect(validateCase(c).length).toBeGreaterThan(0);
  });

  it("AC2: error when a location name contains an innocent suspect's name (not only the killer's)", () => {
    const c = makeSmallCase();
    c.map.locations[0].name = "Alice's boat"; // Alice is innocent (killer is Bob)
    expect(validateCase(c).length).toBeGreaterThan(0);
  });

  it("AC2: error when a location name contains a name word of 3+ letters, case-insensitive", () => {
    const c = makeSmallCase();
    c.suspects[0].name = "Mara Quill";
    c.map.locations[0].name = "Mara's boat";
    expect(validateCase(c).length).toBeGreaterThan(0);
    const d = makeSmallCase();
    d.suspects[0].name = "Mara Quill";
    d.map.locations[0].name = "THE QUILL SHED";
    expect(validateCase(d).length).toBeGreaterThan(0);
  });

  it("AC2: short name words (under 3 letters) alone do not trigger the name rule", () => {
    const c = makeSmallCase();
    c.suspects[0].name = "Al Quill";
    c.map.locations[0].name = "Alcove Hall";
    c.map.locations[2].name = "Cellar Al"; // 'Al' is only 2 letters
    const errs = validateCase(c);
    expect(errs).toEqual([]);
  });
});

describe("validateCase whole-word names (spec 005 AC2, tightened)", () => {
  it("AC2: 'Grand hall' is not rejected for a suspect named Tobias Rand", () => {
    const c = makeSmallCase();
    c.suspects[0].name = "Tobias Rand";
    c.map.locations[0].name = "Grand hall";
    expect(validateCase(c)).toEqual([]);
  });

  it("AC2: 'Turnpike road' is not rejected for a suspect named Edwin Pike", () => {
    const c = makeSmallCase();
    c.suspects[0].name = "Edwin Pike";
    c.map.locations[0].name = "Turnpike road";
    expect(validateCase(c)).toEqual([]);
  });

  it('AC2: "Rand\'s shed" is rejected for a suspect named Tobias Rand', () => {
    const c = makeSmallCase();
    c.suspects[0].name = "Tobias Rand";
    c.map.locations[0].name = "Rand's shed";
    expect(validateCase(c).length).toBeGreaterThan(0);
  });
});

describe("validateCase two witnesses (spec 005 AC2b)", () => {
  it("AC2b: error when only one innocent mentions the killer by name", () => {
    const c = makeSmallCase();
    c.suspects[2].knows = ["KNOWS-c saw nobody"];
    expect(validateCase(c).length).toBeGreaterThan(0);
  });

  it("AC2b: error when no innocent mentions the killer by name", () => {
    const c = makeSmallCase();
    c.suspects[0].knows = ["KNOWS-a nothing"];
    c.suspects[2].knows = ["KNOWS-c nothing"];
    expect(validateCase(c).length).toBeGreaterThan(0);
  });

  it("AC2b: no error when two innocents mention the killer (full name, or a 3+ letter name word, any case)", () => {
    const c = makeSmallCase();
    c.suspects[1].name = "Robert Stone";
    c.suspects[0].knows = ["KNOWS-a saw Robert Stone by the stairs, revenge"];
    c.suspects[2].knows = ["KNOWS-c heard STONE shouting about revenge"];
    expect(validateCase(c)).toEqual([]);
  });

  it("AC2b: the killer mentioning himself does not count", () => {
    const c = makeSmallCase();
    c.suspects[2].knows = ["KNOWS-c nothing"];
    c.suspects[1].knows = ["KNOWS-b Bob was at the stairs"];
    expect(validateCase(c).length).toBeGreaterThan(0);
  });

  it("AC2b: mentions must be whole words (Bobby is not Bob)", () => {
    const c = makeSmallCase();
    c.suspects[2].knows = ["KNOWS-c saw Bobby near the stairs"];
    expect(validateCase(c).length).toBeGreaterThan(0);
  });
});

describe("toPublicCase map (spec 005 AC3)", () => {
  it("AC3: includes map and claimedLocationId, never secrets or the solution", () => {
    const pub = toPublicCase(CaseSchema.parse(makeSmallCase())) as any;
    expect(pub.map).toEqual(makeSmallCase().map);
    expect(Object.keys(pub.map).sort()).toEqual(["locations", "victimLocationId"]);
    expect(pub.suspects.map((s: any) => s.claimedLocationId)).toEqual([
      "loc-jetty",
      "loc-kitchen",
      "loc-cellar",
    ]);
    for (const s of pub.suspects) {
      expect(Object.keys(s).sort()).toEqual(
        ["claimedLocationId", "id", "name", "publicStatement", "role"].sort(),
      );
    }
    const json = JSON.stringify(pub);
    for (const s of [
      "SECRET-",
      "ALIBI-",
      "KNOWS-",
      "CLUE-",
      "EXPLANATION",
      "solution",
      "killerId",
    ]) {
      expect(json).not.toContain(s);
    }
  });
});

describe("mapView (spec 005 AC4)", () => {
  const pub = () => toPublicCase(CaseSchema.parse(makeSmallCase()));

  it("AC4: one point per location in order with exact keys", () => {
    const v = mapView(pub());
    expect(v.map((p) => p.name)).toEqual(["The Jetty", "Kitchen", "Cellar", "Back Stairs"]);
    for (const p of v)
      expect(Object.keys(p).sort()).toEqual(["name", "suspects", "victim", "x", "y"]);
    expect(v[0]).toEqual({
      name: "The Jetty",
      x: 10,
      y: 80,
      victim: false,
      suspects: [{ name: "Alice", initials: "A" }],
    });
  });

  it("AC4: victim is true only at victimLocationId", () => {
    const v = mapView(pub());
    expect(v.map((p) => p.victim)).toEqual([false, false, false, true]);
    expect(v[3]!.suspects).toEqual([]);
  });

  it("AC4: suspects sharing a location are listed in case order with initials; suspect keys are exact", () => {
    const c = makeSmallCase();
    c.suspects[0].name = "Alice Brown";
    c.suspects[1].name = "Dr. Bob Green";
    c.suspects[2].name = "Carol Day";
    c.suspects[0].claimedLocationId = "loc-cellar";
    c.suspects[1].claimedLocationId = "loc-cellar";
    c.suspects[2].claimedLocationId = "loc-cellar";
    const v = mapView(toPublicCase(CaseSchema.parse(c)));
    const cellar = v.find((p) => p.name === "Cellar")!;
    expect(cellar.suspects).toEqual([
      { name: "Alice Brown", initials: "AB" },
      { name: "Dr. Bob Green", initials: "BG" },
      { name: "Carol Day", initials: "CD" },
    ]);
    for (const s of cellar.suspects) expect(Object.keys(s).sort()).toEqual(["initials", "name"]);
    expect(v.find((p) => p.name === "The Jetty")!.suspects).toEqual([]);
  });

  it("AC4: the output contains no secrets or ids", () => {
    const json = JSON.stringify(mapView(pub()));
    for (const s of ["SECRET-", "ALIBI-", "loc-", "id-", "killerId"]) expect(json).not.toContain(s);
  });
});

describe("generator map (spec 005 AC6)", () => {
  function fake(answers: string[]) {
    const calls: ClaudeRequest[] = [];
    const runner = async (req: ClaudeRequest) => {
      calls.push(req);
      const text = answers[Math.min(calls.length - 1, answers.length - 1)] as string;
      return { text, inputTokens: 1, outputTokens: 1 };
    };
    return { runner, calls };
  }

  it("AC6: the prompt asks for the map, locations and claimedLocationId", () => {
    const p = buildGeneratorPrompt();
    expect(p).toMatch(/map/i);
    expect(p).toMatch(/locations/i);
    expect(p).toMatch(/claimedLocationId/);
    expect(p).toMatch(/victimLocationId/);
  });

  it("AC6: a case with an invalid map is retried in the same session with the map error", async () => {
    const bad = makeSmallCase();
    bad.map.victimLocationId = "nowhere-at-all";
    const { runner, calls } = fake([JSON.stringify(bad), JSON.stringify(makeSmallCase())]);
    const c = await generateCase({ runner, maxAttempts: 3 });
    expect(validateCase(c)).toEqual([]);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.resume).toBe(true);
    expect(calls[1]!.sessionId).toBe(calls[0]!.sessionId);
    expect(calls[1]!.question).toMatch(/victimLocationId|victim location|map/i);
  });

  it("AC6: a case with no map at all is retried", async () => {
    const bad = makeSmallCase();
    delete bad.map;
    const { runner, calls } = fake([JSON.stringify(bad), JSON.stringify(makeSmallCase())]);
    await generateCase({ runner, maxAttempts: 3 });
    expect(calls).toHaveLength(2);
    expect(calls[1]!.question).toMatch(/map/i);
  });
});

describe("motiveKeyword (spec 005 AC2c)", () => {
  it("AC2c: the fixture with a valid motiveKeyword has no validation errors", () => {
    expect(validateCase(makeSmallCase())).toEqual([]);
  });

  it("AC2c: CaseSchema requires solution.motiveKeyword, a non-empty string", () => {
    expect(CaseSchema.safeParse(makeSmallCase()).success).toBe(true);
    const missing = makeSmallCase();
    delete missing.solution.motiveKeyword;
    expect(CaseSchema.safeParse(missing).success).toBe(false);
    const empty = makeSmallCase();
    empty.solution.motiveKeyword = "";
    expect(CaseSchema.safeParse(empty).success).toBe(false);
    const num = makeSmallCase();
    num.solution.motiveKeyword = 5;
    expect(CaseSchema.safeParse(num).success).toBe(false);
  });

  it("AC2c: error when the keyword is not a whole word in the true motive's label", () => {
    const c = makeSmallCase();
    c.solution.motiveKeyword = "reven";
    expect(validateCase(c).length).toBeGreaterThan(0);
  });

  it("AC2c: the whole-word match in the true label is case-insensitive", () => {
    const c = makeSmallCase();
    c.solution.motiveKeyword = "REVENGE";
    expect(validateCase(c)).toEqual([]);
  });

  it("AC2c: error when the keyword also appears in another motive's label", () => {
    const c = makeSmallCase();
    c.motives[0].label = "Money and revenge";
    expect(validateCase(c).length).toBeGreaterThan(0);
  });

  it("AC2c: error when only one innocent has the keyword as a whole word in knows", () => {
    const c = makeSmallCase();
    c.suspects[2].knows = ["KNOWS-c saw Bob near the stairs"];
    expect(validateCase(c).length).toBeGreaterThan(0);
  });

  it("AC2c: the killer's knows does not count toward the two innocents", () => {
    const c = makeSmallCase();
    c.suspects[2].knows = ["KNOWS-c saw Bob near the stairs"];
    c.suspects[1].knows = ["KNOWS-b revenge revenge"];
    expect(validateCase(c).length).toBeGreaterThan(0);
  });

  it("AC2c: the keyword in knows must be a whole word (revenges is not revenge)", () => {
    const c = makeSmallCase();
    c.suspects[2].knows = ["KNOWS-c saw Bob near the stairs, revenges everywhere"];
    expect(validateCase(c).length).toBeGreaterThan(0);
  });

  it("AC2c: toPublicCase never contains the key motiveKeyword or its value", () => {
    // Unique value: the real keyword also appears in a public motive label, legitimately.
    const c = makeSmallCase();
    c.solution.motiveKeyword = "ZZKEYWORDVALUE";
    const json = JSON.stringify(toPublicCase(CaseSchema.parse(c)));
    expect(json).not.toContain("motiveKeyword");
    expect(json).not.toContain("ZZKEYWORDVALUE");
  });

  it("AC2c: the generator prompt mentions motiveKeyword and that the killer's secret must not match a wrong motive", () => {
    const p = buildGeneratorPrompt();
    expect(p).toMatch(/motiveKeyword/);
    expect(p).toMatch(
      /killer'?s?\b[^.]*secret[^.]*(must not|never|not)[^.]*(match|fit)[^.]*(wrong|other|incorrect)[^.]*motive/i,
    );
  });
});
