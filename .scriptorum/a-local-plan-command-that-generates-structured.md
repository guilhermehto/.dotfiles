---
created: 2026-05-12
slug: a-local-plan-command-that-generates-structured
goal: A local /plan command that generates structured implementation plans for in-the-moment tasks, written to .scriptorum/<slug>.md at the repo root, independent of the KB.
---

# Local /plan command via catechism alignment

## Summary
Add a `/plan` slash command that runs a catechism interview, synthesises a structured implementation plan, and writes it to `<repo-root>/.scriptorum/<slug>.md`. Mirrors the `/kb-plan` + `kb-workflow` + `kb-curator` pattern but keeps the artefact local and out of `~/work-kb`. Ships with a companion `/plan-list` and a small extension to `magos-logis-plan-reviewer` so it can review local plans.

## Scope
- New skill `plan-workflow` that defines the scriptorum layout, slug rules, frontmatter, body template, citation format, overwrite policy, and curator contract.
- New subagent `magos-artisan` that is the sole writer under `.scriptorum/`, validates `path:line` citations (warn-only), and refuses paths outside `.scriptorum/`.
- New command `/plan <task>` that loads `plan-workflow` and `catechism` inline, runs the alignment interview, previews the plan, and dispatches to `magos-artisan` to write.
- New command `/plan-list [filter]` that reads `.scriptorum/*.md` frontmatter and prints `slug — created — goal` per plan, sorted by `created` desc.
- Extension to `magos-logis-plan-reviewer`: recognise `.scriptorum/<slug>.md` paths, parse the minimal frontmatter, add a `Catechism alignment fit` focus dimension and matching output section.

## Numbered steps
1. Create `ai/skills/plan-workflow/SKILL.md` mirroring the structure of `ai/skills/kb-workflow/SKILL.md:1`. Encode: scriptorum root resolution (`git rev-parse --show-toplevel`, cwd fallback with notice), flat `.scriptorum/<slug>.md` layout, slug rules (kebab-case the recap `Goal:` line, cap 60 chars on the last `-` boundary), minimal frontmatter (`created`, `slug`, `goal`), the five-section body template (Summary, Scope, Numbered steps, Acceptance criteria, File touchpoints), plain `path:line` citation format, overwrite policy (`[y/N]`, default N, preserve `created` on overwrite), and the `magos-artisan` delegation contract.
2. Create `ai/agents/magos-artisan.md` mirroring the frontmatter shape of `ai/agents/kb-curator.md:1`. Set `mode: subagent`, `permission.edit: allow`, no `external_directory` block (target lives inside the workspace), bash allowlist matching kb-curator's read-only verbs plus `mkdir -p *`, `tools.skill: true`. The agent loads `plan-workflow` on entry, accepts the `write-plan` action only, computes the absolute path under `<root>/.scriptorum/`, refuses any escape, validates citations as warnings, and writes the file.
3. Create `ai/commands/plan.md` mirroring `ai/commands/kb-plan.md:1` and `ai/commands/catechism.md:6` for skill loading. Steps: frame from `$ARGUMENTS` or context, run the catechism interview (mandatory, always), abort cleanly on user cancellation, derive slug from the recap `Goal:` line, derive an H1 title, resolve scriptorum root, check for an existing file (`[y/N]` prompt, default N), synthesise the five-section body (no embedded recap), preview to the user, dispatch to `magos-artisan` on confirmation, report path and citation warnings, suggest `@magos-logis-plan-reviewer <path>`.
4. Create `ai/commands/plan-list.md` mirroring `ai/commands/kb-list.md:1`. Steps: resolve root, exit cleanly if `.scriptorum/` is absent or empty, list `*.md`, optional substring filter on slug (case-insensitive), parse minimal frontmatter (substitute `?` for missing fields), sort by `created` desc with slug tiebreak, print `<slug>  <created>  <goal>` per line with two-space gutters.
5. Extend `ai/agents/magos-logis-plan-reviewer.md` in three spots: (a) the "Identifying the plan" section to list `.scriptorum/<slug>.md` and `<KB_ROOT>/projects/.../plans/*.md` as the two known plan-file shapes and to specify frontmatter parsing for each; (b) the focus dimensions list to add `Catechism alignment fit` (active only when the plan has a `goal:` frontmatter field); (c) the output template to add `## Catechism alignment fit` between `## Architecture & fit` and `## Open questions`, with `_(none)_` as the empty marker and the "skip when no `goal:`" rule.
6. Bootstrap: write this plan to `.scriptorum/a-local-plan-command-that-generates-structured.md` as the first real plan (manual write, since `/plan` doesn't exist yet at bootstrap time).
7. Smoke test once the files are in place: run `/plan "add a feature flag for the new checkout flow"` end-to-end, verify the catechism interview runs, verify slug derivation, verify the written file has correct frontmatter and the five sections in order, verify `/plan-list` returns the new entry, verify `@magos-logis-plan-reviewer <path>` produces output with the new section.

## Acceptance criteria
- Invoking `/plan <task>` runs the catechism interview every time, regardless of how detailed `$ARGUMENTS` is.
- Aborting the catechism (cancel, "never mind", etc.) leaves no file on disk and exits with a clear message.
- On confirmation, the plan is written to `<repo-root>/.scriptorum/<slug>.md` with the slug derived from the recap `Goal:` line per the rules in `plan-workflow`.
- Outside a git repo, the command falls back to cwd and prints `No git repo found; using cwd as scriptorum root: <abs-path>`.
- A pre-existing target path triggers a `[y/N]` prompt that defaults to N and exits without modification when declined; on `y`, the existing `created` value is preserved.
- The written plan has YAML frontmatter with exactly `created`, `slug`, `goal` and a body containing `## Summary`, `## Scope`, `## Numbered steps`, `## Acceptance criteria`, `## File touchpoints` in that order.
- Citations are formatted as plain `path:line` (no repo aliases). Invalid `path:line` citations produce `citation_warnings` in the curator's return but never block the write.
- `magos-artisan` refuses any write whose absolute path does not begin with `<scriptorum-root>/.scriptorum/`.
- `/plan-list` with no filter prints all plans, sorted newest-first, one line each as `<slug>  <created>  <goal>`; an empty scriptorum prints the seed message; a filter that matches nothing prints `No plans match '<filter>'.`.
- `magos-logis-plan-reviewer` invoked on a `.scriptorum/` plan returns its review with a populated `## Catechism alignment fit` section (or `_(none)_` if there are no findings), and on a plan without `goal:` frontmatter, that section is `_(none)_` by rule.
- No files outside the listed touchpoints are modified.

## File touchpoints
- `ai/skills/plan-workflow/SKILL.md` — new — scriptorum conventions, mirror of `ai/skills/kb-workflow/SKILL.md:1`.
- `ai/agents/magos-artisan.md` — new — sole writer under `.scriptorum/`, mirror of `ai/agents/kb-curator.md:1`.
- `ai/commands/plan.md` — new — entry point; loads `plan-workflow` + `catechism`.
- `ai/commands/plan-list.md` — new — read-only listing.
- `ai/agents/magos-logis-plan-reviewer.md:32` — update — extend "Identifying the plan" with `.scriptorum/` path shape and frontmatter parsing.
- `ai/agents/magos-logis-plan-reviewer.md:53` — update — add `Catechism alignment fit` focus dimension.
- `ai/agents/magos-logis-plan-reviewer.md:65` — update — add `## Catechism alignment fit` section to the output template.
- `ai/skills/catechism/SKILL.md:1` — reference only — loaded inline by `/plan`; no edits.
