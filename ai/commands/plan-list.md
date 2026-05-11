---
description: List local plans in .scriptorum/ with created date and goal
argument-hint: "[filter]"
---

Load the `plan-workflow` skill before doing anything else.

Arguments: $ARGUMENTS

Steps:

1. **Resolve the scriptorum root.** Run `git rev-parse --show-toplevel`. If it succeeds, use that. Otherwise fall back to cwd and note the fallback: `No git repo found; using cwd as scriptorum root: <abs-path>`.

2. **Check for the scriptorum directory.** If `<scriptorum-root>/.scriptorum/` does not exist, print: `No plans yet. Run /plan <task> to create one.` and stop.

3. **List plan files.** Enumerate `<scriptorum-root>/.scriptorum/*.md`. If the directory exists but contains no matching files, print: `No plans yet. Run /plan <task> to create one.` and stop.

4. **Apply filter.** If `$1` is provided, keep only files whose `<slug>` (the filename stem) contains the filter as a substring, case-insensitive.

5. **Parse frontmatter.** For each remaining file, read the YAML frontmatter and extract `created`, `slug`, `goal`.
   - If the frontmatter is malformed or a field is missing, substitute `?` for the missing values and continue. Do not error.
   - If `slug` is missing from the frontmatter, fall back to the filename stem.

6. **Sort.** Order by `created` descending. Ties broken by `slug` ascending. Entries with `created: ?` sort last.

7. **Print.** One line per plan, format:
   ```
   <slug>  <created>  <goal>
   ```
   Two-space gutters between columns. Do **not** pad slug or created to fixed widths — the goal may be long and a flexible layout reads better than a wrapped table.

8. **Handle empty filter result.** If a filter was provided and matched nothing, print: `No plans match '<filter>'.`

Rules:

- Read-only. Never invoke `magos-artisan`.
- Use `read`, `ls`, and `rg` only. No bash beyond standard read-only verbs.
- A malformed frontmatter on any single plan must not prevent listing the rest — substitute `?` and move on.
- Do not show the absolute path; just the slug. The user can derive `<scriptorum-root>/.scriptorum/<slug>.md` if they need the full path.
