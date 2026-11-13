import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type ClaudeRequest = {
  systemPrompt: string;
  question: string;
  sessionId: string;
  resume: boolean;
};
export type ClaudeResult = { text: string; inputTokens: number; outputTokens: number };
export type ClaudeRunner = (req: ClaudeRequest) => Promise<ClaudeResult>;

export function buildClaudeArgs(req: ClaudeRequest, opts: { model?: string } = {}): string[] {
  return [
    "-p",
    req.question,
    "--system-prompt",
    req.systemPrompt,
    "--tools",
    "",
    "--model",
    opts.model ?? "haiku",
    "--output-format",
    "json",
    "--setting-sources",
    "",
    "--strict-mcp-config",
    ...(req.resume ? ["--resume", req.sessionId] : ["--session-id", req.sessionId]),
  ];
}

export function parseClaudeResult(stdout: string): ClaudeResult {
  const j = JSON.parse(stdout);
  if (j.is_error === true) throw new Error("claude reported an error");
  if (j.type !== "result") throw new Error("unexpected claude output type");
  if (typeof j.result !== "string") throw new Error("claude result is not text");
  return {
    text: j.result,
    inputTokens:
      Number(j.usage?.input_tokens ?? 0) +
      Number(j.usage?.cache_creation_input_tokens ?? 0) +
      Number(j.usage?.cache_read_input_tokens ?? 0),
    outputTokens: Number(j.usage?.output_tokens ?? 0),
  };
}

// Claude Code stores sessions per cwd, so --resume needs the same empty dir every time.
const sessionDirs = new Map<string, string>();

export function sessionDir(sessionId: string): string {
  let dir = sessionDirs.get(sessionId);
  if (!dir) {
    dir = mkdtempSync(join(tmpdir(), "trail-claude-"));
    sessionDirs.set(sessionId, dir);
  }
  return dir;
}

export function cleanupSession(sessionId: string): void {
  const dir = sessionDirs.get(sessionId);
  if (!dir) return;
  sessionDirs.delete(sessionId);
  rmSync(dir, { recursive: true, force: true });
}

export function runClaude(args: string[], sessionId: string, timeout = 180_000): Promise<string> {
  const cwd = sessionDir(sessionId);
  return new Promise((resolve, reject) => {
    execFile("claude", args, { cwd, maxBuffer: 10 * 1024 * 1024, timeout }, (err, stdout) =>
      err ? reject(err) : resolve(stdout),
    );
  });
}

export const claudeRunner: ClaudeRunner = async (req) =>
  parseClaudeResult(await runClaude(buildClaudeArgs(req), req.sessionId));

export const generatorRunner: ClaudeRunner = async (req) =>
  parseClaudeResult(
    await runClaude(buildClaudeArgs(req, { model: "sonnet" }), req.sessionId, 180_000),
  );
