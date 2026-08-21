---
name: code-review
description: Review code changes for concrete defects, regressions, security and data risks, contract or rollout failures, and behavior coverage. Use for local git diffs, staged or unstaged changes, commits, branch ranges, current-branch reviews, and PR links or PR numbers. Local change reviews must be delegated to a spawned subagent; PR link reviews run inline in the same thread using provider tooling.
---

# code-review

Review git changes without modifying the repository.

- Local change review: spawn a subagent to perform the review, then surface its output.
- PR link review: perform the review in the same thread using provider tooling.

## Routing

Classify the target before reviewing:

| Target | Route |
|---|---|
| PR URL containing `/pull/` or `/pull-requests/` | Review inline in the same thread. Do not spawn a subagent. |
| PR number (`123`, `PR #123`) | Review inline if provider/repo context is known; otherwise ask for the full PR URL. |
| Staged, unstaged, all working-tree changes, current branch, local commits, branch ranges, local refs, or a specific commit | Spawn a subagent and ask it to run the review. |

For local targets, the main agent identifies the target, spawns the subagent, waits for its review, and performs a lightweight quality gate before relaying it. Confirm that the response reviewed the intended target, covered the changed files, used valid line citations, and supported each finding with a concrete scenario, impact, and confidence. Ask the same subagent to correct material gaps; do not duplicate the full review in the main thread.

For PR URLs, fetch PR metadata, description, base/head revisions, and diff directly with available provider tools. Do not resolve local PR refs, fetch branches, or compare against the local worktree. For Bitbucket/Atlassian PRs, prefer `twg bitbucket pull-requests get` and `twg bitbucket pull-requests diff`; check live `twg help` only when syntax or output is uncertain. For GitHub PRs, use `gh pr view` and `gh pr diff`, plus read-only provider content/search operations when surrounding code is needed. If provider tooling is unavailable, unauthenticated, or cannot provide enough context, state the limitation and ask for a PR diff/patch, an explicit git range, or a local ref.

## Local subagent prompt

When the target is local, spawn a subagent with this payload shape:

```text
Review target: <plain-language target from the user>

You are a focused code reviewer. Your only job is to read the specified git changes and report issues. Never edit, stage, commit, push, or otherwise modify the repository or working tree.

Use the Code Review protocol and Hard rules below. Return only the requested review format.

<paste the full "Review protocol" and "Hard rules" sections from the code-review skill>
```

Paste both sections into the subagent prompt, not just a reference to the skill; the subagent may not have the skill loaded. If the user requested a thoroughness level or output format, include it and scale effort accordingly.

## Review protocol

### Identify the target

Map the request to a diff source:

| User intent | Diff source |
|---|---|
| Staged changes | `git diff --cached` |
| Unstaged changes, including untracked files | `git diff` plus `git ls-files --others --exclude-standard`; read untracked files as additions |
| All working-tree changes vs HEAD | `git diff HEAD` plus `git ls-files --others --exclude-standard`; read untracked files as additions |
| Unpushed commits | `git log @{upstream}..HEAD` and `git diff @{upstream}..HEAD`; if no upstream exists, ask which remote ref to use rather than substituting the default branch |
| Unmerged/current branch changes vs default branch | Resolve the default branch, then use `git log <default>..HEAD` and `git diff <default>...HEAD` |
| Explicit branch range (`<base>..<head>` or `<base>...<head>`) | Use the exact range supplied for `git diff`; use it for `git log` unless the user asks for a different commit set |
| Between two refs | `git diff <base>..<head>` and `git log <base>..<head>` |
| A specific commit | `git show <sha>` |
| PR URL (`https://.../pull/<n>` or `https://.../pull-requests/<n>`) | Fetch PR metadata and diff with provider tools; do not resolve local refs |
| PR number (`123`, `PR #123`) | Use provider tools when provider/repo context is known; otherwise ask for the full PR URL |

Resolve the default branch from `refs/remotes/origin/HEAD`; if unavailable, verify `main` and then `master` with `git rev-parse --verify`. If none resolves, ask for the base branch.

If the request is ambiguous, state the interpretation in one sentence and proceed. Stop only when no diff can be obtained or the target genuinely cannot be determined.

### Establish intent and coverage

1. Establish intended behavior from the user's request and, when available, the PR description, linked issue, commit messages, and tests. If intent must be inferred, say so rather than blocking the review.
2. Record the exact target and inventory the whole change before reviewing hunks. Use `git diff --stat`, `--numstat`, and `--name-status` with the resolved target, or provider equivalents. Include untracked files when applicable.
3. For large diffs, inspect file-by-file so output truncation cannot silently omit files. State which generated, binary, vendored, lock, or otherwise unreadable files were not fully inspected.
4. For local targets, use `git status` and `git log -n 10 --oneline` for context. For remote PRs, use PR metadata and exact base/head revisions; do not use unrelated local repository state.
5. Read surrounding code for every non-trivial hunk. For removed code, inspect the base version. When remote tooling cannot provide enough surrounding context, lower confidence or ask for the missing material.
6. Trace affected callers, consumers, schemas, persisted data, and tests. When the change introduces an abstraction, search for an existing equivalent only if duplication could create concrete divergence or ownership risk.

### Finding quality

Report only risks introduced or materially worsened by the target change. Before presenting a concern as a finding, establish all four:

- **Trigger:** a realistic input, state, timing, deployment, or failure condition.
- **Impact:** observable incorrect behavior, security/privacy exposure, data loss or corruption, availability degradation, contract breakage, or concrete maintenance risk.
- **Evidence:** support from the changed code and relevant caller, contract, test, documentation, or surrounding implementation.
- **Attribution:** why the target change owns or worsens the problem.

If material evidence is missing, place the concern under `Open questions` or omit it. Do not turn a possibility into a defect merely because it matches a checklist item.

Every finding headline must end with a confidence temperature such as `(0.8 confidence)`. This measures confidence that the finding is valid and attributable to the change; it is not severity or the probability that the failure will occur. Use one decimal place:

- `0.9–1.0`: directly demonstrated or compelled by a contract, with no material assumption.
- `0.8`: strong codebase evidence with one minor unresolved assumption.
- `0.7`: credible but dependent on a meaningful context assumption; prefer an open question when that assumption can change the conclusion.
- Below `0.7`: do not report as a finding; ask a question or omit it.

Do not use a low confidence score to soften an unsupported claim. Severity and confidence are independent.

### Review lenses

Start with changed behavior and invariants, then apply only the lenses relevant to the touched surfaces:

- **Behavior and state:** boundary values, nullability, state transitions, ordering, concurrency, cancellation, partial failure, retry, deduplication, idempotency, and resource cleanup.
- **Contracts and integration:** callers and consumers, API/schema/type compatibility, serialization defaults, version skew, and documentation that defines behavior.
- **Data and rollout:** migrations, backfills, transaction boundaries, configuration defaults, feature flags, mixed-version deployment, rollback, and recovery.
- **Trust and data handling:** authentication and authorization, validation, injection, unsafe parsing or deserialization, path handling, secrets, privacy, and sensitive logging.
- **Operations and performance:** timeouts, failure isolation, observability, pagination, N+1 work, unbounded growth, leaked resources, and hot-path complexity.
- **Surface-specific behavior:** accessibility, localization, loading/error/empty states for UI; dependency, lockfile, build, and supply-chain effects when those surfaces change.
- **Maintainability:** report duplication, placement, naming, comments, or complexity only when it violates an established boundary or creates a concrete correctness, divergence, or ownership risk. Describe the observable mismatch rather than labeling code an “anti-pattern.”
- **Tests as evidence:** assess whether tests protect the changed behavior, boundaries, and failure modes. Mocking or snapshots are findings only when they prevent detection of a specific regression. Missing coverage is a finding only when consequential new behavior is left unprotected.

Run existing targeted validation only when it is available without installing dependencies and can be run without modifying repository contents. Otherwise state what was not run.

### Severity

- **Must fix:** concrete correctness, security/privacy, data integrity, availability, compatibility, migration, deployment, or rollback risk that should block the change.
- **Should fix:** meaningful reliability, performance, maintainability, or test risk that is change-owned but does not clearly block release.
- Put unresolved assumptions under **Open questions**, not under a lower severity.
- Omit style preferences and nits unless the user explicitly requests them. If an optional suggestion alleges a concrete risk, classify it as a finding and include confidence.

### Output format

Unless the user requests a different format, use this structure:

```markdown
## Findings

### Must fix
- `file:line` — <concise problem> (0.9 confidence)
  - Trigger: <specific scenario>
  - Impact: <observable consequence>
  - Fix direction: <required outcome without over-prescribing implementation>

### Should fix
- `file:line` — <concise problem> (0.8 confidence)
  - Trigger: <specific scenario>
  - Impact: <observable consequence>
  - Fix direction: <required outcome without over-prescribing implementation>

## Open questions
- <question whose answer could materially change the review>

## Assessment
<No blocking findings | Blocking findings present | Insufficient evidence>. <Brief rationale.>
- Scope: <target and coverage, including anything not fully inspected>
- Validation: <checks run, failures, or not run>
```

If a findings subsection or `Open questions` has nothing, write `_(none)_`. Keep the review proportional; do not add optional sections merely to fill space.

## Hard rules

- Read-only. Never run `git add`, `git commit`, `git restore`, `git reset`, `git checkout` with paths, `git push`, `git stash`, `git rebase`, `git merge`, or any command that mutates state.
- Allowed git verbs: `diff`, `log`, `show`, `status`, `blame`, `rev-parse`, `ls-files`, `symbolic-ref`, `branch --show-current`, `for-each-ref`.
- Allowed GitHub CLI commands: `gh pr view`, `gh pr diff`, and GET-only `gh api` calls without mutation flags. Use equivalent read-only provider tooling when available.
- Do not install dependencies or run validation commands expected to rewrite files or create repository artifacts.
- Do not pretend to apply fixes. Describe the required outcome or a fix direction instead.
- Use surrounding code as evidence, but do not report unrelated pre-existing problems. Cite a changed line for each finding; for removed code, identify the old-side line.
- Never repeat a discovered secret or sensitive value in the review.
- Be concrete and neutral. Describe the mismatch and exact failure mode; avoid loaded labels such as “anti-pattern,” “lying,” “stuffed,” “brittle,” or “gratuitous.”
- Match the project's established behavior and style. A local convention is not a finding unless it creates one of the concrete risks above.
- Keep the review proportional. A short clean diff deserves a short review.
