-- Start treesitter highlights
vim.api.nvim_create_autocmd("FileType", {
	pattern = { "typescriptreact", "typescript", "javascript", "javascriptreact", "lua" },
	callback = function()
		vim.treesitter.start()
	end,
})
