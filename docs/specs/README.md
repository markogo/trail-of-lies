# Specs

Every feature starts as a spec written with the `/spec` skill. No code is written until the human approves the spec.

- **File name:** `NNN-short-name.md`, numbered in order (`001-case-generator.md`).
- **Status:** one of
  - **Draft:** written by the agents and waiting for human review.
  - **Approved:** the human approved it. Tests and implementation can start.
  - **Shipped:** implemented, all gates pass and the human approved the merge.
- **Contents:**
  - problem;
  - user-visible behaviour;
  - acceptance criteria (each one becomes a test);
  - out of scope;
  - affected ADRs and C4 diagrams;
  - gates that must pass.

Flow: `/spec` → human approves → `/adr` and `/c4` if the design changes → test-writer → implementer → reviewer → `/eval` → human approves the merge → status becomes Shipped.
