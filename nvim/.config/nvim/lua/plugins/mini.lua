-- Customize how the mini.files window looks like, set blend
vim.api.nvim_create_autocmd('User', {
	pattern = 'MiniFilesWindowOpen',
	callback = function(args)
		local win_id = args.data.win_id

		-- Customize window-local settings
		vim.wo[win_id].winblend = 10
		local config = vim.api.nvim_win_get_config(win_id)
		config.border, config.title_pos = 'double', 'right'
		vim.api.nvim_win_set_config(win_id, config)
	end,
})

-- Ensure height
vim.api.nvim_create_autocmd('User', {
	pattern = 'MiniFilesWindowUpdate',
	callback = function(args)
		local config = vim.api.nvim_win_get_config(args.data.win_id)

		-- Ensure fixed height
		config.height = 20

		-- Ensure no title padding
		local n = #config.title
		config.title[1][1] = config.title[1][1]:gsub('^ ', '')
		config.title[n][1] = config.title[n][1]:gsub(' $', '')

		vim.api.nvim_win_set_config(args.data.win_id, config)
	end,
})


return {
	{
		"nvim-mini/mini.files",
		version = false,
		opts = {
			mappings = {
				go_in = 'L',
				go_in_plus = 'l',
			}
		},
		keys = {
			{
				"<leader>fb",
				function()
					local MiniFiles = require("mini.files")
					local _ = MiniFiles.close() or MiniFiles.open(vim.api.nvim_buf_get_name(0), false)
					vim.defer_fn(function()
						MiniFiles.reveal_cwd()
					end, 30)
				end,
				desc = "[F]ile [B]rowser",
			},
		},
	},
	{ "nvim-mini/mini.notify", version = false, opts = {
	} },
	{ "nvim-mini/mini.icons", version = false, opts = {} },
	{ "nvim-mini/mini.animate", version = false, config = function ()
		local animate = require('mini.animate')
		animate.setup({
			cursor = {
				timing = animate.gen_timing.cubic({ duration = 200, easing = 'in', unit = 'total' })
			},
			scroll = {
				timing = animate.gen_timing.cubic({ duration = 200, easing = 'in', unit = 'total' })
			},
			resize = {
				timing = animate.gen_timing.cubic({ duration = 100, easing = 'in', unit = 'total' })
			},
			open = {
				timing = animate.gen_timing.cubic({ duration = 200, easing = 'in', unit = 'total' })
			},
			close = {
				timing = animate.gen_timing.cubic({ duration = 200, easing = 'in', unit = 'total' })
			},
		})
	end
 },
	{ "nvim-mini/mini.statusline", version = false, opts = {} },
	{
		"nvim-mini/mini.hues",
		version = false,
		config = function()
			require("mini.hues").setup({ background = "#002734", foreground = "#c0c8cc", n_hues = 6 })
			vim.cmd.colorscheme("minisummer")
		end,
	},
	{ "nvim-mini/mini.indentscope", version = false, opts = {} },
	{ "nvim-mini/mini.pairs", version = false, opts = {} },
}
