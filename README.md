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
| Neovim     | `nvim/`                    | Hand-rolled config (lazy.nvim)           |
| tmux       | `tmux/`                    | `C-a` prefix, vim-aware pane nav, `sesh` popup |
| zsh        | `zsh/`                     | oh-my-zsh + agnoster + zoxide + fnm      |
| Alacritty  | `alacritty/`               |                                          |
| Kitty      | `kitty/`                   |                                          |
| WezTerm    | `wezterm/`                 | Ayu, 0xProto Nerd Font                   |
| Ghostty    | `ghostty/`                 | Catppuccin Macchiato, 0xProto Nerd Font  |
| Rofi       | `rofi/`                    |                                          |

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
stow nvim tmux zsh ghostty wezterm yabai skhd sketchybar aerospace janky-borders

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
  [gum](https://github.com/charmbracelet/gum)
- **Fonts:** [0xProto Nerd Font](https://www.nerdfonts.com/), AzeretMono Nerd Font
- **macOS:** yabai, skhd, sketchybar, janky-borders, aerospace (all via Homebrew)
- **Linux:** depends on distro / WM choice

## Conventions

- Themes lean on **Ayu** (terminals, sketchybar) and **Catppuccin** (ghostty, yabai borders).
- Window gaps standardized at **12px** across yabai / aerospace.
- Leader/prefix is **`C-a`** in tmux and **`alt`** for window management.

## TODO

- Split `zsh/.zshrc` by OS (currently has hardcoded Linux paths).
- Commit the yabai helper scripts referenced from `skhd/skhdrc`.
- Track `nvim/.config/nvim/lazy-lock.json` for reproducibility.
