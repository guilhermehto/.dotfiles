---
name: execute-tasks
description: Execute a project's ready tasks from the machine-wide beads store by dispatching subagents with a fixed briefing — claim, brief, verify, commit once per task, run file-disjoint tasks in parallel, then end with a subagent code review whose findings become new tasks. Use when the user says "execute with subagents", "run project X with subagents", "dispatch subagents on X", or asks to work through a project's tasks hands-off.
---

# execute-tasks

You are the orchestrator. Subagents write code; you own the tracker, the commits, and the final word on whether a task is done. Load the `project-tasks` skill first: it defines the store, the actor name, the project model, and the handoff comment format used here.

Invoking this skill is the user's explicit request to commit once per completed task (overriding the `commit` skill's "only when asked"). Never push.

## Subagents

Use the harness's default general-purpose subagent (Claude Code `Agent` with the general-purpose type, omp `task` with the default agent, Codex's default spawned agent, opencode `task` with the general agent). Never a named custom agent. Every subagent receives the briefing below, filled in, and nothing else; that briefing is what makes runs reproducible.

Run at most 4 subagents at once unless the user sets another limit or the harness allows fewer.

## Preflight

1. `bd where` (see `project-tasks`), pick your actor name, find the project's epic, read its PRD.
2. `cd` into the repo from the PRD's `Repos:` line. If the project spans several repos, ask which one this run targets and only take tasks whose `Files:` live there.
3. `git status --porcelain`. If there are uncommitted changes, ask the user whether to proceed; never commit them as part of a task.
4. Record the starting commit: `git rev-parse HEAD`. The final review covers `<start>..HEAD`.

## Loop

Repeat until a wave is empty.

1. **Find ready work:** `bd ready --parent <epic-id> --exclude-type epic --json`. Drop tasks whose files are locked by a blocked task from this run (step 5).
2. **Form a wave:** go through ready tasks in the order returned and add each task whose `Files:` set does not overlap any task already in the wave. A task with no `Files:` line runs alone in its own wave.
3. **Claim each task in the wave:** `bd update <id> --claim --actor <actor> --json`. If a claim fails, drop that task from the wave.
4. **Dispatch** one subagent per claimed task, all at once, each with the briefing below.
5. **Handle results one at a time** as they arrive:
   - Confirm the files this task changed (`git status --porcelain`, ignoring files owned by other tasks still in flight and changes that predate the run) are within its `Files:` plus anything the subagent justified in `summary`. Any other unexplained change means the result is not accepted.
   - Re-run the subagent's verification command yourself, and check the diff against the acceptance criteria.
   - **Accepted:** stage exactly the task's files by path and commit following the `commit` skill (where that skill isn't installed: explicit paths, one-line Conventional Commit). Subject: `<type>(<scope>): <short lowercase summary of the task>`, with `<type>` from what changed (`feat`, `fix`, `docs`, `test`, `refactor`, `chore`) and `<scope>` the main module or area; body: one line `Task: <task-id>`. Post the handoff comment (from the result, plus the commit hash) with `--author <actor>`, then `bd close <id> -r "<summary>" --actor <actor> --json`.
   - **`status: partial`** counts as not accepted.
   - **Not accepted, first time:** send the same subagent the concrete gap (failing check, missed criterion, out-of-scope file) and wait for a new result.
   - **Not accepted twice, or `status: blocked`:** do not commit. Post a handoff comment with `Status: blocked` and the reason, then `bd update <id> -s blocked --actor <actor> --json`. Leave its changes in the worktree and treat its files as locked for the rest of the run.
   - **Follow-ups** in a result become new tasks (description ends with a `Files:` line on its own line): `bd create "<title>" --parent <epic-id> --deps discovered-from:<id> -d "<description>" --acceptance "…" --actor <actor> --json`. If the follow-up needs work that is still open, add `blocked-by:<that-id>` to `--deps`. They join later waves.
6. When every result of the wave is handled, go back to step 1.

## Briefing

Fill every `<…>` from `bd show <id> --json --include-comments` (`comments: null` means none) and the PRD. Paste the text itself; the subagent cannot read this skill or the tracker. If the task description tells the reader to look something up in beads, paste that content into the briefing instead.

```text
You are implementing one task of project "<project name>" (task <task-id>).

Repository: <absolute repo path>. Work only inside it.

## Project context
<from the PRD: Goal, Non-goals, Constraints and decisions, plus any other section the task refers to>

## Task: <title>
<description>

## Acceptance criteria
<acceptance criteria>

## Files you may change
<Files list>
If the task needs changes to any other file, stop and report it under blockers instead of editing it.

## Earlier comments on this task
<comments, oldest first, or "none">

## Rules
- Implement the task, then verify it against the acceptance criteria with the project's own tests, build, linters, or a direct run of the changed behavior.
- <only when other tasks run in the same wave:> Other agents are editing other files in this same worktree right now. Do not touch, format, revert, or stage files outside your list.
- Do not run git commands that change state: no add, commit, stash, reset, checkout, rebase, merge, or push.
- Do not run bd commands that write (claim, update, close, create, comments add). The orchestrator owns the tracker.
- Do not ask questions; if something is ambiguous, choose the conservative reading and say so in the summary.

## Return exactly this block and nothing after it
<result>
status: done | partial | blocked
files_changed: <paths>
verification: <commands run and their outcome>
summary: <what changed and any judgment calls>
follow_ups: <new work discovered, one per line, or none>
blockers: <what stopped you, or none>
</result>
```

## Review

When a wave comes back empty:

1. If nothing was committed in this run, skip to Report.
2. Run the `code-review` skill on the local range `<start>..HEAD`. That skill spawns the review subagent; do not review inline.
3. Each finding under "Must fix" or "Should fix" becomes a task in the project:
   `bd create "<finding headline>" --parent <epic-id> -t bug -l review -d "<finding: trigger, impact, example, fix direction; last line Files: <cited files>>" --acceptance "<fix direction as an observable result>" --actor <actor> --json`.
   Do not fix them in this run unless the user asks; they will show up in the next `bd ready`.

## Report

Finish with a table of the tasks handled in this run (id, title, result, commit hash), the tasks left blocked with their reasons, the review tasks created, and what `bd ready --parent <epic-id>` shows next.
