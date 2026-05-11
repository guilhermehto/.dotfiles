---
description: List KB projects with status, last-updated date, and active exploration count
argument-hint: "[filter]"
---

Load the `kb-workflow` skill before doing anything else.

Arguments: $ARGUMENTS

Steps:

1. Use `~/work-kb` as the KB root. If it does not exist, error: `KB not found at ~/work-kb. Run /kb-init first.`
2. List directories under `~/work-kb/projects/`. If empty, print: `No projects yet. Run /kb-init <TICKET-ID> to create one.` and stop.
3. If a filter argument is provided (`$1`), filter the project list using a case-insensitive substring match against the directory name (matches both ticket-id and slug parts).
4. For each project, read `summary.md` frontmatter to get `status` and `updated`. Count files in `explorations/` whose frontmatter has `status: in-progress`.
5. Print a table:

   ```
   PROJECT                                 STATUS    UPDATED      ACTIVE
   PROJ-123-payments-revamp                active    2026-05-09   2
   PROJ-456-rate-limit                     paused    2026-04-22   0
   ```

   Sort by `updated` descending.

6. If a filter was given but matched nothing, print: `No projects match '<filter>'.`

Rules:

- Read-only. Never invoke `kb-curator`.
- Use `read`, `ls`, and `rg` only. No bash beyond what the curator's allowlist permits.
- If a `summary.md` is malformed (missing required frontmatter), show the project with `status: ?` and `updated: ?` and continue.
