// PreToolUse guard: blocks destructive shell commands, git commits/pushes (project is local only),
// .env access and API keys (project runs on the Claude subscription only).
import { basename } from "node:path";
import { block, filePathOf, readInput } from "./lib.mjs";

const input = readInput();
const tool = input.tool_name;

const BASH_RULES = [
  [/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|--recursive\s+--force|--force\s+--recursive)\b/, "rm -rf is blocked; delete specific files instead"],
  [/\bgit\s+(-[cC]\s+\S+\s+)*commit\b/, "git commit is blocked: this project is local only, the human commits"],
  [/\bgit\s+(-[cC]\s+\S+\s+)*push\b/, "git push is blocked: this project is local only"],
  [/\bgit\s+reset\s+.*--hard\b/, "git reset --hard is blocked: it discards work"],
  [/\bgit\s+clean\s+.*-[a-zA-Z]*f/, "git clean -f is blocked: it deletes untracked files"],
  [/\bgit\s+checkout\s+(--\s+)?\.(\s|$)/, "git checkout . is blocked: it discards work"],
  [/\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z)?sh\b/, "piping a download into a shell is blocked"],
  [/(^|[\s/'"=<>])\.env(\.[\w-]+)?\b/, ".env files are off limits"],
  [/\bANTHROPIC_API_KEY\s*=|\bexport\s+ANTHROPIC_API_KEY\b|\becho\s+["']?\$\{?ANTHROPIC_API_KEY|sk-ant-|@anthropic-ai\/sdk|\bpip\d?\s+install\s+anthropic\b/, "API keys and the Anthropic SDK are blocked: suspects run on the Claude subscription via `claude -p` (ADR-001)"],
  [/\bnpm\s+publish\b/, "npm publish is blocked"],
  [/\bsudo\b/, "sudo is blocked"],
];

if (tool === "Bash") {
  const cmd = String(input.tool_input?.command ?? "");
  for (const [re, reason] of BASH_RULES) if (re.test(cmd)) block(`Blocked by block-risky hook: ${reason}.`);
} else if (["Edit", "Write", "MultiEdit", "NotebookEdit", "Read"].includes(tool)) {
  const name = basename(filePathOf(input));
  if (/^\.env(\..*)?$/.test(name) && name !== ".env.example")
    block("Blocked by block-risky hook: .env files are off limits.");
  const ti = input.tool_input ?? {};
  const text = [ti.content, ti.new_string, ...(ti.edits ?? []).map((e) => e.new_string)].join("\n");
  const isCode = /\.(ts|js|mjs|cjs|json)$/.test(name) && name !== "package-lock.json";
  if (tool !== "Read" && isCode && /sk-ant-|from\s+["']@anthropic-ai\/sdk|"@anthropic-ai\/sdk"\s*:/.test(text))
    block("Blocked by block-risky hook: no API keys or Anthropic SDK; use the `claude -p` runner (ADR-001).");
}
process.exit(0);
