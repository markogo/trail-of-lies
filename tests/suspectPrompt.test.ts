import { describe, expect, it } from "vitest";
import { CaseSchema } from "../src/shared/case";
import { buildSuspectPrompt } from "../src/shared/suspectPrompt";
import { makeSmallCase } from "./fixtures/smallCase";

const c = CaseSchema.parse(makeSmallCase());

describe("buildSuspectPrompt", () => {
  it("AC4: contains the suspect's own persona, secret, alibi and knows", () => {
    const p = buildSuspectPrompt(c, "id-a");
    for (const s of ["PERSONA-a", "SECRET-a", "ALIBI-a", "KNOWS-a"]) expect(p).toContain(s);
  });

  it("AC4: never contains other suspects' secrets, clues or the explanation", () => {
    for (const id of ["id-a", "id-b", "id-c"]) {
      const p = buildSuspectPrompt(c, id);
      const others = ["a", "b", "c"].filter((k) => `id-${k}` !== id);
      for (const k of others) expect(p).not.toContain(`SECRET-${k}`);
      for (const s of ["CLUE-ONE-TEXT", "CLUE-TWO-TEXT", "EXPLANATION-TEXT"]) {
        expect(p).not.toContain(s);
      }
    }
  });

  it("AC4: killer is told to lie and never confess", () => {
    const p = buildSuspectPrompt(c, "id-b");
    expect(p).toMatch(/lie/i);
    expect(p).toMatch(/never confess/i);
  });

  it("AC4: innocent is told to hide the secret and the killer id is absent", () => {
    for (const id of ["id-a", "id-c"]) {
      const p = buildSuspectPrompt(c, id);
      expect(p).toMatch(/hide/i);
      expect(p).not.toContain("id-b");
    }
  });
});
