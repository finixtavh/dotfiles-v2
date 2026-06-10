-- Hyprland Lua Configuration (Entry Point)
-- Adapted from /home/fn-finixtavh/olddots for Hyprland 0.55+

---------------------------------
-- MONITORS & WORKSPACES
---------------------------------
hl.monitor({
    output   = "",
    mode     = "preferred",
    position = "auto",
    scale    = "1",
})

---------------------------------
-- ENVIRONMENT VARIABLES
---------------------------------
hl.env("XCURSOR_THEME", "Bibata-Modern-Classic")
hl.env("XCURSOR_SIZE", "24")
hl.env("HYPRCURSOR_SIZE", "24")
hl.env("XDG_CURRENT_DESKTOP", "Hyprland")
hl.env("XDG_SESSION_TYPE", "wayland")
hl.env("XDG_SESSION_DESKTOP", "Hyprland")
hl.env("QT_QPA_PLATFORM", "wayland;xcb")
hl.env("QT_QPA_PLATFORMTHEME", "qt6ct")
hl.env("QT_STYLE_OVERRIDE", "breeze")
hl.env("QT_WAYLAND_DISABLE_WINDOWDECORATION", "1")
hl.env("GDK_BACKEND", "wayland,x11")
hl.env("GTK_THEME", "Adwaita:dark")

---------------------------------
-- LOOK AND FEEL
---------------------------------
hl.config({
    general = {
        gaps_in  = 4,
        gaps_out = 8,
        border_size = 2,
        col = {
            -- Catppuccin Mocha themed blue/lavender gradient
            active_border   = { colors = {"rgba(89b4faee)", "rgba(cba6f7ee)"}, angle = 45 },
            inactive_border = "rgba(31313600)",
        },
        resize_on_border = true,
        allow_tearing = true,
        layout = "dwindle",
        no_focus_fallback = true,
    },

    decoration = {
        rounding       = 12,
        rounding_power = 2,
        active_opacity   = 0.95,
        inactive_opacity = 0.85,
        dim_inactive = true,
        dim_strength = 0.05,

        shadow = {
            enabled      = true,
            range        = 20,
            render_power = 4,
            offset       = "0 2",
            color        = "rgba(00000033)",
        },

        blur = {
            enabled   = true,
            xray      = true,
            size      = 10,
            passes    = 3,
            brightness = 1.0,
            noise     = 0.04,
            contrast  = 0.9,
            vibrancy  = 0.5,
            vibrancy_darkness = 0.5,
            popups    = false,
        },
    },

    dwindle = {
        preserve_split = true,
        smart_split = false,
        smart_resizing = false,
    },

    misc = {
        force_default_wallpaper = 0,
        disable_hyprland_logo = true,
        disable_splash_rendering = true,
        vrr = 0,
        mouse_move_enables_dpms = true,
        key_press_enables_dpms = true,
        animate_manual_resizes = false,
        enable_swallow = true,
        swallow_regex = "^(kitty)$",
        focus_on_activate = true,
    },

    input = {
        kb_layout = "latam",
        kb_variant = "",
        kb_model = "",
        kb_options = "",
        kb_rules = "",
        numlock_by_default = true,
        repeat_delay = 250,
        repeat_rate = 35,
        follow_mouse = 1,
        sensitivity = 0,
        touchpad = {
            natural_scroll = true,
            disable_while_typing = true,
            clickfinger_behavior = true,
            scroll_factor = 0.7,
        }
    },
    
    binds = {
        scroll_event_delay = 0,
    },
    
    cursor = {
        hotspot_padding = 1,
    }
})

---------------------------------
-- AUTOSTART
---------------------------------
hl.on("hyprland.start", function ()
    hl.exec_cmd("ags run &")
    hl.exec_cmd("~/.config/hypr/scripts/init-wallpaper.sh")
    hl.exec_cmd("/usr/lib/polkit-kde-authentication-agent-1")
    hl.exec_cmd("wl-paste --type text --watch cliphist store")
    hl.exec_cmd("wl-paste --type image --watch cliphist store")
    hl.exec_cmd("hyprctl setcursor Bibata-Modern-Classic 24")
    hl.exec_cmd("dbus-update-activation-environment --all")
    hl.exec_cmd("awww-daemon")
    hl.exec_cmd("~/.config/wallman/restore.sh")
end)

---------------------------------
-- LOAD MODULAR CONFIGS
---------------------------------
require("animations")
require("rules")
require("keybinds")
