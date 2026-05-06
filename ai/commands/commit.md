---
description: Create a one-line conventional commit from staged changes
argument-hint: "[extra context]"
---
Create a git commit using the Conventional Commits specification.

Steps:
1. Run `git status` to see what is staged.
   - **If something is already staged**, use that as-is. Do **not** add or remove anything from the index.
   - **If nothing is staged**, look at the unstaged + untracked changes (`git status`, `git diff`) and pick the files that form a single coherent commit. Then:
     a. List the files you would stage, grouped by the logical change you'd commit.
     b. If the working tree contains multiple unrelated concerns, propose only the most coherent group and mention the others as out-of-scope (do not stage them).
     c. Ask me to confirm before staging. Wait for an explicit yes.
     d. On confirmation, run `git add -- <files>` for exactly those files, then continue.
     e. If I decline, stop without staging anything.
2. Run `git diff --cached` to inspect the staged changes.
3. Run `git log -n 10 --oneline` to match the repository's existing commit style (scope conventions, casing, tone).
4. Write a **single-line** commit message in the form:
   `<type>(<scope>): <subject>`
   - `type` is one of: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
   - `scope` is optional. Use it when the change is clearly localised (e.g. a package, module, or top-level folder).
   - `subject` is imperative, lowercase, no trailing period, ≤ 72 chars total line length.
   - No body, no footer — one line only.
5. Run the commit with `git commit -m "<message>"`.
6. Print the resulting commit hash and message.

Rules:
- Never stage files without my explicit confirmation.
- Never unstage, amend, or push.
- Do not include co-author trailers, emojis, or marketing language.
- If the **already-staged** diff mixes unrelated concerns, stop and tell me — suggest splitting before committing.

Extra context from me (may be empty): $ARGUMENTS
