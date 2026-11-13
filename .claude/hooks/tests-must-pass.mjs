// Stop / SubagentStop: Claude may not finish while the test suite fails.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { readInput } from "./lib.mjs";

const input = readInput();
const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
// Second attempt in a row: let Claude stop so it can report, instead of looping forever.
if (input.stop_hook_active) process.exit(0);

const testsDir = resolve(root, "tests");
const hasTests =
  existsSync(testsDir) && readdirSync(testsDir, { recursive: true }).some((f) => /\.test\.ts$/.test(String(f)));
const vitest = resolve(root, "node_modules/.bin/vitest");
if (!hasTests || !existsSync(vitest)) process.exit(0);

try {
  execFileSync(vitest, ["run", "--reporter=dot"], { cwd: root, stdio: "pipe", encoding: "utf8", timeout: 120000 });
} catch (e) {
  const out = `${e.stdout ?? ""}${e.stderr ?? ""}`.trim().split("\n").slice(-40).join("\n");
  process.stderr.write(`tests are failing, fix them before finishing (never by editing the tests):\n${out}\n`);
  process.exit(2);
}
process.exit(0);
