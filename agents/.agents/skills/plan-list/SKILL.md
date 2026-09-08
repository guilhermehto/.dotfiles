---
name: plan-list
description: List implementation plans in .scriptorum/. Invoke when the user says "/plan-list", "list plans", "what plans are in progress", or wants to see the status of tracked plans. An optional filter argument narrows by slug substring; it comes from the surrounding prompt.
---

# plan-list

Lists implementation plans under `.scriptorum/` following the `plan-workflow` conventions.

Load the `plan-workflow` skill for the full `/plan-list` contract, status markers, and sort order.

## Codex-specific notes

**No `$ARGUMENTS` injection.** On Codex, the optional filter comes from the surrounding prompt, not a `$ARGUMENTS` placeholder. Extract it from the user's message if present.

## Workflow

Follow the `/plan-list` contract from `plan-workflow` verbatim:

1. Resolve the scriptorum root (`git rev-parse --show-toplevel`; fall back to cwd).
2. If `.scriptorum/` does not exist, print `No plans yet. Run /plan <task> to create one.` and stop.
3. List `.scriptorum/*.md`. Apply the filter if provided (case-insensitive slug substring match).
4. Parse frontmatter; apply legacy-frontmatter fallbacks.
5. Sort by `updated` descending.
6. Print one line per plan:
   ```
   [<marker>] <status>  <slug>  <updated>  <goal>
   ```
   Status markers: `[ ]` not-started, `[~]` in-progress, `[x]` complete, `[-]` abandoned, `[?]` unknown.
7. If the filter matched nothing, print `No plans match '<filter>'.`
