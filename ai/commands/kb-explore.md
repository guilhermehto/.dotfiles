---
description: Start a new exploration for a KB project
argument-hint: "<query> <topic>"
---

Load the `kb-workflow` skill before doing anything else.

Arguments: $ARGUMENTS

Steps:

1. Parse arguments. `$1` is the project query. The remaining arguments form the topic (everything after the first arg).
   - If either is missing, error: `Usage: /kb-explore <query> <topic>`.
2. Resolve `<KB_ROOT>`. Error if missing.
3. Resolve `$1` to a project using the skill's resolution rules.
4. Derive the exploration slug from the topic: lowercase, replace whitespace with `-`, strip non-`[a-z0-9-]`, collapse repeated `-`, trim. Cap at 60 chars.
5. Compute the filename: `explorations/YYYY-MM-DD--<slug>.md` using today's date.
6. **Refuse overwrite**: if the file exists, error: `Exploration already exists at <path>. Pick a different topic or use /kb-capture <project>.`
7. Invoke `kb-curator` with `action: create-exploration` and payload:
   - project dir name
   - exploration filename
   - topic (used as the H1 and the goal placeholder)
8. Report: `Created exploration at <KB_ROOT>/projects/<dir>/explorations/<file>. Status: in-progress.`

Rules:

- The curator creates the file from the exploration template in the skill, with `status: in-progress`, today's `started` and `last_updated`, the topic as H1.
- Curator bumps `summary.updated` after the write.
- Multi-word topics are fine; the slug is derived from them.
