---
description: Search the KB across explorations, decisions, plans, and summaries
argument-hint: "<text> [project-query]"
---

Load the `kb-workflow` skill before doing anything else.

Arguments: $ARGUMENTS

Steps:

1. Parse arguments. `$1` is the search text (required). `$2` is an optional project query to scope the search.
   - If `$1` is missing, error: `Usage: /kb-search <text> [project-query]`.
2. Resolve `<KB_ROOT>`. Error if missing.
3. **Compute search scope**:
   - If `$2` is provided, resolve it to a project. Search root: `<KB_ROOT>/projects/<dir>/`.
   - Else search root: `<KB_ROOT>/projects/`.
4. Run ripgrep over the search root with sensible defaults:
   - Case-insensitive (`-i`).
   - Show file paths with line numbers (default `rg` output).
   - Limit to markdown (`-tmd`) and yaml frontmatter (it's inside `.md` so this is implicit).
   - Use the user's text as a literal pattern (`-F`) unless it looks like a regex (contains regex metacharacters that aren't quoted) — default to literal for predictability.
5. Format the results as `project/file:line — <surrounding context>` entries, grouped by project. Print the project's directory name as the group header.
6. If no matches, print: `No matches for '<text>'` (with scope note if a project was given).
7. If matches are abundant (>30), show the first 30 and the count of additional matches, with a tip: `Add a project filter: /kb-search '<text>' <project>`.

Rules:

- Read-only. Never invoke `kb-curator`.
- Use `rg` directly. No content modification.
- Repo-relative paths (relative to `<KB_ROOT>`), not absolute.
