return {
	{
		"nvim-mini/mini.files",
		version = false,
		opts = {},
		keys = {
			{
				"<leader>fb",
				function()
					require("mini.files").open()
				end,
				desc = "[F]ile [B]rowser",
			},
		},
	},
	{ "nvim-mini/mini.notify", version = false, opts = {} },
	{ "nvim-mini/mini.icons", version = false, opts = {} },
	{ "nvim-mini/mini.animate", version = false, opts = {} },
	{ "nvim-mini/mini.statusline", version = false, opts = {} },
	{
		"nvim-mini/mini.pick",
		version = false,
		opts = {},
		keys = {
			{
				"<C-p>",
				function()
					require("mini.pick").builtin.files()
				end,
			},
			{
				"<leader><space>",
				function()
					require("mini.pick").builtin.buffers()
				end,
			},
		},
	},
	{
		"nvim-mini/mini.extra",
		version = false,
		opts = {},
		keys = {
			{
				"<leader>ff",
				function()
					require("mini.extra").pickers.buf_lines()
				end,
				desc = "[F]ile [F]ind",
			},
			{
				"<leader>cd",
				function()
					require("mini.extra").pickers.diagnostic()
				end,
				desc = "[C]ode [D]iagnostic",
			},
		},
	},
	{
		"nvim-mini/mini.hues",
		version = false,
		config = function()
			require("mini.hues").setup({ background = "#002734", foreground = "#c0c8cc", n_hues = 6 })
			vim.cmd.colorscheme("minisummer")
		end,
	},
	{ "nvim-mini/mini.indentscope", version = false, opts = {} },
}
