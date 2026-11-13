// PostToolUse: format the edited file, then lint and typecheck TypeScript. Exit 2 feeds errors back to Claude.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { filePathOf, readInput } from "./lib.mjs";

const input = readInput();
const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const file = filePathOf(input);
if (!file) process.exit(0);
const abs = resolve(input.cwd ?? root, file);
const rel = relative(root, abs);
if (rel.startsWith("..") || rel.includes("node_modules") || !existsSync(abs)) process.exit(0);

const bin = (name) => resolve(root, "node_modules/.bin", name);
const run = (cmd, args) => {
  try {
    execFileSync(cmd, args, { cwd: root, stdio: "pipe", encoding: "utf8" });
    return "";
  } catch (e) {
    return `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(e.message);
  }
};

if (/\.(ts|js|mjs|json|md|html|css)$/.test(rel) && existsSync(bin("prettier"))) {
  run(bin("prettier"), ["--write", "--log-level", "warn", abs]);
}

if (/\.ts$/.test(rel)) {
  const problems = [];
  const lint = existsSync(bin("eslint")) ? run(bin("eslint"), [abs]) : "";
  if (lint) problems.push(`eslint ${rel}:\n${lint}`);
  const types = existsSync(bin("tsc")) ? run(bin("tsc"), ["--noEmit", "-p", root]) : "";
  if (types) problems.push(`tsc --noEmit:\n${types.split("\n").slice(0, 40).join("\n")}`);
  if (problems.length) {
    process.stderr.write(`post-edit hook found problems, fix them:\n\n${problems.join("\n\n")}\n`);
    process.exit(2);
  }
}
process.exit(0);
