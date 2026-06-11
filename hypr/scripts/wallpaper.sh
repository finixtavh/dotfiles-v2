#!/bin/bash
# ── Wallpaper Selector ──
# Detects whether the file is a video or image and launches awww or mpvpaper

WALLPAPER_DIR="$HOME/Pictures/Wallpapers"
CACHE="$HOME/.cache/current_wallpaper"
mkdir -p "$WALLPAPER_DIR"

# ── File type patterns ─────────────────────────────────────────
IMAGE_EXT='(jpg|jpeg|png|gif|webp|bmp|tiff)'
VIDEO_EXT='(mp4|webm|mkv|avi|mov|gif)'

# ── Select with rofi (shows all supported files) ───────────────
selected=$(ls "$WALLPAPER_DIR" \
    | grep -iE "\.($IMAGE_EXT|$VIDEO_EXT)$" \
    | rofi -dmenu -i -p "󰸉 Wallpaper:")

[[ -z "$selected" ]] && exit 0

FILE="$WALLPAPER_DIR/$selected"

# ── Detect file type ───────────────────────────────────────────
EXT="${selected##*.}"
EXT="${EXT,,}"  # lowercase

is_video() {
    echo "$EXT" | grep -qE "^(mp4|webm|mkv|avi|mov)$"
}

# ── Kill previous wallpaper process ───────────────────────────
pkill -x awww-daemon 2>/dev/null
pkill -x mpvpaper    2>/dev/null
sleep 0.3

# ── Apply wallpaper ────────────────────────────────────────────
if is_video; then
    # Kill awww if running (to clear state), then launch mpvpaper
    mpvpaper -o "--no-audio --loop-file=inf --panscan=1.0" '*' "$FILE" &
    disown
else
    # Ensure awww daemon is running
    if ! pgrep -x awww-daemon > /dev/null; then
        awww-daemon --no-cache &
        sleep 0.5
    fi
    awww img "$FILE" \
        --transition-type grow \
        --transition-pos center \
        --transition-duration 0.8 \
        --transition-fps 60
fi

# Save path to cache so AGS and other tools know the current wallpaper
echo "$FILE" > "$CACHE"
notify-send "Wallpaper Applied" "$selected" -a "Wallpaper" -t 2500
