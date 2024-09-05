-- Pull in the wezterm API
local wezterm = require("wezterm")

-- This will hold the configuration.
local config = wezterm.config_builder()

-- This is where you actually apply your config choices

-- For example, changing the color scheme:
config.color_scheme = "Catppuccin Macchiato"

-- Font config
--
-- config.font = wezterm.font("0xProto Nerd Font", { weight = "Bold", style = "Italic" })
config.font = wezterm.font({
	family = "0xProto Nerd Font",
	weight = "Bold",
	harfbuzz_features = { "ss01=1" },
})
-- config.harfbuzz_features = { "ss01" }
config.font_size = 16
config.freetype_load_flags = "NO_HINTING"

config.freetype_render_target = "HorizontalLcd"
config.cell_width = 0.9

config.window_decorations = "RESIZE"
config.hide_tab_bar_if_only_one_tab = true

-- and finally, return the configuration to wezterm
return config
