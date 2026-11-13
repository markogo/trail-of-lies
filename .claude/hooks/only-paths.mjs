// PreToolUse guard for scoped agents: file edits only under the allowed prefixes given as args.
// Usage: node only-paths.mjs docs/ tests/
import { relative, resolve } from "node:path";
import { block, filePathOf, readInput } from "./lib.mjs";

const allowed = process.argv.slice(2);
const input = readInput();
const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const file = filePathOf(input);
if (file) {
  const rel = relative(root, resolve(input.cwd ?? root, file));
  if (!allowed.some((p) => rel === p.replace(/\/$/, "") || rel.startsWith(p)))
    block(`Blocked by only-paths hook: this agent may only edit ${allowed.join(", ")} (tried ${rel}).`);
}
process.exit(0);
