---
description: Run a structured clarifying interview before tackling a task
argument-hint: "<initial request>"
---

Load the `catechism` skill before doing anything else. It defines the dimensions to probe, question-crafting rules, pacing, and the alignment recap you must follow.

Arguments: $ARGUMENTS

Steps:

1. If `$ARGUMENTS` is empty, ask the user: `What would you like to align on?` and wait for a reply.
2. Do cheap research first. If the request references repo paths, files, or symbols, read them before asking anything. Never ask what reading a file would answer.
3. Restate your current understanding of the request in 1-2 lines so the user can spot mismatch early.
4. Identify which of the five dimensions need clarification (goal & success criteria, scope & non-goals, constraints, edge cases & failure modes, assumptions to surface). Skip dimensions already answered in the brief.
5. Run the interview per the skill's protocol:
   - One dimension per round, 3-6 questions per round, never more than 7.
   - Every question uses `mcp_Question` with multiple-choice options. Free-form prose is allowed only under the narrow exceptions listed in the skill; never as a default or convenience.
   - After each round, briefly summarise what you learned and move to the next dimension.
6. After the final dimension, produce the alignment recap in the skill's prescribed shape.
7. Wait for explicit affirmative go-ahead before starting any implementation work. Silence is not consent. If the user corrects the recap, edit it in place and re-confirm.

Rules:

- If the user says "just go", "stop asking", or equivalent at any point, halt the interview immediately and act on what you have, surfacing remaining open assumptions in the recap.
- Do not write any files (KB or otherwise) as part of this command. The output is in-conversation only.
- If alignment is reached but the next action would be a `/kb-explore`, `/kb-plan`, or similar, suggest it explicitly in the recap's `Next step` line; do not invoke it automatically.
