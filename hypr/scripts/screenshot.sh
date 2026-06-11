#!/bin/bash
# ── Screenshot Script ──
# Handles screenshots using grim and slurp

SCREENSHOT_DIR="$(xdg-user-dir PICTURES 2>/dev/null || echo "$HOME/Pictures")/Screenshots"
mkdir -p "$SCREENSHOT_DIR"

DATE=$(date '+%Y-%m-%d_%H.%M.%S')
local_file="$SCREENSHOT_DIR/Screenshot_${DATE}.png"

case "$1" in
    region)
        # Region capture
        grim -g "$(slurp)" "$local_file"
        if [[ -f "$local_file" ]]; then
            wl-copy < "$local_file"
            notify-send "📷 Region Capture" "Saved to $local_file and copied to clipboard" -a "Screenshot" -t 3000
        fi
        ;;
    screen)
        # Full screen capture
        grim "$local_file"
        if [[ -f "$local_file" ]]; then
            wl-copy < "$local_file"
            notify-send "📷 Screenshot" "Saved to $local_file and copied to clipboard" -a "Screenshot" -t 3000
        fi
        ;;
    save)
        # Save directly
        grim "$local_file"
        if [[ -f "$local_file" ]]; then
            wl-copy < "$local_file"
            notify-send "📷 Screenshot Saved" "Saved to $local_file" -a "Screenshot" -t 3000
        fi
        ;;
    *)
        echo "Usage: $0 {region|screen|save}"
        exit 1
        ;;
esac
