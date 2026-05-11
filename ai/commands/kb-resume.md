---
description: Load a KB project's context (summary, active explorations, recent decisions, links) into the current session
argument-hint: "<query>"
---

Load the `kb-workflow` skill before doing anything else.

Arguments: $ARGUMENTS

Steps:

1. Use `~/work-kb` as the KB root. If it does not exist, error: `KB not found at ~/work-kb. Run /kb-init first.`
2. Resolve `$1` to a project using the skill's project resolution rules (exact → ticket-id → prefix → substring). On multiple matches, list and prompt; on zero matches, error and suggest `/kb-list`.
3. Enumerate target files (do not read contents yet):
   - `summary.md` (known path).
   - In-progress explorations: run a single `grep` for `^status: in-progress` across `~/work-kb/projects/<dir>/explorations/*.md` to get the file list.
   - Recent decisions: glob `~/work-kb/projects/<dir>/decisions/*.md`, sort by filename descending (NNNN-prefix sorts naturally), take the first 3.
   - `links.md` if present.
4. Load all enumerated files into context with parallel `Read` tool calls in a single assistant turn. Do NOT echo file contents in the response text. The tool results place contents in your context; that is sufficient.
5. Print only a short orientation, e.g.:

   ```
   Loaded <project>:
   - summary.md
   - N active explorations: <slug-list>
   - M recent decisions: <NNNN-list>
   - links.md (if loaded)

   Continue from <most recently updated exploration path> (last_updated <date>). Open questions are in summary.md.
   ```

   If zero active explorations, say so explicitly and suggest `/kb-explore <project> "<topic>"`.

Rules:

- Read-only. Never invoke `kb-curator`.
- Do NOT regenerate file contents in the assistant response. Use parallel `Read` tool calls; the tool results put contents in context. Print only the orientation summary.
- Read each file in full (no offset/limit). Explorations are append-only field notes; truncation risks dropping the latest finding.
- If the project has zero active explorations, say so explicitly and suggest `/kb-explore <project> "<topic>"`.
