vim.g.mapleader = " "
vim.keymap.set("n", "<C-p>", "<cmd>Telescope find_files<cr>")
vim.keymap.set("n", "<leader>ff", "<cmd>Telescope current_buffer_fuzzy_find <cr>")
vim.keymap.set("n", "<leader>fp", "<cmd>Telescope git_files<cr>")
vim.keymap.set("n", "<leader>fg", "<cmd>Telescope live_grep<cr>")
vim.keymap.set("n", "<leader>fb", "<cmd>Telescope buffers<cr>")
vim.keymap.set("n", "<leader>fh", "<cmd>Telescope help_tags<cr>")
vim.keymap.set("n", "<leader>pp", "<cmd>:lua require'telescope'.extensions.project.project{}<cr>")

vim.keymap.set("n", "<leader>ft", "<cmd>Neotree<cr>")
vim.keymap.set("n", "<leader>fT", "<cmd>Neotree reveal<cr>")

vim.keymap.set("n", "<leader>wh", "<cmd>split<cr>")
vim.keymap.set("n", "<leader>wv", "<cmd>vsplit<cr>")
vim.keymap.set("n", "<leader>wd", "<cmd>q<cr>")
vim.keymap.set("n", "<leader>h", "<cmd>wincmd h<cr>")
vim.keymap.set("n", "<leader>j", "<cmd>wincmd j<cr>")
vim.keymap.set("n", "<leader>k", "<cmd>wincmd k<cr>")
vim.keymap.set("n", "<leader>l", "<cmd>wincmd l<cr>")

vim.keymap.set("n", "<leader>cd", "<cmd>Telescope lsp_references<cr>")
vim.keymap.set("n", "<leader>cD", "<cmd>Telescope lsp_definitions<cr>")
vim.keymap.set("n", "<leader>cr", "<cmd>Lspsaga rename<cr>")
vim.keymap.set("n", "<leader>csd", "<cmd>Lspsaga hover_doc<cr>")

vim.keymap.set("n", "<C-f", " <cmd>:lua require('lspsaga.action').smart_scroll_with_saga(1)<cr>")
vim.keymap.set("n", "<C-b", " <cmd>:lua require('lspsaga.action').smart_scroll_with_saga(-1)<cr>")

vim.keymap.set("n", "<leader>csa", "<cmd>Lspsaga code_action<cr>")
vim.keymap.set("n", "<leader>css", "<cmd>Lspsaga signature_help<cr>")
vim.keymap.set("n", "<leader>cse", "<cmd>Lspsaga show_line_diagnostics<cr>")

vim.keymap.set("n", "<C-t>", "<cmd>Lspsaga open_floaterm<cr>")
vim.keymap.set("n", "<C-l>", "<cmd>Lspsaga open_floaterm lazygit<cr>")
vim.keymap.set("t", "<C-t>", "<cmd>Lspsaga close_floaterm<cr>")
vim.keymap.set("t", "<C-l>", "<cmd>Lspsaga close_floaterm lazygit<cr>")

vim.keymap.set("n", "<leader>tn", "<cmd>:tabnew<cr>")
vim.keymap.set("n", "<leader>tc", "<cmd>:tabclose<cr>")
vim.keymap.set("n", "<leader>t1", "1gt")
vim.keymap.set("n", "<leader>t2", "2gt")
vim.keymap.set("n", "<leader>t3", "3gt")
vim.keymap.set("n", "<leader>t4", "4gt")
vim.keymap.set("n", "<leader>t5", "5gt")

vim.keymap.set("n", "<leader>vs", ":source $MYVIMRC<cr>")

vim.keymap.set("v", "J", ":m '>+1<CR>gv=gv")
vim.keymap.set("v", "K", ":m '<-2<CR>gv=gv")

-- from: ThePrimeagen
vim.keymap.set("n", "<C-d>", "<C-d>zz")
vim.keymap.set("n", "<C-u>", "<C-u>zz")

-- Managers
vim.keymap.set("n", "<leader>mm", "<cmd>Mason<cr>")
vim.keymap.set("n", "<leader>ml", "<cmd>Lazy<cr>")
