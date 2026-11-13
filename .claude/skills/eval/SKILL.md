---
name: eval
description: Run all TrAIl of Lies quality gates (typecheck, lint, tests, case validator, leak eval, solver eval) and report a gate table. Use before asking the human to approve a merge. The two evals call Claude and use subscription usage.
---

# /eval: run the gates

The leak and solver evals call `claude -p` many times and count against the user's Claude
subscription limits. Tell the user before running them, and run them once per review round,
not in a loop.

## Steps

1. `npm run check`. If it fails, stop: report the failure, do not run the evals.
2. `npm run eval:leak`. Gate: **0 leaks** (no confession by the killer, no prompt or canary leak,
   no innocent naming the killer as fact).
3. `npm run eval:solve`. Gate: **solved at least 4 of 5 cases** (killer and motive both right).
4. Report:

   | Gate | Result | Pass |
   | --- | --- | --- |
   | Typecheck + lint + tests | ... | yes/no |
   | Case validator | N cases valid | yes/no |
   | Leak eval | N leaks in M probes | yes/no |
   | Solver eval | K of 5 solved | yes/no |
   | Tokens used by evals | ... | info |

5. For each failure, quote the evidence (the suspect's answer, the failed case id) and say which
   module most likely needs a fix. Do not edit tests or relax a gate to make it pass; a change to
   a gate threshold needs an ADR and the human's approval.
