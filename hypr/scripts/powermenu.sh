#!/usr/bin/env bash
# Rofi-based power menu (replaces wlogout)

OPTIONS="󰌾  Lock\n󰤄  Suspend\n󰿅  Logout\n󰑓  Reboot\n⏻  Shutdown"

CHOSEN=$(echo -e "$OPTIONS" | rofi -dmenu \
  -i \
  -p "  Power" \
  -theme-str 'window { width: 220px; location: center; }' \
  -theme-str 'listview { lines: 5; }' \
  -theme-str 'element-text { font: "JetBrainsMono Nerd Font 13"; }')

case "$CHOSEN" in
  *Lock)     loginctl lock-session ;;
  *Suspend)  systemctl suspend ;;
  *Logout)   loginctl terminate-user "$USER" ;;
  *Reboot)   systemctl reboot ;;
  *Shutdown) systemctl poweroff ;;
esac
