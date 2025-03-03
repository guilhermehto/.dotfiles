alias cd="z"
alias cdi="zi"
alias gvim="nvim --listen /tmp/godot.pipe"
export EDITOR="nvim"

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
