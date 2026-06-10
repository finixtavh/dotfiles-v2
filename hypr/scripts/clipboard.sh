#!/bin/bash
# ── Clipboard History ──
# Muestra el historial de cliphist en rofi

selected=$(cliphist list | rofi -dmenu -i -p "📋 Clipboard" -display-columns 2 -theme-str 'window { width: 600px; } listview { lines: 15; }')

if [[ -n "$selected" ]]; then
    echo "$selected" | cliphist decode | wl-copy
fi
