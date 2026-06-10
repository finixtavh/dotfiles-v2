#!/bin/bash
exec >> /tmp/rofi-debug.log 2>&1
echo "[$(date '+%H:%M:%S')] triggered | WAYLAND=$WAYLAND_DISPLAY | USER=$USER"
if pgrep -x rofi > /dev/null 2>&1; then
    echo "[$(date '+%H:%M:%S')] killing rofi"
    pkill -x rofi
else
    echo "[$(date '+%H:%M:%S')] launching rofi"
    exec rofi -show drun -show-icons
fi
