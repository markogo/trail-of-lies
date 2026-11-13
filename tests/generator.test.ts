import { describe, expect, it } from "vitest";
import { buildGeneratorPrompt, extractJson, generateCase } from "../src/server/generator";
import { GameError } from "../src/server/game";
import { validateCase } from "../src/shared/validate";
import type { ClaudeRequest } from "../src/server/claude";
import { makeSmallCase } from "./fixtures/smallCase";

const good = () => JSON.stringify(makeSmallCase());
function fake(answers: string[]) {
  const calls: ClaudeRequest[] = [];
  const runner = async (req: ClaudeRequest) => {
    calls.push(req);
    const text = answers[Math.min(calls.length - 1, answers.length - 1)] as string;
    return { text, inputTokens: 1, outputTokens: 1 };
  };
  return { runner, calls };
}

describe("generator", () => {
  it("AC1: extracts JSON from a fence or prose and returns a valid case", async () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here you go: {"a":1} enjoy')).toEqual({ a: 1 });
    expect(() => extractJson("no json here")).toThrow();
    const { runner } = fake(["Sure!\n```json\n" + good() + "\n```"]);
    const c = await generateCase({ runner });
    expect(validateCase(c)).toEqual([]);
  });

  it("AC2: retries in the same session with the errors and stops at the first valid case", async () => {
    const { runner, calls } = fake(["not json at all", '{"id":"x"}', good(), good()]);
    const c = await generateCase({ runner, maxAttempts: 5 });
    expect(validateCase(c)).toEqual([]);
    expect(calls).toHaveLength(3);
    expect(calls[0]!.resume).toBe(false);
    expect(calls[1]!.resume).toBe(true);
    expect(calls[2]!.resume).toBe(true);
    expect(calls[1]!.sessionId).toBe(calls[0]!.sessionId);
    expect(calls[2]!.sessionId).toBe(calls[0]!.sessionId);
    expect(calls[1]!.question).toMatch(/not valid json|no json object found/i);
    expect(calls[2]!.question).toMatch(/schema: suspects/i);
  });

  it("AC3: throws GameError 502 after maxAttempts and stops calling the runner", async () => {
    const { runner, calls } = fake(["garbage"]);
    const err = await generateCase({ runner, maxAttempts: 2 }).catch((e) => e);
    expect(err).toBeInstanceOf(GameError);
    expect(err.status).toBe(502);
    expect(calls).toHaveLength(2);
    const d = fake(["garbage"]);
    await generateCase({ runner: d.runner }).catch(() => undefined);
    expect(d.calls).toHaveLength(3);
  });

  it("AC3: a runner throw counts as a failed attempt", async () => {
    let n = 0;
    const runner = async () => {
      n++;
      throw new Error("boom");
    };
    const err = await generateCase({ runner, maxAttempts: 2 }).catch((e) => e);
    expect(err).toBeInstanceOf(GameError);
    expect(err.status).toBe(502);
    expect(n).toBe(2);
  });

  it("AC4: assigns a fresh gen-<random> id, ignoring the generated one", async () => {
    const a = await generateCase({ runner: fake([good()]).runner });
    const b = await generateCase({ runner: fake([good()]).runner });
    expect(a.id).toMatch(/^gen-.+/);
    expect(a.id).not.toBe("small");
    expect(a.id).not.toBe(b.id);
  });

  it("AC5: the system prompt states the shape and fairness rules", () => {
    const p = buildGeneratorPrompt();
    expect(p).toMatch(/3 suspects|three suspects/i);
    expect(p).toMatch(/4 motives|four motives/i);
    expect(p).toMatch(/clues/i);
    expect(p).toMatch(/solution/i);
    expect(p).toMatch(/knows/i);
    expect(p).toMatch(/alibi/i);
    expect(p).toMatch(/secret/i);
    expect(p).toMatch(/motive/i);
  });
});
