---
description: Stage and commit scoped changes via the servitor subagent
argument-hint: "[scope hint — e.g. 'just the auth fixes, leave the readme alone']"
---
Dispatch the `servitor` subagent with this task. Do not run `git status`, `git diff`, or any other tool yourself first — servitor will do that. Surface its structured return verbatim. Do not add commentary, summarisation, or next steps.

Task for servitor:

> Stage and commit changes in this worktree that match the scope below, using Conventional Commits format. Skip files outside scope and leave them dirty. If something is already staged and matches the scope, use it as-is. Match repo style via `git log -n 10 --oneline`. Return hash, commit message, files staged, and files left dirty.
>
> Scope: $ARGUMENTS
>
> If the scope above is empty, infer the single most coherent commit from the working tree and leave anything unrelated dirty.
