---
description: Regenerate a KB project's summary.md from current explorations, decisions, and links (preserves sentinel-bracketed sections)
argument-hint: "<query>"
---

Load the `kb-workflow` skill before doing anything else.

Arguments: $ARGUMENTS

Steps:

1. Parse arguments. `$1` is project query.
   - If missing, error: `Usage: /kb-summarize <query>`.
2. Resolve `<KB_ROOT>`. Error if missing.
3. Resolve `$1` to a project.
4. **Pre-flight sentinel check** (do this BEFORE any synthesis work):
   - Read the existing `summary.md`.
   - Count `<!-- kb:preserve start -->` and `<!-- kb:preserve end -->` markers.
   - Verify they're balanced and properly alternating.
   - **If unbalanced or missing**: stop. Print a clear error naming the issue (e.g. `summary.md has 1 'kb:preserve start' but 0 'kb:preserve end'`, or `summary.md has no preserve sentinels`). Tell the user to wrap their hand-written `## One-liner` and `## Context` sections with `<!-- kb:preserve start -->` and `<!-- kb:preserve end -->` and re-run. Do not invoke the curator.
5. **Gather inputs** for regeneration:
   - All exploration files (their headers, statuses, last_updated).
   - All decision files (number, title, date).
   - Any links currently present (will be preserved as-is from inside the sentinel blocks if the user keeps them there, OR regenerated from a links section outside sentinels — see below).
6. **Compose the regenerated summary**:
   - Frontmatter: keep existing fields verbatim. Bump `updated` to today.
   - H1: keep existing project name (the line right after frontmatter).
   - Sentinel-preserved blocks: copy verbatim from the existing file.
   - Outside sentinels, regenerate these sections:
     - `## Repos involved` — from frontmatter `repos:` map.
     - `## Key links` — from existing `## Key links` content (links additions live here too; this section is curator-managed via `/kb-link`, NOT regenerated from scratch — copy verbatim from existing summary).
     - `## Active explorations` — list each `status: in-progress` exploration as `- [<topic>](explorations/<file>) — last updated <date>`. If none, write `_(none)_`.
     - `## Decisions` — list each decision newest-first as `- [<NNNN-title>](decisions/<file>) — <date>`. If none, write `_(none)_`.
     - `## Open questions` — copy verbatim from existing summary (also user-managed; do not regenerate).
7. Compute the diff between current and proposed `summary.md`. Show it to the user.
8. Ask: `Apply this regeneration? [Y/n]`. Default Y.
9. On confirmation, invoke `kb-curator` with `action: regenerate-summary` and payload:
   - project dir name
   - the full new summary content
10. The curator re-validates sentinel balance on the new content (defense in depth) and writes. Report: `Regenerated <KB_ROOT>/projects/<dir>/summary.md.`

Rules:

- Sections that are user-managed (`## Key links`, `## Open questions`, sentinel-preserved blocks) must be copied verbatim, not regenerated. Only auto-derivable sections (`## Repos involved`, `## Active explorations`, `## Decisions`) get rewritten.
- If sentinel validation fails, do not invoke the curator. The summary stays untouched.
- The curator bumps `updated` only after a successful write.
