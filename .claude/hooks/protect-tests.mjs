// PreToolUse guard for the implementer agent: tests are the spec, so it may not edit them.
import { relative, resolve } from "node:path";
import { block, filePathOf, readInput } from "./lib.mjs";

const input = readInput();
const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const file = filePathOf(input);
if (file) {
  const rel = relative(root, resolve(input.cwd ?? root, file));
  if (rel === "tests" || rel.startsWith("tests/") || /\.test\.[cm]?[jt]s$/.test(rel))
    block(`Blocked by protect-tests hook: the implementer may not edit tests (${rel}). Make the code pass the tests; if a test is wrong, stop and report it.`);
}
process.exit(0);
