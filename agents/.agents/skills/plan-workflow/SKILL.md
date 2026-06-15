---
name: plan-workflow
description: Local implementation-plan workspace at .scriptorum/YYYY-MM-DD--<slug>.md. Load when handling /plan, /execute-plan, /plan-list, or whenever the user mentions writing, listing, executing, updating, or reviewing a local plan. Encodes the scriptorum root resolution, slug rules, frontmatter schema, the phased plan body template (with parallel/sequential phases and rich-context checkbox steps), the parallelization model the executor consumes, citation format, overwrite policy, status semantics, and the direct-write operations (write-plan, update-status, tick-task, append-note, supersede) the main agent performs itself. Required for any read or write under .scriptorum/.
---

# plan-workflow

Conventions for the local implementation-plan workspace at `<repo-root>/.scriptorum/`. The `/plan`, `/execute-plan`, and `/plan-list` commands all follow these rules. The main agent (archmagos) is the sole writer — there is no separate writer subagent.

This skill is the local-task counterpart to a future KB workflow. It captures the structured, trackable plan for a single in-the-moment task next to the code it touches.

## Written vs. in-chat plans

Not every plan goes to disk. Trivial and small work uses the agent's in-chat numbered-bullet plan and never touches `.scriptorum/`. A **written** plan is for work that benefits from persistence: multi-step features, anything you want tracked across sessions, anything you intend to execute step-by-step (especially with parallel phases). When in doubt, stay in chat — `/plan` is opt-in.

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
- `--` is a literal double-hyphen separator.
- `<slug>` follows the slug rules below.

Multiple plans for the same slug on different days are allowed. Two plans with the **same** date and **same** slug are not — `/plan` prompts to overwrite.

### Legacy filenames

Files of the shape `<slug>.md` (no date prefix) are **legacy plans** created before the format upgrade. They are read-compatible but never created. When resolving a slug for an update action, look for `*--<slug>.md` first; if zero matches, fall back to the legacy `<slug>.md`. See [Slug-to-file resolution](#slug-to-file-resolution).

## Slug rules

The slug is the part of the filename after the date prefix. It comes from the catechism recap's `Goal:` line (or, when the catechism is skipped, the single-line goal the user confirmed) — never from the raw prompt text directly.

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
created: 2026-06-15
updated: 2026-06-15
slug: <slug>
goal: <single-line goal, copied verbatim from the catechism recap's Goal: line>
status: not-started
weight: standard
supersedes: []
---
```

Rules:

- `created` is the ISO date of first write. **Never** bumped on overwrite or any update action.
- `updated` is the ISO date of the last write or mutation. Bumped on every write-plan, update-status, tick-task, append-note, and supersede operation. On first write, equals `created`.
- `slug` matches the filename slug component (the part after `YYYY-MM-DD--`).
- `goal` is one line; embedded newlines are flattened to spaces before writing.
- `status` is one of: `not-started`, `in-progress`, `complete`, `abandoned`. Defaults to `not-started` on creation.
- `weight` is one of: `light`, `standard`, `heavy`. Optional; defaults to `standard`. Controls how meaty per-step contracts are — see [Step shape and weight](#step-shape-and-weight). Unknown values default to `standard` on read; preserve any value verbatim on rewrite.
- `supersedes` is a list of slugs (without date prefix) that this plan replaces. Optional; defaults to `[]`. Setting a value also marks each referenced predecessor as `abandoned` via the supersede operation.
- Unknown fields in an existing file are preserved on rewrite.

Frontmatter is intentionally unchanged from the pre-phases format — parallelism lives in the body, not in frontmatter.

### Status semantics

| Status | Meaning | Set by |
|---|---|---|
| `not-started` | Plan exists but no step has been ticked. | write-plan (initial). |
| `in-progress` | At least one step has been ticked **or** explicitly set. | First `tick-task done` auto-promotes from `not-started`; or explicit `update-status in-progress`. |
| `complete` | All work is done; plan is closed. | Explicit `update-status complete` only. Never auto-set, even when all checkboxes are ticked — completion is a deliberate decision. |
| `abandoned` | Plan is no longer being pursued. Kept on disk for history. | Explicit `update-status abandoned`, or implicitly by a supersede operation on another plan. |

### Legacy frontmatter

Plans written before the format upgrade lack `updated`, `status`, and `supersedes`. When reading a legacy plan:

- Missing `updated` → fall back to `created` for display/sort.
- Missing `status` → display as `unknown`. Consumers (`/plan-list`) treat `unknown` as eligible for resume and may prompt to set a real status on first contact.
- Missing `supersedes` → treat as `[]`.

Do **not** silently upgrade legacy frontmatter on read. Only an explicit write-plan or update-status operation upgrades a legacy file in place (preserving the original `created`).

## Plan body template

After the frontmatter, the plan body has these five sections in this exact order. Each section heading is `## <Name>` at level 2.

```markdown
# <H1: short human title — derived from the Goal>

## Summary
<1-3 sentences: what this plan does and why.>

## Scope
- <bullet list of what is in this pass>

## Steps

### Phase 1 — <phase name> · parallel
1. [ ] <action-oriented step text>
   Context: <why this step exists + the domain knowledge a fresh subagent lacks>
   Read first: <files/docs to read before editing>
   Done when:
     - <observable outcome>
   Touchpoints: <files — disjoint from sibling steps in this phase>
2. [ ] <step text>
   Context: <...>
   Read first: <...>
   Done when:
     - <observable outcome>
   Touchpoints: <files — disjoint from step 1>

### Phase 2 — <phase name> · sequential
3. [ ] <step text>
   Context: <...>
   Read first: <...>
   Done when:
     - <observable outcome>
   Touchpoints: <files>

## Acceptance criteria
- [ ] <cross-cutting invariant that must hold across all steps>
- [ ] <cross-cutting invariant>

## File touchpoints
- `path/to/file.ts:42` — <new | update> — <one-line note>
- `path/to/other.ts` — <new | update> — <one-line note>
```

Notes:

- The H1 is a short human title for the plan, not the full goal sentence. Derive it from the goal (~6-10 words, title-case acceptable).
- Section names are fixed: `Summary`, `Scope`, `Steps`, `Acceptance criteria`, `File touchpoints`. Do **not** add `Out of scope`, `Risks`, `Open questions`, or `Verification` sections by default. The user can extend a written plan manually.
- The catechism recap is **not** embedded in the plan body. It drives slug + body synthesis only.
- Per-step `Context:` / `Read first:` / `Done when:` / `Touchpoints:` / etc. are **sub-items**, not primary checkboxes. Indent them under the step text. The tick algorithm enumerates only primary `N. [ ]` items in document order across all phases, so sub-items never receive a checkbox and never get ticked.

## Parallelization model

`## Steps` is organized into **phases**. Phases are the unit of parallelism — the Kanban column you drain before moving to the next.

### Phase headers

Each phase is a `### Phase N — <name> · <mode>` subheading inside `## Steps`, where `<mode>` is exactly `parallel` or `sequential`.

- `parallel` — every step in the phase is **file-disjoint** and may be dispatched concurrently.
- `sequential` — steps run one at a time, top to bottom (use when steps in the phase depend on each other, or when there is only one step).

Phases execute **in document order**. A phase must fully drain — all its steps ticked, no open blockers — before the next phase starts. The phase boundary is the synchronization point; it is what makes concurrent dispatch safe.

### Global step numbering

Steps are numbered **globally and contiguously** across all phases (Phase 1 has steps 1-2, Phase 2 starts at 3, …). This keeps ticking-by-index and `/plan-list`-style counting simple: the Nth primary checkbox in `## Steps` (document order) is step N regardless of which phase it sits in.

### The disjointness invariant — load-bearing

**Within a `parallel` phase, no two steps may share a touchpoint file.** This is the contract that lets the executor run them concurrently without write races. The planner guarantees it; `logis` verifies it; the executor re-checks it before dispatching a wave and refuses to parallelize on overlap (falling back to sequential).

A step that needs the output of another step must **not** sit in the same `parallel` phase as that step — push it to a later phase. Cross-phase ordering is always safe because phases drain in order.

### How the executor consumes phases

The `/execute-plan` command walks phases in order:

- **`sequential` phase** — dispatch one `enginseer` per unticked step, top to bottom; each enginseer commits its own work; tick after each; stop the phase on a blocker.
- **`parallel` phase** — re-verify touchpoint disjointness, then dispatch all unticked steps as concurrent `enginseer` tasks **in a single message** (enginseers edit + verify but do **not** commit). When the wave returns, the main agent commits each successful step serially by explicit pathspec, then ticks it. Blocked steps stay unticked and are surfaced.

See `/execute-plan` for the full loop, including the serialized-commit rationale.

## Step shape and weight

The `weight` frontmatter field tunes how meaty each step's contract is. The five body sections are mandatory at every weight; what changes is the per-step shape under `## Steps`.

Two fields embody the "assume the subagent knows nothing, but the planner did the homework" principle and are **required at standard and heavy**:

- **`Context:`** — why this step exists and the domain knowledge a fresh subagent lacks (existing patterns to mirror, invariants, the trap to avoid). 1-3 sentences. This is the planner's research distilled — not a restatement of the step text.
- **`Read first:`** — the exact files (and docs) the subagent should read before editing, as a short list. This is the reading list the planner already walked. The subagent still does its own lightweight look; this just points it at the right place immediately.

**Do not paste implementation code into steps.** Describe interfaces, signatures, gotchas, and expected behavior; the subagent writes the actual code after its quick look. A tiny illustrative snippet is acceptable only when prose genuinely can't convey the shape.

At every weight ≥ standard, `Done when:` bullets must describe **observable behavior** of the system — what an outside observer (user, integration test, curl, log line) sees. They are **not** a restatement of the implementation. If a bullet reads as "the code uses X" or "field Y is configured", rewrite it as GIVEN/WHEN/THEN against the system, or move it to `Context:` / `Verification:`.

Bad: `better-auth instance uses drizzleAdapter(db, { provider: "pg" })`
Good: `GIVEN POST /api/auth/sign-in/email with valid creds, server returns 200 + Set-Cookie`

**light** — quick fixes, single-file edits, well-understood territory. One-line steps; no per-step sub-items (no `Context:`/`Read first:` required). Plan-level `## File touchpoints` carries the file list. Usually one `sequential` phase.

```markdown
### Phase 1 — Bump · sequential
1. [ ] Bump dependency `foo` from 1.2.3 to 1.2.4 in `package.json`.
2. [ ] Run `npm install` and commit the lockfile change.
```

**standard** (default) — most engineering work. Each step gets `Context:`, `Read first:`, `Done when:` (2-5 observable outcomes), and `Touchpoints:` (per-step file list). This is the floor for any work handed to a subagent.

```markdown
### Phase 1 — Foundations · parallel
1. [ ] Add GET /users/:id endpoint returning user JSON
   Context: We already have a users list route with the same auth + error-envelope pattern; mirror it. Auth is a middleware, not per-handler. The standard error envelope is `{ error: { code, message } }`.
   Read first: `api/users-list.go`, `api/middleware/auth.go`, `api/errors.go`
   Done when:
     - GIVEN a valid auth token and an existing user, GET /users/:id returns 200 + the user JSON.
     - GIVEN no auth header, the same request returns 401.
     - GIVEN a valid token but a missing user, the request returns 404 with the standard error envelope.
     - GIVEN a malformed `:id`, the request returns 400.
   Touchpoints: `api/users.go`, `api/router.go`
```

**heavy** — multi-module changes, unfamiliar territory, work where one wrong assumption costs real time. Standard + two **required** fields and any of three optional fields:

Required for heavy:

- `Outcome:` — single sentence describing the user-visible result of this step, phrased so a non-engineer could repeat it back. Anchors the step's reason for existing.
- `Independent Test:` — the concrete behavioral check the executing agent runs to gain confidence the `Outcome:` holds. Either a runnable command (`pnpm test path/to/file.test.ts`, `curl -i ...`) or — when the agent cannot run the check — a 2-4 line manual repro it documents in its commit message. Valid escape hatch for pure refactors: `Independent Test: n/a — pure refactor; behavior covered by existing test <path>`.

Optional for heavy (use when they add signal):

- `Anti-touch:` — files explicitly off-limits to this step (handled elsewhere or out of scope).
- `Verification:` — the static gates that must pass (typecheck, lint, build, unit tests on changed modules). Behavioral checks go in `Independent Test:`.
- `Pre-conditions:` — what must be true before this step starts (prior phase landed, env var set, migration applied, etc.).

Field order under a heavy step:

1. Step text
2. `Outcome:`
3. `Context:`
4. `Read first:`
5. `Done when:`
6. `Touchpoints:`
7. `Anti-touch:` (if present)
8. `Verification:` (if present)
9. `Independent Test:`
10. `Pre-conditions:` (if present)

```markdown
### Phase 2 — Admin auth · sequential
3. [ ] Add admin login via better-auth
   Outcome: An operator can sign into the admin console with valid credentials and is rejected (with feedback) on invalid credentials.
   Context: better-auth is already installed and the auth tables were migrated in Phase 1. Sessions are cookie-based (SameSite=Lax). The admin user is seeded from `SPOOR_ADMIN_*` env on first boot. Do not hand-roll password hashing — better-auth owns it.
   Read first: `src/lib/auth.ts`, `src/lib/auth-middleware.ts`, `src/server.ts:40`
   Done when:
     - GIVEN an unauthenticated GET `/admin`, the server returns 302 → `/login`.
     - GIVEN POST `/api/auth/sign-in/email` with valid creds, the server returns 200 and sets a SameSite=Lax session cookie; a subsequent GET `/admin` returns 200.
     - GIVEN the same POST with wrong creds, the server returns 401 and sets no cookie.
   Touchpoints: `src/lib/auth.ts`, `src/lib/auth-middleware.ts`, `src/views/login.tsx`, `src/server.ts`
   Anti-touch: `src/db/schema.ts` (auth tables migrated in Phase 1; don't re-touch)
   Verification: `pnpm typecheck && pnpm lint && pnpm build`
   Independent Test: `pnpm test src/lib/auth.test.ts` — supertest harness exercising all three scenarios against an in-process Hono app. If not yet wired: `curl -i http://localhost:3000/admin` (expect 302) plus a POST with valid creds (expect 200 + Set-Cookie); paste both transcripts into the commit message.
   Pre-conditions: Phase 1 landed (better-auth installed, auth schema migrated); `BETTER_AUTH_SECRET`, `SPOOR_ADMIN_EMAIL`, `SPOOR_ADMIN_PASSWORD` in `.env.test`.
```

`## Acceptance criteria` is **cross-cutting** at every weight — invariants that span steps, not outcomes scoped to one step. Examples: "no regression in the existing test suite", "p95 latency unchanged", "all migrations reversible", "no new lint violations". If a candidate criterion only describes the outcome of one step, push it into that step's `Done when:` instead.

### Checkbox grammar

Primary steps and acceptance criteria use GitHub-flavoured markdown checkboxes so progress is human-readable and machine-tickable.

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

The checkbox stays **unchecked** (the work was not done). The `> note:` blockquote, indented under the step text, captures the reason. Multiple `> note:` lines may accrue under one step over time.

There is no third checkbox state — the failed/skipped distinction lives in the note. This keeps grep simple (`rg '^\s*[-0-9]+[.)]? \[ \]'` finds work-to-do) and avoids a non-standard markdown token.

### Auto-promotion rule

When a `tick-task` ticks the first step of a plan whose status is `not-started`, also bump the status to `in-progress` in the same write. No auto-promotion in the other direction — completion is always explicit.

## Citation format

Citations to existing code use plain `path:line`, relative to the scriptorum root:

```
src/auth/login.ts:142
packages/api/handlers/orders.ts:88
```

No repo aliases (local plans are single-repo). Backtick-wrap citations in bullet lists for readability. A bare `path` (no line) is allowed when referring to a whole new file to create.

## Slug-to-file resolution

Resolve a slug to a file as follows:

1. Glob `<scriptorum-root>/.scriptorum/*--<slug>.md`.
2. If exactly one match → that's the file.
3. If multiple matches → slug collision across dates. Take context-appropriate action:
   - **Update operations** (update-status, tick-task, append-note, supersede): error with `Slug "<slug>" matches multiple plans: <list>. Disambiguate with the dated filename.`
   - **write-plan with `overwrite: false`**: error `Slug "<slug>" already in use across <N> plans on dates <list>. Use a different slug or overwrite an existing date.`
   - **write-plan with `overwrite: true`**: error — overwrite requires an unambiguous target. The user must specify the date.
4. If zero matches → check legacy `<scriptorum-root>/.scriptorum/<slug>.md`. If it exists, that's the file.
5. If still zero matches and the operation is write-plan: create `<scriptorum-root>/.scriptorum/<TODAY>--<slug>.md`.
6. If still zero matches and the operation is an update: error with `No plan found for slug "<slug>".`

## Overwrite policy

`/plan` enforces a single rule when a plan with the same slug already exists today (`<TODAY>--<slug>.md` resolves to one file):

1. Prompt the user: `Plan exists at <path>. Overwrite? [y/N]`.
2. Default is N. Empty answer or anything other than `y`/`Y` → abort with `Aborted; existing plan not modified.` and write nothing.
3. On `y`/`Y` → perform the write-plan with `overwrite: true`. Preserve `created` from the existing file's frontmatter; only `updated`, `slug`, `goal`, body, and (optionally) `status` change.

Plans on a **different** date with the same slug do not collide for write-plan — they create a new dated file. Use supersede if the new plan is meant to replace the old one.

## Catechism dependency

`/plan` runs the catechism interview before synthesis unless the incoming task description already contains an explicit goal, scope, and at least one constraint or edge case (see the skip heuristic in the `catechism` skill and `/plan`):

1. Load the `catechism` skill.
2. Run the protocol (rounds, multiple-choice questions, recap).
3. Wait for affirmative confirmation of the recap.
4. Only then derive the slug and synthesize the body.

If the user aborts mid-interview (`stop`, `cancel`, `never mind`, or equivalent), write nothing and exit cleanly with `Aborted; no plan written.`

## Direct-write operations

The main agent performs all `.scriptorum/` mutations itself, inline, while running `/plan` and `/execute-plan`. There is no writer subagent. Each operation below is a procedure the agent follows directly; the path-safety and validation rules are non-negotiable.

**Path safety (every write).** Before any write: resolve the scriptorum root (`git rev-parse --show-toplevel`, cwd fallback noted to the user). Compute the full intended absolute path. Verify it begins with `<scriptorum-root>/.scriptorum/`. Refuse any path that escapes (e.g. a slug containing `..`). `mkdir -p` the directory if missing. Never write outside `.scriptorum/`. Never delete plan files as part of an operation; the user manages deletion.

### write-plan

Create a new plan file or overwrite an existing same-day plan.

Inputs: `slug`, `goal` (single line), `title` (H1), `body` (sections only — no frontmatter), `overwrite` (bool), `weight` (optional), `supersedes` (optional, default `[]`).

1. Compute target `<root>/.scriptorum/<TODAY>--<slug>.md`. Apply path safety.
2. **Same-day collision.** If the target exists and `overwrite: false` → stop, report `exists` with the path. If it exists and `overwrite: true` → read it, preserve its `created` (and `status`); on unrecoverable frontmatter, reset `created` to today and note it. If it doesn't exist → `created` = today.
3. **Multi-day collision.** Glob `*--<slug>.md`; matches on other dates are separate plans, not errors — surface their existence as a note.
4. **Body validation.** Ensure sections appear in order: `## Summary`, `## Scope`, `## Steps`, `## Acceptance criteria`, `## File touchpoints`. If any are missing or out of order, stop and report rather than writing a malformed plan.
5. **Phase validation.** Under `## Steps`, every step lives in a `### Phase N — <name> · <parallel|sequential>` subheading. For each `parallel` phase, verify its steps have disjoint `Touchpoints:`; if any overlap, either fix (re-phase) or downgrade the phase to `sequential` before writing, and note it.
6. **Checkbox sanity.** Every primary item under `## Steps` and `## Acceptance criteria` uses `[ ]` or `[x]`. Coerce stray non-checkbox primary items by prepending `[ ] ` and note the coercion.
7. **Citation validation (warn-only).** Extract every `<path>:<N>` in the body (relative path, positive integer; inside or outside backticks). Resolve `<root>/<path>`; if the file is missing or has fewer than `N` lines, record a warning. Bare `<path>` (no line) is not validated. Never block or rewrite on a citation warning — surface warnings.
8. Compose the file: frontmatter (`created`, `updated: <today>`, `slug`, `goal` flattened to one line, `status` — `not-started` on create, preserved on overwrite — `weight` only if supplied/preserved, `supersedes`) then `# <title>` then the body. Write it.
9. If `supersedes` is non-empty, run update-status `abandoned` on each predecessor (see supersede).
10. Report path, created/updated, overwrote, citation warnings, and any superseded predecessors.

### update-status

Change `status` in frontmatter. Inputs: `slug`, `status` (one of the four), optional `date`.

1. Reject unknown status values (`Invalid status "<value>". Allowed: not-started, in-progress, complete, abandoned.`).
2. Resolve the file (use `date` to disambiguate collisions).
3. Capture the previous status (default `not-started` if absent — legacy). Set the new status. Bump `updated`. Preserve every other field, including unknowns. Write back.

### tick-task

Tick/untick a primary checkbox. Inputs: `slug`, `section` (`steps` | `acceptance-criteria`), `index` (1-based, global), `state` (`done` | `undone`), optional `note`, optional `date`.

1. Resolve the file. Locate the section heading (`## Steps` or `## Acceptance criteria`). For `steps`, the section spans all its `### Phase …` subheadings until the next `##`.
2. Enumerate primary checkbox items in document order. A primary item matches `^\s*-\s+\[[ x]\]\s` or `^\s*\d+\.\s+\[[ x]\]\s`. Indented sub-items and `> note:` lines are not primary. If the section has fewer than `index` items, error with the count.
3. Capture the previous state. Toggle the box to `[x]` (done) or `[ ]` (undone), preserving the marker and spacing.
4. If `note` is given, append a `> note: <note>` line after the step's existing lines (before the next primary item / section boundary), indented to align with the step body. Notes accrue; don't collapse.
5. Bump `updated`.
6. **Auto-promotion:** if `state == done`, current status is `not-started`, and this tick changed a box from `[ ]` to `[x]`, also set `status: in-progress`.
7. Write back.

### append-note

Append a `> note:` line under a step without touching its checkbox. Inputs: `slug`, `section`, `index`, `note`, optional `date`. Same resolution + placement as tick-task steps 1-2 and 4; bump `updated`; write back. Used for "skipped — reason", "blocked — see ticket", "tried and reverted because …".

### supersede

Mark this plan as the successor of one or more older plans, abandoning them. Inputs: `slug` (successor, must exist), `predecessors` (list), optional `date` (successor disambiguation).

1. Resolve the successor file.
2. For each predecessor: resolve it (error if ambiguous/not found), run update-status `abandoned`, collect the result.
3. On the successor, set `supersedes: [<predecessor-slugs>]` (overwriting any existing value). Bump `updated`. Write back.

### Frontmatter handling (all operations)

- Parse tolerantly: treat malformed frontmatter as findable but skip malformed fields; never crash; surface malformed states.
- Preserve unknown fields verbatim on rewrite.
- Field order for readability: `created`, `updated`, `slug`, `goal`, `status`, `weight` (if present), `supersedes`, then preserved unknowns. Consumers tolerate any order.
- `supersedes: []` is written as an empty inline list, not omitted.
- Dates are ISO `YYYY-MM-DD` (no time component).

## /plan-list contract

`/plan-list [filter]` is read-only:

1. Resolve the scriptorum root.
2. If `.scriptorum/` does not exist, print `No plans yet. Run /plan <task> to create one.` and stop.
3. List `.scriptorum/*.md` (both `YYYY-MM-DD--<slug>.md` and legacy `<slug>.md`).
4. If `filter` is provided, keep only files whose `<slug>` substring-matches the filter (case-insensitive). The slug for a dated file is everything after `YYYY-MM-DD--`; for legacy files it's the filename stem.
5. For each remaining file, parse YAML frontmatter and extract `created`, `updated`, `slug`, `status`, `goal`. Apply legacy-frontmatter fallbacks; for completely missing fields with no fallback, use `?`.
6. Sort by `updated` descending. Ties broken by `slug` ascending. Entries with `updated: ?` sort last.
7. Print one line per plan (single-space gutters; status bracketed):
   ```
   [<marker>] <status>  <slug>  <updated>  <goal>
   ```
   Status markers: `[ ]` not-started, `[~]` in-progress, `[x]` complete, `[-]` abandoned, `[?]` unknown (legacy). Pad the status name to 11 chars (longest is `not-started`); do not pad `slug` or `updated`.
8. If the filter matched nothing, print `No plans match '<filter>'.`

## Templates

### New plan file (created by `/plan`)

```markdown
---
created: 2026-06-15
updated: 2026-06-15
slug: add-user-csv-export
goal: Add a CSV export endpoint for users behind a feature flag.
status: not-started
weight: standard
supersedes: []
---

# Add user CSV export

## Summary
Add a CSV export endpoint for users, wired through the existing export service, behind the `export.users` flag (default off).

## Scope
- New CSV serializer for the user shape.
- New `export.users` flag.
- New GET /users/export endpoint, flag-gated.

## Steps

### Phase 1 — Foundations · parallel
1. [ ] Add a CSV serializer for users
   Context: Users are serialized to JSON in `serializers/user.ts`; CSV must match the same field order and redaction (never emit `password_hash`). There is no global CSV lib — the billing module already pulls `csv-stringify`; reuse it.
   Read first: `src/serializers/user.ts`, `src/billing/export.ts:40`
   Done when:
     - GIVEN a user record, the serializer returns a CSV row with columns id,email,created_at in that order.
     - password_hash never appears in the output.
   Touchpoints: `src/serializers/user-csv.ts`
2. [ ] Register the `export.users` flag
   Context: Flags live in a central registry; booleans default off in all environments.
   Read first: `src/flags/registry.ts:1`
   Done when:
     - `export.users` exists in the registry and defaults to false.
   Touchpoints: `src/flags/registry.ts`

### Phase 2 — Endpoint · sequential
3. [ ] Add GET /users/export
   Context: Depends on the serializer (step 1) and flag (step 2). Mirror the auth + pagination pattern in the existing users list route.
   Read first: `src/api/users-list.ts`, `src/serializers/user-csv.ts`
   Done when:
     - GIVEN the flag on and valid auth, GET /users/export returns 200 with Content-Type text/csv.
     - GIVEN the flag off, the request returns 404.
     - GIVEN no auth, the request returns 401.
   Touchpoints: `src/api/users-export.ts`, `src/api/router.ts`

## Acceptance criteria
- [ ] Existing users-list tests still pass (no regression).
- [ ] Lint and typecheck clean.
- [ ] No PII beyond id,email,created_at in the CSV output.

## File touchpoints
- `src/serializers/user-csv.ts` — new — CSV serializer.
- `src/flags/registry.ts` — update — add `export.users`.
- `src/api/users-export.ts` — new — export endpoint.
- `src/api/router.ts` — update — mount the route.
```

Phase 1's two steps touch disjoint files, so the executor dispatches them concurrently. Phase 2 waits for Phase 1 to drain.

### Plan after partial progress (post tick-task + append-note)

```markdown
---
created: 2026-06-15
updated: 2026-06-16
slug: add-user-csv-export
goal: ...
status: in-progress
weight: standard
supersedes: []
---

# Add user CSV export

## Summary
...

## Scope
...

## Steps

### Phase 1 — Foundations · parallel
1. [x] Add a CSV serializer for users
   Context: ...
   Read first: `src/serializers/user.ts`, `src/billing/export.ts:40`
   Done when:
     - GIVEN a user record, the serializer returns a CSV row with columns id,email,created_at in that order.
     - password_hash never appears in the output.
   Touchpoints: `src/serializers/user-csv.ts`
2. [x] Register the `export.users` flag
   Context: ...
   Read first: `src/flags/registry.ts:1`
   Done when:
     - `export.users` exists in the registry and defaults to false.
   Touchpoints: `src/flags/registry.ts`

### Phase 2 — Endpoint · sequential
3. [ ] Add GET /users/export
   Context: ...
   Read first: `src/api/users-list.ts`, `src/serializers/user-csv.ts`
   Done when:
     - GIVEN the flag on and valid auth, GET /users/export returns 200 with Content-Type text/csv.
     - GIVEN the flag off, the request returns 404.
     - GIVEN no auth, the request returns 401.
   Touchpoints: `src/api/users-export.ts`, `src/api/router.ts`
   > note: blocked — the users list route moved to `src/api/v2/users-list.ts` yesterday; re-locate before continuing.

## Acceptance criteria
- [ ] Existing users-list tests still pass (no regression).
- [ ] Lint and typecheck clean.
- [ ] No PII beyond id,email,created_at in the CSV output.

## File touchpoints
...
```

## Hard rules

- Never write outside `<scriptorum-root>/.scriptorum/`. Compute the absolute path and refuse anything that escapes.
- Never modify the `created` field on any subsequent operation — it is preserved from the existing file.
- Never auto-set `status: complete`. Completion is always an explicit `update-status complete`.
- Never embed the catechism recap verbatim in the plan body.
- Never use repo aliases in citations; `path:line` is plain.
- Never auto-version filenames on collision — prompt `Overwrite? [y/N]` for same-day collisions; new dates create new files.
- Never touch `.gitignore`.
- Never paste implementation code into steps — describe interfaces and behavior; the subagent writes the code.
- Within a `parallel` phase, never let two steps share a touchpoint file — that invariant is what makes concurrent dispatch safe.
- Citation validation is warn-only; never block a write on a missing line.
