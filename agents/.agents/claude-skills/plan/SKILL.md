---
name: plan
description: Generate a local implementation plan — ground in the code, align via catechism, then write a phased .scriptorum/ plan with rich-context checkbox steps and tracked status. Use when the user says /plan, asks to write or create a plan, or describes a task they want planned and tracked before implementation.
argument-hint: "<task description>"
---

Load the `plan-workflow` skill and the `catechism` skill before doing anything else. `plan-workflow` defines the scriptorum root, filename format (`YYYY-MM-DD--<slug>.md`), slug rules, frontmatter schema, the phased plan body template (parallel/sequential phases, rich-context steps), the parallelization model, citation format, slug-to-file resolution, overwrite policy, and the direct-write operations you perform yourself. `catechism` defines the alignment interview that drives the slug and the plan body.

Arguments: $ARGUMENTS

You write the plan file directly — there is no writer subagent. Your job here is to do the heavy lifting up front: ground the plan in real code, align on intent, and produce steps so well-specified that a fresh subagent (which knows nothing about this codebase) can execute each one after only a quick look.

Steps:

1. **Frame the task.**
   - If `$ARGUMENTS` is non-empty, restate your current understanding in 1-2 lines so the user can spot a mismatch early.
   - If `$ARGUMENTS` is empty, synthesize the framing from the recent conversation context.

2. **Understand (ground in the code).** Before planning, build a real mental model — this is what makes the steps rich instead of vague.
   - Dispatch `explore` (subagent) with the task as the question when the structure is unfamiliar or the fan-out is large; use `medium` thoroughness (`quick` for a narrow task, higher for a broad explainer). Treat its `path:line` references as a map.
   - Open and read the load-bearing files yourself before citing them. Verify every `path:line` you intend to use.
   - The research you gather here becomes each step's `Context:` and `Read first:`. The planner walks the code so the executor doesn't have to rediscover it.
   - Keep this phase internal — don't dump the writeup unless something surprising surfaced that the user should weigh in on.

3. **Run the catechism — unless the task is already fully specified.** Run the interview (probe the five dimensions, batch 3-6 multiple-choice questions per round via the `question` tool, recap) when alignment is genuinely needed. **Skip** the multi-round interview only when **all** of these hold: an explicit single-sentence goal ("I want to <X> so that <Y>"), an explicit scope (named files/modules/feature), at least one named constraint or non-goal, and no vague verbs ("improve", "clean up", "refactor") without a concrete target. When skipping, restate your understanding in 1-2 lines and confirm with one focused question instead.

4. **Wait for affirmative confirmation of the recap** (or the one-line confirmation when skipping). Silence is not consent. If the user corrects it, edit in place and re-confirm.

5. **Handle abort cleanly.** If the user aborts at any point ("never mind", "stop", "cancel") or declines the recap, exit with `Aborted; no plan written.` and write nothing.

6. **Decide plan weight** per `plan-workflow > Step shape and weight`: `light` (trivial single-file), `standard` (default — most work), or `heavy` (multi-module, unfamiliar, high cost of a wrong assumption). The weight shapes the per-step contract and goes in frontmatter.

7. **Derive the slug** from the recap's `Goal:` line per the `plan-workflow` slug rules. If empty, error: `Could not derive a slug from the catechism Goal line. Refine the goal and re-run.`

8. **Derive a short H1 title** from the goal (~6-10 words; title-case acceptable). For the body's `# <title>`, not the filename.

9. **Resolve the scriptorum root.** `git rev-parse --show-toplevel`; on failure fall back to cwd and print `No git repo found; using cwd as scriptorum root: <abs-path>`.

10. **Compute the target path:** `<scriptorum-root>/.scriptorum/<TODAY>--<slug>.md`.

11. **Check for same-day collision.** If the target exists, prompt `Plan exists at <path>. Overwrite? [y/N]`. Empty or non-`y` → exit with `Aborted; existing plan not modified.` `y`/`Y` → `overwrite = true`. Otherwise `overwrite = false`.

12. **Surface cross-date collisions.** Glob `*--<slug>.md`. If matches exist on other dates, print: `Note: other plans with slug "<slug>" exist on dates [<list>]. Proceeding creates a NEW dated plan; use supersede if you mean to replace one.` Continue.

13. **Synthesize the phased plan body** per the `plan-workflow` template — the five sections in order (`## Summary`, `## Scope`, `## Steps`, `## Acceptance criteria`, `## File touchpoints`):
    - Organize `## Steps` into `### Phase N — <name> · <parallel|sequential>` subheadings. Steps numbered globally and contiguously across phases.
    - Group steps that are **file-disjoint and independent** into a `parallel` phase; put dependent or same-file steps in `sequential` phases or in later phases. **Within a `parallel` phase, no two steps may share a touchpoint file** — this is what lets the executor run them concurrently.
    - At `standard`/`heavy`, every step carries `Context:` (the why + domain knowledge a fresh subagent lacks, from your Understand pass) and `Read first:` (the exact files/docs to read), plus `Done when:` (observable behavior) and `Touchpoints:`. Heavy adds `Outcome:` and `Independent Test:`. **Do not paste implementation code** — describe interfaces and behavior; the subagent writes the code.
    - Acceptance criteria: `- [ ] criterion` (cross-cutting invariants only). File touchpoints: regular bullets, no checkboxes.
    - Use plain `path:line` citations (verified in step 2) for existing code; bare paths for new files. Never embed the catechism recap verbatim.

14. **Preview to the user.** Print the frontmatter (created/updated, slug, goal, status: not-started, weight, supersedes: []) and the full body. Ask `Write plan to <path>? [Y/n]`. Default Y. If declined, write nothing and exit cleanly.

15. **Write the plan directly** per `plan-workflow > Direct-write operations > write-plan`: apply path safety; validate section order; validate phases (every step in a `### Phase` subheading; every `parallel` phase's steps disjoint — re-phase or downgrade to `sequential` on overlap and note it); coerce stray non-checkbox primary items; validate citations (warn-only); compose frontmatter + body; write the file.

16. **Report and review.**
    - Print `Wrote plan to <abs-path> (status: not-started).` List any citation warnings as `Warning: <path>:<N> — <reason>`.
    - **Dispatch `logis`** (subagent) on the absolute path. This is automatic — do not ask. Surface its return.
    - Triage: if the verdict is approve / no blocking concerns → go to Handoff. If there are blocking concerns → propose amendments, show the diff against the current body, ask `Apply these amendments and re-write the plan? [Y/n]`. On Y → direct `write-plan` with `overwrite: true`; re-dispatch `logis` if the change was substantial. On N → ask how to proceed (waive via an `append-note` justification / amend partially / abandon).

17. **Handoff.** Print:
    ```
    Plan ready at <abs-path>.

    To execute: /execute-plan <slug>  — I'll run it phase by phase, dispatching enginseer
    per step (parallel phases run concurrently) and committing as it goes.
    To review status later: /plan-list
    ```

Rules:

- **Catechism runs unless the task is fully specified** (step 3 heuristic). When in doubt, run it. Never write a plan without alignment.
- The slug comes from the recap's `Goal:` line, not from `$ARGUMENTS`.
- The catechism recap is never embedded verbatim in the plan body.
- **Do the Understand pass before synthesizing** — rich `Context:`/`Read first:` come from real reading, not guesses. Verify every `path:line` before citing it.
- **You write the plan directly.** There is no writer subagent. Follow the path-safety and validation rules in `plan-workflow`.
- Within a `parallel` phase, never let two steps share a touchpoint file.
- Citations are plain `path:line`. No repo aliases.
- Steps and Acceptance criteria MUST use checkbox grammar. File touchpoints MUST NOT — they describe locations, not work units.
- Never paste implementation code into steps.
- If the user declines the preview, write nothing and exit cleanly.
