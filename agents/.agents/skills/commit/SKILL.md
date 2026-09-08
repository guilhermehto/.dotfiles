---
name: commit
description: Commit staged or specified changes directly in the current agent. Invoke when the user says "/commit", "commit this", "commit the changes", or asks to commit with a scope or message hint. Arguments come from the surrounding prompt.
---

# commit

Commit directly in the current agent; do not delegate. Reuse session context and completed verification instead of repeating exploration, log inspection, or tests without a new reason.

## Workflow

1. Identify the requested changes from the conversation. Check status and existing staged changes, then stage only intended files or hunks using explicit paths. Ask only when scope is ambiguous or unrelated staged changes would enter the commit; preserve unrelated worktree and index changes.
2. Verify the final staged diff matches the requested scope and run `git diff --cached --check`. Commit with a one-line Conventional Commit message by default: `type(scope): short summary` (scope optional). Add a body only when requested or needed to explain a material rationale or breaking change.
3. Report the commit hash and subject. Mention failures or remaining in-scope changes only when relevant.

## Hard rules

- Commit only when explicitly asked; keep separately requested commits separate and in order.
- Never run `git add -A`, `git add .`, or `git add --all`.
- Never run `git push`, `git commit --amend`, `git rebase`, or `git reset --hard`.
