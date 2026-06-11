#!/bin/bash
# ── Wallpaper Init ──
# On session start: restore the last wallpaper from cache

CACHE="$HOME/.cache/current_wallpaper"
WALLPAPER_DIR="$HOME/Pictures/Wallpapers"
IMAGE_EXT='(jpg|jpeg|png|gif|webp|bmp|tiff)'
VIDEO_EXT='(mp4|webm|mkv|avi|mov)'
mkdir -p "$WALLPAPER_DIR"

# Read file from cache, or find the first available one
if [[ -f "$CACHE" ]]; then
    FILE=$(cat "$CACHE" | tr -d '[:space:]')
    # Verify it still exists
    [[ ! -f "$FILE" ]] && FILE=""
fi

# Fallback: first file found
if [[ -z "$FILE" ]]; then
    FILE=$(find "$WALLPAPER_DIR" -maxdepth 1 \
        -iregex ".*\.\($IMAGE_EXT\|\$VIDEO_EXT\)" \
        | head -1)
fi

[[ -z "$FILE" ]] && exit 0  # No wallpapers, nothing to do

EXT="${FILE##*.}"
EXT="${EXT,,}"

is_video() {
    echo "$EXT" | grep -qE "^(mp4|webm|mkv|avi|mov)$"
}

# Kill any previous wallpaper process (clean start)
pkill -x awww-daemon 2>/dev/null
pkill -x mpvpaper    2>/dev/null
sleep 0.2

if is_video; then
    mpvpaper -o "--no-audio --loop-file=inf --panscan=1.0" '*' "$FILE" &
    disown
else
    awww-daemon --no-cache &
    sleep 0.6
    awww img "$FILE" \
        --transition-type fade \
        --transition-duration 1.0 \
        --transition-fps 60
fi

echo "$FILE" > "$CACHE"
