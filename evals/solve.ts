import { execFile } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { CaseSchema } from "../src/shared/case";
import { claudeRunner, parseClaudeResult, sessionDir, cleanupSession } from "../src/server/claude";
import { createGameStore } from "../src/server/game";

const cases = readdirSync("cases")
  .filter((f) => f.endsWith(".json"))
  .map((f) => CaseSchema.parse(JSON.parse(readFileSync(join("cases", f), "utf8"))))
  .sort((a, b) => a.id.localeCompare(b.id));

const detectivePrompt = readFileSync(".claude/agents/detective.md", "utf8").replace(
  /^---\n[\s\S]*?\n---\n/,
  "",
);

let tokens = 0;

const outDir = join("evals", "out", `solve-${new Date().toISOString().replace(/[:.]/g, "-")}`);
mkdirSync(outDir, { recursive: true });

type Log = { lines: string[]; tokens: number };

function runDetective(prompt: string, sessionId: string, resume: boolean, log: Log): Promise<string> {
  const cwd = sessionDir(sessionId);
  const args = [
    "-p",
    prompt,
    "--system-prompt",
    detectivePrompt,
    "--tools",
    "",
    "--model",
    "sonnet",
    "--output-format",
    "json",
    "--setting-sources",
    "",
    "--strict-mcp-config",
    ...(resume ? ["--resume", sessionId] : ["--session-id", sessionId]),
  ];
  return new Promise((resolve, reject) => {
    execFile("claude", args, { cwd, maxBuffer: 10 * 1024 * 1024, timeout: 300_000 }, (err, out) => {
      if (err) return reject(err);
      const r = parseClaudeResult(out);
      tokens += r.inputTokens + r.outputTokens;
      log.tokens += r.inputTokens + r.outputTokens;
      resolve(r.text);
    });
  });
}

function parseAction(text: string): Record<string, string> | undefined {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return undefined;
  try {
    return JSON.parse(m[0]);
  } catch {
    return undefined;
  }
}

type Outcome = { killer: boolean; motive: boolean };
const NONE: Outcome = { killer: false, motive: false };

async function play(n: number): Promise<Outcome> {
  const sessionId = randomUUID();
  const c = cases[n % cases.length]!;
  const log: Log = {
    lines: [
      `# Run ${n}: ${c.id}`,
      "",
      `Case id: ${c.id}`,
      `True solution: killer ${c.solution.killerId}, motive ${c.solution.motiveId}`,
      "",
    ],
    tokens: 0,
  };
  let result = "no accusation";
  try {
    const outcome = await playGame(c, sessionId, log);
    result = `killer ${outcome.killer ? "right" : "wrong"}, motive ${outcome.motive ? "right" : "wrong"}`;
    return outcome;
  } catch (e) {
    result = `failed: ${(e as Error).message}`;
    throw e;
  } finally {
    cleanupSession(sessionId);
    log.lines.push("", `Tokens (suspects + detective): ${log.tokens}`, `Result: ${result}`);
    writeFileSync(join(outDir, `run-${n}-${c.id}.md`), log.lines.join("\n") + "\n");
    summary[n] = `run ${n} case ${c.id} (${c.difficulty}): ${result}, tokens ${log.tokens}`;
  }
}

const summary: string[] = [];

async function playGame(c: (typeof cases)[number], sessionId: string, log: Log): Promise<Outcome> {
  const store = createGameStore({
    cases: [c],
    runner: async (req) => {
      const r = await claudeRunner(req);
      tokens += r.inputTokens + r.outputTokens;
      log.tokens += r.inputTokens + r.outputTokens;
      return r;
    },
  });
  const { gameId, case: pub } = store.createGame(c.id);
  let resume = false;
  let questionsLeft = 20;
  let prompt = `Case file:\n${JSON.stringify(pub, null, 2)}\n\nQuestions left: ${questionsLeft}\nYour move.`;
  for (let turn = 0; turn < 30; turn++) {
    const reply = await runDetective(prompt, sessionId, resume, log);
    resume = true;
    log.lines.push(`## Detective turn ${turn}`, "", "```json", reply, "```", "");
    const action = parseAction(reply);
    let feedback: string;
    if (action?.action === "accuse") {
      log.lines.push(`Final accusation: suspect ${action.suspect}, motive ${action.motive}`, "");
      try {
        const v = store.accuse(gameId, action.suspect ?? "", action.motive ?? "");
        return { killer: v.correctKiller, motive: v.correctMotive };
      } catch (e) {
        feedback = `Error: ${(e as Error).message}`;
        log.lines.push(feedback, "");
      }
    } else if (action?.action === "ask") {
      try {
        const r = await store.ask(gameId, action.suspect ?? "", action.question ?? "");
        questionsLeft = r.questionsLeft;
        feedback = `Q (${action.suspect}): ${action.question}\nA: ${r.answer}`;
        log.lines.push(feedback, "", `Questions left: ${r.questionsLeft}`, "");
      } catch (e) {
        feedback = `Error: ${(e as Error).message}`;
        log.lines.push(feedback, "");
        if (questionsLeft === 0) feedback += " You must accuse now.";
      }
    } else {
      feedback = "Error: reply with exactly one JSON object.";
      log.lines.push(feedback, "");
    }
    prompt = `${feedback}\n\nQuestions left: ${questionsLeft}. Your move.`;
  }
  // never accused: not solved
  return NONE;
}

const results = await Promise.all(
  Array.from({ length: 5 }, (_, i) =>
    play(i).catch((e) => {
      console.log(`game ${i} failed: ${(e as Error).message}`);
      return NONE;
    }),
  ),
);
results.forEach((r, i) => {
  const c = cases[i % cases.length]!;
  const mark = (ok: boolean) => (ok ? "right" : "wrong");
  console.log(`run ${i} case ${c.id} (${c.difficulty}): killer ${mark(r.killer)}, motive ${mark(r.motive)}`);
});
writeFileSync(join(outDir, "summary.md"), `# Solver eval summary\n\n${summary.map((l) => `- ${l}`).join("\n")}\n`);
const solved = results.filter((r) => r.killer && r.motive).length;
console.log(`${solved} of 5 solved`);
console.log(`Total tokens used: ${tokens}`);
console.log(`Transcripts: ${outDir}`);
process.exit(solved < 4 ? 1 : 0);
