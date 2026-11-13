import { describe, expect, it } from "vitest";
import { buildClaudeArgs, parseClaudeResult } from "../src/server/claude";

const base = { systemPrompt: "SYS PROMPT", question: "Where were you?", sessionId: "sess-1" };
const after = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

describe("buildClaudeArgs", () => {
  it("AC11: first call uses --session-id and the fixed flags", () => {
    const a = buildClaudeArgs({ ...base, resume: false });
    expect(a).toContain("-p");
    expect(a).toContain("Where were you?");
    expect(after(a, "--system-prompt")).toBe("SYS PROMPT");
    expect(after(a, "--tools")).toBe("");
    expect(after(a, "--model")).toBe("haiku");
    expect(after(a, "--output-format")).toBe("json");
    expect(after(a, "--setting-sources")).toBe("");
    expect(a).toContain("--strict-mcp-config");
    expect(after(a, "--session-id")).toBe("sess-1");
    expect(a).not.toContain("--resume");
  });

  it("AC11: later calls use --resume instead of --session-id", () => {
    const a = buildClaudeArgs({ ...base, resume: true });
    expect(after(a, "--resume")).toBe("sess-1");
    expect(a).not.toContain("--session-id");
  });
});

describe("parseClaudeResult", () => {
  it("AC11: inputTokens sums input + cache creation + cache read tokens", () => {
    const out = JSON.stringify({
      type: "result",
      result: "I was asleep.",
      usage: {
        input_tokens: 120,
        cache_creation_input_tokens: 700,
        cache_read_input_tokens: 5000,
        output_tokens: 30,
      },
    });
    expect(parseClaudeResult(out)).toEqual({
      text: "I was asleep.",
      inputTokens: 5820,
      outputTokens: 30,
    });
  });

  it("AC11: missing cache fields count as 0", () => {
    const out = JSON.stringify({
      type: "result",
      result: "I was asleep.",
      usage: { input_tokens: 120, output_tokens: 30 },
    });
    expect(parseClaudeResult(out)).toEqual({
      text: "I was asleep.",
      inputTokens: 120,
      outputTokens: 30,
    });
  });
});
