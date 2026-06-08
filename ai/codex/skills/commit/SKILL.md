---
name: commit
description: Commit staged or specified changes via the servitor subagent. Invoke when the user says "/commit", "commit this", "commit the changes", or asks to commit with a scope or message hint. Arguments come from the surrounding prompt.
---

# commit

Routes a commit request through the `servitor` subagent, mirroring the opencode `/commit` command.

## Codex-specific notes

**No `$ARGUMENTS` injection.** On Codex, the scope hint or message comes from the surrounding prompt, not a `$ARGUMENTS` placeholder. Extract it from the user's message.

**Dispatches `servitor`.** The default agent does not commit directly. It dispatches `servitor` with a scope hint derived from the user's message and the current working-tree state. This mirrors the opencode pattern where commits are always routed through servitor. This is a known invariant (not a downgrade) slated for the README.

## Workflow

1. Extract the scope hint or message from the user's prompt (e.g. "commit the auth changes" → scope hint: `auth`).
2. Dispatch `servitor` with:
   - The scope hint (if any).
   - A note of what was changed (from context or a brief `git status` summary).
3. Surface servitor's output verbatim.
4. Do not run `git add` or `git commit` yourself.

## Hard rules

- Never commit automatically without an explicit user request.
- Never run `git add -A`, `git add .`, or `git add --all`.
- Never run `git push`, `git commit --amend`, `git rebase`, or `git reset --hard`.
