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
'nvim-lua/plenary.nvim',
'williamboman/mason.nvim',
'williamboman/mason-lspconfig.nvim',
'nvim-telescope/telescope.nvim',
'nvim-telescope/telescope-project.nvim',
'neovim/nvim-lspconfig',
'tami5/lspsaga.nvim',
'hrsh7th/cmp-nvim-lsp',
'hrsh7th/cmp-buffer',
'hrsh7th/cmp-path',
'hrsh7th/cmp-cmdline',
'hrsh7th/nvim-cmp',
'hrsh7th/vim-vsnip',
'onsails/lspkind-nvim',
'nvim-treesitter/nvim-treesitter',
'dense-analysis/ale',
'preservim/nerdtree',
'dstein64/vim-startuptime',
'tpope/vim-surround',
'shatur/neovim-ayu',
'nvim-lualine/lualine.nvim',
'kyazdani42/nvim-web-devicons',
'sotte/presenting.vim',
'ryanoasis/vim-devicons',
'ggandor/leap.nvim',
'catppuccin/nvim',
})
