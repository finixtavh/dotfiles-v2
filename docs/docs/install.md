# Instalación

## Índice

1. [Resumen](#resumen)
2. [Requisitos](#requisitos)
3. [Variables del script](#variables-del-script)
4. [Uso](#uso)
5. [Pasos del instalador](#pasos-del-instalador)
6. [Comportamiento de backups](#comportamiento-de-backups)
7. [Estructura del repositorio](#estructura-del-repositorio)
8. [Post-instalación](#post-instalación)
9. [Notas y recursos](#notas-y-recursos)

---

## Resumen

`install.sh` es el script de instalación automática de los dotfiles. Detecta qué paquetes faltan, instala dependencias del sistema, clona el repositorio y copia los archivos de configuración al lugar correcto. Antes de sobreescribir cualquier archivo existente, crea una copia de seguridad con extensión `.bak`.

Diseñado exclusivamente para **Arch Linux**. Requiere conexión a internet.

---

## Requisitos

- Arch Linux instalado y con usuario normal (no root)
- Conexión a internet
- `git` y `base-devel` (el script los instala si faltan)

---

## Variables del script

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `REPO_URL` | `https://github.com/finixtavh/dotfiles-v2` | URL del repositorio a clonar |
| `DOTFILES` | `~/.dotfiles-v2` | Directorio local donde se clona el repo |
| `CFG` | `~/.config` | Directorio de configuración del usuario |

---

## Uso

```bash
bash install.sh
```

!!! warning "No ejecutar como root"
    El script detecta si se ejecuta como root y termina con error. Ejecútalo con tu usuario normal; usará `sudo` internamente cuando sea necesario.

El instalador muestra un aviso y pide confirmación con Enter antes de proceder. Puedes cancelar con `Ctrl+C`.

---

## Pasos del instalador

### Paso 1 — yay (AUR helper)

Comprueba si `yay` está instalado. Si no:

1. Instala `git` y `base-devel` via pacman.
2. Clona `https://aur.archlinux.org/yay.git` en un directorio temporal.
3. Compila e instala con `makepkg -si --noconfirm`.
4. Elimina el directorio temporal.

### Paso 2 — Paquetes del sistema (pacman)

Instala los paquetes necesarios **solo si no están ya instalados** (usa `pacman -Qi` para verificar).

**Paquetes pacman:**

| Categoría | Paquetes |
|-----------|---------|
| Base | `base-devel`, `git`, `curl`, `wget` |
| Compositor | `hyprland`, `xdg-desktop-portal-hyprland` |
| Audio | `pipewire`, `pipewire-alsa`, `pipewire-pulse`, `wireplumber`, `gst-plugin-pipewire` |
| Media | `playerctl`, `brightnessctl` |
| Pantalla | `grim`, `slurp`, `wl-clipboard` |
| Aplicaciones | `kitty`, `dolphin`, `firefox`, `kate` |
| Notificaciones | `dunst`, `libnotify` |
| Audio visual | `cava`, `mpv` |
| GTK/GJS | `gjs`, `gtk3`, `gtk-layer-shell`, `gobject-introspection`, `sassc` |
| Node | `nodejs`, `npm` |
| Fuentes | `ttf-font-awesome`, `noto-fonts`, `noto-fonts-emoji`, `noto-fonts-cjk` |
| Sistema | `xdg-user-dirs`, `polkit-kde-agent` |
| Utilidades | `gnome-system-monitor`, `gnome-control-center`, `pavucontrol`, `blueman` |

**Paquetes AUR (via yay):**

| Paquete | Descripción |
|---------|-------------|
| `aylurs-gtk-shell` | **AGS v3 (Astal)** — la barra |
| `hyprlock` | Pantalla de bloqueo |
| `hyprpicker` | Selector de color |
| `rofi-lbonn-wayland-git` | Lanzador de aplicaciones (Wayland) |
| `mpvpaper` | Fondos de video |
| `swww` | Fondos de imagen animados |
| `nerd-fonts-noto-sans-mono` | Fuente con íconos |

!!! important "Nombre correcto de AGS"
    El paquete AGS v3 en AUR se llama `aylurs-gtk-shell`, **no** `ags`. El paquete `ags` en AUR es "Adventure Game System", una aplicación completamente diferente.

### Paso 3 — Clonar dotfiles

```bash
git clone https://github.com/finixtavh/dotfiles-v2 ~/.dotfiles-v2
```

Si el repositorio ya existe en `~/.dotfiles-v2`, hace `git pull --ff-only` en vez de clonar.

### Paso 4 — Instalar configuraciones

Copia los directorios del repo a `~/.config/`:

**Directorios obligatorios** (avisa si no están en el repo):
- `ags/` → `~/.config/ags/`
- `hypr/` → `~/.config/hypr/`
- `rofi/` → `~/.config/rofi/`
- `wallman/` → `~/.config/wallman/`

**Directorios opcionales** (solo se copian si existen en el repo):
- `kitty/` → `~/.config/kitty/`
- `dunst/` → `~/.config/dunst/`
- `gtk-3.0/` → `~/.config/gtk-3.0/`
- `gtk-4.0/` → `~/.config/gtk-4.0/`
- `Kvantum/` → `~/.config/Kvantum/`

Después de copiar:
- Aplica `chmod +x` a todos los `.sh` en `hypr/scripts/`.
- Crea `~/.config/wallman/wallpapers/` si no existe.

### Paso 5 — npm install (AGS)

Si existe `~/.config/ags/package.json`, ejecuta `npm install` dentro del directorio para instalar las dependencias del proyecto AGS.

### Paso 6 — systemd-logind

Crea `/etc/systemd/logind.conf.d/10-power-key.conf` con:

```ini
[Login]
HandlePowerKey=ignore
```

Esto evita que el botón físico de encendido apague el equipo directamente, dejando que AGS PowerMenu tome el control. Reinicia `systemd-logind` para aplicar.

Si el archivo ya existe, omite este paso.

### Paso 7 — Servicios de usuario

Habilita e inicia los servicios de audio PipeWire para el usuario actual:

```bash
systemctl --user enable --now pipewire
systemctl --user enable --now pipewire-pulse
systemctl --user enable --now wireplumber
```

---

## Comportamiento de backups

La función `bak_cp` maneja cada directorio de configuración:

1. Si el destino **ya existe**: lo mueve a `destino.bak` (sobrescribiendo cualquier `.bak` anterior con `rm -rf`).
2. Si el destino es un **symlink**: lo elimina sin hacer backup.
3. Crea el directorio padre si no existe.
4. Copia el origen al destino con `cp -r`.

```
~/.config/ags/      → se mueve a ~/.config/ags.bak
~/.config/ags.bak   → se elimina (si existía de antes)
~/.dotfiles-v2/ags/ → se copia a ~/.config/ags/
```

!!! tip "Recuperar configuración anterior"
    Si algo sale mal, tus configuraciones originales están en `~/.config/<nombre>.bak`.

---

## Estructura del repositorio

El script espera esta estructura en el repositorio:

```
dotfiles-v2/
├── install.sh
├── ags/                  ← ~/.config/ags/
├── hypr/                 ← ~/.config/hypr/
│   ├── hyprland.lua
│   ├── keybinds.lua
│   ├── animations.lua
│   ├── rules.lua
│   └── scripts/
├── rofi/                 ← ~/.config/rofi/
├── wallman/              ← ~/.config/wallman/
│   ├── wallpicker.sh
│   └── restore.sh
│   # wallpapers/ NO incluido (.gitignore)
└── (opcional: kitty/, dunst/, gtk-3.0/, etc.)
```

---

## Post-instalación

Después de que el script termine:

1. **Reiniciar** el equipo (recomendado) o cerrar sesión.
2. Iniciar **Hyprland** desde el display manager o TTY (`Hyprland`).
3. La barra AGS debería arrancar automáticamente via `exec-once` en `hyprland.lua`.
   - Si no arranca: `ags run ~/.config/ags/app.ts -i ags-bar`
4. Añadir fondos a `~/.config/wallman/wallpapers/`.
5. Abrir el wallpicker: `bash ~/.config/wallman/wallpicker.sh` o **SUPER+W**.

---

## Notas y recursos

- [Arch Wiki — Instalación](https://wiki.archlinux.org/title/Installation_guide)
- [yay — AUR Helper](https://github.com/Jguer/yay)
- [AGS v3 / Aylurs-GTK-Shell](https://github.com/Aylur/ags)
- [Hyprland — primeros pasos](https://wiki.hyprland.org/Getting-Started/Installation/)

!!! note "awww vs swww"
    El script instala `swww` (paquete AUR). Los scripts de wallman usan el binario `awww`. Si en tu sistema el binario es `swww`, necesitarás ajustar `wallpicker.sh` y `restore.sh` reemplazando `awww` por `swww`.
