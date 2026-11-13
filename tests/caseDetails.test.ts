import { describe, expect, it } from "vitest";
import { CaseSchema, toPublicCase, type PublicCase } from "../src/shared/case";
import { makeSmallCase } from "./fixtures/smallCase";

const pub = (): PublicCase => toPublicCase(CaseSchema.parse(makeSmallCase()));

describe("caseDetails", () => {
  it("AC1: returns exactly the popover keys with the public case's values", async () => {
    const { caseDetails } = await import("../src/web/format");
    const c = pub();
    const d = caseDetails(c);
    expect(Object.keys(d).sort()).toEqual(
      ["briefing", "motives", "setting", "suspects", "title", "victim"].sort(),
    );
    expect(d.title).toBe(c.title);
    expect(d.setting).toBe(c.setting);
    expect(d.victim).toBe(c.victim);
    expect(d.briefing).toBe(c.briefing);
  });

  it("AC2: suspects and motive labels in case order, no ids, no other keys", async () => {
    const { caseDetails } = await import("../src/web/format");
    const c = pub();
    const d = caseDetails(c);
    expect(d.suspects).toEqual(
      c.suspects.map((s) => ({ name: s.name, role: s.role, publicStatement: s.publicStatement })),
    );
    for (const s of d.suspects) {
      expect(Object.keys(s).sort()).toEqual(["name", "publicStatement", "role"]);
    }
    expect(d.motives).toEqual(c.motives.map((m) => m.label));
    expect(JSON.stringify(d)).not.toMatch(/id-[abc]|"m[1-4]"|"small"/);
  });

  it("AC2: an extra field on PublicCase does not reach the output", async () => {
    const { caseDetails } = await import("../src/web/format");
    const c = pub();
    const extended = {
      ...c,
      extraTop: "LEAK-TOP",
      suspects: c.suspects.map((s) => ({ ...s, extraSuspect: "LEAK-SUSPECT" })),
    } as unknown as PublicCase;
    const d = caseDetails(extended);
    expect(Object.keys(d)).not.toContain("extraTop");
    expect(JSON.stringify(d)).not.toContain("LEAK-");
  });
});
