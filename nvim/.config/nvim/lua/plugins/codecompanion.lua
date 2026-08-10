return {
	"olimorris/codecompanion.nvim",
	dependencies = {
		"nvim-lua/plenary.nvim",
		"nvim-treesitter/nvim-treesitter",
	},
	config = function()
		require("codecompanion").setup({
			strategies = {
				chat = { adapter = "claude_code" },
			},
			adapters = {
				acp = {
					claude_code = function()
						return require("codecompanion.adapters").extend("claude_code", {
							-- Model must match a value the claude-code-acp bridge advertises (opus/sonnet/...).
							defaults = {
								model = "sonnet",
							},
							-- Zed's package ships `claude-code-acp`; adapter defaults to `claude-agent-acp`.
							commands = {
								default = { "claude-code-acp" },
								yolo = { "claude-code-acp", "--yolo" },
							},
							env = {
								-- One-time: `claude setup-token`, then store the token in the login keychain:
								--   security add-generic-password -a "$USER" -s anthropic-claude -w '<token>'
								CLAUDE_CODE_OAUTH_TOKEN = "cmd:security find-generic-password -ws anthropic-claude | tr -d '\n'",
							},
						})
					end,
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
