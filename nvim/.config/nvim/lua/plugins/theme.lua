return {
	"ayu-theme/ayu-vim",
	config = function()
		vim.opt.termguicolors = true -- enable true colors
		vim.g.ayucolor = "dark" -- choose one: "light", "mirage", or "dark"
		vim.cmd.colorscheme("ayu")

		-- ayu defines the diff groups with a foreground color, which clobbers
		-- syntax highlighting on changed lines (added lines turn solid green).
		-- Redefine them background-only so treesitter colors show through,
		-- GitHub-style: a tinted background with intact syntax highlighting.
		local function diff_highlights()
			vim.api.nvim_set_hl(0, "DiffAdd", { bg = "#1f3a28" })
			vim.api.nvim_set_hl(0, "DiffDelete", { bg = "#3a2128" })
			vim.api.nvim_set_hl(0, "DiffChange", { bg = "#2a2f3d" })
			vim.api.nvim_set_hl(0, "DiffText", { bg = "#3a4f6b" })
		end
		diff_highlights()
		vim.api.nvim_create_autocmd("ColorScheme", { pattern = "ayu", callback = diff_highlights })
	end,
}
