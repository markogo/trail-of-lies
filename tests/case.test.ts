import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CaseSchema, toPublicCase } from "../src/shared/case";
import { validateCase } from "../src/shared/validate";
import { makeSmallCase } from "./fixtures/smallCase";

const lighthouse = () => JSON.parse(readFileSync("cases/lighthouse.json", "utf8"));

describe("case schema", () => {
  it("AC1: CaseSchema parses cases/lighthouse.json with 3 suspects and 4 motives", () => {
    const c = CaseSchema.parse(lighthouse());
    expect(c.suspects).toHaveLength(3);
    expect(c.motives).toHaveLength(4);
    expect(c.solution.killerId).toBeTruthy();
  });

  it("AC1: CaseSchema rejects a case with two suspects", () => {
    const bad = makeSmallCase();
    bad.suspects = bad.suspects.slice(0, 2);
    expect(CaseSchema.safeParse(bad).success).toBe(false);
  });
});

describe("toPublicCase", () => {
  it("AC2: exposes only public fields and no secrets", () => {
    const pub = toPublicCase(CaseSchema.parse(makeSmallCase())) as any;
    expect(Object.keys(pub).sort()).toEqual(
      [
        "briefing",
        "difficulty",
        "id",
        "map",
        "motives",
        "setting",
        "suspects",
        "title",
        "victim",
      ].sort(),
    );
    expect(Object.keys(pub.suspects[0]).sort()).toEqual(
      ["claimedLocationId", "id", "name", "publicStatement", "role"].sort(),
    );
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

describe("validateCase", () => {
  it("AC3: no errors for the lighthouse case", () => {
    expect(validateCase(lighthouse())).toEqual([]);
  });

  it("AC3: no errors for the small fixture", () => {
    expect(validateCase(makeSmallCase())).toEqual([]);
  });

  it("AC3: error when schema fails", () => {
    expect(validateCase({ id: "x" }).length).toBeGreaterThan(0);
  });

  it("AC3: error on duplicate suspect ids", () => {
    const c = makeSmallCase();
    c.suspects[1].id = c.suspects[0].id;
    c.solution.killerId = c.suspects[0].id;
    expect(validateCase(c).length).toBeGreaterThan(0);
  });

  it("AC3: error on duplicate motive ids", () => {
    const c = makeSmallCase();
    c.motives[1].id = c.motives[0].id;
    expect(validateCase(c).length).toBeGreaterThan(0);
  });

  it("AC3: error when killerId is not a suspect", () => {
    const c = makeSmallCase();
    c.solution.killerId = "nobody";
    expect(validateCase(c).length).toBeGreaterThan(0);
  });

  it("AC3: error when motiveId is not a motive", () => {
    const c = makeSmallCase();
    c.solution.motiveId = "nope";
    expect(validateCase(c).length).toBeGreaterThan(0);
  });
});
