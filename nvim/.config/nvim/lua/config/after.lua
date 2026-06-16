-- Start treesitter highlights for any filetype with an available parser.
-- pcall swallows the "parser could not be created" error for filetypes
-- without one (e.g. mini.notify's scratch buffers).
vim.api.nvim_create_autocmd("FileType", {
	callback = function(args)
		local lang = vim.treesitter.language.get_lang(vim.bo[args.buf].filetype)
		if lang then
			pcall(vim.treesitter.start, args.buf, lang)
		end
	end,
})
