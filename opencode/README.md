# opencode

Stow package for [OpenCode](https://opencode.ai) configuration that depends on
this dotfiles repo. Currently ships:

- `bin/opencode-sync-ai` — symlinks the central `~/.dotfiles/ai/{agents,commands,skills}`
  resources into OpenCode's expected global paths.
- `commands/update-config.md` — `/update-config` slash command that runs the
  sync script from inside an OpenCode session.

Note: `opencode.json` is intentionally **not** tracked. It is hand-managed
under `~/.config/opencode/opencode.json` because it contains
machine/account-specific values (MCP auth headers, provider base URLs).

## Layout

```
opencode/.config/opencode/
├── bin/
│   └── opencode-sync-ai
└── commands/
    └── update-config.md
```

After `cd ~/.dotfiles && stow opencode` the entries land at:

```
~/.config/opencode/bin/opencode-sync-ai
~/.config/opencode/commands/update-config.md
```

## Why this exists

OpenCode discovers global agents/commands/skills from
`~/.config/opencode/{agents,commands,skills}`. The same resources are also
consumed by other agent harnesses (pi.dev, Rovo Dev CLI) that read from
`~/.dotfiles/ai/`. To avoid duplication and per-resource symlink maintenance,
`opencode-sync-ai` reconciles the two: it creates one symlink in
`~/.config/opencode/...` for every agent / command / skill found under
the configured source roots.

Resources placed directly in `~/.config/opencode` (regular files or
directories, not symlinks) are treated as user-managed and never touched —
this is how work-only or machine-local resources can coexist with the
synced ones.

## opencode-sync-ai

### Configuration

Edit the `OPENCODE_AI_SOURCES` array at the top of the script to add or
remove source roots:

```bash
OPENCODE_AI_SOURCES=(
  "$HOME/.dotfiles/ai"
  # "$HOME/src/work/private-ai-resources"   # example: add a private repo
)
```

Each source root is expected to (optionally) contain `agents/`, `commands/`,
and `skills/` subdirectories with the same shapes OpenCode discovers natively:

- `agents/<name>.md`
- `commands/<name>.md`
- `skills/<name>/SKILL.md`

### Running

Two equivalent ways:

```sh
# directly
~/.config/opencode/bin/opencode-sync-ai

# from inside an OpenCode session
/update-config
```

The slash command is a thin wrapper that runs the script and asks the
agent for a short summary.

### What it does

For every `agents/*.md`, `commands/*.md`, and `skills/<name>/` (with
`SKILL.md` present) found under the source roots, the script ensures
`~/.config/opencode/<resource_dir>/<name>` is a symlink to the source.

Every run also prunes managed symlinks whose source no longer exists.

### Behavior summary

| Destination state | Action |
|---|---|
| Missing | Create symlink |
| Symlink to the desired target | No-op (counted as unchanged) |
| Symlink into a known source root, but wrong target | Update in place |
| Symlink to a path outside all known source roots | Skip, report as `external link` |
| Regular file or non-symlink directory | Skip, report as `user-managed` |
| Symlink in destination dir but the source file was deleted | Prune |
| Same name defined by two source roots | Abort with non-zero exit, write nothing |

### Properties

- **Idempotent.** Re-running with no source changes is a no-op (all
  entries reported as unchanged).
- **Safe for hand-managed files.** Anything that isn't a symlink — or is a
  symlink pointing outside known source roots — is left strictly alone.
- **Conflict-safe.** When two source roots define the same resource name,
  the script aborts before writing anything. Resolve the conflict (rename
  one, drop one, etc.) and re-run.
- **Bash 3.2 compatible.** Works with macOS system bash; no Homebrew bash
  required. Uses `python3` for `realpath` since macOS `readlink -f` doesn't
  exist on stock systems.
- **Absolute symlinks.** All created symlinks use absolute paths so they
  remain valid regardless of where the script is invoked from.

### Output

Each run prints sections only when they have content:

```
Created:
  agents/code-explorer.md
  commands/commit.md

Updated:
  agents/diff-reviewer.md

Pruned:
  commands/old-command.md

Skipped (user-managed):
  commands/work-only.md

Skipped (external link):
  agents/something.md -> /elsewhere/something.md

Summary: 2 created, 1 updated, 5 unchanged, 1 pruned, 1 skipped (user), 1 skipped (external)
```

Exit code is non-zero on conflicts or filesystem errors.

## First-time setup

```sh
cd ~/.dotfiles && stow opencode
~/.config/opencode/bin/opencode-sync-ai
```

If a stale `~/.config/opencode/skills/SKILL.md` exists (an artifact from
before the per-skill `<name>/SKILL.md` convention was adopted), remove it:

```sh
rm -f ~/.config/opencode/skills/SKILL.md
```
