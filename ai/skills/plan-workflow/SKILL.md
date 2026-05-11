---
name: plan-workflow
description: Local implementation-plan workspace at .scriptorum/<slug>.md. Load when handling /plan, /plan-list, or whenever the user mentions writing, listing, or reviewing a local plan. Encodes the scriptorum root resolution, slug rules, frontmatter schema, plan body template, citation format, overwrite policy, and the magos-artisan delegation contract. Required for any read or write under .scriptorum/.
---

# plan-workflow

Conventions for the local implementation-plan workspace at `<repo-root>/.scriptorum/`. The `/plan` and `/plan-list` commands and the `magos-artisan` subagent must follow these rules.

This skill is the local-task counterpart to `kb-workflow`. Where `kb-workflow` captures multi-session, multi-repo knowledge under `~/work-kb`, `plan-workflow` captures the structured plan for a single in-the-moment task next to the code it touches.

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
    └── <slug>.md
```

Flat. No subdirectories. No archive folder. The user manages lifecycle by editing or deleting files.

`.scriptorum/` is **not** added to `.gitignore` by any command. Whether to commit or ignore is the user's call.

## Slug rules

The slug is the filename stem under `.scriptorum/`. It comes from the catechism recap's `Goal:` line and never from raw `$ARGUMENTS`.

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

Plan files have minimal YAML frontmatter:

```yaml
---
created: 2026-05-12
slug: <slug>
goal: <single-line goal, copied verbatim from the catechism recap's Goal: line>
---
```

Rules:

- `created` is the ISO date of first write. Not bumped on overwrite.
- `slug` matches the filename stem.
- `goal` is one line; embedded newlines are flattened to spaces before writing.
- Unknown fields in an existing file are preserved on rewrite.

## Plan body template

After the frontmatter, the plan body has these five sections in this exact order. Each section heading is `## <Name>` at level 2.

```markdown
# <H1: short human title — derived from the Goal>

## Summary
<1-3 sentences: what this plan does and why.>

## Scope
<bullet list of what is in this pass.>

## Numbered steps
1. <step — concrete, executable>
2. <step>
3. <step>

## Acceptance criteria
- <observable criterion>
- <observable criterion>

## File touchpoints
- `path/to/file.ts:42` — <new | update> — <one-line note>
- `path/to/other.ts` — <new | update> — <one-line note>
```

Notes:

- The H1 is a short human title for the plan, not the full goal sentence. Derive it from the goal (e.g. trim to ~6-10 words, title-case acceptable).
- Section names are fixed. Do **not** add `Out of scope`, `Risks`, `Open questions`, or `Verification` sections by default — the agreed minimum is five. The user can extend a written plan manually.
- The catechism recap is **not** embedded in the plan body. It drives slug + body synthesis only.

## Citation format

Citations to existing code use plain `path:line`, relative to the scriptorum root:

```
src/auth/login.ts:142
packages/api/handlers/orders.ts:88
```

No repo aliases (local plans are single-repo).
No backticks required in running prose, but backtick-wrap them in bullet lists for readability.
A bare `path` (no line) is allowed when referring to a whole new file to create.

## Overwrite policy

`/plan` enforces a single rule when the target path exists:

1. Prompt the user: `Plan exists at <path>. Overwrite? [y/N]`.
2. Default is N. Empty answer or anything other than `y`/`Y` → abort with `Aborted; existing plan not modified.` and write nothing.
3. On `y`/`Y` → dispatch to `magos-artisan` with `overwrite: true`. The curator preserves `created` from the existing file's frontmatter; only the body and `slug`/`goal` are updated.

## Catechism dependency

`/plan` always runs the catechism interview before synthesis:

1. Load the `catechism` skill.
2. Run the protocol (rounds, multiple-choice via the `question` tool, recap).
3. Wait for affirmative confirmation of the recap.
4. Only then derive the slug and synthesize the body.

If the user aborts mid-interview (`stop`, `cancel`, `never mind`, or equivalent), write nothing and exit cleanly with `Aborted; no plan written.`

If `$ARGUMENTS` is empty, the catechism still runs — synthesis is driven by the recap, not the args.

## magos-artisan delegation contract

`/plan` and any other consumer that writes under `.scriptorum/` invokes the `magos-artisan` subagent via the task tool. The request is structured:

```
action: write-plan
payload:
  slug: <slug>
  goal: <single-line goal>
  title: <H1 title>
  body: <markdown body, sections only — no frontmatter>
  overwrite: <true | false>
```

The curator:

1. Loads this skill first. If it cannot, aborts and reports.
2. Resolves the scriptorum root via `git rev-parse --show-toplevel` (or cwd fallback).
3. Computes the target absolute path: `<root>/.scriptorum/<slug>.md`. Verifies it begins with `<root>/.scriptorum/`. Refuses any path that escapes.
4. If the file exists:
   - `overwrite: false` → returns `{error: "exists", path: <path>}`.
   - `overwrite: true` → reads the existing file, preserves the `created` frontmatter value.
5. Validates `path:line` citations in `body`:
   - For each `path:line` of the form `<repo-relative-path>:<N>`, reads the file and checks that line `N` exists (file has at least `N` lines).
   - Bare `path` references (no line) are validated only as "file may or may not exist" — a non-existent path is fine for "new file" cases and is **not** flagged.
   - Failures are collected as warnings, not errors. They never block the write.
6. Writes the file with frontmatter (`created`, `slug`, `goal`) followed by the body.
7. Returns `{action: "write-plan", path: <abs-path>, citation_warnings: [...]}`.

The curator does not bump or maintain any cross-file index (there is no `summary.md` analogue in the scriptorum). `/plan-list` re-derives the list from the directory on demand.

## /plan-list contract

`/plan-list [filter]` is read-only and does not invoke `magos-artisan`:

1. Resolve the scriptorum root.
2. If `.scriptorum/` does not exist, print `No plans yet. Run /plan <task> to create one.` and stop.
3. List `.scriptorum/*.md`.
4. If `filter` is provided, keep only files whose `<slug>` substring-matches the filter (case-insensitive).
5. For each remaining file, parse the YAML frontmatter and extract `created`, `slug`, `goal`. If the frontmatter is malformed or missing, substitute `?` for the missing fields and continue.
6. Sort by `created` descending. Ties broken by slug ascending.
7. Print one line per plan: `<slug>  <created>  <goal>`. Use two-space gutters; do **not** pad to a fixed column width — the goal may be long.
8. If the filter matched nothing, print `No plans match '<filter>'.`

## Templates

### Plan file (created by `/plan` via `magos-artisan`)

```markdown
---
created: 2026-05-12
slug: add-feature-flag-for-new-checkout
goal: Add a feature flag for the new checkout flow so we can roll it out to a subset of users.
---

# Add feature flag for new checkout

## Summary
Wire a new boolean flag `checkout.v2` through the existing flag service so the new checkout flow can be enabled per-cohort without a deploy.

## Scope
- New flag definition in the flag registry.
- Wiring in `CheckoutPage` to branch on the flag.
- Default value: off in all environments.

## Numbered steps
1. Add `checkout.v2` to `src/flags/registry.ts:1` alongside existing entries.
2. Read the flag in `src/pages/CheckoutPage.tsx:24` and render `CheckoutV2` when on, `CheckoutV1` when off.
3. Update the flag-service mock in `tests/mocks/flags.ts:1` so tests can toggle it.

## Acceptance criteria
- `checkout.v2` appears in the flag registry and is `false` by default.
- `CheckoutPage` renders `CheckoutV2` when the flag is enabled, `CheckoutV1` otherwise.
- All existing `CheckoutPage` tests still pass with the flag off.

## File touchpoints
- `src/flags/registry.ts:1` — update — add `checkout.v2` entry.
- `src/pages/CheckoutPage.tsx:24` — update — branch on flag.
- `src/pages/CheckoutV2.tsx` — new — new flow shell.
- `tests/mocks/flags.ts:1` — update — expose toggle in tests.
```

## Hard rules

- Never write outside `<scriptorum-root>/.scriptorum/`. The curator computes the absolute path and refuses anything that escapes.
- Never modify the `created` field on an overwrite — it is preserved from the existing file.
- Never embed the catechism recap verbatim in the plan body.
- Never use repo aliases in citations; `path:line` is plain.
- Never auto-version filenames on collision — always prompt the user with `Overwrite? [y/N]`.
- Never touch `.gitignore`.
- Citation validation is warn-only; never block a write on a missing line.
