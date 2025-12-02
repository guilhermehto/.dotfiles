-- Format on save
vim.api.nvim_create_autocmd("BufWritePre", {
	pattern = "*",
	callback = function(args)
		require("conform").format({ bufnr = args.buf })
	end,
})
-- tags: formatting, auto format, autoformat, auto-formatting
return {
	"stevearc/conform.nvim",
	opts = {
		formatters_by_ft = {
			lua = { "stylua" },
			javascript = { "biome", "prettier" },
			typescript = { "biome", "prettier" },
			javascriptreact = { "biome", "prettier" },
			typescriptreact = { "biome", "prettier" },
		},
	},
}
