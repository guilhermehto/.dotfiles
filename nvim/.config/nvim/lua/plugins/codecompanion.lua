return {
	"olimorris/codecompanion.nvim",
	dependencies = {
		"nvim-lua/plenary.nvim",
		"nvim-treesitter/nvim-treesitter",
	},
	config = function()
		require("codecompanion").setup({
			interactions = {
				chat = { adapter = "codex" },
			},
			adapters = {
				acp = {
					extend = {
						claude_code = {
							defaults = {
								-- Model must match a value the Claude CLI advertises (fable/opus/sonnet/...).
								model = "fable",
							},
							-- Zed's package ships `claude-code-acp`; adapter defaults to `claude-agent-acp`.
							commands = {
								default = { "claude-code-acp" },
								yolo = { "claude-code-acp", "--yolo" },
							},
							env = {
								-- The bridge bundles an old Claude CLI that predates Fable; use the system install.
								CLAUDE_CODE_EXECUTABLE = function()
									return vim.fn.expand("~/.local/bin/claude")
								end,
								-- One-time: `claude setup-token`, then store the token in the login keychain:
								--   security add-generic-password -a "$USER" -s anthropic-claude -w '<token>'
								CLAUDE_CODE_OAUTH_TOKEN = "cmd:security find-generic-password -ws anthropic-claude | tr -d '\n'",
							},
						},
						codex = {
							env = {
								CODEX_PATH = "/opt/homebrew/bin/codex",
							},
							defaults = {
								auth_method = "chat-gpt",
								session_config_options = {
									model = "gpt-6-astra",
									thought_level = "medium",
								},
							},
						},
					},
				},
			},
		})
	end,
	keys = {
		{ "<leader>ac", "<cmd>CodeCompanionChat Toggle<cr>", mode = { "n", "v" }, desc = "[A]I [C]hat toggle" },
		{ "<leader>aa", "<cmd>CodeCompanionActions<cr>", mode = { "n", "v" }, desc = "[A]I [A]ctions" },
		{ "ga", "<cmd>CodeCompanionChat Add<cr>", mode = "v", desc = "[A]I add selection to chat" },
	},
}
