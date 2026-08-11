-- Pull in the wezterm API
local wezterm = require("wezterm")

-- This will hold the configuration.
local config = wezterm.config_builder()

-- This is where you actually apply your config choices

-- For example, changing the color scheme:
config.color_scheme = "Tokyo Night Storm"

-- Font config
--
-- config.font = wezterm.font("0xProto Nerd Font", { weight = "Bold", style = "Italic" })
-- Listing kern/liga/clig/calt keeps wezterm's defaults, which naming any
-- feature would otherwise drop. ss01 = 0xProto's script variant.
local font_features = { "kern", "liga", "clig", "calt", "ss01" }

config.font = wezterm.font({
	family = "0xProto Nerd Font",
	weight = "Bold",
	harfbuzz_features = font_features,
})

-- ss01 exists only in the Italic face, which ships at weight 400 with no
-- Bold Italic, so italic is matched by style rather than inheriting Bold.
config.font_rules = {
	{
		italic = true,
		font = wezterm.font({
			family = "0xProto Nerd Font",
			style = "Italic",
			harfbuzz_features = font_features,
		}),
	},
}

config.font_size = 20
config.freetype_load_flags = "NO_HINTING"

config.freetype_render_target = "HorizontalLcd"
config.cell_width = 0.9

config.window_decorations = "RESIZE"
config.hide_tab_bar_if_only_one_tab = true

config.audible_bell = "Disabled"

-- and finally, return the configuration to wezterm
return config
