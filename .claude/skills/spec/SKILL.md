---
name: spec
description: Write a feature spec for TrAIl of Lies in docs/specs/NNN-<slug>.md with testable acceptance criteria, then get the human's approval. Use when starting any new feature, before design, tests or code.
argument-hint: <feature idea>
---

# /spec: write a feature spec

The spec is the contract for the rest of the workflow: the test-writer turns its acceptance
criteria into tests, and the reviewer checks the diff against it. Write it so both can work from
the spec alone.

## Steps

1. Read `CLAUDE.md` and the existing specs in `docs/specs/` to pick the next number (`001`, `002`, ...).
2. Read the code the feature touches, so the spec names real modules and types.
3. Write `docs/specs/NNN-<slug>.md` with the template below. Keep it to one page.
4. Every acceptance criterion must be testable without calling Claude (use the fake runner),
   except criteria that belong to an eval gate; mark those `[eval]`.
5. Show the human a short summary and ask: **"Approve this spec? (yes / changes)"**. Stop and wait.
6. On approval, set `Status: Approved (YYYY-MM-DD)`. If the human asked for changes, apply them and
   show the updated spec again.

## Template

```markdown
# Spec NNN: <Feature name>

Status: Draft | Approved (YYYY-MM-DD)

## Problem
What is wrong or missing today, from the player's or developer's point of view.

## Goal
One or two sentences: what is true when this ships.

## Non-goals
What this feature deliberately does not do (protects scope).

## User stories
- As a <player | developer>, I want <...> so that <...>.

## Acceptance criteria
- AC1: Given <state>, when <action>, then <observable result>.
- AC2: ...
- AC5 [eval]: <criterion checked by an eval gate>.

## Design notes
Modules touched, new types, data flow. Point to ADRs that need writing.

## Gates affected
Which of: unit tests, case validator, leak eval, solver eval, token budget.

## Risks
Risk, and how we detect or cut it.
```
