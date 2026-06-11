# AGS Bar

## Índice

1. [Resumen](#resumen)
2. [Archivos](#archivos)
3. [Constantes y variables globales](#constantes-y-variables-globales)
4. [app.ts — Punto de entrada](#appts--punto-de-entrada)
5. [style.scss — Estilos](#stylescss--estilos)
6. [Bar.tsx — Barra principal](#bartsx--barra-principal)
7. [MusicBar.tsx — Barra de música](#musicbartsx--barra-de-música)
8. [CommandCenter.tsx](#commandcentertsx)
9. [Keybinds.tsx](#keybindstsx)
10. [PowerMenu.tsx](#powermenutsx)
11. [NotificationCenter.tsx](#notificationcentertsx)
12. [OSD.tsx](#osdtsx)
13. [cava.ts — Visualizador de audio](#cavats--visualizador-de-audio)
14. [Notas y recursos](#notas-y-recursos)

---

## Resumen

El directorio `~/.config/ags/` contiene la barra de escritorio construida con **AGS v3 (Aylurs-GTK-Shell)** y el framework **Astal**. Está escrita en TypeScript con sintaxis JSX similar a SolidJS y se compila/ejecuta en tiempo real via el runtime GJS (GNOME JavaScript).

La barra se divide en dos capas visibles:

- **Barra inferior** (`Bar.tsx`): anclada al fondo de la pantalla, siempre visible. Contiene el lanzador de apps, reloj, calendario, taskbar, bandeja del sistema y controles de audio/red/bluetooth.
- **Barra superior de música** (`MusicBar.tsx`): tres píldoras flotantes en la parte superior que muestran info del reproductor actual, el visualizador CAVA y las letras sincronizadas.

---

## Archivos

| Archivo | Propósito |
|---------|-----------|
| `app.ts` | Punto de entrada, monta todas las ventanas |
| `style.scss` | Estilos globales (compilado a CSS por sassc) |
| `widget/Bar.tsx` | Barra inferior principal |
| `widget/MusicBar.tsx` | Barra de música flotante + flyout now-playing |
| `widget/CommandCenter.tsx` | Centro de comandos (SUPER+C) |
| `widget/Keybinds.tsx` | Visor de keybinds (SUPER+') |
| `widget/PowerMenu.tsx` | Menú de sesión (CTRL+ALT+DEL) |
| `widget/NotificationCenter.tsx` | Centro de notificaciones |
| `widget/OSD.tsx` | Indicador on-screen (volumen, brillo) |
| `widget/cava.ts` | Clase del visualizador de audio CAVA |
| `package.json` | Dependencias npm (solo `ags: "*"`) |
| `tsconfig.json` | Configuración de TypeScript |

---

## Constantes y variables globales

### MusicBar.tsx

| Nombre | Valor | Descripción |
|--------|-------|-------------|
| `NO_TRACK` | `'/org/mpris/MediaPlayer2/TrackList/NoTrack'` | ID especial de MPRIS que indica "sin pista" |
| `DECAY_λ` | `0.001` | Factor de decaimiento exponencial para la caché de letras |
| `LYRICS_DIR` | `~/lyrics` | Directorio donde se buscan los archivos `.lyr` |
| `MAX_CACHE` | `200` | Máximo de entradas en la caché de letras en memoria |
| `NUM_BARS` | *(definido en cava.ts)* | Número de barras del visualizador |
| `lyricsIndex` | `Map<string, LyricFile[]>` | Índice en memoria de todos los `.lyr` encontrados |

---

## app.ts — Punto de entrada

Inicializa la aplicación AGS y monta todos los widgets en cada monitor detectado.

### Función `main()`

Se ejecuta al lanzar `ags run ~/.config/ags/app.ts -i ags-bar`.

- Itera sobre los monitores GDK disponibles con `Gdk.Display.get_default().get_monitors()`.
- Por cada monitor crea instancias de: `Bar`, `MusicBar`, `PowerMenu`, `CommandCenter`, `Keybinds`, `NotificationCenter`, `OSD`.
- Registra la app con el identificador `ags-bar` para que `ags toggle -i ags-bar <nombre>` funcione.

---

## style.scss — Estilos

Hoja de estilos SCSS compilada por `sassc`. Define variables de color del sistema y los estilos de todos los widgets.

### Variables de color principales

```scss
$bg-deep:       #050505;   /* Fondo más oscuro */
$bg-glass:      #121212;   /* Fondo de píldoras */
$accent:        #89B19E;   /* Verde claro — color principal */
$primary:       #33473D;   /* Verde oscuro */
$secondary:     #4D6B5C;   /* Verde medio */
$text-primary:  #E8E8E8;
$text-dim:      #7A7A7A;
$border:        #2A2A2A;
$border-bright: #4D6B5C;
```

> Los alias `$purple-light`, `$purple-mid` y `$cyan-accent` apuntan a `$accent`, `$secondary` y `$accent` respectivamente, para mantener compatibilidad con nombres heredados.

---

## Bar.tsx — Barra principal

Ventana GTK anclada a `BOTTOM | LEFT | RIGHT` con exclusividad de espacio (`EXCLUSIVE`), es decir, las ventanas de aplicaciones no se superponen a ella.

### Componentes

#### `Launcher`
Botón con el ícono de Arch Linux. Al hacer clic lanza `rofi -show drun -show-icons`.

#### `ColorPicker`
Botón con ícono de cuentagotas. Ejecuta `hyprpicker -a` (selecciona un color de pantalla y lo copia al portapapeles automáticamente).

#### `Clock`
Muestra la hora actual en formato `HH:MM`. Se actualiza cada segundo. Usa la zona horaria `America/Santiago`.

#### `CalendarWidget`
Muestra la fecha corta (`lun 10 jun`). Al hacer clic abre un popover con un `Gtk.Calendar`. Clic derecho abre `calcure` en una terminal.

#### `VolumeWidget`
Muestra el ícono y porcentaje del volumen del altavoz predeterminado (via WirePlumber/AstalWp). Funciones:
- **Clic izquierdo**: abre `pavucontrol`.
- **Clic derecho**: silencia/desilencia.
- **Scroll**: sube/baja volumen en 5%.

#### `MicWidget`
Igual que `VolumeWidget` pero para el micrófono predeterminado.

#### `NetworkWidget`
Muestra el estado de red (WiFi con intensidad de señal, o Ethernet). Lee `/proc/net/route` para detectar la interfaz activa y `/proc/net/dev` para calcular velocidades de descarga/subida en tiempo real (actualización cada 1.5 s).

#### `BluetoothWidget`
Muestra el estado Bluetooth. Visible solo si hay adaptador disponible. Clic abre `blueman-manager`.

#### `VpnWidget`
Se hace visible automáticamente cuando detecta alguna interfaz VPN activa (`tun0`, `wg0`, `ppp0`, etc.) leyendo `/proc/net/dev`. Se comprueba cada 4 segundos.

#### `NotifBell`
Campana que abre/cierra el `NotificationCenter`.

#### `Taskbar`
Lista de ventanas abiertas en Hyprland (vía `AstalHyprland`). Al hacer clic en una ventana, enfoca su workspace y luego la ventana.

#### `Tray`
Bandeja del sistema con los ítems de `AstalTray`. Filtra automáticamente `nm-applet` y `blueman-applet` (ya representados por `NetworkWidget` y `BluetoothWidget`).

```typescript
const TRAY_HIDDEN = new Set(['nm-applet', 'network-manager-applet', 'blueman', 'blueman-applet'])
```

---

## MusicBar.tsx — Barra de música

Tres ventanas GTK flotantes ancladas a `TOP` que se muestran solo cuando hay un reproductor MPRIS activo.

### Píldoras

| Píldora | Clase CSS | Contenido |
|---------|-----------|-----------|
| Izquierda | `.m-left-pill` | Carátula + título/artista + controles + barra de progreso |
| Centro | `.m-center-pill` | Visualizador de barras CAVA |
| Derecha | `.m-right-pill` | Letras sincronizadas |

### Componentes internos

#### `AlbumArt`
Muestra la carátula del track actual. Usa `GdkPixbuf.Pixbuf.new_from_file_at_scale` para escalar la imagen a 36×36 (en la píldora) ó 128×128 (en el flyout). Se actualiza reactivamente cuando `coverArt` o `artUrl` cambian.

#### `MediaInfo`
Muestra el título y artista del track con texto truncado (`ellipsize`).

#### `MediaControls`
Botones de anterior, play/pause y siguiente. Usan la API de `AstalMpris`.

#### `ProgressBar`
Barra de progreso interactiva (`Gtk.Scale`) con clase `song-seek-scale`. Permite arrastrar para cambiar la posición de la canción. Se actualiza cada 250 ms. Al soltar ejecuta `playerctl position <segundos>`.

#### `LyricsViewer`
Muestra las letras sincronizadas en la píldora derecha. Ver [Letras (.lyr)](lyr.md) para la documentación del sistema de letras.

#### `buildNowPlayingContent(player)`
Construye el flyout "now-playing" completo (carátula grande, título, artista, barra de progreso arrastrable, visualizador CAVA). Se invoca al hacer clic en la píldora izquierda.

- La carátula en el flyout es de **128×128 px**.
- La imagen se actualiza cuando cambia la canción, comparando el path del cover anterior con el nuevo.
- El visualizador en el flyout usa `Gtk.DrawingArea` con Cairo para renderizar las barras.
- El flyout tiene 83 px de margen a cada lado.

#### `openFlyoutWin(gdkmonitor, content)`
Crea la ventana overlay del flyout:
- Capa `OVERLAY`, anclada a `TOP`, sin modo de teclado.
- Después de `show_all()`, usa `GLib.idle_add` para medir el ancho natural del contenido y asignarlo explícitamente con `set_size_request()` (necesario para que Wayland layer-shell respete los márgenes).

#### `ProgressBar` en flyout (progScale)
`Gtk.Scale` con clase `npp-scale`. Igual al de la píldora pero con detección de `button-press-event` / `button-release-event` para seeking preciso.

---

## CommandCenter.tsx

Ventana overlay centrada, activada con **SUPER+C**. Keymode `EXCLUSIVE` (captura todas las teclas). Se cierra con **Escape**.

### Botones disponibles

| Ícono | Acción | Comando |
|-------|--------|---------|
| `󰑓` | Restart Bar | `ags quit -i ags-bar; sleep 0.3; nohup ags run ...` |
| `󰮯` | System Update | `kitty --hold -e sudo pacman -Syyu` |
| `󰸉` | Wallpaper | `bash ~/.config/wallman/wallpicker.sh` |
| `󰅇` | Clipboard | `bash ~/.config/hypr/scripts/clipboard.sh` |
| `󰐥` | Power | `ags toggle -i ags-bar power-menu` |

El título **"COMMAND CENTER"** usa un gradiente de color por carácter generado con markup Pango (`<span foreground="...">`) interpolando de `#89B19E` a `#33473D`.

---

## Keybinds.tsx

Ventana overlay centrada, activada con **SUPER+'**. Muestra:

1. **Keybinds comunes**: tabla de 2 columnas con los atajos más usados (hardcodeados en el array `COMMON`).
2. **Todos los keybinds**: lista filtrable generada parseando `/home/fn-finixtavh/.config/hypr/keybinds.lua` en tiempo real.

### `parseKeybinds()`
Lee `keybinds.lua` línea por línea. Detecta comentarios de sección (`-- ── Sección ──`) como encabezados y extrae llamadas `hl.bind(...)`. Ignora bucles `for`.

### `humanize(cmd)`
Convierte comandos crudos (ej. `ags toggle -i ags-bar command-center`) a nombres amigables (ej. `Command Center`).

---

## PowerMenu.tsx

Menú de sesión, activado con **CTRL+ALT+DEL** o el botón de encendido físico (si está configurado en logind). Opciones: Lock, Suspend, Logout, Reboot, Shutdown.

---

## NotificationCenter.tsx

Panel lateral de notificaciones. Se activa con el botón de campana en la barra inferior o programáticamente via `toggleNotifCenter(gdkmonitor)`.

---

## OSD.tsx

Indicador on-screen que aparece brevemente al cambiar el volumen o brillo. Se posiciona en la parte inferior central de la pantalla.

---

## cava.ts — Visualizador de audio

Clase que lanza CAVA como subproceso y parsea su salida.

### Configuración embebida

```ini
[general]
bars = 20
[input]
method = pipewire
source = auto
[output]
method = raw
raw_target = /dev/stdout
data_format = ascii
ascii_max_range = 255
```

> **Importante**: `method=pipewire` es necesario en sistemas con PipeWire puro. Sin esta línea CAVA intenta usar ALSA/PulseAudio y no recibe audio.

### Propiedad `bars`
Array de números 0–255 representando la amplitud de cada banda de frecuencia. Se actualiza en cada frame de CAVA.

---

## Notas y recursos

- [Documentación oficial de AGS v3 (Astal)](https://aylur.github.io/astal/)
- [GJS Documentation](https://gjs-docs.gnome.org/)
- [Referencia GTK3](https://docs.gtk.org/gtk3/)
- [AstalMpris — MPRIS2 bindings](https://aylur.github.io/astal/guide/libraries/mpris)
- Para el formato de archivos de letra: ver [Letras (.lyr)](lyr.md)
