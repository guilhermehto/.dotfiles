return {
	"aserowy/tmux.nvim",
	opts = {},
	config = function(_, opts)
		require("tmux").setup(opts)
		if not vim.env.ZELLIJ then
			return
		end
		-- tmux.nvim only crosses into tmux panes; under zellij hand focus over at the nvim edge
		for key, direction in pairs({ h = "left", j = "down", k = "up", l = "right" }) do
			vim.keymap.set("n", "<C-" .. key .. ">", function()
				local window = vim.api.nvim_get_current_win()
				vim.cmd.wincmd(key)
				if vim.api.nvim_get_current_win() == window then
					vim.system({ "zellij", "action", "move-focus", direction })
				end
			end, { desc = "Move to " .. direction .. " window or zellij pane" })
		end
	end,
}
