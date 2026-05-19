---
description: List local plans in .scriptorum/ with status, last-updated date, and goal
argument-hint: "[filter]"
---

Load the `plan-workflow` skill before doing anything else.

Arguments: $ARGUMENTS

Steps:

1. **Resolve the scriptorum root.** Run `git rev-parse --show-toplevel`. If it succeeds, use that. Otherwise fall back to cwd and note the fallback: `No git repo found; using cwd as scriptorum root: <abs-path>`.

2. **Check for the scriptorum directory.** If `<scriptorum-root>/.scriptorum/` does not exist, print: `No plans yet. Run /plan <task> to create one.` and stop.

3. **List plan files.** Enumerate `<scriptorum-root>/.scriptorum/*.md` (both dated `YYYY-MM-DD--<slug>.md` and legacy `<slug>.md`). If the directory exists but contains no matching files, print: `No plans yet. Run /plan <task> to create one.` and stop.

4. **Derive the slug per file.**
   - Dated filename `YYYY-MM-DD--<slug>.md` → slug is everything after `--`, stem only.
   - Legacy filename `<slug>.md` → slug is the filename stem.

5. **Apply filter.** If `$1` is provided, keep only files whose derived `<slug>` contains the filter as a substring, case-insensitive.

6. **Parse frontmatter.** For each remaining file, read the YAML frontmatter and extract `created`, `updated`, `slug`, `status`, `goal`.
   - If `updated` is missing, fall back to `created`.
   - If `created` is also missing, substitute `?`.
   - If `status` is missing, set it to `unknown` (legacy plan).
   - If `slug` is missing from frontmatter, fall back to the slug derived in step 4.
   - If `goal` is missing, substitute `?`.
   - Malformed frontmatter on any single file must not prevent listing the rest — substitute `?` for unparseable fields and continue.

7. **Sort.** Order by `updated` descending. Ties broken by `slug` ascending. Entries with `updated: ?` sort last.

8. **Print.** One line per plan in this format:
   ```
   <marker> <status-padded>  <slug>  <updated>  <goal>
   ```
   - `<marker>` is a 3-char bracketed glyph keyed to status:
     - `[ ]` → `not-started`
     - `[~]` → `in-progress`
     - `[x]` → `complete`
     - `[-]` → `abandoned`
     - `[?]` → `unknown`
   - `<status-padded>` is the status string left-padded to 11 chars (longest is `not-started`).
   - `<slug>`, `<updated>`, `<goal>` are not padded — keep gutters at two spaces; goals may be long.

   Example output:
   ```
   [~] in-progress  add-feature-flag-for-new-checkout  2026-05-20  Add a feature flag for the new checkout flow.
   [ ] not-started  rewrite-billing-export-pipeline    2026-05-19  Rewrite the billing export pipeline to use the new async runner.
   [x] complete     a-local-plan-command-that-...      2026-05-12  A local /plan command that generates structured implementation plans.
   ```

9. **Handle empty filter result.** If a filter was provided and matched nothing, print: `No plans match '<filter>'.`

Rules:

- Read-only. Never invoke `magos-artisan`.
- Use `read`, `ls`, and `rg` only. No bash beyond standard read-only verbs.
- A malformed frontmatter on any single plan must not prevent listing the rest — substitute `?`/`unknown` and move on.
- Do not show the absolute path; just the slug. The user can derive `<scriptorum-root>/.scriptorum/<file>.md` if they need the full path.
- Do not include the date prefix in the displayed slug — it's redundant with the `updated` column. The slug stays the human-friendly identifier.
- Status sorting is by `updated` desc, not by status. Active and stale plans interleave naturally; the leftmost glyph still makes status scannable.
