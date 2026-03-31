return {
	"ayu-theme/ayu-vim",
	config = function()
		vim.opt.termguicolors = true -- enable true colors
		vim.g.ayucolor = "dark" -- choose one: "light", "mirage", or "dark"
		vim.cmd.colorscheme("ayu")
	end,
}
