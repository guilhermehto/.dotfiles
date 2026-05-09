---
description: Load a KB project's context (summary, active explorations, recent decisions, links) into the current session
argument-hint: "<query>"
---

Load the `kb-workflow` skill before doing anything else.

Arguments: $ARGUMENTS

Steps:

1. Resolve `<KB_ROOT>`. If it does not exist, error: `KB not found at <path>. Run /kb-init first.`
2. Resolve `$1` to a project using the skill's project resolution rules (exact → ticket-id → prefix → substring). On multiple matches, list and prompt; on zero matches, error and suggest `/kb-list`.
3. Read into the current session:
   - The full `summary.md` (verbatim).
   - All exploration files in `explorations/` whose frontmatter has `status: in-progress`. For each, print the file path then its full contents.
   - The most recent 3 decisions in `decisions/` by `number` descending. Print path then contents.
   - If `links.md` exists, print it.
4. Format the output as a structured preamble:

   ```
   # KB context — <PROJECT-DIR>

   ## Summary
   <summary.md contents>

   ## Active explorations (N)
   ### explorations/<file>
   <file contents>

   ## Recent decisions (N)
   ### decisions/<file>
   <file contents>

   ## Links
   <links.md contents, if any>
   ```

5. After the preamble, give a brief one-paragraph orientation to the agent (yourself): "You now have context for <project>. Open questions are listed in summary.md. Active explorations are <list>. Continue from where the most recent `last_updated` exploration left off."

Rules:

- Read-only. Never invoke `kb-curator`.
- Do not summarize the contents — print them verbatim. The point is to load context, not compress it.
- If the project has zero active explorations, say so explicitly and suggest `/kb-explore <project> "<topic>"`.
