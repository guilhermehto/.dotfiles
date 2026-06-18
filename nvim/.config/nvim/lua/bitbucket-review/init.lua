-- bitbucket-review/init.lua — orchestrator and setup() wiring.
--
-- Exposes:
--   M.comment_on_current_line()  — full prompt→confirm→post flow
--   M.setup(opts)                — register keymap and user command via autocmd
--
-- opts:
--   keymap  string  normal-mode key (default "<leader>cc")

local M = {}

local diff_context = require("bitbucket-review.diff_context")
local twg          = require("bitbucket-review.twg")

-- Module-level in-flight guard: true while a post is pending.
local _in_flight = false

--- Full prompt → confirm → post flow.
--- Safe to call from any context; gracefully exits with a notify on any failure.
function M.comment_on_current_line()
  if _in_flight then
    vim.notify("[BitbucketReview] A comment post is already in progress — please wait.", vim.log.levels.WARN)
    return
  end

  -- Capture the anchor synchronously, before any async hop changes the cursor.
  local anchor, anchor_err = diff_context.get_cursor_context()
  if not anchor then
    vim.notify("[BitbucketReview] " .. (anchor_err or "could not resolve diff context"), vim.log.levels.WARN)
    return
  end

  _in_flight = true

  twg.resolve_pr(function(pr_id, pr_warn)
    if not pr_id then
      _in_flight = false
      vim.notify("[BitbucketReview] " .. (pr_warn or "could not resolve PR"), vim.log.levels.ERROR)
      return
    end

    if pr_warn then
      vim.notify("[BitbucketReview] " .. pr_warn, vim.log.levels.WARN)
    end

    -- vim.schedule because resolve_pr callbacks run in vim.schedule already,
    -- but vim.ui.input must be called from the main loop.
    vim.schedule(function()
      vim.ui.input({ prompt = "Comment: " }, function(body)
        if not body or body == "" then
          _in_flight = false
          return
        end

        local label = ("%s:%d"):format(anchor.path, anchor.line)
        local choice = vim.fn.confirm(
          ("Post inline comment on %s?"):format(label),
          "&Yes\n&No",
          2
        )

        if choice ~= 1 then
          _in_flight = false
          return
        end

        twg.post_comment(pr_id, anchor.path, anchor.line, body, function(ok, detail)
          _in_flight = false
          vim.schedule(function()
            if ok then
              vim.notify(("[BitbucketReview] Comment posted on %s (PR #%d)"):format(label, pr_id), vim.log.levels.INFO)
            else
              vim.notify("[BitbucketReview] Failed to post comment: " .. (detail or "unknown error"), vim.log.levels.ERROR)
            end
          end)
        end)
      end)
    end)
  end)
end

--- Register the keymap and :BitbucketComment command.
--- Does NOT require diffview to be loaded at call time.
---@param opts? { keymap?: string }
function M.setup(opts)
  opts = opts or {}
  local key = opts.keymap or "<leader>cc"

  -- Wire the keymap and command into each diffview diff buffer as it opens.
  -- DiffviewDiffBufWinEnter fires with no buffer argument; use nvim_get_current_buf().
  vim.api.nvim_create_autocmd("User", {
    pattern  = "DiffviewDiffBufWinEnter",
    group    = vim.api.nvim_create_augroup("BitbucketReviewSetup", { clear = true }),
    callback = function()
      local buf = vim.api.nvim_get_current_buf()
      vim.keymap.set("n", key, M.comment_on_current_line, {
        buffer = buf,
        desc   = "[B]itbucket [C]omment on current line",
        silent = true,
      })
    end,
  })

  vim.api.nvim_create_user_command("BitbucketComment", function()
    M.comment_on_current_line()
  end, { desc = "Post Bitbucket inline comment on the current diff line" })
end

return M
