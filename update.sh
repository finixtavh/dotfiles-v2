#!/usr/bin/env bash
# =============================================================================
#  dotfiles-v2 updater — sincroniza configs locales con el repo
#  Usage: bash update.sh
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'
R='\033[0;31m'; C='\033[0;36m'; N='\033[0m'; BOLD='\033[1m'

info()   { echo -e "${B}[INFO]${N}  $*"; }
ok()     { echo -e "${G}[ OK ]${N}  $*"; }
warn()   { echo -e "${Y}[WARN]${N}  $*"; }
err()    { echo -e "${R}[ERR ]${N}  $*" >&2; }
header() { echo -e "\n${BOLD}${C}━━━  $*  ━━━${N}"; }

DOTFILES="$HOME/.dotfiles-v2"
CFG="$HOME/.config"

[[ $EUID -eq 0 ]] && { err "No ejecutar como root."; exit 1; }
[[ ! -d "$DOTFILES/.git" ]] && { err "Repo no encontrado en $DOTFILES. Ejecuta install.sh primero."; exit 1; }

# Backup + copy (igual que install.sh)
bak_cp() {
    local src="$1" dst="$2"
    [[ ! -e "$src" ]] && { warn "No encontrado en repo: $src"; return 0; }
    if [[ -e "$dst" || -L "$dst" ]]; then
        rm -rf "$dst.bak"
        [[ -L "$dst" ]] && rm "$dst" || mv "$dst" "$dst.bak"
    fi
    mkdir -p "$(dirname "$dst")"
    cp -r "$src" "$dst"
    ok "  $dst"
}

# ── Paso 1: git pull ──────────────────────────────────────────────────────────
header "Paso 1 — git pull"

cd "$DOTFILES"
BEFORE=$(git rev-parse HEAD)
git pull --ff-only
AFTER=$(git rev-parse HEAD)

if [[ "$BEFORE" == "$AFTER" ]]; then
    echo -e "  ${Y}Ya está al día. Nada que actualizar.${N}"
    exit 0
fi

echo ""
info "Cambios desde el commit anterior:"
git log --oneline "$BEFORE..$AFTER"
echo ""

# ── Paso 2: detectar qué directorios cambiaron ────────────────────────────────
header "Paso 2 — Detectar cambios"

CHANGED_DIRS=$(git diff --name-only "$BEFORE" "$AFTER" \
    | cut -d/ -f1 \
    | sort -u)

info "Directorios modificados: $(echo $CHANGED_DIRS | tr '\n' ' ')"

# ── Paso 3: sincronizar solo lo que cambió ────────────────────────────────────
header "Paso 3 — Sincronizar configs"

declare -A DIR_MAP=(
    [ags]="$CFG/ags"
    [hypr]="$CFG/hypr"
    [rofi]="$CFG/rofi"
    [wallman]="$CFG/wallman"
    [kitty]="$CFG/kitty"
    [dunst]="$CFG/dunst"
    [gtk-3.0]="$CFG/gtk-3.0"
    [gtk-4.0]="$CFG/gtk-4.0"
    [Kvantum]="$CFG/Kvantum"
)

UPDATED=0
for dir in $CHANGED_DIRS; do
    dst="${DIR_MAP[$dir]:-}"
    [[ -z "$dst" ]] && continue
    [[ ! -d "$DOTFILES/$dir" ]] && continue
    bak_cp "$DOTFILES/$dir" "$dst"
    UPDATED=1
done

if [[ $UPDATED -eq 0 ]]; then
    warn "Ningún directorio de config reconocido fue modificado."
fi

# ── Paso 4: permisos de scripts ───────────────────────────────────────────────
if echo "$CHANGED_DIRS" | grep -q '^hypr$'; then
    find "$CFG/hypr/scripts" -name '*.sh' -exec chmod +x {} \; 2>/dev/null && \
        ok "  hypr/scripts — chmod +x"
fi
if echo "$CHANGED_DIRS" | grep -q '^wallman$'; then
    [[ -f "$CFG/wallman/wallpicker.sh" ]] && chmod +x "$CFG/wallman/wallpicker.sh"
    [[ -f "$CFG/wallman/restore.sh"    ]] && chmod +x "$CFG/wallman/restore.sh"
fi

# ── Paso 5: npm install si cambió package.json ────────────────────────────────
if echo "$CHANGED_DIRS" | grep -q '^ags$'; then
    if git diff --name-only "$BEFORE" "$AFTER" | grep -q '^ags/package.json$'; then
        header "Paso 5 — npm install (package.json cambió)"
        (cd "$CFG/ags" && npm install) && ok "npm install"
    fi
fi

# ── Listo ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${G}╔══════════════════════════════════════════════╗"
echo -e "║          Dotfiles actualizados!             ║"
echo -e "╚══════════════════════════════════════════════╝${N}"
echo ""
echo -e "  Commit: ${C}$(git -C "$DOTFILES" rev-parse --short HEAD)${N} — $(git -C "$DOTFILES" log -1 --format='%s')"
echo ""
echo -e "  ${Y}Reinicia AGS para aplicar cambios:${N}"
echo -e "  ${C}ags quit -i ags-bar; sleep 0.3; nohup ags run ~/.config/ags/app.ts -i ags-bar >/dev/null 2>&1 &${N}"
echo ""
