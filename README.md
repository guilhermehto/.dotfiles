# .dotfiles

My personal configuration files for macOS and Linux. Originally based on
[ThePrimeagen's dotfiles](https://github.com/ThePrimeagen/.dotfiles), evolved
over time into a stow-managed multi-platform setup.

## Layout

The repo is organized as a [GNU Stow](https://www.gnu.org/software/stow/)
package per tool. Each top-level directory mirrors the target file tree
relative to `$HOME`:

```
.dotfiles/
├── nvim/.config/nvim/          → ~/.config/nvim/        (git submodule)
├── tmux/.tmux.conf             → ~/.tmux.conf
├── zsh/.zshrc                  → ~/.zshrc
├── ghostty/.config/ghostty/    → ~/.config/ghostty/
├── ...
```

So `stow nvim` from inside this repo creates `~/.config/nvim` as a symlink.

## What's in here

### Cross-platform
| Tool       | Path                       | Notes                                    |
| ---------- | -------------------------- | ---------------------------------------- |
| Neovim     | `nvim/`                    | Hand-rolled config                       |
| tmux       | `tmux/`                    | `C-a` prefix, vim-aware pane nav, `sesh` popup |
| zsh        | `zsh/`                     | oh-my-zsh + agnoster + zoxide + fnm      |
| Alacritty  | `alacritty/`               |                                          |
| Kitty      | `kitty/`                   |                                          |
| WezTerm    | `wezterm/`                 | Ayu, 0xProto Nerd Font                   |
| Ghostty    | `ghostty/`                 | Catppuccin Macchiato, 0xProto Nerd Font  |
| Rofi       | `rofi/`                    |                                          |
| pi         | `pi/`                      | [pi-coding-agent](https://github.com/mariozechner/pi-coding-agent) global settings |

### macOS
| Tool          | Path              | Notes                                  |
| ------------- | ----------------- | -------------------------------------- |
| yabai         | `yabai/`          | bsp tiling                             |
| skhd          | `skhd/`           | Keybindings for yabai                  |
| AeroSpace     | `aerospace/`      | Alternative tiling WM                  |
| SketchyBar    | `sketchybar/`     | Status bar + plugin scripts            |
| janky-borders | `janky-borders/`  | Active window borders                  |

### Linux
| Tool       | Path        | Notes                |
| ---------- | ----------- | -------------------- |
| Hyprland   | `hypr/`     | Wayland compositor   |
| i3         | `i3/`       | X11 WM               |
| Waybar     | `waybar/`   | Bar for Hyprland     |
| Polybar    | `polybar/`  | Bar for i3           |
| Eww        | `eww/`      | Widgets              |
| Picom      | `picom/`    | X11 compositor       |
| NixOS      | `nixos/`    | System configuration |

## Installation

```bash
git clone git@github.com:<you>/.dotfiles.git ~/.dotfiles
cd ~/.dotfiles

# Pick the packages you want for the current machine, e.g. on macOS:
stow nvim tmux tmuxinator zsh ghostty wezterm yabai skhd sketchybar aerospace janky-borders agents

# On Linux:
stow nvim tmux zsh alacritty hypr waybar rofi
```

## Dependencies

Most of these are optional, but the configs assume they exist:

- **Shell tooling:** [zoxide](https://github.com/ajeetdsouza/zoxide),
  [fnm](https://github.com/Schniz/fnm),
  [yazi](https://github.com/sxyazi/yazi),
  [oh-my-zsh](https://ohmyz.sh/), `zsh-vi-mode`, `zsh-autosuggestions`
- **tmux:** [sesh](https://github.com/joshmedeski/sesh),
  [gum](https://github.com/charmbracelet/gum),
  [tmuxinator](https://github.com/tmuxinator/tmuxinator) (required for `prefix+O` IDE popup)
- **Fonts:** [0xProto Nerd Font](https://www.nerdfonts.com/), AzeretMono Nerd Font
- **macOS:** yabai, skhd, sketchybar, janky-borders, aerospace (all via Homebrew)
- **Linux:** depends on distro / WM choice

## Conventions

- Themes lean on **Ayu** (terminals, sketchybar) and **Catppuccin** (ghostty, yabai borders).
- Window gaps standardized at **12px** across yabai / aerospace.
- Leader/prefix is **`C-a`** in tmux and **`alt`** for window management.

## AI assistant

The `ai/` directory is the single source of truth for an AI coding-assistant
setup that runs on both **opencode** and **OpenAI Codex**. The same agent
definitions, skills, and engineering standards are wired into each tool from
one place.

### Model

| Layer | Contents |
|---|---|
| Main agent | `archmagos` — handles read, explore, and in-chat build directly; delegates only for value |
| Workflow skills | `magos-iterator` (deep plan/track loop), `catechism`, `plan-workflow`, `to-html`, `personal-writing-style` — stowed to `~/.agents/skills` via the `agents/` package |
| Subagents | `explore`, `enginseer`, `magos-artisan`, `logis`, `magos-reductor`, `servitor` |

### `ai/` layout

```
ai/
├── AGENTS.md                  # engineering-standards prose — single source, cross-tool
├── shared/bash-denylist.md    # canonical bash-denylist reference artifact
├── agents/                    # archmagos + 6 subagent definitions
├── commands/                  # 5 opencode slash-commands (catechism, plan, plan-list, commit, to-html)
└── codex/
    ├── agents/                # 6 subagent TOMLs for Codex
    ├── skills/                # 4 Codex action-skills (plan, plan-list, commit, update-config)
    ├── bin/codex-sync-ai      # idempotent reconciler
    ├── install.sh             # one-time bootstrap
    └── config.snippet.toml   # [agents] depth/threads + writable_roots
```

`ai/AGENTS.md` is the single source for engineering-standards prose (code
quality, tests, working style). `ai/shared/bash-denylist.md` is the canonical
reference for the bash command denylist; opencode's per-agent frontmatter
carries intentional enforcement copies kept in parity with it.

### Shared skills (`agents/` package)

The 5 workflow skills (`catechism`, `magos-iterator`, `plan-workflow`,
`to-html`, `personal-writing-style`) live in the `agents/` stow package:

```
agents/.agents/skills/<name>/SKILL.md   →   ~/.agents/skills/<name>/SKILL.md
```

`stow agents` links them into `~/.agents/skills`, which both opencode (≥1.16,
"global agent-compatible" discovery) and Codex (USER-scope skills) read
natively — no sync script required. The package tree-folds into the existing
real `~/.agents/skills` dir, so it coexists with hand-placed skills (e.g.
firecrawl) and the Codex action-skills linked there by `codex-sync-ai`.

### Per-tool wiring

**opencode**

`opencode/.config/opencode/bin/opencode-sync-ai` reconciles
`~/.config/opencode/{AGENTS.md,agents,commands}` by symlinking from `ai/`. Run
it (or invoke the `/update-config` command inside opencode) after any change to
`ai/`. The script prunes only symlinks it owns; hand-placed files are never
touched. (Skills are no longer synced here — they are stowed to
`~/.agents/skills` via the `agents/` package and read natively.)

**Codex**

`ai/codex/install.sh` is the one-time bootstrap. It places `codex-sync-ai`
at `~/.codex/bin/`, runs it once, and prints the config-merge instruction
(the `[agents]` block and `[sandbox_workspace_write] writable_roots` entry)
to paste into `~/.codex/config.toml`.

`ai/codex/bin/codex-sync-ai` is the idempotent reconciler:

- Links the 4 Codex action-skills into `~/.agents/skills/<name>` (Codex
  USER-scope skills directory). The 5 shared workflow skills now reach the same
  directory via `stow agents`, not this script.
- Links the 6 subagent TOMLs into `~/.codex/agents/`.
- Composes `~/.codex/AGENTS.md` = `ai/AGENTS.md` + `ai/agents/archmagos.md`
  (marker-delimited, regenerated idempotently). A single symlink cannot carry
  both files, and spawned-subagent inheritance of AGENTS.md is unverified, so
  each subagent TOML carries its own engineering-standards copy.
- Prunes only symlinks resolving into `ai/`; foreign entries (e.g. firecrawl
  skills already in `~/.agents/skills`) are never touched.

The `writable_roots` entry in `config.snippet.toml` covers `~/.agents` and
`~/.codex` so the `update-config` skill can run `codex-sync-ai` unattended
without stalling on a sandbox escalation prompt.

To re-sync after changes: invoke the `update-config` skill inside Codex
(natural-language trigger: "update config" / "sync codex" / "I added a
skill"). It runs `codex-sync-ai` by absolute path and summarizes
created/updated/pruned/skipped.

### Enforced-to-instructional downgrades

Two invariants that were permission-enforced in the old multi-primary model
are now instruction-enforced only:

**Planner-only invariant (both tools)**
`archmagos` is now write-capable, so the guarantee that the main agent never
edits code is no longer enforced by permissions. The `magos-iterator` skill
strongly instructs the host agent to orchestrate only while the plan/track
loop is active — but this is a soft guard, not a hard one.

**Git-write denylist (Codex)**
opencode enforces the bash denylist via per-agent `permission.bash`
frontmatter (hard deny). Codex has no equivalent per-agent permission
frontmatter, so the git-write prohibitions are carried as instructional guards
in each subagent TOML's `developer_instructions`. The canonical reference
remains `ai/shared/bash-denylist.md`.

**Codex `/plan` skill**
On opencode, plan writes go through the `magos-artisan` subagent (gated).
On Codex, the `plan` action-skill writes `.scriptorum` via the default agent
directly — no magos-artisan gate.

**Codex `commit` skill**
Routes through the `servitor` subagent (mirroring opencode), rather than
committing from the main agent.

### What was removed

- **KB subsystem** — `kb-curator` agent, `kb-workflow` skill, and all
  `kb-*` commands removed entirely.
- **`/work` command** — removed.
- **Dropped primaries** — `explorator`, `fabricator`, and the old
  `magos-iterator` primary agent are gone; their capabilities are folded into
  `archmagos` and the `magos-iterator` workflow skill.

### Claude Code (future)

Not yet implemented. Mapping when it is:

| Claude Code concept | This model |
|---|---|
| `CLAUDE.md` | `archmagos` persona (`ai/agents/archmagos.md`) |
| Agents | Subagents (`ai/agents/`) |
| Commands | Skills (`agents/.agents/skills/`, `ai/commands/`) |

## TODO

- Split `zsh/.zshrc` by OS (currently has hardcoded Linux paths).
- Commit the yabai helper scripts referenced from `skhd/skhdrc`.
- Track `nvim/.config/nvim/lazy-lock.json` for reproducibility.
