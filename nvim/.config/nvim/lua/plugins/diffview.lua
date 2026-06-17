return {
	"sindrets/diffview.nvim",
	dependencies = { "nvim-lua/plenary.nvim" },
	cmd = {
		"DiffviewOpen",
		"DiffviewClose",
		"DiffviewToggleFiles",
		"DiffviewFocusFiles",
		"DiffviewFileHistory",
	},
	opts = {
		enhanced_diff_hl = true,
		-- Left panel lists changed files as a tree.
		file_panel = {
			listing_style = "tree",
			win_config = {
				width = 60,
			},
		},
		view = {
			-- 3-way layout for resolving conflicts during a merge/rebase.
			merge_tool = {
				layout = "diff3_mixed",
				disable_diagnostics = true,
			},
		},
	},
	keys = {
		{ "<leader>gd", "<cmd>DiffviewOpen<cr>", desc = "[G]it [D]iff (working tree)" },
		{
			"<leader>gb",
			function()
				vim.ui.input({
					prompt = "Diff against (rev/range): ",
					default = "origin/main...HEAD",
				}, function(rev)
					if rev and rev ~= "" then
						vim.cmd("DiffviewOpen " .. rev)
					end
				end)
			end,
			desc = "[G]it diff vs [B]ranch",
		},
		{ "<leader>gc", "<cmd>DiffviewClose<cr>", desc = "[G]it diff [C]lose" },
		{ "<leader>gh", "<cmd>DiffviewFileHistory %<cr>", desc = "[G]it [H]istory (current file)" },
		{ "<leader>gH", "<cmd>DiffviewFileHistory<cr>", desc = "[G]it [H]istory (repo)" },
	},
}
