---
description: Append findings from the current session to a KB exploration
argument-hint: "<query> [exploration-slug]"
---

Load the `kb-workflow` skill before doing anything else.

Arguments: $ARGUMENTS

Steps:

1. Parse arguments. `$1` is the project query (required). `$2` is the optional exploration slug or filename.
   - If `$1` is missing, error: `Usage: /kb-capture <query> [exploration-slug]`.
2. Use `~/work-kb` as the KB root. Error if it does not exist.
3. Resolve `$1` to a project.
4. **Pick the target exploration**:
   - If `$2` is provided: match it against `explorations/` filenames (substring on the slug part). If multiple match, list and prompt; if zero, error: `No exploration matches '<slug>' in <project>.`
   - If `$2` is omitted: list all `status: in-progress` explorations.
     - Zero → error: `No active explorations for <project>. Run /kb-explore <project> "<topic>" first.` and stop.
     - One → use it.
     - Multiple → tiebreak by most recent `last_updated`. If still tied, tiebreak by lexicographic filename (descending). Use the result.
5. **Synthesize findings** from the current session's recent context:
   - Write terse field notes, not prose.
   - Max 7 bullets by default unless the user asks for depth.
   - Each bullet: one concrete claim, optional impact, inline `<repo-alias>/<path>:<line>` citation.
   - No background already present in the exploration.
   - No preambles or filler: avoid "we investigated", "it appears", "this means", "the following".
   - Use exact technical names; short fragments are OK when clear.
   - Add a small Mermaid diagram only when it clarifies flow, ownership, dependencies, state, or data shape.
   - Do not add diagrams for simple lists, one-file findings, or obvious call chains.
   - Format as ready-to-append markdown content (no top-level heading; the curator wraps it in a `### YYYY-MM-DD — <topic>` subsection).
6. Choose a short topic label for the dated subsection (3-6 words capturing what was learned).
7. Show the user what you're about to capture: a summary of the new content and the target file. Ask for confirmation: `Append to <file>? [Y/n]`. Default Y.
8. On confirmation, invoke `kb-curator` with `action: append-exploration` and payload:
   - project dir name
   - exploration filename
   - topic label
   - content (the markdown body)
9. The curator validates citations against the `repos:` map. If any alias is unmapped, the curator prompts for the URL and adds it to the map before appending. If the user aborts that prompt, the capture is cancelled.
10. On success, report: `Appended to <file>. Bumped summary.updated.` Surface any aliases the curator added.

Rules:

- Curator enforces append-only: it never edits prior content.
- Curator updates the exploration's `last_updated` and `summary.md`'s `updated`.
- If the user declines confirmation, do nothing.
- Do not invent citations. Every `<alias>/path:line` must come from something actually examined in the session.
- Keep captures concise. Prefer `Fact. Impact. citation` over narrative explanation.
