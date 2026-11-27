# PanSync Agent Rules

## Prompt Logging Requirement (`prompts.md`)

- **Always log new user instructions**: Every time a user sends a new prompt or instruction in this repository, append the exact verbatim instruction (with its sequential `## Prompt N — YYYY-MM-DD HH:MM:SS ±HH:MM` header) to `prompts.md` at the repository root.
- **Keep `prompts.md` saved in the repository**: Stage and commit updates to `prompts.md` alongside any related changes (or in a dedicated commit when an instruction involves no other code changes).

## Team Collaboration — Do Not Modify UI Code

- Other team members are actively updating the website UI.
- **Avoid modifying UI files** (`src/pages/**`, `src/components/**`, `src/App.tsx`, `src/index.css`) unless the user explicitly asks for a UI change.
- Restrict backend/integration work to `/api/**`, `src/data/**`, `src/lib/**`, `src/hooks/**`, `src/store/**`, tests, and configuration files.
