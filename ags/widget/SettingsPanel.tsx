import app from "ags/gtk3/app"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import GLib from "gi://GLib"
import { restartCavaWithHz, GDK_HZ } from "./cava"
import { YTDLP_AVAILABLE } from "./YtDlp"
import { clearRecent, clearListened } from "./ListenHistory"

const SETTINGS_FILE = `${GLib.get_home_dir()}/.config/ags/user-settings.json`

export function loadSettings(): Record<string, any> {
  try {
    const [ok, raw] = GLib.file_get_contents(SETTINGS_FILE)
    if (ok) return JSON.parse(new TextDecoder().decode(raw))
  } catch (_) {}
  return {}
}

function saveSettings(updates: Record<string, any>) {
  try {
    const cur = loadSettings()
    GLib.file_set_contents(SETTINGS_FILE, JSON.stringify({ ...cur, ...updates }, null, 2))
  } catch (_) {}
}

// ── Build CAVA page ──────────────────────────────────────────────────────────
function buildCavaPage(close: () => void): Gtk.Box {
  const page = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 14, visible: true })
  page.get_style_context().add_class('settings-page')

  const settings = loadSettings()
  const initAuto = settings.cavaAutoHz !== false
  const initHz   = typeof settings.cavaManualHz === 'number' ? settings.cavaManualHz : GDK_HZ

  const sectionLbl = new Gtk.Label({ label: 'REFRESH RATE', visible: true, xalign: 0 })
  sectionLbl.get_style_context().add_class('settings-section')
  page.add(sectionLbl)

  const autoRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 12, visible: true })
  const autoLbl = new Gtk.Label({ label: 'Auto-detect Hz from monitor', visible: true, xalign: 0 })
  autoLbl.get_style_context().add_class('settings-label')
  autoLbl.set_hexpand(true)
  autoRow.add(autoLbl)
  const autoSwitch = new Gtk.Switch({ visible: true })
  autoSwitch.set_active(initAuto)
  autoRow.add(autoSwitch)
  page.add(autoRow)

  const detectedLbl = new Gtk.Label({ label: `Detected: ${GDK_HZ} Hz`, visible: true, xalign: 0 })
  detectedLbl.get_style_context().add_class('settings-hint')
  page.add(detectedLbl)

  const manualRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 12, visible: true })
  const manualLbl = new Gtk.Label({ label: 'Manual refresh rate (Hz)', visible: true, xalign: 0 })
  manualLbl.get_style_context().add_class('settings-label')
  manualLbl.set_hexpand(true)
  manualRow.add(manualLbl)
  const adj  = new Gtk.Adjustment({ lower: 1, upper: 999, step_increment: 1, page_increment: 10, value: initHz })
  const spin = new (Gtk as any).SpinButton({ adjustment: adj, digits: 0, numeric: true, visible: true })
  spin.set_sensitive(!initAuto)
  manualRow.add(spin)
  page.add(manualRow)

  autoSwitch.connect('state-set', (_sw: any, state: boolean) => {
    spin.set_sensitive(!state)
    saveSettings({ cavaAutoHz: state })
    return false
  })

  page.add(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL, visible: true }))

  const applyBtn = new Gtk.Button({ label: '  Apply & Restart CAVA', visible: true })
  applyBtn.get_style_context().add_class('settings-apply-btn')
  applyBtn.connect('clicked', () => {
    const isAuto  = autoSwitch.get_active()
    const manualV = Math.round(adj.get_value())
    const hz      = isAuto ? GDK_HZ : manualV
    saveSettings({ cavaAutoHz: isAuto, cavaManualHz: manualV })
    restartCavaWithHz(hz)
    close()
  })
  page.add(applyBtn)

  const hintLbl = new Gtk.Label({ label: 'Frame interval applies on next AGS restart', visible: true })
  hintLbl.get_style_context().add_class('settings-hint')
  page.add(hintLbl)

  return page
}

// ── Build YT-DLP page ────────────────────────────────────────────────────────
function buildYtdlpPage(): Gtk.Box {
  const page = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 14, visible: true })
  page.get_style_context().add_class('settings-page')

  // Detection status
  const statusRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8, visible: true })
  const statusIcon = new Gtk.Label({ visible: true })
  statusIcon.set_use_markup(true)
  statusIcon.set_markup(YTDLP_AVAILABLE
    ? '<span foreground="#a6e3a1">●</span>'
    : '<span foreground="#f38ba8">●</span>')
  statusRow.add(statusIcon)
  const statusLbl = new Gtk.Label({
    label: YTDLP_AVAILABLE ? 'yt-dlp detected' : 'yt-dlp not found — install it to enable filtering',
    visible: true, xalign: 0,
  })
  statusLbl.get_style_context().add_class('settings-label')
  statusLbl.set_hexpand(true)
  statusRow.add(statusLbl)
  page.add(statusRow)

  page.add(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL, visible: true }))

  // Music-only filter toggle
  const settings     = loadSettings()
  const initFilter   = settings.ytdlpMusicFilter !== false

  const sectionLbl = new Gtk.Label({ label: 'MUSIC FILTER', visible: true, xalign: 0 })
  sectionLbl.get_style_context().add_class('settings-section')
  page.add(sectionLbl)

  const filterRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 12, visible: true })
  const filterLbl = new Gtk.Label({ label: 'Only track music (filter YouTube videos)', visible: true, xalign: 0 })
  filterLbl.get_style_context().add_class('settings-label')
  filterLbl.set_hexpand(true)
  filterRow.add(filterLbl)
  const filterSwitch = new Gtk.Switch({ visible: true, sensitive: YTDLP_AVAILABLE })
  filterSwitch.set_active(initFilter && YTDLP_AVAILABLE)
  filterRow.add(filterSwitch)
  page.add(filterRow)

  const filterHint = new Gtk.Label({
    label: 'Uses yt-dlp to check YouTube categories.\nResults cached for 7 days.',
    visible: true, xalign: 0,
  })
  filterHint.get_style_context().add_class('settings-hint')
  filterHint.set_line_wrap(true)
  page.add(filterHint)

  filterSwitch.connect('state-set', (_sw: any, state: boolean) => {
    saveSettings({ ytdlpMusicFilter: state })
    return false
  })

  if (!YTDLP_AVAILABLE) {
    const notAvailHint = new Gtk.Label({
      label: 'Install yt-dlp: sudo pacman -S yt-dlp',
      visible: true, xalign: 0,
    })
    notAvailHint.get_style_context().add_class('settings-hint')
    page.add(notAvailHint)
  }

  return page
}

// ── Build Music Bar page ─────────────────────────────────────────────────────
function buildMusicBarPage(): Gtk.Box {
  const page = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 14, visible: true })
  page.get_style_context().add_class('settings-page')

  const settings   = loadSettings()
  const initInterv = Math.max(5, Math.min(300, Number(settings.historyIntervalS) || 30))

  const sectionLbl = new Gtk.Label({ label: 'LISTEN HISTORY', visible: true, xalign: 0 })
  sectionLbl.get_style_context().add_class('settings-section')
  page.add(sectionLbl)

  const intRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 12, visible: true })
  const intLbl = new Gtk.Label({
    label: 'Save interval (seconds)',
    visible: true, xalign: 0,
    tooltip_text: 'How often play time is saved to recently played & top listened',
  })
  intLbl.get_style_context().add_class('settings-label')
  intLbl.set_hexpand(true)
  intRow.add(intLbl)

  const adj  = new Gtk.Adjustment({ lower: 5, upper: 300, step_increment: 5, page_increment: 30, value: initInterv })
  const spin = new (Gtk as any).SpinButton({ adjustment: adj, digits: 0, numeric: true, visible: true })
  intRow.add(spin)
  page.add(intRow)

  const intHint = new Gtk.Label({
    label: 'Changes apply on next AGS restart.',
    visible: true, xalign: 0,
  })
  intHint.get_style_context().add_class('settings-hint')
  page.add(intHint)

  adj.connect('value-changed', () => {
    saveSettings({ historyIntervalS: Math.round(adj.get_value()) })
  })

  page.add(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL, visible: true }))

  // ── Clear data ──────────────────────────────────────────────────────────────
  const clearSectionLbl = new Gtk.Label({ label: 'CLEAR DATA', visible: true, xalign: 0 })
  clearSectionLbl.get_style_context().add_class('settings-section')
  page.add(clearSectionLbl)

  const clearHint = new Gtk.Label({ label: 'Click once to arm, click again to confirm. Cannot be undone.', visible: true, xalign: 0 })
  clearHint.get_style_context().add_class('settings-hint')
  clearHint.set_line_wrap(true)
  page.add(clearHint)

  const clearRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8, visible: true })
  page.add(clearRow)

  const makeClearBtn = (label: string, action: () => void): Gtk.Button => {
    const btn = new Gtk.Button({ label, visible: true })
    btn.get_style_context().add_class('settings-clear-btn')
    let timeoutId: any = null

    btn.connect('clicked', () => {
      if (btn.get_label() !== label) {
        // Second click: confirm
        if (timeoutId !== null) { GLib.source_remove(timeoutId); timeoutId = null }
        action()
        btn.set_label(label)
        btn.get_style_context().remove_class('settings-danger-armed')
      } else {
        // First click: arm
        btn.set_label('Confirm?')
        btn.get_style_context().add_class('settings-danger-armed')
        timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => {
          btn.set_label(label)
          btn.get_style_context().remove_class('settings-danger-armed')
          timeoutId = null
          return GLib.SOURCE_REMOVE
        })
      }
    })

    return btn
  }

  clearRow.add(makeClearBtn('Clear Recently Played', clearRecent))
  clearRow.add(makeClearBtn('Clear Top Listened', clearListened))

  return page
}

// ── Main SettingsPanel ────────────────────────────────────────────────────────
export default function SettingsPanel() {
  let win: Astal.Window
  const { CENTER } = Astal.WindowAnchor

  const close = () => { try { win?.set_visible(false) } catch (_) {} }

  return (
    <window
      $={(self: any) => (win = self)}
      name="cava-settings"
      class="SettingsPanel"
      visible={false}
      keymode={Astal.Keymode.EXCLUSIVE}
      anchor={CENTER}
      exclusivity={Astal.Exclusivity.IGNORE}
      layer={Astal.Layer.OVERLAY}
      application={app}
      onKeyPressEvent={(_: any, event: any) => {
        const [, k] = event.get_keyval()
        if (k === Gdk.KEY_Escape) close()
      }}
    >
      <box class="settings-root" orientation={Gtk.Orientation.VERTICAL} spacing={0}
        $={(root: any) => {
          // ── Title bar ─────────────────────────────────────────────────────
          const titleBar = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL, visible: true,
            margin_top: 16, margin_bottom: 12, margin_start: 20, margin_end: 20,
          })
          const titleLbl = new Gtk.Label({ visible: true })
          titleLbl.get_style_context().add_class('settings-title')
          titleLbl.set_use_markup(true)
          titleLbl.set_markup('<b>SETTINGS</b>')
          titleLbl.set_hexpand(true)
          titleLbl.set_halign(Gtk.Align.CENTER)
          titleBar.add(titleLbl)
          root.add(titleBar)

          root.add(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL, visible: true }))

          // ── Body: sidebar + content ────────────────────────────────────────
          const body = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 0, visible: true })
          root.add(body)

          // Sidebar
          const sidebar = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL, spacing: 2, visible: true,
            margin_top: 12, margin_bottom: 12, margin_start: 0, margin_end: 0,
          })
          sidebar.get_style_context().add_class('settings-sidebar')
          body.add(sidebar)

          body.add(new Gtk.Separator({ orientation: Gtk.Orientation.VERTICAL, visible: true }))

          // Content area
          const contentWrap = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL, spacing: 0, visible: true,
            hexpand: true, vexpand: true,
            margin_top: 16, margin_bottom: 16, margin_start: 20, margin_end: 20,
          })
          body.add(contentWrap)

          // ── Pages ──────────────────────────────────────────────────────────
          const cavaPage     = buildCavaPage(close)
          const ytdlpPage    = buildYtdlpPage()
          const musicBarPage = buildMusicBarPage()
          ytdlpPage.set_visible(false)
          musicBarPage.set_visible(false)
          contentWrap.add(cavaPage)
          contentWrap.add(ytdlpPage)
          contentWrap.add(musicBarPage)

          // ── Nav buttons ────────────────────────────────────────────────────
          const navBtns: Gtk.Button[] = []
          const pages = [cavaPage, ytdlpPage, musicBarPage]

          const makeNavBtn = (label: string, pageIdx: number): Gtk.Button => {
            const btn = new Gtk.Button({ label, visible: true })
            btn.get_style_context().add_class('settings-nav-btn')
            btn.set_relief(Gtk.ReliefStyle.NONE)
            btn.connect('clicked', () => {
              navBtns.forEach(b => b.get_style_context().remove_class('active'))
              btn.get_style_context().add_class('active')
              pages.forEach((p, i) => p.set_visible(i === pageIdx))
            })
            navBtns.push(btn)
            sidebar.add(btn)
            return btn
          }

          const cavaNavBtn = makeNavBtn('CAVA', 0)
          makeNavBtn('YT-DLP', 1)
          makeNavBtn('MUSIC BAR', 2)

          // Default active page
          cavaNavBtn.get_style_context().add_class('active')

          // ── Footer ─────────────────────────────────────────────────────────
          root.add(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL, visible: true }))
          const footer = new Gtk.Label({ label: 'Press Esc to close', visible: true })
          footer.get_style_context().add_class('settings-hint')
          footer.set_margin_top(8)
          footer.set_margin_bottom(10)
          root.add(footer)
        }}
      />
    </window>
  )
}
