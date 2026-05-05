/**
 * Git Status Extension
 *
 * Shows current git state in the footer status segment:
 *   <branch>  +A ~M -D   ↑ahead ↓behind   <worktree?>
 *
 * Refreshes on session_start, turn_end, after every bash tool call,
 * and on a 5s idle interval. Stays silent when cwd is not a git repo.
 *
 * Nerd Font icons used:
 *    branch         (U+E0A0, powerline)
 *    worktree/fork  (U+F126, fa-code-fork)
 *    ahead          (U+F062, fa-arrow-up)
 *    behind         (U+F063, fa-arrow-down)
 *    stash          (U+F02E, fa-bookmark)
 *    merge/rebase   (U+F126 reused for merge state label)
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ICON_BRANCH = "\uE0A0";
const ICON_WORKTREE = "\uF126";
const ICON_AHEAD = "\uF062";
const ICON_BEHIND = "\uF063";
const ICON_STASH = "\uF02E";

const POLL_MS = 5000;
// If a full refresh takes longer than this, switch to lite mode
// (branch + worktree only, no polling). Useful for huge monorepos.
const SLOW_THRESHOLD_MS = 1500;
// Hard cap on any single git command. Anything slower is treated as failure.
const GIT_TIMEOUT_MS = 3000;

interface GitInfo {
	branch: string;
	detached: boolean;
	added: number;
	modified: number;
	deleted: number;
	linesAdded: number;
	linesDeleted: number;
	ahead: number;
	behind: number;
	isWorktree: boolean;
	stash: number;
	state: "" | "merging" | "rebasing" | "cherry-picking" | "bisecting" | "reverting";
}

async function git(args: string[], cwd: string, signal?: AbortSignal): Promise<string | null> {
	try {
		const { stdout } = await execFileAsync("git", args, {
			cwd,
			signal,
			timeout: GIT_TIMEOUT_MS,
			maxBuffer: 1024 * 1024,
		});
		return stdout;
	} catch {
		return null;
	}
}

async function collectLite(cwd: string, signal?: AbortSignal): Promise<GitInfo | null> {
	const inside = await git(["rev-parse", "--is-inside-work-tree"], cwd, signal);
	if (!inside || inside.trim() !== "true") return null;

	const [gitDir, commonDir, branchName, sha] = await Promise.all([
		git(["rev-parse", "--absolute-git-dir"], cwd, signal),
		git(["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd, signal),
		git(["branch", "--show-current"], cwd, signal),
		git(["rev-parse", "--short", "HEAD"], cwd, signal),
	]);
	const isWorktree = !!(gitDir && commonDir && gitDir.trim() !== commonDir.trim());
	const trimmed = (branchName ?? "").trim();
	const branch = trimmed || (sha ? `@${sha.trim()}` : "@detached");
	const detached = !trimmed;

	return {
		branch,
		detached,
		added: 0,
		modified: 0,
		deleted: 0,
		linesAdded: 0,
		linesDeleted: 0,
		ahead: 0,
		behind: 0,
		isWorktree,
		stash: 0,
		state: "",
	};
}

async function collect(cwd: string, signal?: AbortSignal): Promise<GitInfo | null> {
	// Quick repo check
	const inside = await git(["rev-parse", "--is-inside-work-tree"], cwd, signal);
	if (!inside || inside.trim() !== "true") return null;

	// Worktree detection: linked worktrees have differing git-dir vs git-common-dir
	const [gitDir, commonDir] = await Promise.all([
		git(["rev-parse", "--absolute-git-dir"], cwd, signal),
		git(["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd, signal),
	]);
	const isWorktree = !!(gitDir && commonDir && gitDir.trim() !== commonDir.trim());

	// Status with branch line: porcelain v2 gives ahead/behind
	const status = await git(["status", "--porcelain=v2", "--branch"], cwd, signal);
	if (status === null) return null;

	let branch = "";
	let detached = false;
	let ahead = 0;
	let behind = 0;
	let added = 0;
	let modified = 0;
	let deleted = 0;

	for (const line of status.split("\n")) {
		if (!line) continue;
		if (line.startsWith("# branch.head ")) {
			const head = line.slice("# branch.head ".length).trim();
			if (head === "(detached)") {
				detached = true;
			} else {
				branch = head;
			}
		} else if (line.startsWith("# branch.ab ")) {
			const m = line.match(/\+(\d+) -(\d+)/);
			if (m) {
				ahead = parseInt(m[1], 10);
				behind = parseInt(m[2], 10);
			}
		} else if (line.startsWith("1 ") || line.startsWith("2 ")) {
			// "1 XY ..." or "2 XY ..." - XY is the two-char status
			const xy = line.slice(2, 4);
			const X = xy[0];
			const Y = xy[1];
			// Index changes (staged): X
			if (X === "A") added++;
			else if (X === "M" || X === "R" || X === "C" || X === "T") modified++;
			else if (X === "D") deleted++;
			// Worktree changes: Y
			if (Y === "M" || Y === "T") modified++;
			else if (Y === "D") deleted++;
		} else if (line.startsWith("? ")) {
			added++; // untracked counted as added
		}
	}

	// Detached HEAD: show short SHA
	if (detached) {
		const sha = await git(["rev-parse", "--short", "HEAD"], cwd, signal);
		branch = sha ? `@${sha.trim()}` : "@detached";
	}

	// Line-level stats vs HEAD: tracked changes (staged + unstaged) via numstat,
	// plus a line count for untracked files (numstat doesn't list those).
	let linesAdded = 0;
	let linesDeleted = 0;
	const numstat = await git(["diff", "HEAD", "--numstat"], cwd, signal);
	if (numstat) {
		for (const line of numstat.split("\n")) {
			if (!line) continue;
			const [a, d] = line.split("\t");
			if (a && a !== "-") linesAdded += parseInt(a, 10) || 0;
			if (d && d !== "-") linesDeleted += parseInt(d, 10) || 0;
		}
	}

	// Untracked files: read and count lines. Caps keep it cheap.
	const untracked = await git(["ls-files", "--others", "--exclude-standard", "-z"], cwd, signal);
	if (untracked) {
		const MAX_FILES = 200;
		const MAX_BYTES = 1024 * 1024; // 1 MiB per file
		const files = untracked.split("\0").filter(Boolean).slice(0, MAX_FILES);
		const fs = await import("node:fs/promises");
		const path = await import("node:path");
		const counts = await Promise.all(
			files.map(async (rel) => {
				try {
					const full = path.join(cwd, rel);
					const stat = await fs.stat(full);
					if (!stat.isFile() || stat.size > MAX_BYTES) return 0;
					const buf = await fs.readFile(full);
					// Skip binary: any NUL byte in the first 8 KiB
					const probe = buf.subarray(0, Math.min(buf.length, 8192));
					if (probe.includes(0)) return 0;
					if (buf.length === 0) return 0;
					// Count newlines; add 1 if file doesn't end with one (final partial line)
					let n = 0;
					for (let i = 0; i < buf.length; i++) if (buf[i] === 0x0a) n++;
					if (buf[buf.length - 1] !== 0x0a) n++;
					return n;
				} catch {
					return 0;
				}
			}),
		);
		for (const n of counts) linesAdded += n;
	}

	// Stash count
	let stash = 0;
	const stashOut = await git(["stash", "list"], cwd, signal);
	if (stashOut) stash = stashOut.split("\n").filter((l) => l.trim()).length;

	// In-progress state — check files under the common git dir
	const stateDir = (commonDir ?? gitDir ?? "").trim();
	let state: GitInfo["state"] = "";
	if (stateDir) {
		const fs = await import("node:fs/promises");
		const exists = async (p: string) => {
			try {
				await fs.access(p);
				return true;
			} catch {
				return false;
			}
		};
		if (await exists(`${stateDir}/MERGE_HEAD`)) state = "merging";
		else if ((await exists(`${stateDir}/rebase-merge`)) || (await exists(`${stateDir}/rebase-apply`))) state = "rebasing";
		else if (await exists(`${stateDir}/CHERRY_PICK_HEAD`)) state = "cherry-picking";
		else if (await exists(`${stateDir}/BISECT_LOG`)) state = "bisecting";
		else if (await exists(`${stateDir}/REVERT_HEAD`)) state = "reverting";
	}

	return { branch, detached, added, modified, deleted, linesAdded, linesDeleted, ahead, behind, isWorktree, stash, state };
}

function format(info: GitInfo, theme: ExtensionContext["ui"]["theme"]): string {
	const dim = (s: string) => theme.fg("dim", s);
	const accent = (s: string) => theme.fg("accent", s);
	const warn = (s: string) => theme.fg("warning", s);
	const ok = (s: string) => theme.fg("success", s);
	const err = (s: string) => theme.fg("error", s);

	const parts: string[] = [];

	// Branch
	parts.push(`${dim(ICON_BRANCH)} ${accent(info.branch)}`);

	// Working tree changes (file counts)
	const dirty = info.added + info.modified + info.deleted;
	if (dirty > 0) {
		const segs: string[] = [];
		if (info.added) segs.push(ok(`+${info.added}`));
		if (info.modified) segs.push(warn(`~${info.modified}`));
		if (info.deleted) segs.push(err(`-${info.deleted}`));
		parts.push(segs.join(" "));
	} else {
		parts.push(ok("✓"));
	}

	// Line-level stats vs HEAD
	if (info.linesAdded || info.linesDeleted) {
		const segs: string[] = [];
		if (info.linesAdded) segs.push(ok(`+${info.linesAdded}`));
		if (info.linesDeleted) segs.push(err(`-${info.linesDeleted}`));
		parts.push(dim("(") + segs.join(" ") + dim(")"));
	}

	// Ahead / behind
	if (info.ahead || info.behind) {
		const ab: string[] = [];
		if (info.ahead) ab.push(`${ICON_AHEAD} ${info.ahead}`);
		if (info.behind) ab.push(`${ICON_BEHIND} ${info.behind}`);
		parts.push(dim(ab.join(" ")));
	}

	// Stash
	if (info.stash) parts.push(dim(`${ICON_STASH} ${info.stash}`));

	// In-progress state
	if (info.state) parts.push(warn(info.state));

	// Worktree marker
	if (info.isWorktree) parts.push(dim(`${ICON_WORKTREE} worktree`));

	return parts.join("  ");
}

export default function (pi: ExtensionAPI) {
	let timer: NodeJS.Timeout | undefined;
	let inflight: AbortController | undefined;
	let lastRender = "";
	// When true, this repo is too slow for full refreshes — only show branch + worktree.
	let liteMode = false;
	let lastCwd: string | undefined;

	async function refresh(ctx: ExtensionContext) {
		// Cancel any in-flight refresh
		inflight?.abort();
		const ac = new AbortController();
		inflight = ac;

		// Reset slow detection when cwd changes
		if (ctx.cwd !== lastCwd) {
			liteMode = false;
			lastCwd = ctx.cwd;
		}

		const start = Date.now();
		const info = liteMode ? await collectLite(ctx.cwd, ac.signal) : await collect(ctx.cwd, ac.signal);
		if (ac.signal.aborted) return;
		const elapsed = Date.now() - start;

		// Promote to lite mode if a full refresh was too slow
		if (!liteMode && info && elapsed > SLOW_THRESHOLD_MS) {
			liteMode = true;
			stopPolling();
			ctx.ui.notify(
				`git-status: repo is slow (${elapsed} ms), switching to lite mode (branch only, no polling)`,
				"info",
			);
		}

		if (!info) {
			if (lastRender !== "") {
				ctx.ui.setStatus("git", "");
				lastRender = "";
			}
			return;
		}

		const rendered = format(info, ctx.ui.theme);
		if (rendered !== lastRender) {
			ctx.ui.setStatus("git", rendered);
			lastRender = rendered;
		}
	}

	function startPolling(ctx: ExtensionContext) {
		stopPolling();
		timer = setInterval(() => {
			void refresh(ctx);
		}, POLL_MS);
		// Don't keep the process alive just for this poll
		timer.unref?.();
	}

	function stopPolling() {
		if (timer) {
			clearInterval(timer);
			timer = undefined;
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		await refresh(ctx);
		startPolling(ctx);
	});

	pi.on("turn_end", async (_event, ctx) => {
		await refresh(ctx);
	});

	// Refresh after bash tool calls (likely to mutate the repo: git commit, edits, etc.)
	pi.on("tool_execution_end", async (event, ctx) => {
		if (event.toolName === "bash" || event.toolName === "write" || event.toolName === "edit") {
			await refresh(ctx);
		}
	});

	pi.on("session_shutdown", async () => {
		stopPolling();
		inflight?.abort();
	});

	pi.registerCommand("git-status", {
		description: "Force-refresh the git status footer (retries full mode if previously degraded)",
		handler: async (_args, ctx) => {
			liteMode = false; // give full mode another chance
			await refresh(ctx);
			if (!timer) startPolling(ctx);
			ctx.ui.notify(liteMode ? "Git status refreshed (lite mode)" : "Git status refreshed", "info");
		},
	});
}
