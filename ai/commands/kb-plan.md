---
description: Generate an implementation plan doc for a KB project from prior explorations
argument-hint: "<query> <name>"
---

Load the `kb-workflow` skill before doing anything else.

Arguments: $ARGUMENTS

Steps:

1. Parse arguments. `$1` is project query, `$2..` is the plan name (used to derive the slug and title).
   - If either is missing, error: `Usage: /kb-plan <query> <name>`.
2. Resolve `<KB_ROOT>`. Error if missing.
3. Resolve `$1` to a project.
4. Derive a slug from the name (lowercase, kebab-case, ≤60 chars).
5. Compute filename: `plans/YYYY-MM-DD--<slug>.md`. If it already exists, error: `Plan already exists at <path>.`
6. **Read source material**:
   - All explorations in the project (any status).
   - All decisions.
   - `summary.md`.
7. **Synthesize a plan** matching the template in the `kb-workflow` skill:
   - Summary (1-3 sentences).
   - Scope.
   - Out of scope.
   - Steps (numbered, in execution order).
   - Risks & open questions.
   - Use `<repo-alias>/path:line` citations for every concrete reference to existing code.
8. Show the user a preview and ask: `Write plan to <path>? [Y/n]`. Default Y.
9. Invoke `kb-curator` with `action: write-plan` and payload:
   - project dir name
   - filename
   - body (markdown)
   - `derived_from`: list of exploration paths used (relative to the project dir).
10. The curator validates citation aliases against `repos:` (prompting for unmapped aliases as needed), writes the plan, and bumps `summary.updated`.
11. Report: `Wrote plan to <path>. Run @magos-logis-plan-reviewer to review it.`

Rules:

- The plan is review-compatible: structured sections, citations, explicit scope.
- Never include speculative steps without a citation or a flagged "open question".
- The curator handles validation and writing.
