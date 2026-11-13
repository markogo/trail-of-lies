---
name: adr
description: Record an architecture decision for TrAIl of Lies in docs/adr/ADR-NNN-<slug>.md (context, decision, alternatives, consequences). Use when a spec forces a design choice or an existing decision changes.
argument-hint: <decision title>
---

# /adr: record an architecture decision

1. List `docs/adr/` and take the next number (`ADR-001`, `ADR-002`, ...).
2. If the decision replaces an earlier one, set the old ADR's status to
   `Superseded by ADR-NNN` and link both ways. Never delete an ADR.
3. Write `docs/adr/ADR-NNN-<slug>.md` with the template. One decision per ADR, under a page.
4. Link the ADR from the spec's "Design notes" section.
5. If the decision changes a container or component, run `/c4` afterwards.

## Template

```markdown
# ADR-NNN: <Decision in a few words>

Status: Proposed | Accepted | Superseded by ADR-XXX
Date: YYYY-MM-DD
Spec: docs/specs/NNN-<slug>.md (if any)

## Context
The forces at play: constraints (subscription only, local only, small scope), requirements, facts
measured so far.

## Decision
What we do, stated plainly.

## Alternatives considered
- <Option>: why not.

## Consequences
- Good: ...
- Bad / accepted trade-offs: ...
- Follow-ups: tests, evals or gates that enforce this decision.
```
