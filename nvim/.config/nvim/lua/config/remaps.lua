function nmap(keys, func, desc)
	if desc then
		desc = "LSP: " .. desc
	end

	vim.keymap.set("n", keys, func, { buffer = bufnr, desc = desc, silent = true })
end

vim.keymap.set("n", "<C-h>", "<C-w><C-h>", { desc = "Move focus to the left window" })
vim.keymap.set("n", "<C-l>", "<C-w><C-l>", { desc = "Move focus to the right window" })
vim.keymap.set("n", "<C-j>", "<C-w><C-j>", { desc = "Move focus to the lower window" })
vim.keymap.set("n", "<C-k>", "<C-w><C-k>", { desc = "Move focus to the upper window" })

nmap("gd", function()
	local ft = vim.bo.filetype
	if ft == "typescript" or ft == "typescriptreact" then
		vim.cmd("TSToolsGoToSourceDefinition")
	else
		vim.cmd("FzfLua lsp_definitions")
	end
end, "[G]o to [D]efinition")
