---
description: Record an ADR-style decision for a KB project
argument-hint: "<query> <title>"
---

Load the `kb-workflow` skill before doing anything else.

Arguments: $ARGUMENTS

Steps:

1. Parse arguments. `$1` is project query, `$2..` is the human title.
   - If either is missing, error: `Usage: /kb-decide <query> <title>`.
2. Use `~/work-kb` as the KB root. Error if it does not exist.
3. Resolve `$1` to a project.
4. Derive a slug from the title (lowercase, kebab-case, ≤60 chars).
5. Gather decision body content from the user (one batch prompt):
   - **Context** — what triggered this decision.
   - **Decision** — what we chose.
   - **Consequences** — what changes; tradeoffs accepted.
6. Show the user a preview (header + sections) and ask: `Record this decision? [Y/n]`. Default Y.
7. Invoke `kb-curator` with `action: write-decision` and payload:
   - project dir name
   - slug
   - title
   - body (the three sections)
8. The curator computes the next `NNNN` (`max + 1` over `decisions/*.md`, zero-padded to 4 digits), writes the file, and bumps `summary.updated`.
9. Report: `Recorded decision <NNNN-slug>.md for <project>.`

Rules:

- Decisions are immutable. The curator refuses to write if the target file already exists; in that case, derive a different slug or a new number.
- This command never writes; only the curator does.
