return {
	"folke/tokyonight.nvim",
	lazy = false,
	priority = 1000,
	config = function()
		vim.opt.termguicolors = true -- enable true colors
		-- the -storm variant sets style = "storm" on its own
		vim.cmd.colorscheme("tokyonight-storm")
	end,
}
