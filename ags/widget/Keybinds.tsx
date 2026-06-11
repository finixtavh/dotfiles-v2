import app from "ags/gtk3/app"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import GLib from "gi://GLib"

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any
    }
  }
}

interface KB { keys: string; action: string; section: string }

const COMMON: KB[] = [
  { keys: 'SUPER + Enter',      action: 'Terminal (Kitty)',    section: 'common' },
  { keys: 'SUPER + W',          action: 'Firefox',             section: 'common' },
  { keys: 'SUPER + E',          action: 'File Manager',        section: 'common' },
  { keys: 'SUPER + C',          action: 'Command Center',      section: 'common' },
  { keys: "SUPER + '",          action: 'Keybind Viewer',      section: 'common' },
  { keys: 'SUPER + Q',          action: 'Close Window',        section: 'common' },
  { keys: 'SUPER + F',          action: 'Fullscreen Toggle',   section: 'common' },
  { keys: 'SUPER + D',          action: 'Maximize Toggle',     section: 'common' },
  { keys: 'SUPER + L',          action: 'Lock Screen',         section: 'common' },
  { keys: 'SUPER + SHIFT + S',  action: 'Screenshot Region',   section: 'common' },
  { keys: 'SUPER + V',          action: 'Clipboard',           section: 'common' },
  { keys: 'SUPER + Period',     action: 'Emoji Picker',        section: 'common' },
]

const _dec = new TextDecoder()

function humanize(cmd: string): string {
  const c = cmd.trim()
  if (c === 'kitty')                                      return 'Terminal (Kitty)'
  if (c.startsWith('rofi'))                               return 'App Launcher'
  if (c === 'firefox')                                    return 'Firefox'
  if (c === 'dolphin')                                    return 'File Manager'
  if (c === 'code')                                       return 'VS Code'
  if (c === 'kate')                                       return 'Kate'
  if (c.includes('gnome-control'))                        return 'Control Center'
  if (c.includes('gnome-system-monitor'))                 return 'System Monitor'
  if (c.includes('systemctl suspend'))                    return 'Suspend'
  if (c.includes('systemctl poweroff'))                   return 'Shutdown'
  if (c.includes('systemctl reboot'))                     return 'Reboot'
  if (c.includes('hyprctl dispatch exit'))                return 'Logout'
  if (c.includes('hyprlock'))                             return 'Lock Screen'
  if (c.includes('hyprctl kill'))                         return 'Kill Window (Pick)'
  if (c.includes('hyprpicker'))                           return 'Color Picker'
  if (c.includes('screenshot') && c.includes('region'))  return 'Screenshot Region'
  if (c.includes('screenshot') && c.includes('screen'))  return 'Screenshot Screen'
  if (c.includes('screenshot'))                           return 'Screenshot'
  if (c.includes('clipboard'))                            return 'Clipboard'
  if (c.includes('emoji'))                                return 'Emoji Picker'
  if (c.includes('wallpicker'))                           return 'Wallpaper Picker'
  if (c.includes('wallpaper'))                            return 'Random Wallpaper'
  if (c.includes('powermenu'))                            return 'Power Menu'
  if (c.includes('ags toggle') && c.includes('command-center'))  return 'Command Center'
  if (c.includes('ags toggle') && c.includes('power-menu'))      return 'Power Menu'
  if (c.includes('ags toggle') && c.includes('keybinds'))        return 'Keybind Viewer'
  if (c.includes('wpctl set-mute') && c.includes('SINK'))        return 'Toggle Audio Mute'
  if (c.includes('wpctl set-mute') && c.includes('SOURCE'))      return 'Toggle Mic Mute'
  if (c.includes('wpctl set-volume') && c.includes('%+'))        return 'Volume Up'
  if (c.includes('wpctl set-volume') && c.includes('%-'))        return 'Volume Down'
  if (c.includes('playerctl next'))                       return 'Next Track'
  if (c.includes('playerctl previous'))                   return 'Previous Track'
  if (c.includes('playerctl play-pause'))                 return 'Play / Pause'
  if (c.includes('brightnessctl') && c.includes('+'))    return 'Brightness Up'
  if (c.includes('brightnessctl') && c.includes('-'))    return 'Brightness Down'
  if (c.includes('dunstctl'))                             return 'Notification History'
  if (c.includes('cyclenext'))                            return 'Cycle Windows'
  if (c.includes('keybind-cheatsheet') || c.includes('keybinds-viewer')) return 'Keybind Viewer'
  if (c.includes('zoom_factor') && c.includes('+ 0.3')) return 'Zoom In'
  if (c.includes('zoom_factor') && c.includes('- 0.3')) return 'Zoom Out'
  if (c.includes('blueman'))                              return 'Bluetooth Manager'
  if (c.includes('nm-connection'))                        return 'Network Manager'
  if (c.includes('pavucontrol'))                          return 'Audio Mixer'
  if (c.includes('rofi-toggle'))                          return 'App Launcher Toggle'
  if (c.includes('XF86PowerOff') || c.includes('power-menu')) return 'Power Menu'
  return c.length > 38 ? c.slice(0, 36) + '…' : c
}

function parseKeybinds(): KB[] {
  const res: KB[] = []
  try {
    const [ok, raw] = GLib.file_get_contents('/home/fn-finixtavh/.config/hypr/keybinds.lua')
    if (!ok) return res
    const lines = _dec.decode(raw).split('\n')
    let section = 'General'
    let inLoop = false

    for (const line of lines) {
      const t = line.trim()
      if (t.startsWith('for ') && t.includes(' do')) { inLoop = true; continue }
      if (t === 'end')                                { inLoop = false; continue }
      if (inLoop) continue

      const secM = t.match(/^--\s*[─\-]+\s*(.+?)\s*[─\-]+\s*$/)
      if (secM) { section = secM[1].trim(); continue }

      if (!t.startsWith('hl.bind(')) continue

      const keyM = t.match(/^hl\.bind\(([^,]+),/)
      if (!keyM) continue

      const rawKey = keyM[1]
      if (rawKey.includes('tostring')) continue

      const keys = rawKey
        .replace(/mainMod\s*\.\.\s*["']/g, 'SUPER + ')
        .replace(/mainMod\s*\.\./g,        'SUPER ')
        .replace(/["']/g,                  '')
        .replace(/\s*\+\s*/g,              ' + ')
        .replace(/SUPER_L|Super_L/g,       'SUPER')
        .trim()

      if (!keys || /[{}()\[\].]/.test(keys)) continue

      let action = ''
      const execM = t.match(/exec_cmd\("([^"]+)"\)/)
      if (execM) {
        action = humanize(execM[1])
      } else if (t.includes('window.close()'))                                    { action = 'Close Window'
      } else if (t.includes('window.fullscreen') && t.includes('maximized'))      { action = 'Maximize Toggle'
      } else if (t.includes('window.fullscreen'))                                  { action = 'Fullscreen Toggle'
      } else if (t.includes('window.float'))                                       { action = 'Float Toggle'
      } else if (t.includes('window.pin()'))                                       { action = 'Pin Window'
      } else if (t.includes('window.drag()'))                                      { action = 'Drag Window'
      } else if (t.includes('window.resize()'))                                    { action = 'Resize Window'
      } else if (t.includes('window.move') && t.includes('workspace'))             { action = 'Move to Workspace'
      } else if (t.includes('window.move'))                                        { action = 'Move Window'
      } else if (t.includes('workspace.toggle_special'))                           { action = 'Toggle Scratchpad'
      } else if (t.includes('layout("splitratio') && t.includes('-'))              { action = 'Shrink Split'
      } else if (t.includes('layout("splitratio') && t.includes('+'))              { action = 'Grow Split'
      } else if (t.includes('focus({ direction')) {
        const d = t.match(/direction\s*=\s*"(\w+)"/)?.[1] ?? ''
        const dm: Record<string, string> = { l: 'Left', r: 'Right', u: 'Up', d: 'Down' }
        action = `Focus ${dm[d] ?? d}`
      } else if (t.includes('focus({ workspace')) {
        const ws = t.match(/workspace\s*=\s*"([^"]+)"/)?.[1] ?? ''
        if (ws === 'r+1') action = 'Next Workspace'
        else if (ws === 'r-1') action = 'Previous Workspace'
        else action = `Workspace ${ws}`
      }

      if (action) res.push({ keys, action, section })
    }
  } catch (_) {}
  return res
}

export default function Keybinds() {
  let win: Astal.Window
  const CENTER = Astal.WindowAnchor.NONE
  const close = () => { try { win?.set_visible(false) } catch (_) {} }

  const allBinds = parseKeybinds()

  return (
    <window
      $={(self: any) => (win = self)}
      name="keybinds-viewer"
      class="KeybindsViewer"
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
      <box class="kb-root" orientation={Gtk.Orientation.VERTICAL} spacing={12}
        $={(self: any) => {
          // ── Search entry ─────────────────────────────────────────
          const entry = new Gtk.SearchEntry({ visible: true })
          entry.get_style_context().add_class('kb-search')
          entry.set_placeholder_text('Search keybinds…')
          entry.set_hexpand(true)
          self.add(entry)

          // ── Common section ────────────────────────────────────────
          const comTitle = new Gtk.Label({ label: 'COMMON', visible: true, xalign: 0 })
          comTitle.get_style_context().add_class('kb-section-title')
          self.add(comTitle)

          const grid = new Gtk.Grid({ visible: true, column_spacing: 28, row_spacing: 3 })
          grid.get_style_context().add_class('kb-common-grid')
          COMMON.forEach(({ keys, action }, i) => {
            const col = (i % 2) * 2
            const row = Math.floor(i / 2)
            const kl = new Gtk.Label({ label: keys,   visible: true, xalign: 0 })
            kl.get_style_context().add_class('kb-key')
            kl.set_width_chars(26)
            const al = new Gtk.Label({ label: action, visible: true, xalign: 0 })
            al.get_style_context().add_class('kb-action')
            grid.attach(kl, col,     row, 1, 1)
            grid.attach(al, col + 1, row, 1, 1)
          })
          self.add(grid)

          // ── Separator ─────────────────────────────────────────────
          const sep = new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL, visible: true })
          self.add(sep)

          // ── All keybinds section ──────────────────────────────────
          const allTitle = new Gtk.Label({ label: 'ALL KEYBINDS', visible: true, xalign: 0 })
          allTitle.get_style_context().add_class('kb-section-title')
          self.add(allTitle)

          const scroll = new Gtk.ScrolledWindow({ visible: true })
          scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
          scroll.set_min_content_height(200)
          scroll.set_max_content_height(300)
          self.add(scroll)

          const listBox = new Gtk.ListBox({ visible: true })
          listBox.get_style_context().add_class('kb-list')
          listBox.set_selection_mode(Gtk.SelectionMode.NONE)
          scroll.add(listBox)

          type Row = { keyLow: string; actLow: string; row: Gtk.ListBoxRow }
          const rows: Row[] = allBinds.map(({ keys, action, section }) => {
            const row = new Gtk.ListBoxRow({ visible: true })
            row.get_style_context().add_class('kb-row')
            const hbox = new Gtk.Box({
              orientation: Gtk.Orientation.HORIZONTAL,
              spacing: 20, visible: true,
              margin_start: 8, margin_end: 8,
              margin_top: 3, margin_bottom: 3,
            })
            const kl = new Gtk.Label({ label: keys,    visible: true, xalign: 0 })
            kl.get_style_context().add_class('kb-key')
            kl.set_width_chars(30)
            const al = new Gtk.Label({ label: action,  visible: true, xalign: 0 })
            al.get_style_context().add_class('kb-action')
            al.set_hexpand(true)
            const sl = new Gtk.Label({ label: section, visible: true, xalign: 1 })
            sl.get_style_context().add_class('kb-section-tag')
            hbox.add(kl); hbox.add(al); hbox.add(sl)
            row.add(hbox)
            listBox.add(row)
            return { keyLow: keys.toLowerCase(), actLow: action.toLowerCase(), row }
          })

          // ── Live search filter ─────────────────────────────────────
          entry.connect('search-changed', () => {
            const q = entry.get_text().toLowerCase().trim()
            rows.forEach(({ keyLow, actLow, row }) => {
              row.set_visible(!q || keyLow.includes(q) || actLow.includes(q))
            })
          })

          // ── Hint ──────────────────────────────────────────────────
          const hint = new Gtk.Label({ label: 'Esc to close', visible: true })
          hint.get_style_context().add_class('kb-hint')
          self.add(hint)

          self.show_all()

          // Focus search entry when window opens (defer — win $= fires after children $=)
          GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            const topWin = self.get_toplevel?.() ?? win
            if (topWin) topWin.connect('show', () => {
              entry.set_text('')
              rows.forEach(({ row }) => row.set_visible(true))
              entry.grab_focus()
            })
            return GLib.SOURCE_REMOVE
          })
        }}
      />
    </window>
  )
}
