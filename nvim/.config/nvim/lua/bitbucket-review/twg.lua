--- twg.lua — async wrappers around the twg CLI for Bitbucket PR operations.
--
-- Flags verified against `twg help describe "bitbucket pull-requests comment create"`
-- opts block (authoritative): --pull-request, --text, --path, --line
-- Flags verified against `twg help describe "bitbucket pull-requests query"`
-- opts block: --state, --source; output is a top-level JSON array.
--
-- All public functions are async: they return nothing and deliver results via
-- a callback(value, reason) convention:
--   on success  → callback(value, nil)
--   on failure  → callback(nil,   reason_string)
--
-- Nothing in this file contains credentials. Auth is fully delegated to twg.

local M = {}

-- Path to twg binary. GUI-launched nvim may not inherit the shell PATH that
-- has /Users/goliveira/.local/bin on it, so we try both.
local TWG_CANDIDATES = {
	vim.fn.exepath("twg"),         -- respects current $PATH
	"/Users/goliveira/.local/bin/twg",
}

--- Return the first twg binary that exists, or nil.
local function find_twg()
	for _, candidate in ipairs(TWG_CANDIDATES) do
		if candidate ~= "" and vim.uv.fs_stat(candidate) then
			return candidate
		end
	end
	return nil
end

--- Run cmd asynchronously with cwd, calling back with (stdout, nil) on exit 0
--- or (nil, reason) on any failure.
---@param cmd string[]
---@param cwd string
---@param cb fun(stdout: string|nil, reason: string|nil)
local function run(cmd, cwd, cb)
	local ok, err = pcall(vim.system, cmd, { text = true, cwd = cwd }, function(out)
		vim.schedule(function()
			if out.code ~= 0 then
				local stderr = (out.stderr or ""):gsub("%s+$", "")
				cb(nil, ("twg exited %d: %s"):format(out.code, stderr ~= "" and stderr or "(no stderr)"))
				return
			end
			cb(out.stdout, nil)
		end)
	end)
	if not ok then
		-- vim.system can throw when the binary is not found (ENOENT).
		vim.schedule(function()
			cb(nil, ("could not launch %s: %s"):format(cmd[1], tostring(err)))
		end)
	end
end

--- Derive the repo toplevel from `git rev-parse --show-toplevel`, calling back
--- with (toplevel, nil) or (nil, reason).
---@param cb fun(toplevel: string|nil, reason: string|nil)
local function get_toplevel(cb)
	local git = vim.fn.exepath("git")
	if git == "" then
		vim.schedule(function()
			cb(nil, "git not found on PATH")
		end)
		return
	end
	run({ git, "rev-parse", "--show-toplevel" }, vim.loop.cwd(), function(out, reason)
		if not out then
			cb(nil, reason)
			return
		end
		cb(out:gsub("%s+$", ""), nil)
	end)
end

--- Get the current branch name, calling back with (branch, nil) or (nil, reason).
--- Returns nil+reason for detached HEAD (rev-parse returns the literal "HEAD").
---@param toplevel string
---@param cb fun(branch: string|nil, reason: string|nil)
local function get_branch(toplevel, cb)
	local git = vim.fn.exepath("git")
	if git == "" then
		cb(nil, "git not found on PATH")
		return
	end
	run({ git, "rev-parse", "--abbrev-ref", "HEAD" }, toplevel, function(out, reason)
		if not out then
			cb(nil, reason)
			return
		end
		local branch = out:gsub("%s+$", "")
		if branch == "HEAD" then
			cb(nil, "detached HEAD — cannot resolve PR for a detached checkout")
			return
		end
		cb(branch, nil)
	end)
end

--- Resolve the open PR for the current branch.
---
--- Callback receives (pr_id: number|nil, reason: string|nil).
---   - Exactly one open PR  → (id, nil)
---   - Zero open PRs        → (nil, "no open PR found for branch '<branch>'")
---   - More than one PR     → (first_id, "multiple open PRs found; using the first (id=<id>)")
---   - Any error            → (nil, reason)
---
---@param cb fun(pr_id: number|nil, reason: string|nil)
function M.resolve_pr(cb)
	local twg = find_twg()
	if not twg then
		vim.schedule(function()
			cb(nil, "twg not found — ensure /Users/goliveira/.local/bin is on PATH")
		end)
		return
	end

	get_toplevel(function(toplevel, tl_err)
		if not toplevel then
			cb(nil, tl_err)
			return
		end

		get_branch(toplevel, function(branch, br_err)
			if not branch then
				cb(nil, br_err)
				return
			end

			local cmd = { twg, "bitbucket", "pull-requests", "query",
				"--state", "OPEN",
				"--source", branch,
				"-o", "json",
			}

			run(cmd, toplevel, function(stdout, reason)
				if not stdout then
					cb(nil, reason)
					return
				end

				local raw = (stdout or ""):gsub("%s+$", "")
				if raw == "" then
					cb(nil, ("no open PR found for branch '%s' (empty response)"):format(branch))
					return
				end

				local decode_ok, prs = pcall(vim.json.decode, raw)
				if not decode_ok then
					cb(nil, ("failed to parse twg JSON: %s"):format(tostring(prs)))
					return
				end

				if type(prs) ~= "table" or not vim.islist(prs) then
					cb(nil, "unexpected twg response shape (expected JSON array)")
					return
				end

				if #prs == 0 then
					cb(nil, ("no open PR found for branch '%s'"):format(branch))
					return
				end

				local first = prs[1]
				if type(first) ~= "table" or type(first.id) ~= "number" then
					cb(nil, "PR object missing numeric 'id' field")
					return
				end

				if #prs > 1 then
					cb(first.id, ("multiple open PRs found for branch '%s'; using the first (id=%d)"):format(branch, first.id))
				else
					cb(first.id, nil)
				end
			end)
		end)
	end)
end

--- Post an inline comment on a Bitbucket PR.
---
--- Callback receives (ok: boolean, detail: string|nil).
---   ok=true  → comment posted; detail is nil
---   ok=false → detail is the failure reason / stderr
---
---@param pr_id number       numeric PR id
---@param path  string       repo-relative file path (new-side)
---@param line  number       new-side line number
---@param text  string       comment body
---@param cb    fun(ok: boolean, detail: string|nil)
function M.post_comment(pr_id, path, line, text, cb)
	local twg = find_twg()
	if not twg then
		vim.schedule(function()
			cb(false, "twg not found — ensure /Users/goliveira/.local/bin is on PATH")
		end)
		return
	end

	get_toplevel(function(toplevel, tl_err)
		if not toplevel then
			vim.schedule(function()
				cb(false, tl_err)
			end)
			return
		end

		local cmd = {
			twg, "bitbucket", "pull-requests", "comment", "create",
			"--pull-request", tostring(pr_id),
			"--text",         text,
			"--path",         path,
			"--line",         tostring(line),
		}

		run(cmd, toplevel, function(stdout, reason)
			if not stdout then
				cb(false, reason)
			else
				cb(true, nil)
			end
		end)
	end)
end

return M
