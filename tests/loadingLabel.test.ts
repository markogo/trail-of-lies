import { describe, expect, it } from "vitest";
import { loadingLabel } from "../src/web/format";

describe("loadingLabel (spec 007)", () => {
  it("AC1: ask uses the suspect name", () => {
    expect(loadingLabel("ask", "Mara Quill")).toBe("Mara Quill is thinking…");
  });

  it("AC1: generate, start and accuse have fixed labels", () => {
    expect(loadingLabel("generate")).toBe("Writing a new case…");
    expect(loadingLabel("start")).toBe("Opening the case file…");
    expect(loadingLabel("accuse")).toBe("Weighing the evidence…");
  });
});
