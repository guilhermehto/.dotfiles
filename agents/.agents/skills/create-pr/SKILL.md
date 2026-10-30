---
name: create-pr
description: Open a pull request for the current branch on GitHub or Bitbucket, titled from the Jira ticket in the branch name. Invoke when the user says "/create-pr", "create a PR", "raise a PR", "open a PR", or similar. `/create-pr draft` opens a draft PR; any other argument text is a title suggestion. Arguments come from the surrounding prompt.
---

# create-pr

Open the PR directly in the current agent; do not delegate. Reuse session context (ticket names, diff summaries, completed verification) instead of fetching or rerunning it.

## Arguments

- `draft` anywhere in the arguments: create the PR as a draft.
- Any other text: a title suggestion.
- A base branch, only when the user names one explicitly. Otherwise the base is the repository default branch.

## Workflow

1. **Check the branch.** Read the current branch, the `origin` URL, and the base branch (`git symbolic-ref --short refs/remotes/origin/HEAD`; if unset, `git remote show origin`). Fetch the base. Stop if the current branch is the base or has no commits ahead of it. Note uncommitted changes; never commit them.
2. **Check for an existing PR.** GitHub: `gh pr view --json url,state`. Bitbucket: `twg bitbucket pull-requests query --source <branch> --state OPEN -o json`. If an open PR exists, report its URL and stop.
3. **Find the ticket key.** Take the first match of `[A-Za-z][A-Za-z0-9]+-[0-9]+` in the branch name and uppercase it: `gui/mycl-233-fix-login` gives `MYCL-233`. If the ticket summary is already in session context, use it. Otherwise run `twg jira workitem get <KEY> -o json` and read `summary`. If Jira reports the key as not found, treat the branch as having no ticket (this filters false matches such as `fix-2`). If the lookup fails for another reason (auth, network) and there is no title suggestion, ask the user for the ticket name.
4. **Build the title.**
   - Ticket: `[MYCL-233] - <ticket summary>`, summary verbatim.
   - No ticket: `[NOISSUE] - <title>`. Use the user's title suggestion; without one, write a short plain summary of the change from the commits and diff: sentence case, no trailing period.
   - A user title suggestion replaces the ticket summary but keeps the `[KEY]` prefix.
5. **Write the description.** Load the `personal-writing-style` skill and write the body in its PR description shape from `git log <base>..HEAD` and `git diff <base>...HEAD`. Keep it minimal: a context line and a few bullets. Look for a PR template with `git ls-files | grep -i pull_request_template` (covers `.github/`, `docs/`, the repo root, and `PULL_REQUEST_TEMPLATE/` directories).
   - Use the template when its sections fit the change. If there are several, pick the one matching the change, else the default.
   - Keep its headings and checklists. Fill them with the same terse content, delete guidance comments, tick only checkboxes that are true, and put `N/A` under sections that do not apply.
   - Skip a template that does not fit the change (for example a release template).
6. **Push the branch.** If the branch has no upstream, run `git push -u origin HEAD`; if it is ahead of its upstream, run `git push`. The `/create-pr` request is the request to push. If the push is rejected, stop and report; never force-push.
7. **Create the PR.** Write the body to a file in `$TMPDIR`, then pick the provider from the `origin` URL:
   - `github.com`: `gh pr create --base <base> --title <title> --body-file <file>`, plus `--draft` when requested.
   - `bitbucket.org`: `twg bitbucket pull-requests create --source <branch> --dest <base> --title <title> --description-file <file> -o json`, plus `--draft` when requested.
   - Any other host: stop and report that the provider is not supported.
8. **Report** the PR URL, the title, and whether it is a draft. Mention uncommitted changes left out of the PR and a ticket lookup that failed.

## Hard rules

- Never commit, amend, rebase, or force-push.
- Never invent a ticket summary.
- Add reviewers only when the user asks.
