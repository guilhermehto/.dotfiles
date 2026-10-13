---
name: project-tasks
description: Machine-wide store of projects, PRDs, and tasks shared by every agent and repo (beads `bd`, one global database). Use when the user names a project ("work on project X", "plan project X", "what's left on X", "add a task to X"), asks to persist a plan, PRD, or tasks so another agent can continue later, asks which projects exist, or hands work off. Load alongside the `beads` skill; where they differ, this skill wins.
---

# project-tasks

All projects and tasks on this machine live in one beads store, shared across every repo and every agent (Claude Code, Codex, omp, opencode). Anything planned here must be resumable by a different agent in a different session.

## Store

- The store is `$BEADS_DIR` (`~/.local/share/beads/.beads`), exported from `~/.zshenv`. Every `bd` command works from any directory.
- First command of every session: `bd where`. Its first line must be the store path, ending in `.local/share/beads/.beads` (macOS may show it with symlinks resolved). If it errors or names any other directory, stop and report the problem to the user.
- Never run `bd init`, never create a `.beads/` directory in a repo, never pass `--global`, never run `bd reclaim`, `bd delete`, `bd prune`, `bd purge`, or `bd setup` unless the user asks.
- The generic beads guidance (`bd prime`, the `beads` skill) says to track ALL work in beads and to `bd init` when no database is found. Ignore both on this machine. Track only work that belongs to a named project or that the user asks to persist; a session's own step checklist stays in the harness todo tool.
- Read with `--json` and parse it. Warnings go to stderr; never parse stderr.
- Never use `bd edit` (opens `$EDITOR`). Never use `--notes` on update (it replaces); use `--append-notes`.

## Identity

Pick one actor name per session and reuse it on every write: `<harness>-<4 random hex>` (hex from `openssl rand -hex 2`), e.g. `codex-3f9a`, `claude-b21c`, `omp-07de`. Pass it as `--actor <actor>` on writes and `--author <actor>` on comments.

The name must be unique per session: `--claim` is idempotent for the same actor, so two sessions sharing a name could both "claim" one task.

## Model

| Concept | In beads |
|---|---|
| Project | Epic. Title = human name. Label `project:<slug>` (kebab-case). |
| PRD | The epic's description (markdown, template below). |
| Repos | `Repos:` line at the top of the PRD: absolute paths, comma-separated. |
| Task | Child of the epic (`--parent <epic-id>`); inherits the `project:<slug>` label. |
| Status | `open` = todo, `in_progress` = claimed, `closed` = done, `blocked` = stuck. |
| Expected files | `Files:` line in the task description; `execute-tasks` uses it to decide what can run in parallel. |
| Dependency | `--deps blocked-by:<id>` (several: `--deps blocked-by:<a>,blocked-by:<b>`), only when one task truly cannot start before another finishes. |
| Handoff log | Comments on the task (`bd comments add`). |

## Find a project

```bash
bd list -t epic -l project:<slug> --json          # exact
bd list -t epic --all --json                      # everything, to match by title
```

Match the user's name against slug and title. If nothing matches, say so and offer to plan it. If more than one plausibly matches, ask which one. To list projects for the user, show title, slug, id, and status from `bd list -t epic --json`; `bd epic status` shows completion counts.

## Plan a project

Use this when the user asks to plan a new project, or to add scope to an existing one.

1. Look for an existing project first (above). Extend it instead of creating a duplicate.
2. If the goal, scope, or success criteria are unclear, align with the user first (the `catechism` skill) before writing anything.
3. Write the PRD to a temporary file using this template. The PRD describes the vision and the requirements; it is not a step list, because the tasks are the steps.

   ```markdown
   Repos: /abs/path/one[, /abs/path/two]

   # <Project name>

   ## Problem
   ## Goal
   ## Users and use cases
   ## Scope
   ## Non-goals
   ## Success criteria
   ## Constraints and decisions
   ```

4. Create the epic:

   ```bash
   bd create "<Project name>" -t epic -l project:<slug> --body-file <prd.md> --actor <actor> --json
   ```

5. Create the tasks, one per independently shippable step, each small enough for one agent session:

   ```bash
   bd create "<imperative title>" --parent <epic-id> \
     -d "<why this exists and what to do; self-contained for an agent that has not read the conversation and cannot query beads>
   Files: path/a.ts, path/b.ts" \
     --acceptance "<observable result that proves it is done, with exact inputs and expected outputs>" \
     --actor <actor> --json
   ```

   Add `--deps blocked-by:<id>` for real ordering constraints: the task calls, extends, tests, or documents what another task produces. Give each task a `Files:` line naming the files you expect it to touch (paths relative to the repo; add `repo:<path>` prefixes only if the project spans several repos). Tasks whose `Files:` overlap will run one after another under `execute-tasks`; split files where the design naturally allows it, but don't distort the design to gain parallelism.

6. Show the user the epic id and a table of the created tasks (id, title, depends on).

## Work on a project

1. `bd where`, then find the project's epic.
2. Read the PRD: `bd show <epic-id> --json`. `cd` into the repo from its `Repos:` line.
3. See what others are doing: `bd list --parent <epic-id> -s in_progress --json`.
4. Pick work: `bd ready --parent <epic-id> --exclude-type epic --json`. Read the task with its history: `bd show <id> --json --include-comments`.
5. Claim it: `bd update <id> --claim --actor <actor> --json`. If that fails with "already claimed", pick another task; never take over a claim with `--force`. Claims carry a short lease (`lease_expires_at`); it only matters to `bd reclaim`, which is never run here, so no heartbeat is needed.
6. Do the work. New work you discover goes into the project, not into your head:
   `bd create "<title>" --parent <epic-id> --deps discovered-from:<id> -d "…" --acceptance "…" --actor <actor> --json`.
7. Finish:
   - Done and verified → handoff comment, then `bd close <id> -r "<one-line summary>" --actor <actor> --json`.
   - Stopping before it is done → handoff comment, then `bd unclaim <id> -r "<why>" --actor <actor>` so another agent can pick it up.
   - Stuck on something outside your control → handoff comment, then `bd update <id> -s blocked --actor <actor> --json`.
8. Never close a task you have not verified. Never close the epic; ask the user when every task is closed.

## Handoff comment

Write it to a temporary file and attach it with `bd comments add <id> -f <file> --author <actor>`:

```text
Status: done | partial | blocked
Did: <what changed, with file paths>
Verified: <commands run and their result>
Next: <what the next agent should do first>
Blockers: <or none>
```

## Editing the PRD

1. Re-read it right before editing (`bd show <epic-id> --json`); another agent may have changed it.
2. Write the full new PRD to a file and apply it: `bd update <epic-id> --body-file <prd.md> --actor <actor> --json`.
3. Log the change on the epic: `bd comments add <epic-id> "PRD: <what changed and why>" --author <actor>`.

Change the PRD only when the user agrees with the change in scope or requirements.
