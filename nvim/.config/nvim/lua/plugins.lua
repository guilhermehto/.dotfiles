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
                },
            })
        end,
    },
    "nvim-treesitter/nvim-treesitter",
    "neovim/nvim-lspconfig",

    "hrsh7th/cmp-nvim-lsp",
    "hrsh7th/cmp-buffer",
    "hrsh7th/cmp-path",
    "hrsh7th/cmp-cmdline",
    "hrsh7th/nvim-cmp",
    "L3MON4D3/LuaSnip",
    "saadparwaiz1/cmp_luasnip",

    "onsails/lspkind-nvim",
    "tpope/vim-surround",
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
    "ggandor/leap.nvim",
    { "jose-elias-alvarez/null-ls.nvim",
        config = function()
            local null_ls = require("null-ls")
            null_ls.setup({
                sources = {
                    null_ls.builtins.formatting.stylua,
                    null_ls.builtins.diagnostics.eslint,
                }

            })
        end
    },
    { "lukas-reineke/lsp-format.nvim", config = function()
        require("lsp-format").setup()
    end }
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

local on_attach = function(client)
    require("lsp-format").on_attach(client)
end

require("lspconfig")["sumneko_lua"].setup({
    capabilities = capabilities,
    on_attach = on_attach,
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
    on_attach = on_attach,
})

require("lspconfig")["cssls"].setup({
    capabilities = capabilities,
    on_attach = on_attach,
})

require("lspconfig")["emmet_ls"].setup({
    capabilities = capabilities,
    on_attach = on_attach,
})

require("lspconfig")["pyright"].setup({
    capabilities = capabilities,
    on_attach = on_attach,
})

require("lspconfig")["marksman"].setup({
    capabilities = capabilities,
    on_attach = on_attach,
})
