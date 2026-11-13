# ADR-001: Suspects run via headless `claude -p` on the subscription

Status: Accepted
Date: 2026-11-06
Spec: docs/specs/001-play-a-case.md

## Context

Every suspect is played by Claude. The project is local-only and must cost nothing beyond the
user's Claude subscription. No API key may exist in the repo or environment.

## Decision

`src/server/claude.ts` runs `claude -p <question>` through `execFile` with `--system-prompt <suspect
prompt>`, `--tools ""`, `--model haiku`, `--output-format json`, `--setting-sources ""`,
`--strict-mcp-config`, and `--session-id <id>` on the first question or `--resume <id>` after. It runs
from an empty temp dir. One session per suspect per game, and `claude.ts` keeps one empty temp dir per
session id: Claude Code stores sessions per working directory, so `--resume` must run in the same cwd
as the call that created the session. Answer text and token usage are parsed from
the JSON result. The argument builder and parser are pure functions so they are unit-tested without
spawning. No Anthropic SDK, no API key.

## Alternatives considered

- Anthropic SDK / API key: pay-per-token, breaks the subscription-only rule.
- Resend full history every call to a stateless `claude -p`: more tokens, no benefit over sessions.
- Run with default tools and settings: suspects could read files (the case JSON) or load project
  config; `--tools ""`, empty cwd and no setting sources close that.

## Consequences

- Good: no cost beyond subscription; suspects are sandboxed from the filesystem.
- Bad: process spawn latency per question; usage is subject to subscription limits; Haiku only.
- Follow-ups: AC11 argument/parser tests; the `block-risky` hook blocks SDK and API keys.
