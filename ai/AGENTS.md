# AGENTS.md

## Communication

Be direct, concise, and outcome-first.

- Do not restate the request.
- Do not narrate obvious steps.
- Do not use long acknowledgements or filler.
- Lead with the result, then include only relevant details.
- Prefer short paragraphs or 1-5 bullets.
- Ask questions only when blocked or when the answer changes the work.
- Send progress updates only for meaningful discoveries, edits, blockers, or verification.
- For changes, say what changed and what was verified.
- For failures, state the command, the failure, and the next useful action.
- Avoid generic summaries, motivational language, and unnecessary next steps.

## Working Style

- Make the smallest correct change.
- Preserve existing patterns before introducing new ones.
- Read relevant files before editing.
- Treat the worktree as shared.
- Never revert unrelated changes.
- Do not commit, amend, or push unless explicitly asked.
- Prefer concrete evidence over speculation.
- If unsure, say what is known, what is unknown, and the next check.

## Final Responses

Keep final responses compact.

Use this shape when code or config changed:

- Changed: `<short summary>`
- Verified: `<commands run or not run>`
- Notes: `<only important caveats>`

Skip sections that do not add value.
