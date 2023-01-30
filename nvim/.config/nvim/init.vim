" ==== [SETS]

lua << EOF
require('sets')
EOF

" ==== [PLUGINS]

call plug#begin()

" ==== [GENERAL]

"colorscheme catppuccin-macchiato
set encoding=utf8
let g:rooter_targets = '/,*'
let g:rooter_patterns = ['.git']
let g:ale_fixers = ['prettier', 'eslint']
let g:ale_fix_on_save = 1

" ==== [LUA]

lua << EOF
require('remaps')
require('plugins')
EOF

