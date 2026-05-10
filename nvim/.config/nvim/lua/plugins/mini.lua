return {
	{ "nvim-mini/mini.notify", version = false, opts = {} },
	{
		"nvim-mini/mini.icons",
		version = false,
		lazy = false,
		priority = 900,
		config = function()
			require("mini.icons").setup()
			-- Make plugins that look for `nvim-web-devicons` (e.g. neo-tree)
			-- pick up mini.icons instead.
			MiniIcons.mock_nvim_web_devicons()
		end,
	},
	{
		"nvim-mini/mini.animate",
		version = false,
		config = function()
			local animate = require("mini.animate")
			animate.setup({
				cursor = {
					timing = animate.gen_timing.cubic({ duration = 200, easing = "in", unit = "total" }),
				},
				scroll = {
					timing = animate.gen_timing.cubic({ duration = 200, easing = "in", unit = "total" }),
				},
				resize = {
					timing = animate.gen_timing.cubic({ duration = 100, easing = "in", unit = "total" }),
				},
				open = {
					timing = animate.gen_timing.cubic({ duration = 200, easing = "in", unit = "total" }),
				},
				close = {
					timing = animate.gen_timing.cubic({ duration = 200, easing = "in", unit = "total" }),
				},
			})
		end,
	},
	{ "nvim-mini/mini.statusline", version = false, opts = {} },
	-- {
	-- 	"nvim-mini/mini.hues",
	-- 	version = false,
	-- 	config = function()
	-- 		require("mini.hues").setup({ background = "#002734", foreground = "#c0c8cc", n_hues = 6 })
	-- 		vim.cmd.colorscheme("miniwinter")
	-- 	end,
	-- },
	{ "nvim-mini/mini.indentscope", version = false, opts = {} },
	{ "nvim-mini/mini.pairs", version = false, opts = {} },
	{
		"nvim-mini/mini.clue",
		version = false,
		config = function()
			local miniclue = require("mini.clue")
			miniclue.setup({
				triggers = {
					-- Leader triggers
					{ mode = "n", keys = "<Leader>" },
					{ mode = "x", keys = "<Leader>" },

					-- Built-in completion
					{ mode = "i", keys = "<C-x>" },

					-- `g` key
					{ mode = "n", keys = "g" },
					{ mode = "x", keys = "g" },

					-- Marks
					{ mode = "n", keys = "'" },
					{ mode = "n", keys = "`" },
					{ mode = "x", keys = "'" },
					{ mode = "x", keys = "`" },

					-- Registers
					{ mode = "n", keys = '"' },
					{ mode = "x", keys = '"' },
					{ mode = "i", keys = "<C-r>" },
					{ mode = "c", keys = "<C-r>" },

					-- Window commands
					{ mode = "n", keys = "<C-w>" },

					-- `z` key
					{ mode = "n", keys = "z" },
					{ mode = "x", keys = "z" },
				},
			})
		end,
	},
}
