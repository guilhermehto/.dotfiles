---
description: Stage and commit scoped changes directly in the current agent
argument-hint: "[scope hint — e.g. 'just the auth fixes, leave the readme alone']"
---

Load the `commit` skill and follow its workflow directly. Do not dispatch `servitor` or another subagent.

Scope or message hint: $ARGUMENTS

If arguments are empty, use the current task's changes; without task context, infer one coherent commit from the diff. Reuse context and completed verification from this session. Preserve unrelated worktree and staged changes.
