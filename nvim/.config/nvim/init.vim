" ==== [SETS]

set exrc
set tabstop=4 softtabstop=4
set shiftwidth=4
set guicursor=
set relativenumber
set nohlsearch
set hidden
set noerrorbells
set expandtab
set smartindent
set nu
set nowrap
set noswapfile
set nobackup
set undodir=~/.vim/undodir
set undofile
set incsearch
set termguicolors
set scrolloff=8
set background=dark
set completeopt=menu,menuone,noselect

" ==== [PLUGINS]

call plug#begin()
Plug 'nvim-lua/plenary.nvim'
Plug 'nvim-telescope/telescope.nvim'
Plug 'nvim-telescope/telescope-project.nvim'
Plug 'nvim-telescope/telescope-fzf-native.nvim', { 'do': 'make' }
Plug 'matsuuu/pinkmare'
Plug 'neovim/nvim-lspconfig'
Plug 'tami5/lspsaga.nvim'
Plug 'hrsh7th/cmp-nvim-lsp'
Plug 'hrsh7th/cmp-buffer'
Plug 'hrsh7th/cmp-path'
Plug 'hrsh7th/cmp-cmdline'
Plug 'hrsh7th/nvim-cmp'
Plug 'hrsh7th/vim-vsnip'
Plug 'onsails/lspkind-nvim'
Plug 'nvim-treesitter/nvim-treesitter', {'do': ':TSUpdate'}
Plug 'dense-analysis/ale'
Plug 'preservim/nerdtree'
Plug 'dstein64/vim-startuptime'
Plug 'tpope/vim-surround'
Plug 'arcticicestudio/nord-vim'
Plug 'nvim-lua/plenary.nvim' 
Plug 'airblade/vim-rooter'
Plug 'nvim-lualine/lualine.nvim'
Plug 'romgrk/barbar.nvim'
Plug 'kyazdani42/nvim-web-devicons'
Plug 'sotte/presenting.vim'
Plug 'ryanoasis/vim-devicons'
call plug#end()

" ==== [GENERAL]

let mapleader = " "
colorscheme nord
set encoding=utf8
let g:rooter_targets = '/,*'
let g:rooter_patterns = ['.git']
let g:ale_fixers = ['prettier', 'eslint']
let g:ale_fix_on_save = 1

" ==== [LUA]

lua << EOF
require('init')
EOF

" ==== [KEYBINDS]

imap jk <Esc>

nnoremap <Tab> <cmd>:bnext<CR>
nnoremap <S-Tab> <cmd>:bprevious<CR>

nnoremap <silent><C-p> <cmd>lua require'telescope.builtin'.find_files{}<CR>
nnoremap <leader>ff <cmd>Telescope current_buffer_fuzzy_find <CR>
nnoremap <leader>fp <cmd>lua require'telescope.builtin'.git_files{}<CR>
nnoremap <leader>fg <cmd>Telescope live_grep<cr>
nnoremap <leader>fb <cmd>Telescope buffers<cr>
nnoremap <leader>fh <cmd>Telescope help_tags<cr>
nnoremap <leader>pp <cmd>:lua require'telescope'.extensions.project.project{}<cr>

nnoremap <leader>ft <cmd>NERDTreeToggleVCS<cr>
nnoremap <leader>fT <cmd>NERDTreeFind<cr>

nnoremap <leader>wh <cmd>:split<cr>
nnoremap <leader>wv <cmd>:vsplit<cr>
nnoremap <leader>wd <cmd>:q<cr>
nnoremap <leader>h <cmd>:wincmd h<cr>
nnoremap <leader>j <cmd>:wincmd j<cr>
nnoremap <leader>k <cmd>:wincmd k<cr>
nnoremap <leader>l <cmd>:wincmd l<cr>

nnoremap <leader>cd <cmd>:Lspsaga lsp_finder<CR>
nnoremap <leader>cD <cmd>lua vim.lsp.buf.definition()<CR>
nnoremap <leader>cr <cmd>:Lspsaga rename<CR>
nnoremap <leader>csd <cmd>:Lspsaga hover_doc<CR>
nnoremap <silent> <C-f> <cmd>:lua require('lspsaga.action').smart_scroll_with_saga(1)<CR>
nnoremap <silent> <C-b> <cmd>:lua require('lspsaga.action').smart_scroll_with_saga(-1)<CR>
nnoremap <leader>csa <cmd>:Lspsaga code_action<CR>
nnoremap <leader>css <cmd>:Lspsaga signature_help<CR>
nnoremap <leader>cse <cmd>:Lspsaga show_line_diagnostics<CR>

nnoremap <leader>tn <cmd>:tabnew<cr>
nnoremap <leader>tc <cmd>:tabclose<cr>
nnoremap <leader>t1 1gt
nnoremap <leader>t2 2gt
nnoremap <leader>t3 3gt
nnoremap <leader>t4 4gt
nnoremap <leader>t5 5gt

