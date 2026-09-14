return {
	"stevearc/oil.nvim",
	lazy = false,
	dependencies = { "nvim-mini/mini.icons" },
	keys = {
		{ "<leader>e", "<cmd>Oil<cr>", desc = "Open File Explorer" },
		{ "<leader>fb", "<cmd>Oil<cr>", desc = "[F]ile [B]rowser" },
		{ "-", "<cmd>Oil<cr>", desc = "Open parent directory" },
	},
	opts = {
		keymaps = {
			["<C-h>"] = false,
			["<C-l>"] = false,
			["<C-p>"] = false,
			["gp"] = "actions.preview",
			["gS"] = { "actions.select", opts = { horizontal = true } },
			["gR"] = "actions.refresh",
		},
		view_options = {
			show_hidden = true,
		},
	},
}
