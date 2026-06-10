#!/usr/bin/env bash
# =============================================================================
#  dotfiles-v2 installer — Hyprland + AGS v3 (Astal) — Arch Linux
#  Usage: bash install.sh
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

# ── Colors ────────────────────────────────────────────────────────────────────
R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'
B='\033[0;34m'; C='\033[0;36m'; N='\033[0m'; BOLD='\033[1m'

info()   { echo -e "${B}[INFO]${N}  $*"; }
ok()     { echo -e "${G}[ OK ]${N}  $*"; }
warn()   { echo -e "${Y}[WARN]${N}  $*"; }
err()    { echo -e "${R}[ERR ]${N}  $*" >&2; }
header() { echo -e "\n${BOLD}${C}━━━  $*  ━━━${N}"; }
step()   { echo -e "${BOLD}  ▸ $*${N}"; }

# ── Paths ─────────────────────────────────────────────────────────────────────
REPO_URL="https://github.com/finixtavh/dotfiles-v2"
DOTFILES="$HOME/.dotfiles-v2"
CFG="$HOME/.config"

# ── Safety ────────────────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] && { err "Run as your normal user, not root."; exit 1; }
[[ "$(uname -s)" != "Linux" ]] && { err "Arch Linux only."; exit 1; }
command -v pacman &>/dev/null || { err "pacman not found — this script requires Arch Linux."; exit 1; }

# ── Helpers ───────────────────────────────────────────────────────────────────

# Backup dst if exists, then copy src → dst
bak_cp() {
    local src="$1" dst="$2"
    if [[ -e "$dst" || -L "$dst" ]]; then
        step "Backup  $dst  →  $dst.bak"
        [[ -L "$dst" ]] && rm "$dst" || cp -r "$dst" "$dst.bak"
    fi
    mkdir -p "$(dirname "$dst")"
    cp -r "$src" "$dst"
    ok "Installed  $dst"
}

pkg_installed() { pacman -Qi "$1" &>/dev/null; }

install_pacman() {
    local needed=()
    for p in "$@"; do pkg_installed "$p" || needed+=("$p"); done
    [[ ${#needed[@]} -eq 0 ]] && return 0
    info "pacman -S: ${needed[*]}"
    sudo pacman -S --needed --noconfirm "${needed[@]}"
}

install_aur() {
    local needed=()
    for p in "$@"; do pkg_installed "$p" || needed+=("$p"); done
    [[ ${#needed[@]} -eq 0 ]] && return 0
    info "yay -S: ${needed[*]}"
    yay -S --needed --noconfirm "${needed[@]}"
}

# ── Step 1: yay ───────────────────────────────────────────────────────────────
install_yay() {
    header "Step 1 — yay (AUR helper)"
    if command -v yay &>/dev/null; then
        ok "yay already installed ($(yay --version | head -1))"
        return 0
    fi
    info "Installing yay from AUR..."
    install_pacman git base-devel
    local tmp; tmp=$(mktemp -d)
    trap "rm -rf '$tmp'" EXIT
    git clone --depth=1 https://aur.archlinux.org/yay.git "$tmp/yay"
    (cd "$tmp/yay" && makepkg -si --noconfirm)
    trap - EXIT
    rm -rf "$tmp"
    ok "yay installed"
}

# ── Step 2: System dependencies ───────────────────────────────────────────────
install_deps() {
    header "Step 2 — System packages (pacman)"

    install_pacman \
        base-devel git curl wget \
        \
        hyprland xdg-desktop-portal-hyprland \
        \
        pipewire pipewire-alsa pipewire-pulse wireplumber \
        gst-plugin-pipewire \
        \
        playerctl brightnessctl \
        \
        grim slurp wl-clipboard \
        \
        kitty \
        dolphin \
        firefox \
        kate \
        \
        dunst libnotify \
        \
        cava \
        mpv \
        \
        gjs gtk3 gtk-layer-shell \
        sassc \
        nodejs npm \
        \
        xdg-user-dirs \
        \
        ttf-font-awesome \
        noto-fonts noto-fonts-emoji \
        noto-fonts-cjk \
        \
        polkit-kde-agent \
        gnome-system-monitor \
        gnome-control-center

    header "Step 2b — AUR packages (yay)"

    install_aur \
        hyprlock \
        hyprpicker \
        rofi-lbonn-wayland-git \
        mpvpaper \
        swww \
        ags \
        nerd-fonts-noto-sans-mono

    ok "All dependencies installed"
}

# ── Step 3: Clone dotfiles ────────────────────────────────────────────────────
clone_dotfiles() {
    header "Step 3 — Clone dotfiles"
    if [[ -d "$DOTFILES/.git" ]]; then
        info "Repo already exists, pulling latest..."
        git -C "$DOTFILES" pull --ff-only
    else
        git clone "$REPO_URL" "$DOTFILES"
    fi
    ok "Dotfiles at $DOTFILES"
}

# ── Step 4: Install configs ───────────────────────────────────────────────────
install_configs() {
    header "Step 4 — Install config files"

    # Directories to install: repo-relative → system path
    local -A dirs=(
        [ags]="$CFG/ags"
        [hypr]="$CFG/hypr"
        [rofi]="$CFG/rofi"
        [wallman]="$CFG/wallman"
    )

    for rel in "${!dirs[@]}"; do
        local src="$DOTFILES/$rel"
        local dst="${dirs[$rel]}"
        if [[ ! -d "$src" ]]; then
            warn "Skipping $rel (not found in repo)"
            continue
        fi
        bak_cp "$src" "$dst"
    done

    # Optional configs (only install if present in repo)
    local -A optional_dirs=(
        [kitty]="$CFG/kitty"
        [dunst]="$CFG/dunst"
        [gtk-3.0]="$CFG/gtk-3.0"
        [gtk-4.0]="$CFG/gtk-4.0"
        [Kvantum]="$CFG/Kvantum"
    )
    for rel in "${!optional_dirs[@]}"; do
        local src="$DOTFILES/$rel"
        local dst="${optional_dirs[$rel]}"
        [[ -d "$src" ]] && bak_cp "$src" "$dst"
    done

    # Make all scripts executable
    find "$CFG/hypr/scripts" -name '*.sh' -exec chmod +x {} \; 2>/dev/null && \
        ok "hypr/scripts — chmod +x" || true
    [[ -f "$CFG/wallman/wallpicker.sh" ]] && \
        chmod +x "$CFG/wallman/wallpicker.sh" && ok "wallpicker.sh — chmod +x"
    [[ -f "$CFG/wallman/restore.sh" ]] && \
        chmod +x "$CFG/wallman/restore.sh"  && ok "restore.sh — chmod +x"

    # Create wallpapers dir (not tracked in git)
    mkdir -p "$CFG/wallman/wallpapers"
    ok "wallman/wallpapers/ ready (add your images here)"
}

# ── Step 5: AGS npm dependencies ─────────────────────────────────────────────
install_ags_deps() {
    header "Step 5 — AGS npm dependencies"
    if [[ -f "$CFG/ags/package.json" ]]; then
        (cd "$CFG/ags" && npm install)
        ok "npm install done"
    else
        warn "No package.json in ~/.config/ags — skipping"
    fi
}

# ── Step 6: systemd-logind — disable hardware power key shutdown ──────────────
configure_logind() {
    header "Step 6 — systemd-logind power key"
    local dir="/etc/systemd/logind.conf.d"
    local file="$dir/10-power-key.conf"
    if [[ -f "$file" ]]; then
        ok "Power key config already present"
        return 0
    fi
    info "Setting HandlePowerKey=ignore (prevents double-shutdown with AGS power menu)"
    sudo mkdir -p "$dir"
    printf '[Login]\nHandlePowerKey=ignore\n' | sudo tee "$file" > /dev/null
    sudo systemctl restart systemd-logind
    ok "HandlePowerKey=ignore set"
}

# ── Step 7: Enable user services ──────────────────────────────────────────────
enable_services() {
    header "Step 7 — User systemd services"
    for svc in pipewire pipewire-pulse wireplumber; do
        if systemctl --user is-enabled "$svc" &>/dev/null; then
            ok "$svc already enabled"
        else
            systemctl --user enable --now "$svc"
            ok "$svc enabled + started"
        fi
    done
}

# ── Done ──────────────────────────────────────────────────────────────────────
print_done() {
    echo ""
    echo -e "${BOLD}${G}╔══════════════════════════════════════════════╗"
    echo -e "║         Installation complete!              ║"
    echo -e "╚══════════════════════════════════════════════╝${N}"
    echo ""
    echo -e "${BOLD}Next steps:${N}"
    echo -e "  1. ${Y}Reboot${N} (recommended) or re-login"
    echo -e "  2. Start Hyprland from your display manager or TTY"
    echo -e "  3. AGS bar starts automatically via hyprland.conf exec-once"
    echo -e "     (if not: ${C}ags run ~/.config/ags/app.ts -i ags-bar${N})"
    echo -e "  4. Add wallpapers to ${C}~/.config/wallman/wallpapers/${N}"
    echo -e "     then: ${C}SUPER+W${N}  or  ${C}bash ~/.config/wallman/wallpicker.sh${N}"
    echo ""
    echo -e "${Y}Note:${N} The ${C}awww${N} wallpaper daemon used in wallpicker.sh"
    echo -e "      may need to be installed separately if not found."
    echo -e "      Equivalent: ${C}swww${N} (already installed above)."
    echo -e "      If your wallpicker uses ${C}awww${N}, check AUR for 'awww'."
    echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
    clear
    echo -e "${BOLD}${C}"
    echo "  ██████╗  ██████╗ ████████╗███████╗██╗██╗     ███████╗███████╗"
    echo "  ██╔══██╗██╔═══██╗╚══██╔══╝██╔════╝██║██║     ██╔════╝██╔════╝"
    echo "  ██║  ██║██║   ██║   ██║   █████╗  ██║██║     █████╗  ███████╗"
    echo "  ██║  ██║██║   ██║   ██║   ██╔══╝  ██║██║     ██╔══╝  ╚════██║"
    echo "  ██████╔╝╚██████╔╝   ██║   ██║     ██║███████╗███████╗███████║"
    echo "  ╚═════╝  ╚═════╝    ╚═╝   ╚═╝     ╚═╝╚══════╝╚══════╝╚══════╝"
    echo -e "                   ${Y}Hyprland + AGS v3 setup${C}"
    echo -e "               by finixtavh — github.com/finixtavh/dotfiles-v2"
    echo -e "${N}"
    echo -e "  ${Y}WARNING:${N} Existing configs will be backed up as ${C}*.bak${N}"
    echo ""
    read -rp "  Press Enter to continue, or Ctrl+C to cancel... "

    install_yay
    install_deps
    clone_dotfiles
    install_configs
    install_ags_deps
    configure_logind
    enable_services
    print_done
}

main "$@"
