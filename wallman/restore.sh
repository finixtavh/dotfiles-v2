#!/usr/bin/env bash

STATE_FILE="$HOME/.config/wallman/current"

[[ ! -f "$STATE_FILE" ]] && exit 0

wallpaper="$(cat "$STATE_FILE")"

[[ ! -f "$wallpaper" ]] && exit 0

case "${wallpaper##*.}" in
    mp4|mkv|webm|avi|mov)
        pkill -x awww 2>/dev/null
        pkill -x mpvpaper 2>/dev/null

        mpvpaper '*' "$wallpaper" -o "no-audio --loop" &
        ;;

    *)
        pkill -x mpvpaper 2>/dev/null

        awww daemon >/dev/null 2>&1 &
        sleep 0.3

        awww img "$wallpaper"
        ;;
esac

