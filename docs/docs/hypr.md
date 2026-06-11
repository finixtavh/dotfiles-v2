# Hyprland

## Índice

1. [Resumen](#resumen)
2. [Archivos](#archivos)
3. [hyprland.lua — Configuración principal](#hyprlandlua--configuración-principal)
4. [keybinds.lua — Atajos de teclado](#keybindslua--atajos-de-teclado)
5. [animations.lua](#animationslua)
6. [rules.lua](#ruleslua)
7. [Scripts](#scripts)
8. [Notas y recursos](#notas-y-recursos)

---

## Resumen

El directorio `~/.config/hypr/` contiene la configuración completa del compositor **Hyprland** (v0.55+). Hyprland usa una API Lua para la configuración, lo que permite lógica programática (bucles, funciones, condiciones) en lugar de un formato de configuración estático.

La configuración está dividida en varios archivos Lua para mantenerla organizada.

---

## Archivos

| Archivo | Propósito |
|---------|-----------|
| `hyprland.lua` | Configuración principal — monitor, apariencia, reglas generales |
| `keybinds.lua` | Todos los atajos de teclado |
| `animations.lua` | Definición de animaciones de ventanas |
| `rules.lua` | Reglas de ventanas (float, tamaño, workspace) |
| `menu.conf` | Configuración auxiliar (contextual) |
| `scripts/` | Scripts de shell invocados por los keybinds |

---

## hyprland.lua — Configuración principal

### Variables globales

```lua
local mainMod = "SUPER"
```

### Sección `general`

Controla el comportamiento básico del compositor:

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| `gaps_in` | `4` | Espacio entre ventanas (px) |
| `gaps_out` | `8` | Espacio entre ventanas y borde de pantalla (px) |
| `border_size` | `2` | Grosor del borde de ventanas (px) |
| `resize_on_border` | `true` | Permite redimensionar arrastrando el borde |
| `allow_tearing` | `true` | Permite tearing para menor latencia en juegos |
| `layout` | `dwindle` | Layout de ventanas por defecto |

### Colores de borde

```lua
active_border   = { colors = {"rgba(89b19eee)", "rgba(33473dee)"}, angle = 45 }
inactive_border = "rgba(2a2a2a00)"
```

El borde activo usa un gradiente de 45° con los colores `$accent` (#89B19E) → `$primary` (#33473D) de la paleta del sistema.

### `exec-once`

Comandos que se ejecutan **una sola vez** al iniciar Hyprland:

```lua
-- Ejemplos típicos
exec-once = ags run ~/.config/ags/app.ts -i ags-bar
exec-once = bash ~/.config/wallman/restore.sh
exec-once = /usr/lib/polkit-kde-authentication-agent-1
exec-once = wl-paste --type text --watch cliphist store
```

---

## keybinds.lua — Atajos de teclado

Todos los atajos usan la función `hl.bind(combo, action, opts?)`.

### Aplicaciones

| Atajo | Acción |
|-------|--------|
| `SUPER + Return` | Kitty (terminal) |
| `SUPER + T` | Kitty (terminal) |
| `CTRL+ALT + T` | Kitty (terminal) |
| `SUPER + E` | Dolphin (explorador de archivos) |
| `SUPER + W` | Firefox |
| `SUPER + C` | Command Center (AGS) |
| `SUPER + X` | Kate (editor de texto) |
| `SUPER + I` | gnome-control-center |
| `CTRL+SHIFT + Escape` | gnome-system-monitor |

### Lanzador

| Atajo | Acción |
|-------|--------|
| `SUPER + SUPER_L` (soltar) | Rofi (drun) — toggle |
| `Super_L` (soltar) | rofi-toggle.sh |

### Ventanas

| Atajo | Acción |
|-------|--------|
| `SUPER + Q` | Cerrar ventana activa |
| `ALT + F4` | Cerrar ventana activa |
| `SUPER+SHIFT+ALT + Q` | `hyprctl kill` (selector de ventana) |
| `SUPER+ALT + Space` | Flotar/desflotar ventana |
| `SUPER + D` | Maximizar (toggle) |
| `SUPER + F` | Pantalla completa (toggle) |
| `SUPER + P` | Pin (mantener en todos los workspaces) |

### Foco y movimiento

| Atajo | Acción |
|-------|--------|
| `SUPER + ←/→/↑/↓` | Mover foco |
| `SUPER+SHIFT + ←/→/↑/↓` | Mover ventana |
| `SUPER + Tab` | Siguiente ventana |

### Workspaces

| Atajo | Acción |
|-------|--------|
| `SUPER + 1-9` | Ir a workspace 1-9 |
| `SUPER + 0` | Ir a workspace 10 |
| `SUPER+SHIFT + 1-9` | Mover ventana a workspace 1-9 |
| `SUPER+ALT + 1-9` | Mover ventana sin seguir |
| `CTRL+SUPER + ←/→` | Workspace anterior/siguiente |
| `SUPER + S` | Scratchpad (toggle) |

### Multimedia

| Atajo | Acción |
|-------|--------|
| `XF86AudioRaiseVolume` | Volumen +5% |
| `XF86AudioLowerVolume` | Volumen -5% |
| `XF86AudioMute` | Silenciar altavoz |
| `XF86AudioMicMute` | Silenciar micrófono |
| `SUPER+SHIFT + M` | Silenciar altavoz |
| `SUPER+ALT + M` | Silenciar micrófono |
| `XF86MonBrightnessUp/Down` | Brillo +/-5% |
| `SUPER+SHIFT + N/B/P` | Siguiente / anterior / play-pause |

### Herramientas

| Atajo | Acción |
|-------|--------|
| `SUPER+SHIFT + S` | Captura de región |
| `Print` | Captura de pantalla completa |
| `CTRL + Print` | Guardar captura |
| `SUPER+SHIFT + C` | Color picker (hyprpicker) |
| `SUPER + V` | Historial del portapapeles |
| `SUPER + Period` | Selector de emojis |
| `SUPER + N` | Última notificación |
| `SUPER + '` | Visor de keybinds (AGS) |

### Sesión

| Atajo | Acción |
|-------|--------|
| `SUPER + L` | Bloquear pantalla (hyprlock) |
| `SUPER+SHIFT + L` | Suspender |
| `CTRL+ALT + Delete` | Menú de sesión (AGS PowerMenu) |
| `XF86PowerOff` | Menú de sesión (AGS PowerMenu) |

> **Nota**: El botón de encendido físico está configurado para NO apagar directamente. Ver [systemd-logind](#systemd-logind).

### systemd-logind

Para evitar que el botón físico de encendido apague el equipo independientemente de AGS:

```ini
# /etc/systemd/logind.conf.d/10-power-key.conf
[Login]
HandlePowerKey=ignore
```

Sin esta configuración, logind apaga el equipo **y** AGS muestra el menú de sesión simultáneamente.

---

## animations.lua

Define las animaciones de apertura, cierre y movimiento de ventanas. Usa el sistema de curvas de bezier de Hyprland.

---

## rules.lua

Define reglas que se aplican automáticamente a ventanas según su clase o título:

- Ventanas flotantes por defecto (ej. diálogos de archivo, pavucontrol).
- Asignación automática a workspaces.
- Tamaño y posición inicial.

---

## Scripts

Todos los scripts se encuentran en `~/.config/hypr/scripts/` y son ejecutables.

### `screenshot.sh`

Captura de pantalla usando **grim** (captura Wayland) y **slurp** (selección de región).

| Argumento | Acción |
|-----------|--------|
| `region` | Seleccionar región con slurp, guardar y copiar al portapapeles |
| `screen` | Pantalla completa, guardar y copiar |
| `save` | Guardar en `~/Pictures/Screenshots/` |

Las capturas se guardan en `~/Pictures/Screenshots/Screenshot_YYYY-MM-DD_HH.MM.SS.png` y se notifican via `notify-send`.

---

### `clipboard.sh`

Historial del portapapeles usando **cliphist** y **rofi**.

1. Lista el historial con `cliphist list`.
2. Muestra en rofi con búsqueda (`-i`).
3. Decodifica la entrada seleccionada con `cliphist decode` y la copia con `wl-copy`.

> Requiere que el daemon `wl-paste --type text --watch cliphist store` esté corriendo (típicamente en `exec-once`).

---

### `emoji.sh`

Selector de emojis con rofi.

1. Si no existe `~/.config/hypr/scripts/emojis.txt`, lo genera con una lista de emojis comunes.
2. Muestra la lista en rofi.
3. Copia el emoji seleccionado al portapapeles con `wl-copy`.
4. Envía una notificación de confirmación.

---

### `powermenu.sh`

Menú de sesión **alternativo** usando rofi puro (sin AGS). Opciones: Lock, Suspend, Logout, Reboot, Shutdown. Ejecuta los comandos correspondientes de `loginctl`/`systemctl`.

> Este script coexiste con el `PowerMenu.tsx` de AGS. El keybind `SUPER+Escape` apunta a este script; `CTRL+ALT+DEL` usa el de AGS.

---

### `rofi-toggle.sh`

Hace toggle de rofi: si ya está corriendo lo cierra, si no lo abre. Loguea en `/tmp/rofi-debug.log`.

---

### `init-wallpaper.sh`

*(Script de sesión anterior, puede diferir de `wallman/restore.sh`)* Restaura el último fondo guardado en `~/.cache/current_wallpaper` al iniciar sesión. Soporta imágenes (via awww) y videos (via mpvpaper).

---

### `wallpaper.sh`

Selector interactivo de fondos que busca en `~/Pictures/Wallpapers/`. Versión alternativa/anterior de `wallman/wallpicker.sh`.

---

## Notas y recursos

- [Documentación de Hyprland](https://wiki.hyprland.org/)
- [API Lua de Hyprland](https://wiki.hyprland.org/Configuring/Using-hyprctl/)
- [hyprlock — configuración del locker](https://github.com/hyprwm/hyprlock)
- [hyprpicker — selector de color](https://github.com/hyprwm/hyprpicker)
- Para los atajos que abren widgets AGS: ver [AGS Bar](ags.md)
