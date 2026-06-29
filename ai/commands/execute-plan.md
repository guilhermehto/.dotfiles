---
description: Execute a local .scriptorum/ plan phase-by-phase — dispatch enginseer per step, run parallel phases concurrently, tick progress, and close with a diff review
argument-hint: "[slug]"
---

Load the `plan-workflow` skill before doing anything else. It defines the scriptorum root, slug-to-file resolution, the phased body schema, the parallelization model, the per-step contract fields, the checkbox grammar, and the direct-write operations (tick-task, append-note, update-status) you perform yourself. There is no writer subagent — you write the plan file directly.

Arguments: $ARGUMENTS

This command runs a written plan to completion by dispatching the `enginseer` subagent for each step and tracking progress in the plan file. You orchestrate and track; `enginseer` implements. You do the plan-file writes and (in parallel phases) the commits yourself.

## On entry

1. **Resolve the plan.**
   - If `$ARGUMENTS` names a slug, resolve it via `plan-workflow` slug-to-file resolution. On multi-date collision, ask the user to disambiguate by date.
   - If `$ARGUMENTS` is empty, list `.scriptorum/*--*.md` with `status ∈ {not-started, in-progress, unknown}` sorted by `updated` desc and ask the user to pick.
2. **Read and parse.** Frontmatter: `status`, `goal`, `weight` (default `standard` if absent), `supersedes`, `updated`. Body: the `## Steps` phases (each `### Phase N — <name> · <parallel|sequential>`), the global step numbers and their contract fields, and `## Acceptance criteria`.
3. **Handle status edge cases.**
   - `complete` → report `Plan <slug> is already complete (updated <date>).` Ask: reopen (`update-status in-progress`) / start fresh / nothing.
   - `abandoned` → similar; offer to reopen or stay closed.
   - `not-started` → the first tick auto-promotes to `in-progress`. Proceed.
   - `in-progress` / `unknown` → proceed.
4. **Print the board.** A Kanban-style view, phases as columns drained top to bottom:
   ```
   Plan: <slug>  (status: in-progress, updated <date>, weight: <weight>)
   Goal: <goal>

   Phase 1 — Foundations · parallel        [2/2 done]
     1. [x] <step>
     2. [x] <step>
   Phase 2 — Endpoint · sequential          [0/1 done]
     3. [ ] <step>          ← next

   Acceptance criteria: [0/3 verified]
     - [ ] <criterion>
     ...
   ```
   Show every phase, its mode, and its done count. Mark the first `[ ]` step `← next`.

## Reacting to the user

Interpret natural-language direction and act:

| User says | Action |
|---|---|
| "Execute step N." | Dispatch `enginseer` for step N (see dispatch + commit rules). Tick on success. |
| "Run phase N." / "Run the next phase." | Execute every unticked step in that phase per its mode (parallel → concurrent wave; sequential → one at a time). Gate at the phase boundary. |
| "Go." / "Run the rest." / "Execute all remaining." | **Autopilot.** Walk all remaining phases in order (below). |
| "Step N is blocked — <reason>." | `append-note` on step N (checkbox stays `[ ]`). |
| "Untick step N." | `tick-task` step N state=undone. |
| "Add a note to step N: <text>." | `append-note` on step N. |
| "Acceptance criterion K passes." | `tick-task` section=acceptance-criteria index=K state=done. |
| "The plan is wrong — <what changed>." | Pause-and-amend (below). |
| "Mark this plan complete." | Run **Close**. |
| "Abandon this plan." | `update-status abandoned`. Report and stop. |
| "What's left?" / "Show the board." | Re-print the board. No mutation. |
| "Show the plan." | Print the full body. No mutation. |

After every tick following an enginseer commit, print a one-line confirmation with the new state and SHA: `Step 3 → done (commit abc1234). Phase 2 now 1/1; plan 3/3.`

## Dispatching enginseer

Dispatch `enginseer` via the `task` tool. The prompt **must** start with the sentinel `[DISPATCH: execute-plan]`. Hoist the step's contract from the plan **verbatim** — invent nothing at dispatch time.

```
[DISPATCH: execute-plan]
Plan: <abs-path-to-plan-file>
Weight: <light | standard | heavy, or "standard" if absent>
Commit: <yes | no>
Step <N>: <step text verbatim>
Outcome: <Outcome: line verbatim, or "see step text">
Context: <Context: line verbatim, or "none">
Read first: <Read first: line verbatim, or "none">
Done when:
  - <observable outcome verbatim>
  - <observable outcome verbatim>
Touchpoints: <per-step Touchpoints: verbatim, or the relevant subset of ## File touchpoints>
Anti-touch: <verbatim, or "none">
Verification: <verbatim, or "none">
Independent Test: <verbatim, or "none">
Pre-conditions: <verbatim, or "none">
Plan-level acceptance (relevant): <subset of ## Acceptance criteria this step affects, or "none">

Execute this step. Touch only the named touchpoints. Read first before editing. Independent Test is your behavioral confidence gate. Return one structured <result> block.
```

Rules:

- **Sentinel is non-negotiable.** Without `[DISPATCH: execute-plan]` on the first line, enginseer cannot tell a real plan dispatch from a stray invocation.
- **Always include every labelled line**, even when it resolves to "none". Enginseer relies on the shape.
- **Verbatim hoisting only.** Never paraphrase the step text or sub-items. If the plan is wrong, run pause-and-amend — don't "fix" content at dispatch time.
- **Light-weight steps** have no sub-items: fall back to `Done when: <step text restated as one outcome>`; `Touchpoints:` from `## File touchpoints` filtered to what the step mentions; `Context: none`, `Read first: none`, `Outcome: see step text`, `Independent Test: none`.
- **`Commit:` is set by the phase mode** — see below.

## Phase modes

Walk phases in document order. A phase must fully drain (all steps ticked, no open blockers) before the next begins. Never cross a phase boundary with parallelism.

### Sequential phase

For each unticked step, top to bottom:

1. Dispatch `enginseer` with `Commit: yes`.
2. Surface the returned `<result>` block.
3. If `blockers` is empty and `committed` is a SHA → `tick-task` the step directly (note the SHA). Print the confirmation.
4. If `committed: not run` (no-op — already satisfied) → still tick, noting the no-op.
5. If `blockers` is set → **stop the phase.** Do not dispatch later steps. Surface the blocker and wait for direction.

### Parallel phase

1. **Re-verify disjointness.** Collect the `Touchpoints:` of every unticked step in the phase. If any two share a file, do **not** parallelize: either run the phase sequentially this time and note it, or pause-and-amend. The plan-level invariant should already guarantee disjointness — this is the executor's safety net.
2. **Dispatch the whole wave concurrently.** Issue one `enginseer` `task` call per unticked step, all in a **single message**, each with `Commit: no`. With `Commit: no`, enginseer edits + verifies, leaves the worktree dirty, and returns its changed paths plus a suggested commit subject — it does **not** commit.
3. **Collect all results.** Then, **serially** (never concurrently — git's index takes a lock), for each step whose result has no blocker and a non-empty changed-files list:
   - Stage only that step's files by explicit pathspec: `git add -- <path> [<path> ...]`. Never `git add -A`/`.`/`--all`. Disjoint touchpoints make this clean even though other steps' files are also dirty.
   - Match repo style (`git log -n 10 --oneline`) and commit with the enginseer's suggested subject in Conventional Commits format: `git commit -m "<type>(<scope>): <subject>"`. Capture the SHA.
   - `tick-task` the step (note the SHA).
   - Print the confirmation.
4. **Blocked steps** stay unticked; surface each. Their dirty files remain in the worktree for inspection — do not commit them.
5. **Gate.** Only advance to the next phase once this one is fully drained. If a step is blocked, stop and wait for direction.

**Why serialized commits in parallel phases:** the speed win is in the implementation work (read + edit + verify), which runs concurrently. Commits are fast and must be serialized so two enginseers never race on `.git/index`. So enginseers parallelize the slow part and you, the main agent, serialize the fast part.

## Autopilot

When the user says "go" / "run the rest" / "execute all remaining", walk every remaining phase in order, applying the phase-mode rules above. Stop conditions:

- **Blocker.** Any step returns a blocker → stop the loop. Print `Autopilot stopped in phase <P> at step <N>. Blocker: <one-liner>. Plan now X/Y.` Wait for direction.
- **End of plan.** When the last unticked step ticks, print `All steps complete (X/X). Run Close to verify acceptance criteria and transition to complete?` Wait. **Do not auto-transition to `complete`.**

Autopilot constraints:

- **Phase order is law.** Never run steps from different phases concurrently. Parallelism is only ever within one phase.
- **No mid-loop questions.** If a step is ambiguous or wrong, that's a plan defect: enginseer returns a blocker, the loop stops, handle it via pause-and-amend on the next turn.
- **No acceptance-criteria auto-check.** Autopilot only walks `## Steps`. Acceptance criteria stay user-driven.
- **Bounded variants** ("run phase N", "run the next phase") run that one phase, print the board, and stop — no Close prompt.

## Pause-and-amend

If the user reports the plan itself is wrong (a step is impossible, a touchpoint moved, an assumption broke, a parallel phase isn't actually disjoint), do **not** silently work around it. Ask a multiple-choice question with three options:

- **Amend the plan** → propose a revised body fixing the affected sections (re-phasing if disjointness broke), show it, and on confirmation perform a direct `write-plan` with `overwrite: true`. Re-dispatch `logis` if the change was substantial. Resume.
- **Continue with a caveat** → `append-note` on the affected step explaining the deviation. Continue.
- **Abandon the plan** → `update-status abandoned`. Stop.

## Close

Triggered by "mark complete" / "this is done", or after autopilot drains the last step and the user confirms.

1. **Coverage check.** If any `## Steps` or `## Acceptance criteria` are still `[ ]`, surface them and ask: tick remaining / waive (via `append-note` with a justification) / abort the Close.
2. **Diff review.** Load the `code-review` skill to review the working-tree diff against `HEAD` (or since the plan started, if a meaningful base ref is known). This is a local change review, so the skill will spawn a review subagent. Surface its output verbatim.
3. **Triage.**
   - Blocking issues → surface; ask whether to (a) leave the plan open for fixing, (b) record as a `> note:` on a step, or (c) waive with the user's acknowledgement.
   - Non-blocking → surface; default is defer unless the user wants to act.
4. **Mark complete.** Perform a direct `update-status complete`. Report the final path.
5. **Summarize** in the compact shape from `ai/AGENTS.md`:
   ```
   - Changed: <what landed across all steps>
   - Verified: <diff review + any acceptance checks>
   - Notes: <important caveats — e.g. criterion N waived per user>
   ```
   If any work is uncommitted (e.g. a blocked parallel step left dirty), say so. Offer a commit via `servitor` if the user wants one. Do not commit unprompted beyond the per-step commits this command already makes.

## Hard rules

- **You write the plan file directly** — every tick-task, append-note, and update-status is your own edit, following `plan-workflow`. There is no writer subagent.
- **Orchestrate implementation; don't hand-write the code yourself.** Dispatch `enginseer` for step work so phases can parallelize. (You still do the plan-file writes and the parallel-phase commits.)
- **Parallelism is within a single phase only.** Never run steps from different phases concurrently. Always re-verify touchpoint disjointness before a parallel wave; fall back to sequential on overlap.
- **Serialize commits.** In a parallel phase, enginseers run with `Commit: no`; you commit each successful step serially by explicit pathspec. Never `git add -A`/`.`/`--all`.
- **Never auto-set `status: complete`.** Completion is an explicit `update-status complete` at the end of Close, after coverage + diff review.
- **Never skip the Close diff review.** The `code-review` skill runs before completing. Surface its output even when clean.
- **Never commit on a verification failure.** A blocked step's files stay dirty for inspection.
- **Never `git push`, `git commit --amend`, `git rebase`, `git reset --hard`, `git stash`, or `git checkout` with paths.**
- **Match `ai/AGENTS.md`:** direct, concise, outcome-first. Don't restate the request; don't narrate obvious steps.
