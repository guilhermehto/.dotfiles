---
name: commit
description: Commit staged or specified changes directly in the current agent. Invoke when the user says "/commit", "commit this", "commit the changes", or asks to commit with a scope or message hint. Arguments come from the surrounding prompt.
---

# commit

Handle commits directly in the current agent. Do not delegate to `servitor` or another subagent: reuse the conversation's scope, implementation context, and verification results.

## Workflow

1. Extract the requested scope and message hint from the user's prompt. If no scope is given, use the changes from the current task; without task context, infer one coherent commit from the diff. Ask only if the intended scope remains ambiguous.
2. Inspect `git status --short`, the relevant diff, and the staged diff. Reuse known context; do not repeat codebase exploration or completed tests unless intervening changes or failures warrant it. Check recent commit subjects if repository style is not already known.
3. Stage only in-scope changes with explicit paths. Preserve unrelated worktree and index changes. If unrelated staged changes would enter the commit, resolve the scope with the user before proceeding; do not silently include or unstage them. If only part of a file belongs to the scope, stage only those hunks.
4. Verify the staged diff matches the requested scope and run `git diff --cached --check`. Commit directly using Conventional Commits format and the repository's established style. For multiple requested commits, stage and commit each scope sequentially in the requested order.
5. Report the commit hash and subject. Mention verification failures or remaining in-scope changes when relevant.

## Hard rules

- Never commit automatically without an explicit user request.
- Never delegate ordinary commit work to a subagent.
- Never run `git add -A`, `git add .`, or `git add --all`.
- Never run `git push`, `git commit --amend`, `git rebase`, or `git reset --hard`.
