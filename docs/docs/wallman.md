# Wallman

## Índice

1. [Resumen](#resumen)
2. [Archivos](#archivos)
3. [Constantes y variables](#constantes-y-variables)
4. [wallpicker.sh — Selector interactivo](#wallpickersh--selector-interactivo)
5. [restore.sh — Restauración al inicio](#restoresh--restauración-al-inicio)
6. [Directorio de fondos](#directorio-de-fondos)
7. [Dependencias](#dependencias)
8. [Notas y recursos](#notas-y-recursos)

---

## Resumen

**Wallman** es el gestor de fondos de pantalla. Está compuesto por dos scripts bash en `~/.config/wallman/`. Soporta tanto **imágenes estáticas** (via `awww`) como **videos en loop** (via `mpvpaper`). El fondo actual se guarda en `~/.config/wallman/current` para poder restaurarse al reiniciar sesión.

El selector se puede abrir desde:
- El **Command Center** (SUPER+C → botón Wallpaper).
- Directamente: `bash ~/.config/wallman/wallpicker.sh`.

---

## Archivos

| Archivo | Propósito |
|---------|-----------|
| `wallpicker.sh` | Selector interactivo de fondos via rofi |
| `restore.sh` | Restaura el último fondo al iniciar sesión |
| `current` | Archivo de estado — guarda la ruta del fondo activo |
| `wallpapers/` | Directorio de imágenes y videos (no incluido en el repo) |

---

## Constantes y variables

### wallpicker.sh

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `WALL_DIR` | `~/.config/wallman/wallpapers` | Directorio de fondos |
| `STATE_FILE` | `~/.config/wallman/current` | Guarda la ruta del fondo activo |

### restore.sh

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `STATE_FILE` | `~/.config/wallman/current` | Lee el fondo guardado para restaurarlo |

---

## wallpicker.sh — Selector interactivo

### Flujo general

```
1. Listar archivos de WALL_DIR (solo nombres, sin ruta)
2. Mostrar lista en rofi (búsqueda fuzzy)
3. Reconstruir ruta completa del archivo seleccionado
4. Llamar a apply_wallpaper()
```

### Función `apply_wallpaper(file)`

Detecta el tipo de archivo por su extensión y aplica el fondo correspondiente:

#### Imágenes estáticas (`png`, `jpg`, `gif`, etc.)

1. Termina cualquier proceso `mpvpaper` previo.
2. Termina el daemon `awww` previo.
3. Lanza `awww daemon` en segundo plano.
4. Espera 0.3 s para que el daemon inicialice.
5. Ejecuta `awww img "$file"` para aplicar el fondo.

#### Videos (`mp4`, `mkv`, `webm`, `avi`, `mov`)

1. Termina `mpvpaper`, `awww` y `awww-daemon` explícitamente (con múltiples variantes de pkill para cubrir todos los casos).
2. Espera 0.5 s para asegurar que los procesos terminaron.
3. Lanza `mpvpaper '*' "$file" -o "--no-audio --loop --hwdec=auto-safe"` en segundo plano.

> **Nota**: La terminación explícita de `awww` antes de lanzar `mpvpaper` es importante. Si no se mata correctamente, el fondo estático de `awww` queda visible debajo del video.

### Selección con rofi

```bash
selection_name=$(
    find "$WALL_DIR" -type f -printf '%f\n' \
    | sort \
    | rofi -dmenu -i -p "Wallpaper"
)
```

Rofi muestra **solo el nombre del archivo** (sin ruta completa). Una vez seleccionado, se reconstruye la ruta completa con:

```bash
selection=$(find "$WALL_DIR" -type f -name "$selection_name" | head -1)
```

### Guardar estado

El path completo se guarda en `STATE_FILE` al inicio de `apply_wallpaper()`, antes de aplicar el fondo. Esto garantiza que `restore.sh` siempre tenga la ruta más reciente.

---

## restore.sh — Restauración al inicio

Se ejecuta al inicio de sesión (via `exec-once` en Hyprland) para restaurar el último fondo usado.

### Flujo

```
1. Leer STATE_FILE → obtener ruta del fondo guardado
2. Si el archivo no existe → salir sin error
3. Detectar tipo por extensión
4. Video → mpvpaper '*' "$wallpaper" -o "no-audio --loop"
5. Imagen → awww daemon + awww img "$wallpaper"
```

!!! warning "Diferencia con wallpicker.sh"
    `restore.sh` usa flags ligeramente diferentes a `wallpicker.sh` en el comando de mpvpaper (`no-audio --loop` vs `--no-audio --loop --hwdec=auto-safe`). Ambos funcionan, pero `wallpicker.sh` añade aceleración de hardware.

---

## Directorio de fondos

```
~/.config/wallman/wallpapers/
├── imagen.png
├── imagen.jpg
├── video.mp4
├── video.webm
└── ...
```

!!! note "No incluido en el repositorio"
    El directorio `wallpapers/` está en el `.gitignore` del repo porque los archivos de video/imagen son pesados y personales. El script de instalación crea el directorio vacío automáticamente.

**Formatos soportados:**

| Tipo | Extensiones |
|------|-------------|
| Imágenes | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`, `.tiff` |
| Videos | `.mp4`, `.mkv`, `.webm`, `.avi`, `.mov` |

---

## Dependencias

| Herramienta | Paquete | Uso |
|-------------|---------|-----|
| `awww` | AUR: `awww` | Daemon de fondos estáticos con transiciones |
| `mpvpaper` | AUR: `mpvpaper` | Fondo de video usando MPV |
| `rofi` | AUR: `rofi-lbonn-wayland-git` | Selector de archivos interactivo |
| `find` | `findutils` (base) | Listar archivos del directorio |

---

## Notas y recursos

- Si `awww` no está instalado, prueba `swww` (también en AUR) — es el equivalente más popular. El script usa el binario `awww`, por lo que habría que ajustar los comandos si usas `swww`.
- [mpvpaper — GitHub](https://github.com/GhostNaN/mpvpaper)
- [swww — GitHub](https://github.com/LGFae/swww) (alternativa popular a awww)
- Para cambiar el fondo desde el Command Center: ver [AGS Bar → CommandCenter](ags.md#commandcentertsx)
