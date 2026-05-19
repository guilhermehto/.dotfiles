---
description: Entry point for the orchestration agents. With no args, lists in-progress plans for resume. With a task, recommends magos-velox (light) or magos-iterator (deep) based on flags. Thin router — does not do the work itself.
argument-hint: "[--deep|-d] [task description]   |   [no args = resume picker]"
---

Load the `plan-workflow` skill before doing anything else. The skill defines the scriptorum root, the dated filename format, the frontmatter schema (including `status`), the slug-to-file resolution, and the contract for `/work` itself (see the `/work contract` section).

This command is a **router**. It does not run the workflow. It tells the user which primary agent to switch into so they can. Opencode commands run inside the current agent and cannot directly switch primary agents — the user does that explicitly.

Arguments: $ARGUMENTS

Steps:

1. **Parse `$ARGUMENTS`** into `(flag, task)`:
   - If `$ARGUMENTS` starts with `--deep` or `-d` (possibly followed by a space and a task), set `flag = "deep"` and `task = the rest (may be empty)`.
   - Otherwise set `flag = none`, `task = $ARGUMENTS verbatim`.
   - Trim whitespace from `task`.

2. **Branch on the input shape.**

   ### Case A: No args (`flag == none` and `task` empty) → Resume picker

   1. Resolve the scriptorum root: `git rev-parse --show-toplevel`. On failure, fall back to cwd and note: `No git repo found; using cwd as scriptorum root: <abs-path>`.
   2. If `<root>/.scriptorum/` does not exist, print: `No plans yet. Run /plan <task> to create one, or /work <task> for a light task.` and stop.
   3. List `<root>/.scriptorum/*.md`. Parse frontmatter on each per the rules in `plan-workflow > /plan-list contract` (legacy plans get `status: unknown`).
   4. Filter to plans where `status ∈ {not-started, in-progress, unknown}`. If the filtered list is empty, print: `No in-progress plans. Run /plan <task> to create one, or /work <task> for a light task.` and stop.
   5. Sort by `updated` descending; ties broken by `slug` ascending.
   6. **Print the picker.** Use the same per-line format as `/plan-list`:
      ```
      [<marker>] <status-padded>  <slug>  <updated>  <goal>
      ```
      Status markers: `[ ]` not-started, `[~]` in-progress, `[?]` unknown.
   7. Below the list, print:
      ```
      Resume one of these by switching into magos-iterator with the slug:

        @magos-iterator <slug>

      Or start fresh:

        @magos-velox <task>          # light, in-chat plan
        @magos-iterator <task>       # deep, persisted plan
      ```
      Then stop. Do not prompt the user to pick interactively — they'll just type the command.

   ### Case B: Task arg, no `--deep` (`flag == none`, `task` non-empty) → Recommend light

   Print:
   ```
   Light flow recommended. Switch to:

     @magos-velox <task>

   This will plan in chat (no .scriptorum file) and implement directly.
   If the task turns out to be larger than expected, magos-velox will recommend escalating to magos-iterator.

   To force the deep flow up front:

     /work --deep <task>
   ```
   Then stop.

   ### Case C: `--deep` with task (`flag == deep`, `task` non-empty) → Recommend deep

   Print:
   ```
   Deep flow. Switch to:

     @magos-iterator <task>

   This will run Understand → Plan → Implement with a persisted .scriptorum plan, auto plan review, and auto diff review at the end.
   ```
   Then stop.

   ### Case D: `--deep` with no task (`flag == deep`, `task` empty) → Treat as resume picker

   Run Case A.

3. **Do not switch agents yourself.** Commands cannot switch primary agents in opencode. Your job is to print the right recommendation and let the user invoke `@magos-velox` or `@magos-iterator`.

4. **Do not run the workflow inline.** If a user pastes a task and expects you to start working on it, the recommendation output is the right answer — they should switch agents to get the system-prompt discipline that the workflow needs.

Rules:

- Read-only. Never invoke `magos-artisan`. Never edit files.
- Never invent slugs. If the user passes `--resume <slug>` (a shape you might see in scripts later), forward it: print `@magos-iterator --resume <slug>` and stop. For now, treat unknown flags as part of the task description.
- Output is short. The list of plans plus 2-3 lines of recommendation. No header, no preamble, no postscript.
- Use `read`, `ls`, `rg` only. No mutating bash verbs.
- Match the project's `AGENTS.md`: direct, concise, outcome-first. Don't explain what the agents do — the user knows. Just give them the next command to run.
