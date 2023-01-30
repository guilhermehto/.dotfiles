require'lspconfig'.tsserver.setup {}
require'lspconfig'.cssls.setup {}
require'lspconfig'.emmet_ls.setup {}
require'lualine'.setup {}
require'nvim-treesitter.configs'.setup {highlight = {enable = true}}
require'telescope'.load_extension('project')
require'lspconfig'.pyright.setup {}
require'lspconfig'.sumneko_lua.setup {
settings = {
    Lua = {
    diagnostics = {
        globals = { 'vim' },
    },
}
}
}
require('leap').add_default_mappings()
require'mason'.setup {}

local telescope = require 'telescope'

telescope.setup {
    defaults = {
        file_ignore_patterns = {"node_modules", ".git/"},
        layout_strategy = 'vertical',
        path_display = {truncate = 4}
    },
    pickers = {find_files = {hidden = true}},
    extensions = {
        fzf = {
            fuzzy = true,
            override_generic_sorter = true,
            override_file_sorter = true,
            case_mode = "smart_case"
        }
    }
}

telescope.load_extension 'fzf'

local lspconfig = require 'lspconfig'
local configs = require 'lspconfig/configs'
local capabilities = vim.lsp.protocol.make_client_capabilities()
local saga = require 'lspsaga'
saga.init_lsp_saga()

capabilities.textDocument.completion.completionItem.snippetSupport = true

lspconfig.emmet_ls.setup({
    -- on_attach = on_attach,
    capabilities = capabilities,
    filetypes = {"html", "css", "typescriptreact", "javascriptreact"}
})

local cmp = require 'cmp'
local lspkind = require('lspkind')

cmp.setup({
    formatting = {format = lspkind.cmp_format()},
    sources = cmp.config.sources({
        {name = 'nvim_lsp'}, {name = 'vsnip'} -- For vsnip users.
        -- { name = 'luasnip' }, -- For luasnip users.
        -- { name = 'ultisnips' }, -- For ultisnips users.
        -- { name = 'snippy' }, -- For snippy users.
    }, {{name = 'buffer'}}),
    snippet = {
        -- REQUIRED - you must specify a snippet engine
        expand = function(args)
            vim.fn["vsnip#anonymous"](args.body) -- For `vsnip` users.
            -- require('luasnip').lsp_expand(args.body) -- For `luasnip` users.
            -- require('snippy').expand_snippet(args.body) -- For `snippy` users.
            -- vim.fn["UltiSnips#Anon"](args.body) -- For `ultisnips` users.
        end
    },
    mapping = {
        ['<C-b>'] = cmp.mapping(cmp.mapping.scroll_docs(-4), {'i', 'c'}),
        ['<C-f>'] = cmp.mapping(cmp.mapping.scroll_docs(4), {'i', 'c'}),
        ['<C-Space>'] = cmp.mapping(cmp.mapping.complete(), {'i', 'c'}),
        ['<C-y>'] = cmp.config.disable, -- Specify `cmp.config.disable` if you want to remove the default `<C-y>` mapping.
        ['<C-e>'] = cmp.mapping({
            i = cmp.mapping.abort(),
            c = cmp.mapping.close()
        }),
        ['<CR>'] = cmp.mapping.confirm({select = true}), -- Accept currently selected item. Set `select` to `false` to only confirm explicitly selected items.
        ['<C-Space>'] = cmp.mapping.confirm {
            behavior = cmp.ConfirmBehavior.Insert,
            select = true
        },

        ['<Tab>'] = function(fallback)
            if not cmp.select_next_item() then
                if vim.bo.buftype ~= 'prompt' and has_words_before() then
                    cmp.complete()
                else
                    fallback()
                end
            end
        end,

        ['<S-Tab>'] = function(fallback)
            if not cmp.select_prev_item() then
                if vim.bo.buftype ~= 'prompt' and has_words_before() then
                    cmp.complete()
                else
                    fallback()
                end
            end
        end
    },
    sources = cmp.config.sources({
        {name = 'nvim_lsp'}
        --      { name = 'vsnip' }, -- For vsnip users.
        -- { name = 'luasnip' }, -- For luasnip users.
        -- { name = 'ultisnips' }, -- For ultisnips users.
        -- { name = 'snippy' }, -- For snippy users.
    }, {{name = 'buffer'}})
})

-- Set configuration for specific filetype.
cmp.setup.filetype('gitcommit', {
    sources = cmp.config.sources({
        {name = 'cmp_git'} -- You can specify the `cmp_git` source if you were installed it. 
    }, {{name = 'buffer'}})
})

-- Use buffer source for `/` (if you enabled `native_menu`, this won't work anymore).
cmp.setup.cmdline('/', {sources = {{name = 'buffer'}}})

-- Use cmdline & path source for ':' (if you enabled `native_menu`, this won't work anymore).
cmp.setup.cmdline(':', {
    sources = cmp.config.sources({{name = 'path'}}, {{name = 'cmdline'}})
})

-- Setup lspconfig.
local capabilities = require('cmp_nvim_lsp').default_capabilities(vim.lsp
                                                                     .protocol
                                                                     .make_client_capabilities())
-- Replace <YOUR_LSP_SERVER> with each lsp server you've enabled.
require('lspconfig')['tsserver'].setup {capabilities = capabilities}

require('lspconfig')['cssls'].setup {capabilities = capabilities}

