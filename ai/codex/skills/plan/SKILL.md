---
name: plan
description: Create a new implementation plan in .scriptorum/. Invoke when the user says "/plan", "write a plan", "create a plan", or provides a task description and wants a tracked, persisted plan. Arguments come from the surrounding prompt.
---

# plan

Creates a new implementation plan under `.scriptorum/` following the `plan-workflow` conventions.

Load the `plan-workflow` skill for the full schema, slug rules, frontmatter, and body template.

## Codex-specific notes

**No `$ARGUMENTS` injection.** On Codex, skill arguments come from the surrounding prompt, not a `$ARGUMENTS` placeholder. Read the task description from the user's message.

**No magos-artisan gate.** On opencode, plan writes are routed through the `magos-artisan` subagent. On Codex, the default agent writes `.scriptorum/` directly. The same `plan-workflow` conventions apply; the delegation layer is absent. This is a known invariant downgrade slated for the README.

## Workflow

1. Read the task description from the user's prompt.
2. Load the `catechism` skill and run the alignment interview (unless the task already contains an explicit goal, scope, and constraints — see the catechism skip heuristic in `plan-workflow`).
3. Derive the slug from the catechism recap's `Goal:` line per `plan-workflow` slug rules.
4. Decide plan weight (`light` / `standard` / `heavy`).
5. Synthesize the plan body (Summary, Scope, Numbered steps, Acceptance criteria, File touchpoints).
6. Preview the full plan to the user. Ask: `Write plan to <abs-path>? [Y/n]`. Default Y.
7. On confirmation, write the file directly to `<scriptorum-root>/.scriptorum/<TODAY>--<slug>.md`.
8. Load the `magos-iterator` skill if the user wants to execute the plan immediately.

Follow all hard rules from `plan-workflow`: never write outside `.scriptorum/`, never auto-set `status: complete`, never embed the catechism recap verbatim.
