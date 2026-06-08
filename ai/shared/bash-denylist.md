# Bash denylist — canonical reference

This document lists the bash command globs denied across all agents in this repo.
opencode enforces them via per-agent `permission.bash` frontmatter (the enforcement copies).
Codex-style runtimes derive soft guards from this reference.

**Do not edit the per-agent frontmatter to match this file — the frontmatter is the enforcement copy.**
If you need to change the policy, update both this file and every affected agent's frontmatter.

---

## Base denylist (all 11 agents)

### Privilege escalation
```
"sudo *": deny
"doas *": deny
"su *": deny
```
Prevents any command running as root or another user.

### Catastrophic deletion
```
"rm -rf /": deny
"rm -rf /*": deny
"rm -rf ~": deny
"rm -rf ~/*": deny
"rm -rf $HOME*": deny
"rm -rf .": deny
"rm -rf ./*": deny
"rm -rf ..*": deny
```
Blocks recursive deletion of the filesystem root, home directory, or CWD.

### Disk / filesystem destruction
```
"dd *of=/dev/*": deny
"mkfs*": deny
"fdisk *": deny
```
Prevents overwriting block devices or reformatting disks.

### Remote pipe-to-shell
```
"curl *|sh*": deny
"curl *| sh*": deny
"curl *|bash*": deny
"curl *| bash*": deny
"wget *|sh*": deny
"wget *| sh*": deny
"wget *|bash*": deny
"wget *| bash*": deny
```
Blocks the classic remote-code-execution pattern of piping a downloaded script directly into a shell.

### Permission breakage
```
"chmod -R 777*": deny
"chown -R *": deny
```
Prevents world-writable trees and recursive ownership changes.

### Git history rewriting / work loss
```
"git push*": deny
"git reset --hard*": deny
"git rebase*": deny
"git filter-branch*": deny
"git filter-repo*": deny
"git stash drop*": deny
"git stash clear*": deny
"git clean -f*": deny
"git clean -d*": deny
"git clean -x*": deny
"git branch -D*": deny
"git checkout -- *": deny
"git checkout . *": deny
"git restore *": deny
"git update-ref *": deny
```
Prevents pushing, history rewriting, and irreversible worktree mutations.

---

## Read-only contract (agents: archmagos, explore, logis, magos-reductor)

These agents carry an additional block that prevents any worktree or commit mutations:

```
"git add*": deny
"git commit*": deny
"git merge*": deny
"git revert*": deny
"git cherry-pick*": deny
"git mv*": deny
"git rm*": deny
"git apply *": deny
"git am *": deny
"git pull*": deny
"git tag *": deny
"git stash*": deny
```
Read-only agents must not touch the index or commit history at all.

---

## Write-agent commit contract (agents: enginseer, servitor)

These agents commit their own work but must not amend or stash:

```
"git commit --amend*": deny
"git commit -a*": deny
"git stash*": deny
```
Enginseer and servitor stage and commit explicitly scoped changes per-step; amending or bulk-staging would break the per-step commit invariant.
