# docs

Working documents for planning and tracking this project. Structure:

- **`specs/`** — What to build and why. One file per feature/initiative,
  written before planning starts. Requirements, constraints, out-of-scope notes.
  Not phased, not a task list — just the "what/why."
- **`plans/`** — How to build it. Phased implementation plans, produced by
  `/make-plan` (optionally hardened first with the `grill-me` skill). One file
  per initiative, named `NN-short-name.md` (zero-padded, incrementing —
  `01-auth-flow.md`, `02-resume-upload.md`). If a spec exists for the same
  initiative, the plan links back to it.
- **`progress.md`** — Single running index of every initiative and its status.
  Updated as phases complete during `/do` execution.

## Workflow

1. Non-trivial feature → write `specs/NN-name.md` first (what/why).
2. `/make-plan` → writes `plans/NN-name.md` (how, phased). Link back to the spec.
3. Optionally `/grilling` the plan before executing anything.
4. `/do` executes the plan phase by phase, checking off progress in
   `progress.md` as phases complete.
