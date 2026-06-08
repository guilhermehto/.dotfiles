---
name: update-config
description: Sync Codex skills and subagent TOMLs from the dotfiles repo into ~/.agents/skills and ~/.codex/agents/, and recompose ~/.codex/AGENTS.md. Invoke when the user says "update config", "sync codex", "I added a skill", "re-sync", or similar. Implicit invocation is on by default.
---

# update-config

Runs `codex-sync-ai` to reconcile the live Codex configuration with the dotfiles source.

## What the sync does

- Links skill directories from `ai/skills/*` and `ai/codex/skills/*` into `~/.agents/skills/`.
- Links subagent TOMLs from `ai/codex/agents/*.toml` into `~/.codex/agents/`.
- Composes `~/.codex/AGENTS.md` from `ai/AGENTS.md` (engineering standards) + `ai/agents/archmagos.md` (persona).
- Prunes only symlinks that resolve into the `ai/` dotfiles paths — foreign skills (e.g. firecrawl) are never touched.
- Re-running is a no-op when nothing has changed.

## How to run it

Invoke `codex-sync-ai` by its absolute path. Do NOT use a bare command name (it may not be on PATH in the sandbox), and do NOT use opencode's `!`-shell-injection syntax (Codex skills lack it).

The canonical path is:

```
<dotfiles-root>/ai/codex/bin/codex-sync-ai
```

To resolve `<dotfiles-root>` dynamically:

```bash
DOTFILES_ROOT="$(cd "$(dirname "$(readlink -f "$HOME/.codex/bin/codex-sync-ai")")"/../../.. && pwd)"
"$DOTFILES_ROOT/ai/codex/bin/codex-sync-ai"
```

Or, if `~/.codex/bin/codex-sync-ai` is the symlink placed by `install.sh`, invoke it directly:

```bash
"$HOME/.codex/bin/codex-sync-ai"
```

## After running

Summarize the output in 2-4 lines:

- How many skills/agents were created, updated, pruned, or skipped.
- The AGENTS.md action (created / updated / unchanged).
- Any conflicts, skipped files, or warnings.

If the script exits non-zero, surface the exit code and the last meaningful output prominently. Do **not** claim success on a non-zero exit.

## Sandbox note

`codex-sync-ai` writes outside the workspace (into `~/.agents/skills` and `~/.codex`). If `writable_roots` is not yet configured in `~/.codex/config.toml`, the sandbox will prompt for approval on each write. Approve the escalation, or add the `writable_roots` entry from `ai/codex/config.snippet.toml` to `~/.codex/config.toml` to remove the friction permanently.
