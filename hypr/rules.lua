-- Window, Workspace, and Layer rules (Lua API)

-- Opacity
hl.window_rule({ match = { class = ".*" }, opacity = "0.90 override 0.60 override" })
hl.window_rule({ match = { class = "^(code)" }, opacity = "1.0 override 1.0 override" })

-- Floating Dialogs
local floating_titles = {
    "^(Open File)(.*)$",
    "^(Select a File)(.*)$",
    "^(Choose wallpaper)(.*)$",
    "^(Open Folder)(.*)$",
    "^(Save As)(.*)$",
    "^(Library)(.*)$",
    "^(File Upload)(.*)$"
}
for _, title in ipairs(floating_titles) do
    hl.window_rule({ match = { title = title }, float = true, center = true })
end

-- Floating Apps
local floating_apps = { "pavucontrol", "blueman-manager", "nm-connection-editor" }
for _, app in ipairs(floating_apps) do
    hl.window_rule({
        match = { class = "^(" .. app .. ")$" },
        float = true,
        size = "45% 45%",
        center = true
    })
end

-- Picture in Picture
hl.window_rule({
    match = { title = "^([Pp]icture[-\\s]?[Ii]n[-\\s]?[Pp]icture)(.*)$" },
    float = true,
    keep_aspect_ratio = true,
    move = "73% 72%",
    size = "25% 25%",
    pin = true
})

-- Screen sharing indicator
hl.window_rule({
    match = { title = ".*is sharing (a window|your screen).*" },
    float = true,
    pin = true
})

-- Tearing (immediate)
hl.window_rule({ match = { title = ".*\\.exe" }, immediate = true })
hl.window_rule({ match = { class = "^(steam_app).*" }, immediate = true })
hl.window_rule({ match = { title = ".*minecraft.*" }, immediate = true })

-- Workspace rule (Special workspace gaps)
hl.workspace_rule({ workspace = "special:special", gaps_out = 30 })

-- Layer rules (blur and ignore alpha for desktop widgets)
hl.layer_rule({ match = { namespace = "notifications" }, blur = true, ignore_alpha = 0.69 })
hl.layer_rule({ match = { namespace = "rofi" }, blur = true, ignore_alpha = 0.5 })
hl.layer_rule({ match = { namespace = "ags-bar" }, blur = true, ignore_alpha = 0.5 })
hl.layer_rule({ match = { namespace = "ags-music-bar" }, blur = true, ignore_alpha = 0.5 })
hl.layer_rule({ match = { namespace = "power-menu" }, blur = true })
