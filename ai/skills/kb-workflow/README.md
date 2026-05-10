# kb-workflow

A local knowledge base for multi-repo code explorations. Captures findings as you work; lets agents pick up where you left off.

## What you get

- One folder per project, one file per exploration.
- Plain markdown. Open in any editor.
- Agents read it via `/kb-resume`; agents write to it via `/kb-capture`.
- All projects live in `~/work-kb` (override with `KB_ROOT`).

## First-time setup

1. `/update-config` to sync the skill, agent, and commands into `~/.config/opencode/`.
2. That's it. `~/work-kb/` is created on first `/kb-init`.

## Daily workflow

### Starting a new project

```
/kb-init <TICKET-ID> [slug]
```

Answer the prompts: one-liner, key links, repos involved (`alias` → URL).

### Doing an exploration

```
/kb-explore <TICKET-ID> "the question I'm answering"
```

Then use `magos-explorator-code-explorer` (or whatever) to investigate. When you have findings:

```
/kb-capture <TICKET-ID>
```

Appends them to the active exploration.

### Resuming days later

```
/kb-resume <ticket-or-slug-prefix>
```

Loads summary, in-progress explorations, and recent decisions into your current session. Continue exploring; `/kb-capture` as you go.

### Wrapping up

```
/kb-summarize <TICKET-ID>      # refresh summary.md from explorations + decisions
/kb-plan <TICKET-ID> <name>    # generate a plan doc from findings
@magos-logis-plan-reviewer     # review the plan
```

## Command reference

| Command | What it does |
|---|---|
| `/kb-init <TICKET-ID> [slug]` | Scaffold a project. Creates `~/work-kb/` on first run. |
| `/kb-list [filter]` | List projects with status, last-updated, active exploration count. |
| `/kb-resume <query>` | Load a project's context into the current session. |
| `/kb-explore <query> <topic>` | Start a new exploration. |
| `/kb-capture <query> [exploration-slug]` | Append findings to the active exploration. |
| `/kb-link <query> <url> [title]` | Add a link to the project's key links. |
| `/kb-decide <query> <title>` | Record an ADR-style decision. |
| `/kb-plan <query> <name>` | Generate a plan doc from explorations. |
| `/kb-summarize <query>` | Regenerate `summary.md`, preserving hand-written sections. |
| `/kb-search <text> [project-query]` | Ripgrep across the KB; optionally scoped to a project. |

## Conventions

- **Project slug**: `<TICKET-ID>-<kebab-slug>`. Ticket ID is sanitized for the filesystem (unsafe chars rejected with a clear error).
- **Citations**: `<repo-alias>/<path>:<line>`, where `<repo-alias>` is a key in the project's `summary.md` `repos:` map. Unknown aliases trigger a prompt to register them.
- **Status flips** (`active|paused|done|dropped` for projects, `in-progress|done|superseded` for explorations) are manual edits to frontmatter. Commands never change them.
- **Append-only explorations**: corrections go in `## Update YYYY-MM-DD` blocks. For pivots, set `status: superseded` and `superseded_by:` then create a new exploration.
- **Decisions are immutable** once written.
- **Cross-references**: standard markdown links with relative paths. No wikilinks.

## When things go wrong

- **"KB not found at ~/work-kb. Run /kb-init first."** → The KB root doesn't exist. `/kb-init` will offer to create it.
- **`/kb-summarize` refuses to write** → Sentinel markers (`<!-- kb:preserve start -->` / `<!-- kb:preserve end -->`) are missing or unbalanced in `summary.md`. Restore them around your hand-written `## One-liner` and `## Context` sections, then retry.
- **"Multiple projects match '<query>'"** → Use a more specific prefix, the full ticket ID, or pick from the listed options.
- **"Citation references repo alias '<alias>' which is not in the repos map"** → The curator is asking which repo URL that alias points at. Provide it, or blank to abort.
- **"No active exploration"** → `/kb-capture` ran with nothing to append to. Run `/kb-explore` first.

## Files modified by which command

| File | Read by | Written by |
|---|---|---|
| `summary.md` | `/kb-resume`, `/kb-list` | `/kb-init` (full), `/kb-summarize` (preserves sentinel blocks), every other `/kb-*` (bumps `updated`) |
| `explorations/*.md` | `/kb-resume`, `/kb-search` | `/kb-explore` (creates), `/kb-capture` (appends only) |
| `decisions/*.md` | `/kb-resume`, `/kb-search` | `/kb-decide` (creates only; immutable after) |
| `plans/*.md` | `/kb-search` | `/kb-plan` (creates) |
| `links.md` | `/kb-resume` | reserved for future overflow; today links live in `summary.md` |

## Directory layout

```
~/work-kb/
├── README.md
└── projects/
    └── <TICKET-ID>-<slug>/
        ├── summary.md
        ├── links.md             # not created until needed
        ├── glossary.md          # optional
        ├── explorations/
        ├── decisions/
        └── plans/
```

## Where this is configured

- Skill: `~/.dotfiles/ai/skills/kb-workflow/SKILL.md` (synced to `~/.config/opencode/skills/kb-workflow/`).
- Agent: `~/.dotfiles/ai/agents/kb-curator.md`.
- Commands: `~/.dotfiles/ai/commands/kb-*.md`.
- Permission: `~/.config/opencode/opencode.json` allows `external_directory` writes under `~/work-kb/**`.
