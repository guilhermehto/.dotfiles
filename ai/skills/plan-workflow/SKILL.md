---
name: plan-workflow
description: Local implementation-plan workspace at .scriptorum/YYYY-MM-DD--<slug>.md. Load when handling /plan, /plan-list, /work, or whenever the user mentions writing, listing, updating, or reviewing a local plan. Encodes the scriptorum root resolution, slug rules, frontmatter schema, plan body template (with checkbox tasks), citation format, overwrite policy, status semantics, and the magos-artisan delegation contract (write-plan, update-status, tick-task, append-note, supersede). Required for any read or write under .scriptorum/.
---

# plan-workflow

Conventions for the local implementation-plan workspace at `<repo-root>/.scriptorum/`. The `/plan`, `/plan-list`, `/work` commands, the `magos-iterator` (planner-only) and `magos-fabricator` (light end-to-end) primary agents, and the `magos-artisan` subagent must follow these rules.

This skill is the local-task counterpart to a future KB workflow. It captures the structured, trackable plan for a single in-the-moment task next to the code it touches.

## Scriptorum root resolution

The scriptorum root is the directory that contains `.scriptorum/`.

1. Run `git rev-parse --show-toplevel`. If it succeeds, that is the scriptorum root.
2. If the current directory is not inside a git repo, fall back to the current working directory and print to the user: `No git repo found; using cwd as scriptorum root: <abs-path>`.
3. The full plan directory is `<scriptorum-root>/.scriptorum/`. Create it on first write (`mkdir -p`).

When citing the path back to the user, use the absolute path so it is unambiguous.

## Directory layout

```
<scriptorum-root>/
└── .scriptorum/
    └── YYYY-MM-DD--<slug>.md
```

Flat. No subdirectories. No archive folder. The user manages lifecycle by editing or deleting files.

`.scriptorum/` is **not** added to `.gitignore` by any command. Whether to commit or ignore is the user's call.

## Filename format

Filenames use a date prefix so the most recent plan is unambiguous by lex-sort:

```
YYYY-MM-DD--<slug>.md
```

- `YYYY-MM-DD` is the ISO date of plan creation (matches `created` in frontmatter at write time).
- `--` is a literal double-hyphen separator (matches the KB plan convention historically used elsewhere).
- `<slug>` follows the slug rules below.

Multiple plans for the same slug on different days are allowed. Two plans with the **same** date and **same** slug are not — `/plan` prompts to overwrite.

### Legacy filenames

Files of the shape `<slug>.md` (no date prefix) are **legacy plans** created before the format upgrade. They are read-compatible but never created. When `magos-artisan` resolves a slug for an update action, it looks for `*--<slug>.md` first; if zero matches, it falls back to the legacy `<slug>.md`. See [Slug-to-file resolution](#slug-to-file-resolution).

## Slug rules

The slug is the part of the filename after the date prefix. It comes from the catechism recap's `Goal:` line and never from raw `$ARGUMENTS`.

Derivation:

1. Take the recap's `Goal:` line (the single line after `Goal:` in the alignment recap).
2. Lowercase.
3. Replace whitespace runs with `-`.
4. Strip every character not in `[a-z0-9-]`.
5. Collapse repeated `-` into a single `-`.
6. Trim leading/trailing `-`.
7. Cap length at 60 characters. If the raw slug is longer, cut at the last `-` boundary that keeps the result ≤60 chars (so the slug always ends on a whole word). If even the first word is >60 chars, truncate hard at 60.

Example:

- Goal: `A local /plan command that generates structured implementation plans for in-the-moment tasks` → `a-local-plan-command-that-generates-structured` (47 chars; cut at the last `-` ≤60 so we don't end mid-word in `implementation`)

If the derived slug is empty after sanitization (very rare — only happens if the Goal line has no `[a-z0-9]` content), the command errors with `Could not derive a slug from the catechism Goal line. Refine the goal and re-run.`

## Frontmatter schema

Plan files have YAML frontmatter:

```yaml
---
created: 2026-05-19
updated: 2026-05-19
slug: <slug>
goal: <single-line goal, copied verbatim from the catechism recap's Goal: line>
status: not-started
supersedes: []
---
```

Rules:

- `created` is the ISO date of first write. **Never** bumped on overwrite or any update action.
- `updated` is the ISO date of the last write or mutation. Bumped on every `write-plan`, `update-status`, `tick-task`, `append-note`, and `supersede` action. On first write, equals `created`.
- `slug` matches the filename slug component (the part after `YYYY-MM-DD--`).
- `goal` is one line; embedded newlines are flattened to spaces before writing.
- `status` is one of: `not-started`, `in-progress`, `complete`, `abandoned`. Defaults to `not-started` on creation.
- `supersedes` is a list of slugs (without date prefix) that this plan replaces. Optional; defaults to `[]`. Setting a value also marks each referenced predecessor as `abandoned` via the `supersede` action.
- Unknown fields in an existing file are preserved on rewrite.

### Status semantics

| Status | Meaning | Set by |
|---|---|---|
| `not-started` | Plan exists but no step has been ticked. | `write-plan` (initial). |
| `in-progress` | At least one step has been ticked **or** explicitly set. | First `tick-task done` auto-promotes from `not-started`; or explicit `update-status in-progress`. |
| `complete` | All work is done; plan is closed. | Explicit `update-status complete` only. Never auto-set, even when all checkboxes are ticked — completion is a deliberate decision. |
| `abandoned` | Plan is no longer being pursued. Kept on disk for history. | Explicit `update-status abandoned`, or implicitly by a `supersede` action on another plan. |

### Legacy frontmatter

Plans written before the format upgrade lack `updated`, `status`, and `supersedes`. When reading a legacy plan:

- Missing `updated` → fall back to `created` for display/sort.
- Missing `status` → display as `unknown`. Consumers (`/plan-list`, `/work`) treat `unknown` as eligible for resume and may prompt to set a real status on first contact.
- Missing `supersedes` → treat as `[]`.

Do **not** silently upgrade legacy frontmatter on read. Only an explicit `write-plan` or `update-status` action upgrades a legacy file in place (preserving the original `created`).

## Plan body template

After the frontmatter, the plan body has these five sections in this exact order. Each section heading is `## <Name>` at level 2.

```markdown
# <H1: short human title — derived from the Goal>

## Summary
<1-3 sentences: what this plan does and why.>

## Scope
- <bullet list of what is in this pass>

## Numbered steps
1. [ ] <step — concrete, executable>
2. [ ] <step>
3. [ ] <step>

## Acceptance criteria
- [ ] <observable criterion>
- [ ] <observable criterion>

## File touchpoints
- `path/to/file.ts:42` — <new | update> — <one-line note>
- `path/to/other.ts` — <new | update> — <one-line note>
```

Notes:

- The H1 is a short human title for the plan, not the full goal sentence. Derive it from the goal (e.g. trim to ~6-10 words, title-case acceptable).
- Section names are fixed. Do **not** add `Out of scope`, `Risks`, `Open questions`, or `Verification` sections by default — the agreed minimum is five. The user can extend a written plan manually.
- The catechism recap is **not** embedded in the plan body. It drives slug + body synthesis only.

### Checkbox grammar

Numbered steps and acceptance criteria use GitHub-flavoured markdown checkboxes so progress is human-readable and machine-tickable.

| Token | Meaning |
|---|---|
| `- [ ]` or `1. [ ]` | Not done. |
| `- [x]` or `1. [x]` | Done. |
| Unchecked + `> note:` line below | Skipped, blocked, or failed — see the note. |

Failed/skipped convention:

```markdown
3. [ ] Run the migration on staging.
   > note: skipped — staging DB is being rebuilt this week; revisit after Friday.
```

The checkbox stays **unchecked** (the work was not done). The `> note:` blockquote, indented to align under the step text, captures the reason. Multiple `> note:` lines may accrue under one step over time.

There is no third checkbox state — the failed/skipped distinction lives in the note, not the box. This keeps grep simple (`rg '^\s*[-0-9]+\. \[ \]'` finds work-to-do) and avoids inventing a non-standard markdown token.

### Auto-promotion rule

When `tick-task` ticks the first step of a plan whose status is `not-started`, `magos-artisan` also bumps the status to `in-progress` in the same write. No auto-promotion in the other direction — completion is always explicit.

## Citation format

Citations to existing code use plain `path:line`, relative to the scriptorum root:

```
src/auth/login.ts:142
packages/api/handlers/orders.ts:88
```

No repo aliases (local plans are single-repo).
No backticks required in running prose, but backtick-wrap them in bullet lists for readability.
A bare `path` (no line) is allowed when referring to a whole new file to create.

## Slug-to-file resolution

`magos-artisan` and any reader (`/plan-list`, `/work`) resolve a slug to a file as follows:

1. Glob `<scriptorum-root>/.scriptorum/*--<slug>.md`.
2. If exactly one match → that's the file.
3. If multiple matches → slug collision across dates. The reader/writer takes context-appropriate action:
   - **Update actions** (`update-status`, `tick-task`, `append-note`, `supersede`): error with `Slug "<slug>" matches multiple plans: <list>. Disambiguate with the dated filename.`
   - **`write-plan` with `overwrite: false`**: error `Slug "<slug>" already in use across <N> plans on dates <list>. Use a different slug or overwrite an existing date.`
   - **`write-plan` with `overwrite: true`**: error — overwrite requires unambiguous target. Caller must specify the date.
4. If zero matches → check legacy `<scriptorum-root>/.scriptorum/<slug>.md`. If it exists, that's the file.
5. If still zero matches and the action is `write-plan`: create `<scriptorum-root>/.scriptorum/<TODAY>--<slug>.md`.
6. If still zero matches and the action is an update: error with `No plan found for slug "<slug>".`

## Overwrite policy

`/plan` enforces a single rule when a plan with the same slug already exists today (`<TODAY>--<slug>.md` resolves to one file):

1. Prompt the user: `Plan exists at <path>. Overwrite? [y/N]`.
2. Default is N. Empty answer or anything other than `y`/`Y` → abort with `Aborted; existing plan not modified.` and write nothing.
3. On `y`/`Y` → dispatch to `magos-artisan` with `overwrite: true`. The artisan preserves `created` from the existing file's frontmatter; only `updated`, `slug`, `goal`, body, and (optionally) `status` are updated.

Plans on a **different** date with the same slug do not collide for `write-plan` — they create a new dated file. The caller is responsible for using `supersede` if they intend the new plan to replace the old one.

## Catechism dependency

`/plan` always runs the catechism interview before synthesis:

1. Load the `catechism` skill.
2. Run the protocol (rounds, multiple-choice via the `question` tool, recap).
3. Wait for affirmative confirmation of the recap.
4. Only then derive the slug and synthesize the body.

If the user aborts mid-interview (`stop`, `cancel`, `never mind`, or equivalent), write nothing and exit cleanly with `Aborted; no plan written.`

If `$ARGUMENTS` is empty, the catechism still runs — synthesis is driven by the recap, not the args.

`magos-iterator` follows the same rule for the heavy work flow, but may **skip** the catechism when the incoming task description already contains an explicit goal, scope, and constraints (see `magos-iterator`'s own prompt for the skip heuristic).

## magos-artisan delegation contract

`magos-artisan` is the sole writer under `.scriptorum/`. Every consumer that mutates a plan file invokes it via the `task` tool with a structured request. Supported actions:

### `action: write-plan`

Create a new plan file or overwrite an existing one for today.

```
action: write-plan
payload:
  slug: <slug>
  goal: <single-line goal>
  title: <H1 title>
  body: <markdown body, sections only — no frontmatter>
  overwrite: <true | false>
  supersedes: [<slug>, ...]   # optional, default []
```

Artisan:

1. Resolves the target path: `<root>/.scriptorum/<TODAY>--<slug>.md`.
2. Honours overwrite policy (above).
3. Validates `path:line` citations in `body` (warn-only).
4. Writes frontmatter (`created`, `updated`, `slug`, `goal`, `status: not-started`, `supersedes`) followed by the body.
5. If `supersedes` is non-empty, dispatches an internal `update-status abandoned` on each referenced slug.
6. Returns `{action, path, created, updated, overwrote, citation_warnings, superseded}`.

### `action: update-status`

Change the `status` field on an existing plan.

```
action: update-status
payload:
  slug: <slug>
  status: not-started | in-progress | complete | abandoned
  date: <YYYY-MM-DD>   # optional; required only to disambiguate slug collision
```

Artisan:

1. Resolves the file via [slug-to-file resolution](#slug-to-file-resolution). If `date` is provided, prefer `<date>--<slug>.md` exactly.
2. Rejects unknown status values with `Invalid status "<value>". Allowed: not-started, in-progress, complete, abandoned.`
3. Updates `status` and bumps `updated` to today.
4. Returns `{action, path, previous_status, new_status, updated}`.

### `action: tick-task`

Tick or untick a checkbox under `## Numbered steps` or `## Acceptance criteria`.

```
action: tick-task
payload:
  slug: <slug>
  section: numbered-steps | acceptance-criteria
  index: <1-based integer>
  state: done | undone
  note: <optional short string — appended as a `> note:` line under the step>
  date: <YYYY-MM-DD>   # optional; disambiguation only
```

Artisan:

1. Resolves the file.
2. Locates the section. If missing, errors.
3. Locates the `index`th checkbox in that section (1-based, in document order). If out of range, errors with `Section "<name>" has only <N> checkboxes; index <I> out of range.`
4. Toggles the checkbox text: `[ ]` ↔ `[x]` per `state`.
5. If `note` is provided, appends a new `> note: <note>` line **after** the step's existing lines (preserving any existing notes). Indents to align with the step body.
6. Bumps `updated`.
7. **Auto-promotion**: if `state == done`, the plan's status is `not-started`, and this was the first tick, also set `status: in-progress`.
8. Returns `{action, path, section, index, previous_state, new_state, status_changed, updated}`.

### `action: append-note`

Append a `> note:` line to a step without changing the checkbox.

```
action: append-note
payload:
  slug: <slug>
  section: numbered-steps | acceptance-criteria
  index: <1-based integer>
  note: <short string>
  date: <YYYY-MM-DD>   # optional
```

Used for "skipped — reason", "blocked — see ticket", "tried and reverted because …", etc.

Artisan:

1. Resolves the file and the step (same as `tick-task`).
2. Appends `> note: <note>` aligned under the step.
3. Bumps `updated`.
4. Returns `{action, path, section, index, note, updated}`.

### `action: supersede`

Mark this plan as the successor of one or more older plans, abandoning them.

```
action: supersede
payload:
  slug: <slug>                  # the new (successor) plan
  predecessors: [<slug>, ...]   # the plans this replaces
  date: <YYYY-MM-DD>            # optional; disambiguation for the successor
```

Artisan:

1. Resolves the successor file.
2. For each predecessor slug: resolves the file (errors if not found), runs `update-status abandoned` on it.
3. Sets `supersedes: [<predecessor-slugs>]` on the successor frontmatter (overwriting any existing list).
4. Bumps `updated` on the successor.
5. Returns `{action, path, supersedes, abandoned: [{slug, path}, ...]}`.

### Citation validation (write-plan only)

After staging the body but before writing, artisan validates every `path:line` citation in `body`:

1. Extract every `<path>:<N>` occurrence where `<path>` is a relative path (no leading `/`, no `:`-in-the-path) and `<N>` is a positive integer. Match inside backticks and outside.
2. For each match, resolve `<scriptorum-root>/<path>`.
3. If the file does not exist OR has fewer than `N` lines, record a warning: `{path, line, reason: "missing" | "out-of-range"}`.
4. Bare `<path>` references without a line number are **not** validated (they may legitimately point at files to be created).

Citation validation is warn-only. Do not block or modify the body. Surface warnings in the return as `citation_warnings`.

Other actions (`update-status`, `tick-task`, `append-note`, `supersede`) do **not** re-validate citations — they only touch frontmatter or checkbox lines.

### Hard scoping rules

- Compute the full intended absolute path BEFORE issuing any write. Resolve via `git rev-parse --show-toplevel`; on failure, use cwd and note the fallback in `notes`.
- Verify every target path begins with `<scriptorum-root>/.scriptorum/`. Refuse any path that escapes (e.g. via a slug containing `..`).
- Never write outside `.scriptorum/`. Never delete files. Never modify files in the rest of the repo. Never symlink.
- `mkdir -p <scriptorum-root>/.scriptorum` if the directory does not exist.

## /plan-list contract

`/plan-list [filter]` is read-only and does not invoke `magos-artisan`:

1. Resolve the scriptorum root.
2. If `.scriptorum/` does not exist, print `No plans yet. Run /plan <task> to create one.` and stop.
3. List `.scriptorum/*.md` (both `YYYY-MM-DD--<slug>.md` and legacy `<slug>.md`).
4. If `filter` is provided, keep only files whose `<slug>` substring-matches the filter (case-insensitive). The slug for a dated file is everything after `YYYY-MM-DD--`; for legacy files it's the filename stem.
5. For each remaining file, parse the YAML frontmatter and extract `created`, `updated`, `slug`, `status`, `goal`. If the frontmatter is malformed or missing fields, substitute per the [Legacy frontmatter](#legacy-frontmatter) rules; for completely missing fields with no fallback, use `?`.
6. Sort by `updated` descending. Ties broken by `slug` ascending. Entries with `updated: ?` sort last.
7. Print one line per plan in this shape (single-space gutters; status bracketed for scanability):
   ```
   [<marker>] <status>  <slug>  <updated>  <goal>
   ```
   Status markers:
   - `[ ]` not-started
   - `[~]` in-progress
   - `[x]` complete
   - `[-]` abandoned
   - `[?]` unknown (legacy)
   Pad the status name to 11 chars (longest is `not-started`) for column alignment; do not pad `slug` or `updated`.
8. If the filter matched nothing, print `No plans match '<filter>'.`

## /work contract

`/work` is the entry point for the orchestration agents (`magos-fabricator` for light end-to-end tasks, `magos-iterator` for deep planner-only tasks). It is a thin **router**; it does not do the work itself. See `commands/work.md` for the full behaviour. The relevant facts here:

- `/work` (no args) → resume mode: list `.scriptorum/*--*.md` plans with `status ∈ {not-started, in-progress, unknown}`, sorted newest first, and recommend switching into `magos-iterator` with the chosen slug.
- `/work <task>` → recommend switching into `magos-fabricator` with `<task>`.
- `/work --deep <task>` or `/work -d <task>` → recommend switching into `magos-iterator` with `<task>`.

Because opencode commands run inside the current agent and cannot directly switch primary agents, `/work` prints the recommended `@magos-fabricator <args>` / `@magos-iterator <args>` invocation and stops. The user runs it.

## Templates

### New plan file (created by `/plan` via `magos-artisan write-plan`)

```markdown
---
created: 2026-05-19
updated: 2026-05-19
slug: add-feature-flag-for-new-checkout
goal: Add a feature flag for the new checkout flow so we can roll it out to a subset of users.
status: not-started
supersedes: []
---

# Add feature flag for new checkout

## Summary
Wire a new boolean flag `checkout.v2` through the existing flag service so the new checkout flow can be enabled per-cohort without a deploy.

## Scope
- New flag definition in the flag registry.
- Wiring in `CheckoutPage` to branch on the flag.
- Default value: off in all environments.

## Numbered steps
1. [ ] Add `checkout.v2` to `src/flags/registry.ts:1` alongside existing entries.
2. [ ] Read the flag in `src/pages/CheckoutPage.tsx:24` and render `CheckoutV2` when on, `CheckoutV1` when off.
3. [ ] Update the flag-service mock in `tests/mocks/flags.ts:1` so tests can toggle it.

## Acceptance criteria
- [ ] `checkout.v2` appears in the flag registry and is `false` by default.
- [ ] `CheckoutPage` renders `CheckoutV2` when the flag is enabled, `CheckoutV1` otherwise.
- [ ] All existing `CheckoutPage` tests still pass with the flag off.

## File touchpoints
- `src/flags/registry.ts:1` — update — add `checkout.v2` entry.
- `src/pages/CheckoutPage.tsx:24` — update — branch on flag.
- `src/pages/CheckoutV2.tsx` — new — new flow shell.
- `tests/mocks/flags.ts:1` — update — expose toggle in tests.
```

### Plan after partial progress (post `tick-task` + `append-note`)

```markdown
---
created: 2026-05-19
updated: 2026-05-20
slug: add-feature-flag-for-new-checkout
goal: ...
status: in-progress
supersedes: []
---

# Add feature flag for new checkout

## Summary
...

## Scope
...

## Numbered steps
1. [x] Add `checkout.v2` to `src/flags/registry.ts:1` alongside existing entries.
2. [ ] Read the flag in `src/pages/CheckoutPage.tsx:24` and render `CheckoutV2` when on, `CheckoutV1` when off.
   > note: blocked — CheckoutPage was refactored yesterday; line 24 is now elsewhere. Re-locate before continuing.
3. [ ] Update the flag-service mock in `tests/mocks/flags.ts:1` so tests can toggle it.

## Acceptance criteria
- [x] `checkout.v2` appears in the flag registry and is `false` by default.
- [ ] `CheckoutPage` renders `CheckoutV2` when the flag is enabled, `CheckoutV1` otherwise.
- [ ] All existing `CheckoutPage` tests still pass with the flag off.

## File touchpoints
...
```

## Hard rules

- Never write outside `<scriptorum-root>/.scriptorum/`. The artisan computes the absolute path and refuses anything that escapes.
- Never modify the `created` field on any subsequent action — it is preserved from the existing file.
- Never auto-set `status: complete`. Completion is always an explicit `update-status complete`.
- Never embed the catechism recap verbatim in the plan body.
- Never use repo aliases in citations; `path:line` is plain.
- Never auto-version filenames on collision — always prompt the user with `Overwrite? [y/N]` for same-day collisions; new dates create new files.
- Never touch `.gitignore`.
- Citation validation is warn-only; never block a write on a missing line.
- All `.scriptorum/` mutations go through `magos-artisan`. Other agents may **read** plan files directly but must not edit them.
