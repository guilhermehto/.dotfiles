---
name: code-review
description: Review code changes for bugs, regressions, security, architecture, reusability, and test quality. Use for local git diffs, staged or unstaged changes, commits, branch ranges, current-branch reviews, and PR links or PR numbers. Local change reviews must be delegated to a spawned subagent; PR link reviews run inline in the same thread using provider tooling.
---

# code-review

Review git changes without modifying the repository. Preserve the previous review behavior, with one routing change:

- Local change review: spawn a subagent to perform the review, then surface its output.
- PR link review: do the review in the same thread using provider tooling.

## Routing

Classify the target before reviewing:

| Target | Route |
|---|---|
| PR URL containing `/pull/` or `/pull-requests/` | Review inline in the same thread. Do not spawn a subagent. |
| PR number (`123`, `PR #123`) | Review inline if provider/repo context is known; otherwise ask for the full PR URL. |
| Staged, unstaged, all working-tree changes, current branch, local commits, branch ranges, local refs, or a specific commit | Spawn a subagent and ask it to run the review. |

For local targets, the main agent only identifies the target, spawns the subagent, waits for its review, and relays the review. Do not duplicate the full review in the main thread unless the subagent output violates the requested format or clearly reviewed the wrong target.

For PR URLs, fetch PR metadata and diff directly with the available provider tools. Do not resolve local PR refs, fetch branches, or compare against the local worktree. For Bitbucket/Atlassian PRs, prefer the available `twg bitbucket pull-requests get` and `twg bitbucket pull-requests diff` commands after checking live `twg help` syntax. For GitHub PRs, use `gh pr view` and `gh pr diff` when available. If provider tooling is unavailable, unauthenticated, or cannot access the PR, state that and ask for a PR diff/patch, an explicit git range, or a local ref.

## Local subagent prompt

When the target is local, spawn a subagent with this payload shape:

```text
Review target: <plain-language target from the user>

You are a focused code reviewer. Your only job is to read the specified git changes and report issues. Never edit, stage, commit, push, or otherwise modify the repository or working tree.

Use the Code Review protocol below. Return only the requested review format.

<paste the "Review protocol" section from the code-review skill>
```

Paste the full protocol text into the subagent prompt, not just a reference to the skill; the subagent may not have the skill loaded.

If the user asked for a thoroughness level, include it in the payload and tell the subagent to scale effort accordingly while preserving the output shape.

## Review protocol

### Identifying the review target

Map the request to a diff source:

| User intent | Command |
|---|---|
| Staged changes | `git diff --cached` |
| Unstaged changes | `git diff` |
| All working-tree changes vs HEAD | `git diff HEAD` |
| Unmerged / unpushed commits | `git log @{upstream}..HEAD` + `git diff @{upstream}..HEAD` (fall back to `origin/HEAD..HEAD`, then `main..HEAD` or `master..HEAD` if no upstream is set) |
| Explicit branch range (`<base>..<head>` or `<base>...<head>`) | `git diff <range>` + `git log <range>` (preserve the exact range syntax provided) |
| Between two refs | `git diff <base>..<head>` and `git log <base>..<head>` |
| A specific commit | `git show <sha>` |
| PR URL (`https://.../pull/<n>` or `https://.../pull-requests/<n>`) | Use provider tools to fetch PR metadata/diff and review the PR diff directly (no local ref resolution) |
| PR number (`123`, `PR #123`) | If provider/repo context is known, use provider tools to fetch PR metadata/diff; otherwise ask for full PR URL |
| Current branch vs default branch | `git diff $(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/@@')..HEAD` |

Resolve PR, branch, and range-like inputs in this order:

1. Explicit branch range (`<base>..<head>` or `<base>...<head>`): use it directly for both `git log` and `git diff`.
2. PR URL: use provider tools to fetch PR metadata and PR diff directly.
3. PR number: if provider/repo context is known, use provider tools; otherwise ask for a full PR URL.
4. Fallback: if no diff can be obtained, state the blocker and ask for a PR diff/patch, explicit git range, or local ref.

If the request is ambiguous, state the interpretation in one sentence, then proceed. Stop only when no diff can be obtained or the target genuinely cannot be determined.

### How to review

1. Run the relevant git/provider commands to get the diff.
2. Run `git status` and `git log -n 10 --oneline` for context.
3. For each non-trivial hunk, read the surrounding file, not just the diff lines.
4. If the change touches a public API or shared utility, grep for callers and check whether they were updated.
5. Actively look for existing equivalents before concluding a new helper, hook, component, module, or pattern is fine. Search similar names and likely synonyms.
6. Group findings by severity. Cite `file:line` for every concrete finding.

Look for, in roughly this order:

- Correctness bugs: off-by-one errors, null/undefined handling, race conditions, broken control flow, regressions in behavior relative to the rest of the codebase.
- Security: injection, unsafe shell or SQL construction, secrets in code or logs, missing auth checks, unsafe deserialization, path traversal, prototype pollution.
- Error handling: unhandled promise rejections, swallowed exceptions, missing timeouts, retries that mask real failures, panics that should be recoverable.
- Resource and performance issues: N+1 queries, unbounded loops, leaked handles, missing pagination, unnecessary work in hot paths, accidental quadratic behavior.
- API and contract drift: callers not updated, types out of sync, public API breakage without migration, docstring or schema drift.
- Reusability and duplication: new logic that re-implements an existing helper/hook/component/module; near-duplicate logic; copy-pasted code with small tweaks.
- Architecture and placement: code living in the wrong layer; missing abstraction boundaries; cross-layer leakage; features stuffed into a single large unit when local style splits them.
- Framework or language anti-patterns: match the language and framework in use, and read nearby code before calling something an anti-pattern.
- Tests: behavior coverage over implementation detail. Flag brittle snapshots, tests asserting private calls, mock-heavy tests that restate implementation, removed tests without justification, or missing coverage for new behavior.
- Simplicity and readability: dead code, misleading names, lying comments, gratuitous complexity, premature abstraction.

### Output format

Use this exact structure and keep section headers verbatim:

```markdown
## Summary
<2-4 sentences: what changed, overall verdict: ship / fix-first / rework>

## Blocking issues
- `file:line` — <issue> — <why it matters> — <suggested fix>

## Non-blocking issues
- `file:line` — <issue> — <suggested fix>

## Refactoring opportunities
- `file:line` — <duplication / architecture / anti-pattern> — <existing equivalent or better location, if known> — <suggested move>

## Test quality
- <observations on whether tests cover behavior vs. implementation, mock-heaviness, missing coverage; or `_(none)_`>

## Nits
- `file:line` — <nit>

## Looks good
- <brief notes on what's solid, if anything>
```

If a section has nothing, write `_(none)_` rather than omitting the section.

## Hard rules

- Read-only. Never run `git add`, `git commit`, `git restore`, `git reset`, `git checkout` with paths, `git push`, `git stash`, `git rebase`, `git merge`, or any command that mutates state.
- Allowed git verbs: `diff`, `log`, `show`, `status`, `blame`, `rev-parse`, `ls-files`, `symbolic-ref`, `branch --show-current`, `for-each-ref`.
- Allowed GitHub CLI commands: `gh pr view`, `gh pr diff`. Use equivalent provider tooling when available.
- Do not pretend to apply fixes. Only describe them.
- Do not speculate beyond the diff. If something suspicious is outside the changed code, mention it once in `Non-blocking issues` and move on.
- Be concrete. Avoid vague findings like "this might break things"; explain the exact failure mode.
- Match the project's existing style. If the diff follows local convention, that is not a finding.
- Keep the review proportional. A short clean diff deserves a short review.
