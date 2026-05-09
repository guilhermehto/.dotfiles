---
description: Scaffold a new KB project (also bootstraps ~/work-kb on first run)
argument-hint: "<TICKET-ID> [slug]"
---

Load the `kb-workflow` skill before doing anything else. It defines the KB layout, slug rules, frontmatter schemas, and templates you must follow.

Arguments: $ARGUMENTS

Steps:

1. Parse the arguments. `$1` is the ticket ID (required). `$2` is the optional slug suffix.
   - If `$1` is missing or empty, error: `Usage: /kb-init <TICKET-ID> [slug]`.
   - Sanitize the ticket ID per the skill's rules. If it contains control characters or non-ASCII, error with the offending character and stop.
2. If `$2` is missing, prompt the user: `Optional slug for ticket <TICKET-ID> (kebab-case, blank to skip):`. Accept blank.
3. Compute the project directory name: `<sanitized-ticket>` if no slug, else `<sanitized-ticket>-<slug>`.
4. Resolve `<KB_ROOT>` (env var `KB_ROOT`, default `~/work-kb`).
5. **Bootstrap if needed**:
   - If `<KB_ROOT>` does not exist, prompt the user: `No KB at <KB_ROOT> yet, create it? [Y/n]`. Default Y.
   - On confirmation, invoke `kb-curator` with `action: bootstrap-kb-root` to create the directory, write `README.md` from the skill's template, and create `projects/`.
   - On decline, exit without doing anything.
6. **Refuse overwrite**: if `<KB_ROOT>/projects/<dir>/summary.md` already exists, error: `Project <dir> already exists at <path>. Refusing to overwrite.` Suggest `/kb-list` to see existing projects.
7. **Gather project metadata** by prompting the user (one batch):
   - One-liner (one sentence describing the project).
   - Initial key links (URLs, one per line; blank line to finish). For each, optionally accept a title; otherwise use the URL itself as the placeholder.
   - Repos involved: pairs of `alias url` (one per line; blank line to finish). At least one is required if you have any. The alias is what citations will use.
8. Invoke `kb-curator` with `action: scaffold-project` and a structured payload containing the project dir name, one-liner, links, repos. The curator creates:
   - `projects/<dir>/summary.md` (from template, with sentinels around One-liner + Context, repos map populated, today's date)
   - `projects/<dir>/explorations/`
   - `projects/<dir>/decisions/`
   - `projects/<dir>/plans/`
9. Report back to the user: `Created project <dir> at <KB_ROOT>/projects/<dir>`. List the files written.

Rules:

- Never write outside `<KB_ROOT>`.
- Never overwrite an existing project.
- The Context section in `summary.md` is left blank initially with a placeholder; the user fills it in their editor or via a follow-up exploration.
