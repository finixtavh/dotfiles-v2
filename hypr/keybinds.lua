-- Keybinds Configuration (Lua API)

local mainMod = "SUPER"

-- ── Apps ──────────────────────────────────────────────────────
hl.bind(mainMod .. " + Return", hl.dsp.exec_cmd("kitty"))
hl.bind(mainMod .. " + T", hl.dsp.exec_cmd("kitty"))
hl.bind("CTRL+ALT + T", hl.dsp.exec_cmd("kitty"))
hl.bind(mainMod .. " + E", hl.dsp.exec_cmd("dolphin"))
hl.bind(mainMod .. " + W", hl.dsp.exec_cmd("firefox"))
hl.bind(mainMod .. " + C", hl.dsp.exec_cmd("ags toggle -i ags-bar command-center"))
hl.bind(mainMod .. " + X", hl.dsp.exec_cmd("kate"))
hl.bind(mainMod .. " + I", hl.dsp.exec_cmd("XDG_CURRENT_DESKTOP=gnome gnome-control-center"))
hl.bind("CTRL+SHIFT + Escape", hl.dsp.exec_cmd("gnome-system-monitor"))

-- ── Shell / Launcher ──────────────────────────────────────────
-- hl.bind(mainMod .. " + SUPER_L",     hl.dsp.exec_cmd("rofi -show drun -show-icons"))
hl.bind(
    "SUPER + SUPER_L",
    hl.dsp.exec_cmd([[
        if pidof rofi >/dev/null; then
            pkill rofi
        else
            rofi -show drun -show-icons
        fi
    ]]),
    { release = true }
)

-- hl.bind(mainMod .. " + Space", hl.dsp.exec_cmd("rofi -show drun -show-icons"))
-- hl.bind("SUPER + SUPER_L", hl.dsp.exec_cmd("rofi -show drun -show-icons"), { release = true })
-- Super_L alone on release (may not fire on all Hyprland versions)
hl.bind("Super_L", hl.dsp.exec_cmd("/home/fn-finixtavh/.config/hypr/scripts/rofi-toggle.sh"), { release = true })
hl.bind(mainMod .. "+ALT + W", hl.dsp.exec_cmd("~/.config/hypr/scripts/wallpaper.sh"))
hl.bind(mainMod .. " + Slash", hl.dsp.exec_cmd("~/.config/hypr/scripts/keybind-cheatsheet.sh"))
hl.bind(mainMod .. " + V", hl.dsp.exec_cmd("~/.config/hypr/scripts/clipboard.sh"))
hl.bind(mainMod .. " + Period", hl.dsp.exec_cmd("~/.config/hypr/scripts/emoji.sh"))
hl.bind(mainMod .. " + N", hl.dsp.exec_cmd("dunstctl history-pop"))

-- ── Windows ───────────────────────────────────────────────────
hl.bind(mainMod .. " + Q", hl.dsp.window.close())
hl.bind("ALT + F4", hl.dsp.window.close())
hl.bind(mainMod .. "+SHIFT+ALT + Q", hl.dsp.exec_cmd("hyprctl kill"))

-- ── Focus ─────────────────────────────────────────────────────
hl.bind(mainMod .. " + Left", hl.dsp.focus({ direction = "l" }))
hl.bind(mainMod .. " + Right", hl.dsp.focus({ direction = "r" }))
hl.bind(mainMod .. " + Up", hl.dsp.focus({ direction = "u" }))
hl.bind(mainMod .. " + Down", hl.dsp.focus({ direction = "d" }))
hl.bind(mainMod .. " + BracketLeft", hl.dsp.focus({ direction = "l" }))
hl.bind(mainMod .. " + BracketRight", hl.dsp.focus({ direction = "r" }))
hl.bind(mainMod .. " + Tab", hl.dsp.exec_cmd("hyprctl dispatch cyclenext"))

-- ── Move Window ───────────────────────────────────────────────
hl.bind(mainMod .. "+SHIFT + Left", hl.dsp.window.move({ direction = "l" }))
hl.bind(mainMod .. "+SHIFT + Right", hl.dsp.window.move({ direction = "r" }))
hl.bind(mainMod .. "+SHIFT + Up", hl.dsp.window.move({ direction = "u" }))
hl.bind(mainMod .. "+SHIFT + Down", hl.dsp.window.move({ direction = "d" }))

-- ── Positioning ───────────────────────────────────────────────
hl.bind(mainMod .. "+ALT + Space", hl.dsp.window.float({ action = "toggle" }))
hl.bind(mainMod .. " + D", hl.dsp.window.fullscreen({ mode = "maximized", action = "toggle" }))
hl.bind(mainMod .. " + F", hl.dsp.window.fullscreen({ mode = "fullscreen", action = "toggle" }))
hl.bind(mainMod .. " + P", hl.dsp.window.pin())

-- ── Split ratio ───────────────────────────────────────────────
hl.bind(mainMod .. " + Semicolon", hl.dsp.layout("splitratio -0.1"), { repeating = true })
hl.bind(mainMod .. " + Apostrophe", hl.dsp.exec_cmd("ags toggle -i ags-bar keybinds-viewer"))

-- ── Mouse Binds ───────────────────────────────────────────────
hl.bind(mainMod .. " + mouse:272", hl.dsp.window.drag(), { mouse = true })
hl.bind(mainMod .. " + mouse:273", hl.dsp.window.resize(), { mouse = true })

-- ── Workspaces (1 to 10) ──────────────────────────────────────
for i = 1, 9 do
    hl.bind(mainMod .. " + " .. tostring(i), hl.dsp.focus({ workspace = tostring(i) }))
    hl.bind(mainMod .. "+ALT + " .. tostring(i), hl.dsp.window.move({ workspace = tostring(i), follow = false }))
    hl.bind(mainMod .. "+SHIFT + " .. tostring(i), hl.dsp.window.move({ workspace = tostring(i) }))
end

hl.bind(mainMod .. " + 0", hl.dsp.focus({ workspace = "10" }))
hl.bind(mainMod .. "+ALT + 0", hl.dsp.window.move({ workspace = "10", follow = false }))
hl.bind(mainMod .. "+SHIFT + 0", hl.dsp.window.move({ workspace = "10" }))

-- ── Workspace Navigation ──────────────────────────────────────
hl.bind("CTRL+" .. mainMod .. " + Right", hl.dsp.focus({ workspace = "r+1" }))
hl.bind("CTRL+" .. mainMod .. " + Left", hl.dsp.focus({ workspace = "r-1" }))
hl.bind(mainMod .. " + Page_Down", hl.dsp.focus({ workspace = "+1" }))
hl.bind(mainMod .. " + Page_Up", hl.dsp.focus({ workspace = "-1" }))

-- ── Scroll Workspace ──────────────────────────────────────────
hl.bind(mainMod .. " + mouse_up", hl.dsp.focus({ workspace = "+1" }))
hl.bind(mainMod .. " + mouse_down", hl.dsp.focus({ workspace = "-1" }))

-- ── Scroll Move Window ────────────────────────────────────────
hl.bind(mainMod .. "+SHIFT + mouse_down", hl.dsp.window.move({ workspace = "r-1" }))
hl.bind(mainMod .. "+SHIFT + mouse_up", hl.dsp.window.move({ workspace = "r+1" }))
hl.bind(mainMod .. "+SHIFT + Page_Down", hl.dsp.window.move({ workspace = "r+1" }))
hl.bind(mainMod .. "+SHIFT + Page_Up", hl.dsp.window.move({ workspace = "r-1" }))
hl.bind("CTRL+" .. mainMod .. "+SHIFT + Right", hl.dsp.window.move({ workspace = "r+1" }))
hl.bind("CTRL+" .. mainMod .. "+SHIFT + Left", hl.dsp.window.move({ workspace = "r-1" }))

-- ── Scratchpad ────────────────────────────────────────────────
hl.bind(mainMod .. " + S", hl.dsp.workspace.toggle_special("special"))
hl.bind(mainMod .. "+ALT + S", hl.dsp.window.move({ workspace = "special:special", follow = false }))

-- ── Screenshots & Utilities ───────────────────────────────────
hl.bind(mainMod .. "+SHIFT + S", hl.dsp.exec_cmd("~/.config/hypr/scripts/screenshot.sh region"))
hl.bind("Print", hl.dsp.exec_cmd("~/.config/hypr/scripts/screenshot.sh screen"))
hl.bind("CTRL + Print", hl.dsp.exec_cmd("~/.config/hypr/scripts/screenshot.sh save"))
hl.bind(mainMod .. "+SHIFT + C", hl.dsp.exec_cmd("hyprpicker -a"))

-- ── Multimedia ────────────────────────────────────────────────
hl.bind("XF86AudioRaiseVolume", hl.dsp.exec_cmd("wpctl set-volume -l 1.0 @DEFAULT_AUDIO_SINK@ 5%+"), { repeating = true })
hl.bind("XF86AudioLowerVolume", hl.dsp.exec_cmd("wpctl set-volume -l 1.0 @DEFAULT_AUDIO_SINK@ 5%-"), { repeating = true })
hl.bind("XF86AudioMute", hl.dsp.exec_cmd("wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle"), { locked = true })
hl.bind("XF86AudioMicMute", hl.dsp.exec_cmd("wpctl set-mute @DEFAULT_AUDIO_SOURCE@ toggle"), { locked = true })
hl.bind(mainMod .. "+SHIFT + M", hl.dsp.exec_cmd("wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle"), { locked = true })
hl.bind(mainMod .. "+ALT + M", hl.dsp.exec_cmd("wpctl set-mute @DEFAULT_AUDIO_SOURCE@ toggle"), { locked = true })

hl.bind("XF86MonBrightnessUp", hl.dsp.exec_cmd("brightnessctl set 5%+"), { repeating = true })
hl.bind("XF86MonBrightnessDown", hl.dsp.exec_cmd("brightnessctl set 5%-"), { repeating = true })

-- ── Playerctl Media Controls ──────────────────────────────────
hl.bind(mainMod .. "+SHIFT + N", hl.dsp.exec_cmd("playerctl next"), { locked = true })
hl.bind(mainMod .. "+SHIFT + B", hl.dsp.exec_cmd("playerctl previous"), { locked = true })
hl.bind(mainMod .. "+SHIFT + P", hl.dsp.exec_cmd("playerctl play-pause"), { locked = true })
hl.bind("XF86AudioNext", hl.dsp.exec_cmd("playerctl next"), { locked = true })
hl.bind("XF86AudioPrev", hl.dsp.exec_cmd("playerctl previous"), { locked = true })
hl.bind("XF86AudioPlay", hl.dsp.exec_cmd("playerctl play-pause"), { locked = true })
hl.bind("XF86AudioPause", hl.dsp.exec_cmd("playerctl play-pause"), { locked = true })

-- ── Session / Zoom ────────────────────────────────────────────
hl.bind(mainMod .. " + L", hl.dsp.exec_cmd("hyprlock"), { locked = true })
hl.bind("XF86PowerOff", hl.dsp.exec_cmd("ags toggle -i ags-bar power-menu"))
hl.bind(mainMod .. "+SHIFT + L", hl.dsp.exec_cmd("systemctl suspend"), { locked = true })
hl.bind("CTRL+ALT + Delete", hl.dsp.exec_cmd("ags toggle -i ags-bar power-menu"))
hl.bind(mainMod .. " + Escape", hl.dsp.exec_cmd("~/.config/hypr/scripts/powermenu.sh"))

hl.bind(mainMod .. " + Minus", hl.dsp.exec_cmd("hyprctl keyword cursor:zoom_factor $(hyprctl getoption cursor:zoom_factor -j | grep -oP '(?<=\"float\": )[0-9.]+' | awk '{printf \"%.1f\", $1 - 0.3}')"), { repeating = true })
hl.bind(mainMod .. " + Equal", hl.dsp.exec_cmd("hyprctl keyword cursor:zoom_factor $(hyprctl getoption cursor:zoom_factor -j | grep -oP '(?<=\"float\": )[0-9.]+' | awk '{printf \"%.1f\", $1 + 0.3}')"), { repeating = true })
