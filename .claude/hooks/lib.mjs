// Shared helpers for hook scripts: read the hook JSON from stdin, block with exit 2.
import { readFileSync } from "node:fs";

export function readInput() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

export function block(reason) {
  process.stderr.write(`${reason}\n`);
  process.exit(2);
}

export function filePathOf(input) {
  const t = input.tool_input ?? {};
  return t.file_path ?? t.notebook_path ?? t.path ?? "";
}
