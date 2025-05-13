# Path to your Oh My Zsh installation.
export ZSH="$HOME/.oh-my-zsh"

ZSH_THEME="agnoster"

plugins=(git
	zsh-vi-mode
	zsh-autosuggestions
)

source $ZSH/oh-my-zsh.sh

alias cd="z"
alias cdi="zi"
alias gvim="nvim --listen /tmp/godot.pipe"
export EDITOR="nvim"

alias pmi="sudo pacman -S"
alias pms="pacman -Ss"

eval "$(zoxide init zsh)"

# Turso
export PATH="$PATH:/home/guilherme/.turso"


function ya() {
	local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
	yazi "$@" --cwd-file="$tmp"
	if cwd="$(command cat -- "$tmp")" && [ -n "$cwd" ] && [ "$cwd" != "$PWD" ]; then
		builtin cd -- "$cwd"
	fi
	rm -f -- "$tmp"
}

# fnm
FNM_PATH="/home/gui/.local/share/fnm"
if [ -d "$FNM_PATH" ]; then
  export PATH="/home/gui/.local/share/fnm:$PATH"
  eval "`fnm env`"
fi

# Created by `pipx` on 2025-04-16 09:59:42
export PATH="$PATH:/home/gui/.local/bin"
