#!/bin/bash
# ── Wallpaper Selector ──
# Detecta si el archivo es video o imagen y lanza awww o mpvpaper

WALLPAPER_DIR="$HOME/Pictures/Wallpapers"
CACHE="$HOME/.cache/current_wallpaper"
mkdir -p "$WALLPAPER_DIR"

# ── Patrones por tipo ──────────────────────────────────────────
IMAGE_EXT='(jpg|jpeg|png|gif|webp|bmp|tiff)'
VIDEO_EXT='(mp4|webm|mkv|avi|mov|gif)'

# ── Selección con rofi (muestra todos los archivos soportados) ──
selected=$(ls "$WALLPAPER_DIR" \
    | grep -iE "\.($IMAGE_EXT|$VIDEO_EXT)$" \
    | rofi -dmenu -i -p "󰸉 Wallpaper:")

[[ -z "$selected" ]] && exit 0

FILE="$WALLPAPER_DIR/$selected"

# ── Detectar tipo ──────────────────────────────────────────────
EXT="${selected##*.}"
EXT="${EXT,,}"  # lowercase

is_video() {
    echo "$EXT" | grep -qE "^(mp4|webm|mkv|avi|mov)$"
}

# ── Matar proceso anterior de wallpaper ───────────────────────
pkill -x awww-daemon 2>/dev/null
pkill -x mpvpaper    2>/dev/null
sleep 0.3

# ── Aplicar wallpaper ─────────────────────────────────────────
if is_video; then
    # Iniciar daemon awww si está corriendo (para limpiar estado)
    # mpvpaper toma el monitor, --loop para repetir, --mpv-options para sin audio
    mpvpaper -o "--no-audio --loop-file=inf --panscan=1.0" '*' "$FILE" &
    disown
else
    # Asegurar daemon awww activo
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

# Guardar ruta en cache (para que AGS/otros sepan cuál es el actual)
echo "$FILE" > "$CACHE"
notify-send "Fondo Aplicado" "$selected" -a "Wallpaper" -t 2500
