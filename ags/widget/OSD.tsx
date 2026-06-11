import app from "ags/gtk3/app"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import AstalWp from "gi://AstalWp"
import GLib from "gi://GLib"
import Gio from "gi://Gio"
import { createState, createEffect, onCleanup } from "ags"
import { createBinding } from "ags"

const dec = new TextDecoder()

interface OSDState {
  icon:    string
  text:    string
  pct:     number    // 0-100, ignored for caps lock
  noBar?:  boolean
}

// ── Backlight helpers ───────────────────────────────────────────
function findBacklight(): { cur: string; max: string } | null {
  try {
    if (!GLib.file_test('/sys/class/backlight', GLib.FileTest.IS_DIR)) return null
    const d = GLib.Dir.open('/sys/class/backlight', 0)
    const name = d.read_name()
    d.close()
    if (!name) return null
    const base = `/sys/class/backlight/${name}`
    return { cur: `${base}/actual_brightness`, max: `${base}/max_brightness` }
  } catch (_) { return null }
}

function readInt(path: string): number {
  try {
    const [ok, raw] = GLib.file_get_contents(path)
    return ok ? parseInt(dec.decode(raw).trim(), 10) : 0
  } catch (_) { return 0 }
}

function findCapsLockPath(): string | null {
  try {
    if (!GLib.file_test('/sys/class/leds', GLib.FileTest.IS_DIR)) return null
    const d = GLib.Dir.open('/sys/class/leds', 0)
    let name = d.read_name()
    while (name) {
      if (name.toLowerCase().includes('capslock') || name.toLowerCase().includes('caps_lock')) {
        d.close()
        return `/sys/class/leds/${name}/brightness`
      }
      name = d.read_name()
    }
    d.close()
  } catch (_) {}
  return null
}

function volIcon(pct: number, mute: boolean): string {
  if (mute) return '󰝟'
  return pct > 66 ? '󰕾' : pct > 33 ? '󰖀' : '󰕿'
}

function brightIcon(pct: number): string {
  return pct > 66 ? '󰃠' : pct > 33 ? '󰃟' : '󰃞'
}

// ── Main OSD ────────────────────────────────────────────────────
export default function OSD(gdkmonitor: Gdk.Monitor) {
  let win: Astal.Window

  const [osd, setOsd] = createState<OSDState | null>(null)
  let hideTimer: any = null

  const show = (s: OSDState) => {
    if (hideTimer) { GLib.source_remove(hideTimer); hideTimer = null }
    setOsd(s)
    hideTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2200, () => {
      setOsd(null)
      hideTimer = null
      return GLib.SOURCE_REMOVE
    })
  }
  onCleanup(() => { if (hideTimer) GLib.source_remove(hideTimer) })

  // ── Volume (AstalWp) ──────────────────────────────────────────
  try {
    const wp = (AstalWp as any).Wp.get_default()
    const speaker = wp?.get_default_speaker?.()
    if (speaker) {
      let prevVol  = speaker.volume as number
      let prevMute = speaker.mute  as boolean

      speaker.connect('notify::volume', () => {
        const v = speaker.volume as number
        const m = speaker.mute  as boolean
        if (Math.abs(v - prevVol) < 0.004) return
        prevVol = v
        const pct = Math.round(v * 100)
        show({ icon: volIcon(pct, m), text: m ? 'Silenciado' : `${pct}%`, pct })
      })
      speaker.connect('notify::mute', () => {
        const m = speaker.mute as boolean
        if (m === prevMute) return
        prevMute = m
        const pct = Math.round((speaker.volume as number) * 100)
        show({ icon: volIcon(pct, m), text: m ? 'Silenciado' : `${pct}%`, pct })
      })
    }
  } catch (e) { console.warn('[OSD] volume init failed:', e) }

  // ── Brightness (inotify on actual_brightness) ─────────────────
  try {
    const bl = findBacklight()
    if (bl) {
      const maxVal = readInt(bl.max) || 100
      const blFile = Gio.File.new_for_path(bl.cur)
      const blMon  = blFile.monitor_file(Gio.FileMonitorFlags.NONE, null)
      blMon.connect('changed', () => {
        const val = readInt(bl.cur)
        const pct = Math.min(100, Math.round((val / maxVal) * 100))
        show({ icon: brightIcon(pct), text: `${pct}%`, pct })
      })
      ;(globalThis as any).__osdBlMon = blMon
    }
  } catch (e) { console.warn('[OSD] brightness init failed:', e) }

  // ── Caps Lock (poll 300ms) ────────────────────────────────────
  try {
    const capsPath = findCapsLockPath()
    if (capsPath) {
      let prev = readInt(capsPath) > 0
      const pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
        const cur = readInt(capsPath) > 0
        if (cur !== prev) {
          prev = cur
          show({ icon: cur ? '󰪛' : '󰪜', text: cur ? 'Caps Lock ON' : 'Caps Lock OFF',
                 pct: 0, noBar: true })
        }
        return GLib.SOURCE_CONTINUE
      })
      onCleanup(() => GLib.source_remove(pollId))
    }
  } catch (e) { console.warn('[OSD] capslock init failed:', e) }

  onCleanup(() => { try { win?.destroy() } catch (_) {} })

  const { BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

  return (
    <window
      $={(self: any) => (win = self)}
      visible={osd.as((s: OSDState | null) => s !== null)}
      class="OSD"
      namespace="ags-osd"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.IGNORE}
      layer={Astal.Layer.OVERLAY}
      anchor={BOTTOM | LEFT | RIGHT}
      marginBottom={60}
      keymode={Astal.Keymode.NONE}
      application={app}
    >
      <box halign={Gtk.Align.CENTER} valign={Gtk.Align.END}
        $={(self: any) => {
          const osdBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL, spacing: 8,
            halign: Gtk.Align.CENTER, visible: true,
          })
          osdBox.get_style_context().add_class('osd-root')

          const iconLbl = new Gtk.Label({ visible: true, xalign: 0.5 })
          iconLbl.get_style_context().add_class('osd-icon')

          const textLbl = new Gtk.Label({ visible: true, xalign: 0.5 })
          textLbl.get_style_context().add_class('osd-text')

          const bar = new Gtk.ProgressBar({ visible: true })
          bar.get_style_context().add_class('osd-bar')

          osdBox.add(iconLbl)
          osdBox.add(textLbl)
          osdBox.add(bar)

          self.add(osdBox)
          self.show_all()

          createEffect(() => {
            const s = osd()
            if (!s) return
            iconLbl.set_label(s.icon)
            textLbl.set_label(s.text)
            bar.set_fraction(Math.min(1, Math.max(0, s.pct / 100)))
            bar.set_visible(!s.noBar)
          })
        }}
      />
    </window>
  )
}
