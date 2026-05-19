---
description: Generate a local implementation plan via catechism alignment; write to .scriptorum/YYYY-MM-DD--<slug>.md with checkbox steps and tracked status
argument-hint: "<task description>"
---

Load the `plan-workflow` skill and the `catechism` skill before doing anything else. `plan-workflow` defines the scriptorum root, filename format (`YYYY-MM-DD--<slug>.md`), slug rules, frontmatter schema (including `status` and `updated`), the five-section plan template with checkbox tasks, citation format, slug-to-file resolution, overwrite policy, and the `magos-artisan` delegation contract (actions: `write-plan`, `update-status`, `tick-task`, `append-note`, `supersede`). `catechism` defines the alignment interview that drives the slug and the plan body.

Arguments: $ARGUMENTS

Steps:

1. **Frame the task.**
   - If `$ARGUMENTS` is non-empty, restate your current understanding in 1-2 lines so the user can spot mismatch early.
   - If `$ARGUMENTS` is empty, synthesize the framing from the recent conversation context.

2. **Run the catechism interview.** Follow the protocol in the `catechism` skill: probe the five dimensions, batch 3-6 questions per round via the `question` tool, summarize after each round. Produce the alignment recap in the shape `catechism` prescribes.

3. **Wait for affirmative confirmation of the recap.** Silence is not consent. If the user corrects the recap, edit it in place and re-confirm.

4. **Handle abort cleanly.** If the user aborts the interview at any point ("never mind", "stop", "cancel", or equivalent), or declines the recap, exit with `Aborted; no plan written.` and stop. Do not write anything.

5. **Derive the slug** from the recap's `Goal:` line per the `plan-workflow` slug rules (lowercase, kebab-case, strip non-`[a-z0-9-]`, collapse `-`, trim, ≤60 chars). If the derived slug is empty, error: `Could not derive a slug from the catechism Goal line. Refine the goal and re-run.`

6. **Derive a short H1 title** from the goal (~6-10 words; title-case acceptable). This is for the plan body's `# <title>`, not the filename.

7. **Resolve the scriptorum root.** Run `git rev-parse --show-toplevel`. If it succeeds, use that. If not, fall back to cwd and print: `No git repo found; using cwd as scriptorum root: <abs-path>`.

8. **Compute the target path:** `<scriptorum-root>/.scriptorum/<TODAY>--<slug>.md` (TODAY = ISO date).

9. **Check for same-day collision.** If the target file exists, prompt: `Plan exists at <path>. Overwrite? [y/N]`.
   - Empty answer or anything other than `y`/`Y` → exit with `Aborted; existing plan not modified.`
   - `y`/`Y` → set `overwrite = true`.
   Otherwise `overwrite = false`.

10. **Surface cross-date collisions.** Glob `<scriptorum-root>/.scriptorum/*--<slug>.md`. If matches exist on other dates, print to the user: `Note: other plans with slug "<slug>" exist on dates [<list>]. Proceeding will create a NEW dated plan; use the supersede action if you mean to replace one.` Continue.

11. **Synthesize the plan body** matching the five required sections (Summary, Scope, Numbered steps, Acceptance criteria, File touchpoints) per the `plan-workflow` template. Use **checkbox grammar**:
    - Numbered steps: `1. [ ] step text`, `2. [ ] step text`, ...
    - Acceptance criteria: `- [ ] criterion`, `- [ ] criterion`, ...
    - File touchpoints: regular bullets (`- \`path:line\` — new|update — note`), no checkboxes.
    Do **not** include the catechism recap verbatim — use it as the synthesis source only. Use plain `path:line` citations for every concrete reference to existing code; bare paths for new files.

12. **Show the user the preview.** Print the frontmatter and the full body. Ask: `Write plan to <path>? [Y/n]`. Default Y.

13. **On confirmation**, dispatch to the `magos-artisan` subagent via the task tool with:
    ```
    action: write-plan
    payload:
      slug: <slug>
      goal: <single-line goal copied verbatim from the recap>
      title: <H1 title>
      body: <markdown body, sections only — no frontmatter>
      overwrite: <true | false>
      supersedes: []
    ```

14. **Report.** Surface the artisan's return:
    - On success: `Wrote plan to <abs-path> (status: not-started).` If any `citation_warnings` were returned, list them: `Warning: <path>:<N> — <reason>`. Then suggest both:
      - `Run @logis <abs-path> to review it.`
      - `Run /work --resume <slug> to start executing.` (only if the slug is unique, otherwise show the dated form: `/work --resume <TODAY>--<slug>`.)
    - On `error: "exists"` (shouldn't happen after step 9, but defensive): print the artisan's error and stop.
    - On `error: "malformed-body"`: print the missing/out-of-order sections and stop. Do not retry silently.

Rules:

- The catechism interview is mandatory. Do not skip it, even when `$ARGUMENTS` is detailed.
- The slug must come from the catechism recap's `Goal:` line, not from `$ARGUMENTS`.
- The catechism recap is never embedded verbatim in the plan body.
- Citations are plain `path:line`. No repo aliases.
- This command never writes directly. Only `magos-artisan` writes.
- If the user declines the final preview confirmation, write nothing and exit cleanly.
- Numbered steps and Acceptance criteria MUST use checkbox grammar. File touchpoints MUST NOT — they describe locations, not work units.
