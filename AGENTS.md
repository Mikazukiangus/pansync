# PanSync Agent Rules

## Prompt Logging Requirement (`prompts.md`)

- **Always log new user instructions**: Every time a user sends a new prompt or instruction in this repository, append the exact verbatim instruction (with its sequential `## Prompt N — YYYY-MM-DD HH:MM:SS ±HH:MM` header) to `prompts.md` at the repository root.
- **Keep `prompts.md` saved in the repository**: Stage, commit, and push updates to `prompts.md` alongside any related changes (or in a dedicated `docs: record prompt in prompts.md` commit when an instruction involves no other code changes).
