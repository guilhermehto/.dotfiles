#!/usr/bin/env bash
#
# ai/codex/install.sh — one-time Codex bootstrap
#
# 1. Resolves the dotfiles repo root and $HOME dynamically (no hardcoded paths).
# 2. Places codex-sync-ai on an invocable path (~/.codex/bin/).
# 3. Runs codex-sync-ai once to link skills, subagent TOMLs, and compose AGENTS.md.
# 4. Prints the config-merge instruction for ~/.codex/config.toml.
#
# Run once after cloning the dotfiles repo. Re-running is safe (idempotent).

set -euo pipefail

# ---------- Resolve paths ----------

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOTFILES_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SYNC_SCRIPT="$DOTFILES_ROOT/ai/codex/bin/codex-sync-ai"
CODEX_BIN="$HOME/.codex/bin"
CODEX_BIN_LINK="$CODEX_BIN/codex-sync-ai"

# ---------- Validate ----------

if [[ ! -f "$SYNC_SCRIPT" ]]; then
  printf 'error: codex-sync-ai not found at %s\n' "$SYNC_SCRIPT" >&2
  exit 1
fi

# ---------- Place codex-sync-ai on an invocable path ----------

mkdir -p "$CODEX_BIN"

if [[ -L "$CODEX_BIN_LINK" ]]; then
  current="$(readlink "$CODEX_BIN_LINK")"
  if [[ "$current" != "$SYNC_SCRIPT" ]]; then
    ln -snf "$SYNC_SCRIPT" "$CODEX_BIN_LINK"
    printf 'Updated: %s -> %s\n' "$CODEX_BIN_LINK" "$SYNC_SCRIPT"
  else
    printf 'Unchanged: %s already points to %s\n' "$CODEX_BIN_LINK" "$SYNC_SCRIPT"
  fi
elif [[ -e "$CODEX_BIN_LINK" ]]; then
  printf 'warn: %s exists and is not a symlink — leaving it alone.\n' "$CODEX_BIN_LINK" >&2
  printf '      Add %s to your PATH manually if needed.\n' "$CODEX_BIN" >&2
else
  ln -s "$SYNC_SCRIPT" "$CODEX_BIN_LINK"
  printf 'Created: %s -> %s\n' "$CODEX_BIN_LINK" "$SYNC_SCRIPT"
fi

# ---------- Run the reconciler ----------

printf '\nRunning codex-sync-ai...\n'
"$SYNC_SCRIPT"

# ---------- Print config-merge instruction ----------

cat <<'EOF'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANUAL STEP: merge the following into ~/.codex/config.toml
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If [agents] already exists, merge the keys. Do not duplicate the header.
If [sandbox_workspace_write] already exists, merge writable_roots entries.

EOF

# Print the snippet content so the user can copy it.
SNIPPET="$DOTFILES_ROOT/ai/codex/config.snippet.toml"
if [[ -f "$SNIPPET" ]]; then
  cat "$SNIPPET"
else
  # Fallback: print the minimum required config inline.
  cat <<'SNIPPET_EOF'
[agents]
max_depth = 2
max_threads = 6

[sandbox_workspace_write]
writable_roots = [
  "~/.agents",
  "~/.codex",
]
SNIPPET_EOF
fi

cat <<'EOF'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The writable_roots entry is required so the `update-config` skill can run
codex-sync-ai from within a Codex session without triggering a sandbox
escalation prompt on every re-sync.

To add ~/.codex/bin to your PATH (optional — codex-sync-ai can also be
invoked by absolute path):

  echo 'export PATH="$HOME/.codex/bin:$PATH"' >> ~/.zshrc   # or ~/.bashrc

EOF
