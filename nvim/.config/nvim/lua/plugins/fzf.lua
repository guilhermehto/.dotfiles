local grep_opts = {
	"rg",
	"--vimgrep",
	"--hidden",
	"--follow",
	"--glob",
	'"!**/.git/*"',
	"--column",
	"--line-number",
	"--no-heading",
	"--color=always",
	"--smart-case",
	"--max-columns=4096",
	"-e",
}

return {
	"ibhagwan/fzf-lua",
	-- optional for icon support
	-- or if using mini.icons/mini.nvim
	dependencies = { "nvim-mini/mini.icons" },
	---@module "fzf-lua"
	---@type fzf-lua.Config|{}
	---@diagnostics disable: missing-fields
	opts = {
		winopts = {
			preview = {
				layout = "vertical",
			},
		},
		files = {
			file_icons = "mini",
			hidden = true,
		},
		grep = {
			hidden = true,
			cmd = table.concat(grep_opts, " "),
		},
	},
	---@diagnostics enable: missing-fields
	keys = {
		{
			"<C-p>",
			"<cmd>FzfLua files<cr>",
			desc = "Find files",
		},
		{
			"<leader><space>",
			"<cmd>FzfLua buffers<cr>",
			desc = "Find files",
		},
		{
			"<leader>fg",
			"<cmd>FzfLua live_grep<cr>",
			desc = "Find grep",
		},
		{
			"<leader>ff",
			"<cmd>FzfLua blines<cr>",
			desc = "Find visual",
		},
		{
			"<leader>fr",
			"<cmd>FzfLua resume<cr>",
			desc = "Find resume",
		},
		{
			"<leader>fdd",
			"<cmd>FzfLua diagnostics_document<cr>",
			desc = "Find resume",
		},
		{
			"<leader>fdw",
			"<cmd>FzfLua diagnostics_workspace<cr>",
			desc = "Find resume",
		},
		{
			"<leader>fo",
			"<cmd>FzfLua oldfiles<cr>",
			desc = "Find old files",
		},
		{
			"<leader>cr",
			"<cmd>FzfLua lsp_references<cr>",
			desc = "Find code references",
		},
		{
			"<leader>fc",
			"<cmd>FzfLua git_status<cr>",
			desc = "Find code references",
		},
	},
}
