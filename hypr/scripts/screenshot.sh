#!/bin/bash
# ── Screenshot Script ──
# Maneja capturas de pantalla usando grim y slurp

SCREENSHOT_DIR="$(xdg-user-dir PICTURES 2>/dev/null || echo "$HOME/Pictures")/Screenshots"
mkdir -p "$SCREENSHOT_DIR"

DATE=$(date '+%Y-%m-%d_%H.%M.%S')
local_file="$SCREENSHOT_DIR/Screenshot_${DATE}.png"

case "$1" in
    region)
        # Captura de región seleccionada
        grim -g "$(slurp)" "$local_file"
        if [[ -f "$local_file" ]]; then
            wl-copy < "$local_file"
            notify-send "📷 Captura de Región" "Guardada en $local_file y copiada al portapapeles" -a "Screenshot" -t 3000
        fi
        ;;
    screen)
        # Pantalla completa
        grim "$local_file"
        if [[ -f "$local_file" ]]; then
            wl-copy < "$local_file"
            notify-send "📷 Captura de Pantalla" "Guardada en $local_file y copiada al portapapeles" -a "Screenshot" -t 3000
        fi
        ;;
    save)
        # Guardar directamente
        grim "$local_file"
        if [[ -f "$local_file" ]]; then
            wl-copy < "$local_file"
            notify-send "📷 Captura Guardada" "Guardada en $local_file" -a "Screenshot" -t 3000
        fi
        ;;
    *)
        echo "Uso: $0 {region|screen|save}"
        exit 1
        ;;
esac
