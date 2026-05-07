local function findPackageRoot()
	local root = vim.fs.dirname(
		vim.fs.find("package.json", { upward = true, path = start or vim.api.nvim_buf_get_name(0) })[1] or ""
	)

	return root
end

local function lsp_refs_buffer_quick()
	local fzf = require("fzf-lua")
	local current_file = vim.fn.expand("%") -- Relative path from cwd
	fzf.lsp_references({
		includeDeclaration = false,
		prompt = "References (buffer) > ",
		fzf_opts = {
			["--query"] = current_file,
		},
	})
end

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
	cmd = "FzfLua",
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
			desc = "Find Buffers",
		},
		{
			"<leader>fg",
			"<cmd>FzfLua live_grep<cr>",
			desc = "[F]ind [G]rep",
		},
		{
			"<leader>ff",
			"<cmd>FzfLua blines<cr>",
			desc = "[F]ind [F]ile",
		},
		{
			"<leader>fr",
			"<cmd>FzfLua resume<cr>",
			desc = "[F]ind [R]esume",
		},
		{
			"<leader>fdd",
			"<cmd>FzfLua diagnostics_document<cr>",
			desc = "[F]ind [D]iagnostics [D]ocument",
		},
		{
			"<leader>fdw",
			"<cmd>FzfLua diagnostics_workspace<cr>",
			desc = "[F]ind [D]iagnostics [W]orkspace",
		},
		{
			"<leader>fo",
			"<cmd>FzfLua oldfiles<cr>",
			desc = "[F]ind [O]ld files",
		},
		{
			"<leader>cr",
			"<cmd>FzfLua lsp_references<cr>",
			desc = "[C]ode [R]eferences",
		},
		{
			"<leader>fcr",
			function()
				lsp_refs_buffer_quick()
			end,
			desc = "[C]ode [R]eferences in Buffer",
		},
		{
			"<leader>fpg",
			function()
				local fzf = require("fzf-lua")
				local root = findPackageRoot()
				fzf.live_grep({ cwd = root })
			end,
			desc = "[F]ind [P]ackage [G]rep",
		},
		{
			"<leader>fpp",
			function()
				local fzf = require("fzf-lua")
				local root = findPackageRoot()
				fzf.files({ cwd = root })
			end,
			desc = "[F]ind [P]ackage",
		},
		{
			"<leader>ca",
			function()
				local fzf = require("fzf-lua")
				fzf.lsp_code_actions()
			end,
			desc = "[C]ode [A]ctions",
		},
		{
			"<leader>ds",
			function()
				local fzf = require("fzf-lua")
				fzf.lsp_document_symbols()
			end,
			desc = "[D]ocument [S]ymbols",
		},
	},
}
