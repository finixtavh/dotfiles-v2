#!/usr/bin/env bash

WALL_DIR="$HOME/.config/wallman/wallpapers"
STATE_FILE="$HOME/.config/wallman/current"

apply_wallpaper() {
    local file="$1"

    echo "$file" > "$STATE_FILE"

    case "${file##*.}" in
        mp4|mkv|webm|avi|mov)
            pkill -x mpvpaper   2>/dev/null
            pkill -x awww       2>/dev/null
            pkill -x awww-daemon 2>/dev/null
            pkill -f "awww daemon" 2>/dev/null
            sleep 0.5

            mpvpaper '*' "$file" -o "--no-audio --loop --hwdec=auto-safe" &
            ;;

        *)
            pkill -x mpvpaper 2>/dev/null
            pkill -x awww 2>/dev/null

            awww daemon >/dev/null 2>&1 &
            sleep 0.3

            awww img "$file"
            ;;
    esac
}

selection_name=$(
    find "$WALL_DIR" -type f -printf '%f\n' \
    | sort \
    | rofi -dmenu \
           -i \
           -p "Wallpaper"
)

[[ -z "$selection_name" ]] && exit 0

selection=$(find "$WALL_DIR" -type f -name "$selection_name" | head -1)
[[ -z "$selection" ]] && exit 0

apply_wallpaper "$selection"

