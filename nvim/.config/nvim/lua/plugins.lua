local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
	vim.fn.system({
		"git",
		"clone",
		"--filter=blob:none",
		"https://github.com/folke/lazy.nvim.git",
		"--branch=stable", -- latest stable release
		lazypath,
	})
end
vim.opt.rtp:prepend(lazypath)

require("lazy").setup({
	{
		"catppuccin/nvim",
		name = "catpuccin",
		priority = 5000,
		lazy = false,
		config = function()
			vim.cmd([[colorscheme catppuccin-macchiato]])
		end,
	},
	"nvim-lua/plenary.nvim",
	{
		"williamboman/mason.nvim",
		config = function()
			require("mason").setup()
		end,
	},
	"williamboman/mason-lspconfig.nvim",
	{
		"nvim-telescope/telescope.nvim",

		config = function()
			require("telescope").setup({
				defaults = {
					file_ignore_patterns = { "node_modules", ".git/" },
					layout_strategy = "vertical",
					path_display = { truncate = 4 },
				},
				pickers = { find_files = { hidden = true } },
				extensions = {
					fzf = {
						fuzzy = true,
						override_generic_sorter = true,
						override_file_sorter = true,
						case_mode = "smart_case",
					},
					["ui-select"] = {
						require("telescope.themes").get_dropdown({
							-- even more opts
						}),
					},
				},
			})
			require("telescope").load_extension("ui-select")
		end,
	},
	{
		"nvim-treesitter/nvim-treesitter",
		config = function()
			require("nvim-treesitter.configs").setup({
				highlight = { enable = true },
			})
		end,
		build = ":TSUpdate",
	},
	"neovim/nvim-lspconfig",

	"hrsh7th/cmp-nvim-lsp",
	"hrsh7th/cmp-buffer",
	"hrsh7th/cmp-path",
	"hrsh7th/cmp-cmdline",
	"hrsh7th/nvim-cmp",
	{
		"L3MON4D3/LuaSnip",
		config = function()
			require("luasnip.loaders.from_vscode").lazy_load()
		end,
	},
	"saadparwaiz1/cmp_luasnip",

	"onsails/lspkind-nvim",
	{
		"nvim-lualine/lualine.nvim",
		dependencies = { { "kyazdani42/nvim-web-devicons", name = "kyazdani42-webdevicons" } },
		config = function()
			require("lualine").setup()
		end,
	},
	{
		"kkharji/lspsaga.nvim",
		event = "BufRead",
		dependencies = { { "nvim-tree/nvim-web-devicons" } },
		config = function()
			require("lspsaga").setup()
		end,
	},
	{
		"ggandor/leap.nvim",
		config = function()
			require("leap").add_default_mappings()
		end,
	},
	{
		"jose-elias-alvarez/null-ls.nvim",
		config = function()
			local null_ls = require("null-ls")
			local augroup = vim.api.nvim_create_augroup("LspFormatting", {})
			null_ls.setup({
				sources = {
					null_ls.builtins.formatting.stylua,
					null_ls.builtins.formatting.prettier,
					null_ls.builtins.diagnostics.eslint,
				},
				on_attach = function(client, bufnr)
					if client.supports_method("textDocument/formatting") then
						vim.api.nvim_clear_autocmds({ group = augroup, buffer = bufnr })
						vim.api.nvim_create_autocmd("BufWritePre", {
							group = augroup,
							buffer = bufnr,
							callback = function()
								vim.lsp.buf.format({
									bufnr = bufnr,
									filter = function(client)
										return client.name == "null-ls"
									end,
								})
							end,
						})
					end
				end,
			})
		end,
	},
	{
		"nvim-neo-tree/neo-tree.nvim",
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-tree/nvim-web-devicons",
			"MunifTanjim/nui.nvim",
		},
		config = function()
			vim.cmd([[ let g:neo_tree_remove_legacy_commands = 1 ]])
			vim.fn.sign_define("DiagnosticSignError", { text = " ", texthl = "DiagnosticSignError" })
			vim.fn.sign_define("DiagnosticSignWarn", { text = " ", texthl = "DiagnosticSignWarn" })
			vim.fn.sign_define("DiagnosticSignInfo", { text = " ", texthl = "DiagnosticSignInfo" })
			vim.fn.sign_define("DiagnosticSignHint", { text = "", texthl = "DiagnosticSignHint" })

			require("neo-tree").setup({
				default_components_configs = {
					icon = {
						folder_closed = "",
						folder_open = "",
						folder_empty = "ﰊ",
					},
				},
			})
		end,
	},
	"airblade/vim-gitgutter",
	{
		"nvim-neorg/neorg",
		build = ":Neorg sync-parsers",
		opts = {
			load = {
				["core.defaults"] = {},
				["core.concealer"] = {
					config = {
						folds = false,
					},
				},
				["core.dirman"] = {
					config = {
						workspaces = {
							personal = "~/Dropbox/notes/personal",
							work = "~/Dropbox/notes/work",
						},
					},
				},
				["core.journal"] = {
					config = {
						workspace = "personal",
						strategy = "flat",
					},
				},
			},
		},
		dependencies = { { "nvim-lua/plenary.nvim" } },
	},
	"windwp/nvim-spectre",
	"metakirby5/codi.vim",
	{
		"echasnovski/mini.animate",
		version = false,
		event = "VeryLazy",
		opts = {},
	},
	{
		"folke/trouble.nvim",
		dependencies = { "nvim-tree/nvim-web-devicons" },
		opts = {},
	},
	"nvim-telescope/telescope-ui-select.nvim",
	{
		"echasnovski/mini.pairs",
		version = false,
		event = "VeryLazy",
		opts = {},
	},
	{
		"echasnovski/mini.surround",
		version = false,
		event = "VeryLazy",
		opts = {},
	},
	{
		"echasnovski/mini.comment",
		version = false,
		event = "VeryLazy",
		opts = {},
	},
	"f-person/git-blame.nvim",
	{ "nvim-treesitter/nvim-treesitter-context", opts = {} },
	{
		"NeogitOrg/neogit",
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-telescope/telescope.nvim",
			"sindrets/diffview.nvim",
		},
		config = true,
	},
	{
		"aserowy/tmux.nvim",
		config = true,
	},
})

-- TODO: move this out of here :)
local lspkind = require("lspkind")
local cmp = require("cmp")
local has_words_before = function()
	unpack = unpack or table.unpack
	local line, col = unpack(vim.api.nvim_win_get_cursor(0))
	return col ~= 0 and vim.api.nvim_buf_get_lines(0, line - 1, line, true)[1]:sub(col, col):match("%s") == nil
end

local luasnip = require("luasnip")
cmp.setup({
	snippet = {
		expand = function(args)
			require("luasnip").lsp_expand(args.body) -- For `luasnip` users.
		end,
	},
	window = {
		completion = cmp.config.window.bordered(),
		documentation = cmp.config.window.bordered(),
	},
	mapping = cmp.mapping.preset.insert({
		["<C-p>"] = cmp.mapping.scroll_docs(-4),
		["<C-n>"] = cmp.mapping.scroll_docs(4),
		["<C-Space>"] = cmp.mapping.complete(),
		["<C-e>"] = cmp.mapping.abort(),
		["<CR>"] = cmp.mapping.confirm({ select = true }), -- Accept currently selected item. Set `select` to `false` to only confirm explicitly selected items.
		["<Tab>"] = cmp.mapping(function(fallback)
			if cmp.visible() then
				cmp.select_next_item()
				-- You could replace the expand_or_jumpable() calls with expand_or_locally_jumpable()
				-- they way you will only jump inside the snippet region
			elseif luasnip.expand_or_jumpable() then
				luasnip.expand_or_jump()
			elseif has_words_before() then
				cmp.complete()
			else
				fallback()
			end
		end, { "i", "s" }),

		["<S-Tab>"] = cmp.mapping(function(fallback)
			if cmp.visible() then
				cmp.select_prev_item()
			elseif luasnip.jumpable(-1) then
				luasnip.jump(-1)
			else
				fallback()
			end
		end, { "i", "s" }),
	}),
	sources = cmp.config.sources({
		{ name = "nvim_lsp" },
		{ name = "luasnip" }, -- For luasnip users.
		{ name = "neorg" },
	}, {
		{ name = "buffer" },
	}),
	formatting = {
		format = lspkind.cmp_format({
			mode = "symbol", -- show only symbol annotations
			maxwidth = 50, -- prevent the popup from showing more than provided characters (e.g 50 will not show more than 50 characters)
			ellipsis_char = "...", -- when popup menu exceed maxwidth, the truncated part would show ellipsis_char instead (must define maxwidth first)
		}),
	},
})
-- Set configuration for specific filetype.
cmp.setup.filetype("gitcommit", {
	sources = cmp.config.sources({
		{ name = "cmp_git" }, -- You can specify the `cmp_git` source if you were installed it.
	}, {
		{ name = "buffer" },
	}),
})

-- Use buffer source for `/` and `?` (if you enabled `native_menu`, this won't work anymore).
cmp.setup.cmdline({ "/", "?" }, {
	mapping = cmp.mapping.preset.cmdline(),
	sources = {
		{ name = "buffer" },
	},
})

-- Use cmdline & path source for ':' (if you enabled `native_menu`, this won't work anymore).
cmp.setup.cmdline(":", {
	mapping = cmp.mapping.preset.cmdline(),
	sources = cmp.config.sources({
		{ name = "path" },
	}, {
		{ name = "cmdline" },
	}),
})

-- Set up lspconfig.
local capabilities = require("cmp_nvim_lsp").default_capabilities()

require("lspconfig")["lua_ls"].setup({
	capabilities = capabilities,
	settings = {
		Lua = {
			diagnostics = {
				globals = { "vim" },
			},
		},
	},
})

require("lspconfig")["tsserver"].setup({
	capabilities = capabilities,
})

require("lspconfig")["cssls"].setup({
	capabilities = capabilities,
})

require("lspconfig")["emmet_ls"].setup({
	capabilities = capabilities,
})

require("lspconfig")["pyright"].setup({
	capabilities = capabilities,
})

require("lspconfig")["marksman"].setup({
	capabilities = capabilities,
})

require("lspconfig")["tailwindcss"].setup({
	capabilities = capabilities,
})

require("lspconfig")["gdscript"].setup({
	capabilities = capabilities,
})
