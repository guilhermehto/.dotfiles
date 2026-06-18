-- diff_context.lua: map the diffview cursor to a { path, line } anchor.
--
-- Returns { path = <repo-relative string>, line = <integer> } when the cursor
-- is on the new-side (right) window of a 2-way diff layout, or nil + a string
-- reason in all other cases.
--
-- Assumption carried forward: the line number returned is the working-tree /
-- new-revision line, which only matches the PR anchor when the local checkout
-- equals the PR head commit.

local M = {}

---@class DiffContext
---@field path string  repo-relative path of the new-side file
---@field line integer  1-based line number under the cursor

---Resolve the diffview cursor position to a PR-commentable anchor.
---@return DiffContext|nil, string|nil  context, or nil + reason on failure
function M.get_cursor_context()
  local ok, lib = pcall(require, "diffview.lib")
  if not ok then
    return nil, "diffview is not available"
  end

  local view = lib.get_current_view()
  if not view then
    return nil, "not in a diffview diff"
  end

  local cur_layout = view.cur_layout
  if not cur_layout then
    return nil, "not in a diffview diff"
  end

  -- Guard: require a Diff2 (2-way diff).  Diff1 = file-history single window;
  -- Diff3/Diff4 = merge conflicts — neither maps cleanly to a PR anchor.
  local ok_d2, Diff2 = pcall(require, "diffview.scene.layouts.diff_2")
  if not ok_d2 then
    return nil, "diffview internal unavailable"
  end

  if not cur_layout:instanceof(Diff2.Diff2) then
    return nil, "not a 2-way diff (file history or merge conflict layout not supported)"
  end

  -- cur_layout is a Diff2; it has .a (old-side) and .b (new-side) Windows.
  local win_a = cur_layout.a
  local win_b = cur_layout.b

  local current_winid = vim.api.nvim_get_current_win()

  if not (win_b and win_b.id and vim.api.nvim_win_is_valid(win_b.id)) then
    return nil, "new-side window is not valid"
  end

  if win_a and win_a.id and vim.api.nvim_win_is_valid(win_a.id)
    and current_winid == win_a.id
  then
    return nil, "old-side comments not supported in this POC"
  end

  if current_winid ~= win_b.id then
    -- Cursor is in neither the old-side nor the new-side window (e.g. the file
    -- panel, a floating window, or some other split).
    return nil, "cursor is not in a diff window"
  end

  local cur_entry = view.cur_entry
  if not cur_entry then
    return nil, "no file entry selected"
  end

  local path = cur_entry.path
  if not path or path == "" then
    return nil, "file entry has no path"
  end

  local line = vim.api.nvim_win_get_cursor(0)[1]

  return { path = path, line = line }
end

return M
