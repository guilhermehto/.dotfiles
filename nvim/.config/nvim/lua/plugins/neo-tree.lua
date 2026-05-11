return {
	"nvim-neo-tree/neo-tree.nvim",
	branch = "v3.x",
	dependencies = {
		"nvim-lua/plenary.nvim",
		"MunifTanjim/nui.nvim",
		"nvim-mini/mini.icons",
	},
	cmd = "Neotree",
	keys = {
		{ "<leader>e", "<cmd>Neotree toggle<cr>", desc = "Toggle File Tree" },
		{ "<leader>fb", "<cmd>Neotree toggle reveal<cr>", desc = "[F]ile [B]rowser" },
		{
			"<leader>fG",
			function()
				vim.cmd("NeotreeGitToggle")
			end,
			desc = "[F]ile tree [G]it status toggle",
		},
	},
	opts = {
		sources = { "filesystem", "buffers", "git_status" },
		-- Off by default; can be slow on large repos. Toggle with :NeotreeGitToggle.
		enable_git_status = false,
		git_status_async = true,
		window = {
			position = "left",
			width = 35,
		},
		filesystem = {
			follow_current_file = { enabled = true },
			use_libuv_file_watcher = true,
			filtered_items = {
				visible = true,
				hide_dotfiles = false,
				hide_gitignored = false,
			},
		},
		-- Show line numbers in the tree so relative-number jumps (e.g. `7j`) work.
		event_handlers = {
			{
				event = "neo_tree_buffer_enter",
				handler = function()
					vim.cmd([[setlocal relativenumber]])
				end,
			},
		},
	},
	config = function(_, opts)
		require("neo-tree").setup(opts)

		-- Use mini.icons' azure for folder icons instead of the muted
		-- `Directory` highlight neo-tree links to by default.
		vim.api.nvim_set_hl(0, "NeoTreeDirectoryIcon", { link = "MiniIconsAzure" })
		vim.api.nvim_set_hl(0, "NeoTreeDirectoryName", { link = "MiniIconsAzure" })

		-- Per-session toggle for git decorations in the filesystem tree.
		-- Useful on large repos where git is slow: keep it off by default
		-- and flip on when you actually want git status visible.
		vim.api.nvim_create_user_command("NeotreeGitToggle", function()
			opts.enable_git_status = not opts.enable_git_status
			require("neo-tree").setup(opts)
			vim.cmd("Neotree refresh")
			vim.notify(
				"neo-tree git_status: " .. (opts.enable_git_status and "ON" or "OFF"),
				vim.log.levels.INFO
			)
		end, { desc = "Toggle neo-tree git status decorations" })
	end,
}
