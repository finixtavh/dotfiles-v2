import app from "ags/gtk3/app"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import GLib from "gi://GLib"
import AstalTray from "gi://AstalTray"
import AstalHyprland from "gi://AstalHyprland"
import AstalWp from "gi://AstalWp"
import AstalNetwork from "gi://AstalNetwork"
import AstalBluetooth from "gi://AstalBluetooth"
import { For, createBinding, createState, onCleanup } from "ags"
import { toggleNotifCenter, isDndEnabled, subscribeDnd } from "./NotificationCenter"
import { createPoll } from "ags/time"
import { execAsync } from "ags/process"

// ============================================================
//  LAUNCHER
// ============================================================
function Launcher() {
  return (
    <button class="launcher" onClicked={() => execAsync("rofi -show drun -show-icons")}>
      <label class="launcher-icon" label="󰣇" />
    </button>
  )
}

// ============================================================
//  COLOR PICKER
// ============================================================
function ColorPicker() {
  return (
    <button class="color-picker" tooltip_text="Color picker (copies to clipboard)"
      onClicked={() => execAsync(['hyprpicker', '-a']).catch(() => {})}
    >
      <label class="color-picker-icon" label="󰈋" />
    </button>
  )
}

// ============================================================
//  CLOCK
// ============================================================
function Clock() {
  const time = createPoll("--:--", 1000, () => {
    const tz = GLib.TimeZone.new("America/Santiago")
    return GLib.DateTime.new_now(tz)?.format("%H:%M") ?? "--:--"
  })
  return (
    <box class="clock" spacing={5}>
      <label class="clock-icon" label="󱑂" />
      <label class="clock-time" label={time} />
    </box>
  )
}

// ============================================================
//  CALENDAR
// ============================================================
function CalendarWidget({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const dateStr = createPoll("Fecha", 1000, () => {
    const tz = GLib.TimeZone.new("America/Santiago")
    return GLib.DateTime.new_now(tz)?.format("%a %d %b") ?? "Fecha"
  })

  let calWin: any = null

  const toggleCal = () => {
    if (calWin) {
      try { calWin.destroy() } catch (_) {}
      calWin = null
      return
    }
    const cal = new Gtk.Calendar({ visible: true })
    const box = new Gtk.Box({
      visible: true,
      margin_top: 8, margin_bottom: 8, margin_start: 8, margin_end: 8,
    })
    box.get_style_context().add_class('cal-popup-box')
    box.add(cal)

    calWin = new (Astal.Window as any)({
      gdkmonitor,
      exclusivity: Astal.Exclusivity.IGNORE,
      layer:       Astal.Layer.OVERLAY,
      anchor:      Astal.WindowAnchor.BOTTOM,
      margin_bottom: 50,
      keymode:     Astal.Keymode.ON_DEMAND,
      application: app,
    })
    calWin.get_style_context().add_class('CalendarPopup')
    calWin.add(box)
    calWin.show_all()

    calWin.connect('key-press-event', (_: any, event: any) => {
      const [, k] = event.get_keyval()
      if (k === Gdk.KEY_Escape) {
        try { calWin?.destroy() } catch (_) {}
        calWin = null
      }
    })
    calWin.connect('destroy', () => { calWin = null })
  }

  return (
    <button class="calendar-btn"
      tooltip_text="Click: mini calendar | Right-click: calcure"
      onClicked={toggleCal}
      $={(self: any) => {
        self.add_events(Gdk.EventMask.BUTTON_PRESS_MASK)
        self.connect('button-press-event', (_: any, evt: any) => {
          const [, btn] = evt.get_button()
          if (btn === 3) {
            execAsync('kitty --class calcure calcure').catch(
              () => execAsync('calcure').catch(() => {})
            )
            return true
          }
          return false
        })
      }}
    >
      <box class="calendar-box" spacing={6}>
        <label class="calendar-icon" label="󰸗" />
        <label class="calendar-date" label={dateStr} />
      </box>
    </button>
  )
}

// ============================================================
//  AUDIO — VOLUME + MIC with mute dim + scroll + right-click
// ============================================================
function VolumeWidget() {
  const wp = (AstalWp as any).Wp.get_default()
  const speaker = wp?.get_default_speaker?.()
  if (!speaker) return (<box />) as any

  const [icon,  setIcon]  = createState('󰕾')
  const [label, setLabel] = createState('100%')
  const [muted, setMuted] = createState(false)

  const update = () => {
    const v = speaker.volume as number
    const m = speaker.mute  as boolean
    const p = Math.round(v * 100)
    setMuted(m)
    setIcon(m ? '󰝟' : p > 66 ? '󰕾' : p > 33 ? '󰖀' : '󰕿')
    setLabel(m ? 'Mute' : `${p}%`)
  }
  const u1 = createBinding(speaker, 'volume').subscribe(update)
  const u2 = createBinding(speaker, 'mute').subscribe(update)
  onCleanup(() => { u1(); u2() })
  update()

  return (
    <button
      class={muted.as((m: boolean) => m ? 'audio-btn muted' : 'audio-btn')}
      tooltip_text="Click: mixer | Right-click: mute | Scroll: volume"
      onClicked={() => execAsync('pavucontrol').catch(() => {})}
      $={(self: any) => {
        self.add_events(Gdk.EventMask.SCROLL_MASK | Gdk.EventMask.BUTTON_PRESS_MASK)
        self.connect('button-press-event', (_: any, evt: any) => {
          const [, btn] = evt.get_button()
          if (btn === 3) {
            execAsync('wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle').catch(() => {})
            return true
          }
          return false
        })
        self.connect('scroll-event', (_: any, evt: any) => {
          const [hasDeltas, , dy] = evt.get_scroll_deltas()
          let up: boolean
          if (hasDeltas) { up = dy < 0 }
          else { const [, dir] = evt.get_scroll_direction(); up = dir === Gdk.ScrollDirection.UP }
          execAsync(`wpctl set-volume -l 1.0 @DEFAULT_AUDIO_SINK@ 5%${up ? '+' : '-'}`).catch(() => {})
          return true
        })
      }}
    >
      <box spacing={4}>
        <label class="audio-icon" label={icon} />
        <label class="audio-vol"  label={label} />
      </box>
    </button>
  )
}

function MicWidget() {
  const wp = (AstalWp as any).Wp.get_default()
  const mic = wp?.get_default_microphone?.()
  if (!mic) return (<box />) as any

  const [icon,  setIcon]  = createState('󰍬')
  const [label, setLabel] = createState('100%')
  const [muted, setMuted] = createState(false)

  const update = () => {
    const v = mic.volume as number
    const m = mic.mute   as boolean
    const p = Math.round(v * 100)
    setMuted(m)
    setIcon(m ? '󰍭' : '󰍬')
    setLabel(m ? 'Mute' : `${p}%`)
  }
  const u1 = createBinding(mic, 'volume').subscribe(update)
  const u2 = createBinding(mic, 'mute').subscribe(update)
  onCleanup(() => { u1(); u2() })
  update()

  return (
    <button
      class={muted.as((m: boolean) => m ? 'audio-btn muted' : 'audio-btn')}
      tooltip_text="Right-click: mute mic | Scroll: mic volume"
      onClicked={() => execAsync('pavucontrol').catch(() => {})}
      $={(self: any) => {
        self.add_events(Gdk.EventMask.SCROLL_MASK | Gdk.EventMask.BUTTON_PRESS_MASK)
        self.connect('button-press-event', (_: any, evt: any) => {
          const [, btn] = evt.get_button()
          if (btn === 3) {
            execAsync('wpctl set-mute @DEFAULT_AUDIO_SOURCE@ toggle').catch(() => {})
            return true
          }
          return false
        })
        self.connect('scroll-event', (_: any, evt: any) => {
          const [hasDeltas, , dy] = evt.get_scroll_deltas()
          let up: boolean
          if (hasDeltas) { up = dy < 0 }
          else { const [, dir] = evt.get_scroll_direction(); up = dir === Gdk.ScrollDirection.UP }
          execAsync(`wpctl set-volume -l 1.0 @DEFAULT_AUDIO_SOURCE@ 5%${up ? '+' : '-'}`).catch(() => {})
          return true
        })
      }}
    >
      <box spacing={4}>
        <label class="audio-icon" label={icon} />
        <label class="audio-vol"  label={label} />
      </box>
    </button>
  )
}

// ============================================================
//  NETWORK — wifi/wired icon + traffic (↓/↑)
// ============================================================
const _dec = new TextDecoder()

function getPrimaryIface(): string {
  try {
    const [ok, raw] = GLib.file_get_contents('/proc/net/route')
    if (!ok) return ''
    for (const line of _dec.decode(raw).split('\n').slice(1)) {
      const parts = line.trim().split('\t')
      if (parts.length > 1 && parts[1] === '00000000') return parts[0]
    }
  } catch (_) {}
  return ''
}

function getIfaceBytes(iface: string): { rx: number, tx: number } | null {
  try {
    const [ok, raw] = GLib.file_get_contents('/proc/net/dev')
    if (!ok) return null
    for (const line of _dec.decode(raw).split('\n')) {
      if (line.trim().startsWith(iface + ':')) {
        const parts = line.trim().split(':')[1].trim().split(/\s+/)
        return { rx: parseInt(parts[0], 10), tx: parseInt(parts[8], 10) }
      }
    }
  } catch (_) {}
  return null
}

function fmtSpeed(bps: number): string {
  bps = Math.round(bps)
  if (bps < 1000)           return `${bps}B`
  if (bps < 1_000_000)      return `${Math.round(bps / 1000)}K`
  if (bps < 1_000_000_000)  return `${(bps / 1_000_000).toFixed(1)}M`
  return `${(bps / 1_000_000_000).toFixed(1)}G`
}

function NetworkWidget() {
  const [netIcon,   setNetIcon]   = createState('󰤭')
  const [netSsid,   setNetSsid]   = createState('')
  const [rxStr,     setRxStr]     = createState('')
  const [txStr,     setTxStr]     = createState('')

  let prevRx = 0, prevTx = 0, prevTime = Date.now()

  const poll = () => {
    try {
      let icon  = '󰤭'
      let ssid  = ''
      let found = false
      const iface = getPrimaryIface()

      try {
        const net = (AstalNetwork as any).Network?.get_default?.()
        if (net) {
          const primary = net.primary ?? 0  // 1=wired, 2=wifi
          const wifi  = net.wifi
          const wired = net.wired
          if (primary === 1 || (wired && wired.internet === 0)) {
            icon = '󰈁'; found = true
          } else if (primary === 2 || wifi?.ssid) {
            const s = wifi?.strength ?? 0
            icon = s > 66 ? '󰤨' : s > 33 ? '󰤥' : '󰤢'
            ssid = wifi?.ssid ?? ''
            found = !!ssid
          }
        }
      } catch (_) {}

      if (!found) {
        if (iface) {
          found = true
          icon = iface.startsWith('w') ? '󰤢' : '󰈁'
        }
      }

      setNetIcon(icon)
      setNetSsid(ssid.length > 14 ? ssid.slice(0, 14) + '…' : ssid)

      if (iface) {
        const bytes = getIfaceBytes(iface)
        if (bytes) {
          const now = Date.now()
          const dt  = (now - prevTime) / 1000
          if (dt > 0.5 && prevRx > 0) {
            const rx = Math.max(0, bytes.rx - prevRx) / dt
            const tx = Math.max(0, bytes.tx - prevTx) / dt
            setRxStr(`↓${fmtSpeed(rx)}/s`)
            setTxStr(`↑${fmtSpeed(tx)}/s`)
          }
          prevRx = bytes.rx; prevTx = bytes.tx; prevTime = now
        }
      }
    } catch (_) {}
  }

  const pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => { poll(); return GLib.SOURCE_CONTINUE })
  onCleanup(() => GLib.source_remove(pollId))
  poll()

  return (
    <button class="sys-btn net-btn"
      tooltip_text="Network"
      onClicked={() => execAsync('nm-connection-editor').catch(() => execAsync('nm-applet').catch(() => {}))}
    >
      <box spacing={4} valign={Gtk.Align.CENTER}>
        <label class="sys-icon" label={netIcon} />
        <box orientation={Gtk.Orientation.VERTICAL} spacing={0} valign={Gtk.Align.CENTER}>
          <label class="net-ssid" label={netSsid} xalign={0}
            visible={netSsid.as((s: string) => s.length > 0)} />
          <box spacing={4}>
            <label class="net-speed" label={rxStr} />
            <label class="net-speed" label={txStr} />
          </box>
        </box>
      </box>
    </button>
  )
}

// ============================================================
//  BLUETOOTH
// ============================================================
function BluetoothWidget() {
  const [btIcon, setBtIcon] = createState('󰂯')
  const [btVis,  setBtVis]  = createState(false)

  try {
    const bt = (AstalBluetooth as any).Bluetooth?.get_default?.()
    if (!bt) return (<box />) as any

    const update = () => {
      try {
        const powered   = bt.isPowered ?? bt.is_powered ?? false
        const connected = bt.isConnected ?? bt.is_connected ?? false
        setBtVis(true)
        setBtIcon(connected ? '󰂱' : powered ? '󰂯' : '󰂲')
      } catch (_) {}
    }

    try { createBinding(bt, 'isPowered').subscribe(update)   } catch (_) {}
    try { createBinding(bt, 'isConnected').subscribe(update) } catch (_) {}
    update()
  } catch (_) {
    return (<box />) as any
  }

  return (
    <button class="sys-btn"
      visible={btVis}
      tooltip_text="Bluetooth"
      onClicked={() => execAsync('blueman-manager').catch(() => {})}
    >
      <label class="sys-icon" label={btIcon} />
    </button>
  )
}

// ============================================================
//  BATTERY
// ============================================================
function BatteryWidget() {
  const BAT_PATHS = [
    '/sys/class/power_supply/BAT0',
    '/sys/class/power_supply/BAT1',
    '/sys/class/power_supply/BATT',
  ]
  const batPath = BAT_PATHS.find(p =>
    GLib.file_test(`${p}/capacity`, GLib.FileTest.EXISTS)
  ) ?? null

  if (!batPath) return (<box />) as any

  const [battIcon, setBattIcon] = createState('󰁹')
  const [battText, setBattText] = createState('100%')
  const [tooltip,  setTooltip]  = createState('Battery')

  const readFile = (path: string): string => {
    try {
      const [ok, raw] = GLib.file_get_contents(path)
      return ok ? _dec.decode(raw).trim() : ''
    } catch (_) { return '' }
  }

  const update = () => {
    const pct    = parseInt(readFile(`${batPath}/capacity`)) || 0
    const status = readFile(`${batPath}/status`)
    const ch     = status === 'Charging'
    const full   = status === 'Full'
    const ic     = (ch || full) ? '󰂄'
                 : pct > 90 ? '󰁹'
                 : pct > 70 ? '󰂁'
                 : pct > 50 ? '󰁿'
                 : pct > 30 ? '󰁾'
                 : pct > 15 ? '󰁻'
                 : '󰁺'
    setBattIcon(ic)
    setBattText(`${pct}%`)
    setTooltip(ch ? `Battery: ${pct}% (Charging)` : full ? 'Battery: Full' : `Battery: ${pct}%`)
  }

  update()
  const pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 30_000, () => { update(); return GLib.SOURCE_CONTINUE })
  onCleanup(() => GLib.source_remove(pollId))

  return (
    <button class="sys-btn battery-btn" tooltip_text={tooltip}>
      <box spacing={3}>
        <label class="sys-icon" label={battIcon} />
        <label class="batt-pct" label={battText} />
      </box>
    </button>
  )
}

// ============================================================
//  VPN
// ============================================================
function VpnWidget() {
  const [active, setActive] = createState(false)
  const VPN_IFACES = ['tun0', 'tun1', 'wg0', 'wg1', 'ppp0', 'vpn0', 'vpn1']

  const check = () => {
    try {
      const [ok, raw] = GLib.file_get_contents('/proc/net/dev')
      if (!ok) { setActive(false); return }
      const lines = _dec.decode(raw).split('\n')
      setActive(lines.some(l => VPN_IFACES.some(v => l.trim().startsWith(v + ':'))))
    } catch (_) { setActive(false) }
  }

  const pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 4000, () => { check(); return GLib.SOURCE_CONTINUE })
  onCleanup(() => GLib.source_remove(pollId))
  check()

  return (
    <button class="sys-btn vpn-btn" visible={active} tooltip_text="VPN Active">
      <label class="sys-icon" label="󰒃" />
    </button>
  )
}

// ============================================================
//  WORKSPACES
// ============================================================
function WorkspacesWidget() {
  const hypr = AstalHyprland.get_default()
  const [activeId, setActiveId] = createState(1)

  const update = () => {
    try { setActiveId((hypr as any).focusedWorkspace?.id ?? 1) } catch (_) {}
  }

  try { createBinding(hypr, 'focusedWorkspace').subscribe(update) } catch (_) {}
  update()

  return (
    <box class="workspaces" spacing={4} valign={Gtk.Align.CENTER}>
      {[1, 2, 3, 4, 5].map(id => (
        <button
          class={activeId.as((a: number) => a === id ? 'ws-dot active' : 'ws-dot')}
          onClicked={() => execAsync(`hyprctl dispatch workspace ${id}`).catch(() => {})}
          tooltip_text={`Workspace ${id}`}
        >
          <label label="•" />
        </button>
      ))}
    </box>
  )
}

// ============================================================
//  BAR FLYOUT (above bottom bar, anchored bottom-right)
// ============================================================
function openBarFlyout(gdkmonitor: Gdk.Monitor, content: Gtk.Widget): () => void {
  let closed = false
  const { BOTTOM, RIGHT } = Astal.WindowAnchor
  const fw = new (Astal.Window as any)({
    gdkmonitor,
    exclusivity:   Astal.Exclusivity.IGNORE,
    layer:         Astal.Layer.OVERLAY,
    anchor:        BOTTOM | RIGHT,
    margin_bottom: 50,
    margin_right:  10,
    keymode:       Astal.Keymode.NONE,
    application:   app,
  })
  fw.get_style_context().add_class('BarFlyoutWindow')
  fw.add(content)
  fw.show_all()
  GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
    try {
      const [, natW] = (content as any).get_preferred_width()
      if (natW > 0) fw.set_size_request(natW, -1)
    } catch (_) {}
    return GLib.SOURCE_REMOVE
  })
  const close = () => {
    if (closed) return; closed = true
    try { fw.destroy() } catch (_) {}
  }
  return close
}

// ============================================================
//  GAUGE DRAWING HELPERS  (Cairo on DrawingArea)
// ============================================================
interface GaugeSeg { frac: number; r: number; g: number; b: number }

const _toRad    = (d: number) => (d * Math.PI) / 180
const _GSTART   = _toRad(150)   // start at ~7-8 o'clock
const _GSWEEP   = _toRad(240)   // 240° clockwise sweep, gap at bottom

function _textCenter(cr: any, text: string, cx: number, cy: number, fs: number) {
  cr.setFontSize(fs)
  try {
    const te = cr.textExtents(text)
    const tw = Array.isArray(te) ? (te[2] ?? 0) : (te.width ?? 0)
    const th = Array.isArray(te) ? (te[3] ?? 0) : (te.height ?? 0)
    cr.moveTo(cx - tw / 2, cy + th / 2)
  } catch (_) {
    cr.moveTo(cx - text.length * fs * 0.3, cy + fs * 0.35)
  }
  cr.showText(text)
}

function drawRadialGauge(
  cr: any, w: number, h: number,
  value: number, pctText: string, subText: string,
  colR: number, colG: number, colB: number
) {
  const cx = w / 2, cy = h / 2
  const r  = Math.min(w, h) * 0.36
  const lw = Math.max(4, r * 0.16)
  cr.setLineWidth(lw)
  try { cr.setLineCap(1) } catch (_) {}

  cr.setSourceRGBA(colR, colG, colB, 0.13)
  cr.arc(cx, cy, r, _GSTART, _GSTART + _GSWEEP)
  cr.stroke()

  if (value > 0.005) {
    cr.setSourceRGB(colR, colG, colB)
    cr.arc(cx, cy, r, _GSTART, _GSTART + _GSWEEP * Math.min(1, value))
    cr.stroke()
  }

  cr.setSourceRGB(0.91, 0.91, 0.91)
  _textCenter(cr, pctText, cx, cy, Math.max(8, r * 0.34))
  cr.setSourceRGB(0.45, 0.45, 0.45)
  _textCenter(cr, subText, cx, cy + r * 0.58, Math.max(6, r * 0.22))
}

function drawSegmentedGauge(
  cr: any, w: number, h: number,
  segs: GaugeSeg[], centerText: string, subText: string
) {
  const cx = w / 2, cy = h / 2
  const r  = Math.min(w, h) * 0.36
  const lw = Math.max(4, r * 0.16)
  cr.setLineWidth(lw)
  try { cr.setLineCap(1) } catch (_) {}

  cr.setSourceRGBA(0.13, 0.13, 0.13, 0.9)
  cr.arc(cx, cy, r, _GSTART, _GSTART + _GSWEEP)
  cr.stroke()

  let angle = _GSTART, remaining = 1.0
  for (const s of segs) {
    const frac = Math.min(Math.max(0, s.frac), remaining)
    remaining -= frac
    const sw = _GSWEEP * frac
    if (sw < 0.001) continue
    cr.setSourceRGB(s.r, s.g, s.b)
    cr.arc(cx, cy, r, angle, angle + sw)
    cr.stroke()
    angle += sw
  }

  cr.setSourceRGB(0.91, 0.91, 0.91)
  _textCenter(cr, centerText, cx, cy, Math.max(8, r * 0.32))
  cr.setSourceRGB(0.45, 0.45, 0.45)
  _textCenter(cr, subText, cx, cy + r * 0.58, Math.max(6, r * 0.20))
}

// ============================================================
//  CPU FLYOUT BUILDER
// ============================================================
function buildCpuFlyout(): Gtk.Widget {
  // ---- CPU reading ----
  let prevIdle = 0, prevTotal = 0
  const readCpuPct = (): number => {
    try {
      const [ok, raw] = GLib.file_get_contents('/proc/stat')
      if (!ok) return 0
      const parts = _dec.decode(raw).split('\n')[0].split(/\s+/).slice(1).map(Number)
      const idle  = parts[3] + (parts[4] ?? 0)
      const total = parts.reduce((a: number, b: number) => a + b, 0)
      const dI = idle - prevIdle, dT = total - prevTotal
      prevIdle = idle; prevTotal = total
      return dT > 0 ? Math.round((1 - dI / dT) * 100) : 0
    } catch (_) { return 0 }
  }
  readCpuPct()  // seed delta

  const readCpuName = (): string => {
    try {
      const [ok, raw] = GLib.file_get_contents('/proc/cpuinfo')
      if (!ok) return 'CPU'
      for (const line of _dec.decode(raw).split('\n')) {
        const m = line.match(/^model name\s*:\s*(.+)/)
        if (!m) continue
        const n = m[1].trim()
        const r = n.match(/\b(Ryzen\s+\d+\s+\d+\w*|Ryzen\s+\w+|Core\s+[im]\d+|i[3579]-\d+\w*|Xeon\s+\w+|EPYC\s+\w+)/)
        return r ? r[0] : n.replace(/\s*@.*$/, '').trim().slice(0, 18)
      }
    } catch (_) {}
    return 'CPU'
  }
  const cpuName = readCpuName()

  // ---- GPU reading (AMD sysfs → NVIDIA spawn_sync) ----
  interface GpuInfo { name: string; usedMB: number; totalMB: number; utilPct: number; ok: boolean }
  const readGpu = (): GpuInfo => {
    // AMD: try card0 then card1 (card0 may be iGPU on hybrid)
    for (let c = 0; c <= 1; c++) {
      try {
        const base = `/sys/class/drm/card${c}/device`
        const [b1, busyRaw] = GLib.file_get_contents(`${base}/gpu_busy_percent`)
        if (!b1) continue
        const util = parseInt(_dec.decode(busyRaw).trim()) || 0
        const [b2, usedRaw] = GLib.file_get_contents(`${base}/mem_info_vram_used`)
        const [b3, totRaw]  = GLib.file_get_contents(`${base}/mem_info_vram_total`)
        if (!b2 || !b3) continue
        const usedMB  = Math.round(parseInt(_dec.decode(usedRaw).trim()) / (1024 * 1024))
        const totalMB = Math.round(parseInt(_dec.decode(totRaw).trim())  / (1024 * 1024))
        let name = 'AMD GPU'
        try {
          const [nOk, nRaw] = GLib.file_get_contents(`${base}/product_name`)
          if (nOk) name = _dec.decode(nRaw).trim().replace(/.*\[/, '').replace(']', '').trim() || 'AMD GPU'
        } catch (_) {}
        return { name, usedMB, totalMB, utilPct: util, ok: true }
      } catch (_) { continue }
    }
    // NVIDIA
    try {
      if (GLib.find_program_in_path('nvidia-smi')) {
        const [b, out] = GLib.spawn_command_line_sync(
          'nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv,noheader,nounits'
        )
        if (b && out) {
          const parts = _dec.decode(out).trim().split(', ')
          if (parts.length >= 4) {
            return {
              name:     parts[0].replace('NVIDIA GeForce ', '').replace('NVIDIA ', '').trim(),
              usedMB:   parseInt(parts[1]) || 0,
              totalMB:  parseInt(parts[2]) || 0,
              utilPct:  parseInt(parts[3]) || 0,
              ok: true,
            }
          }
        }
      }
    } catch (_) {}
    return { name: 'No GPU', usedMB: 0, totalMB: 0, utilPct: 0, ok: false }
  }

  const GSIZE = 130
  let cpuPct  = 0
  let gpuData: GpuInfo = { name: '…', usedMB: 0, totalMB: 0, utilPct: 0, ok: false }

  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL, spacing: 8, visible: true,
    margin_top: 12, margin_bottom: 12, margin_start: 14, margin_end: 14,
  })
  root.get_style_context().add_class('bar-flyout-root')

  const hdr = new Gtk.Label({ label: '󰻠  SYSTEM', visible: true, xalign: 0 })
  hdr.get_style_context().add_class('bar-flyout-title')
  root.add(hdr)
  root.add(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL, visible: true }))

  const body = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 16, visible: true })
  body.set_halign(Gtk.Align.CENTER)
  root.add(body)

  // ---- CPU column ----
  const cpuSec = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4, visible: true })
  const cpuSubHdr = new Gtk.Label({ label: 'CPU', visible: true, xalign: 0.5 })
  cpuSubHdr.get_style_context().add_class('bar-flyout-sub-title')
  cpuSec.add(cpuSubHdr)

  const cpuDa = new Gtk.DrawingArea({ visible: true })
  cpuDa.set_size_request(GSIZE, GSIZE)
  cpuDa.connect('draw', (_w: any, cr: any) => {
    drawRadialGauge(cr, GSIZE, GSIZE, cpuPct / 100, `${cpuPct}%`, cpuName.slice(0, 14),
      0x89/255, 0xB1/255, 0x9E/255)
    return false
  })
  cpuSec.add(cpuDa)

  const cpuNameLbl = new Gtk.Label({ label: cpuName, visible: true, xalign: 0.5 })
  cpuNameLbl.get_style_context().add_class('gauge-legend-text')
  cpuNameLbl.set_max_width_chars(18); cpuNameLbl.set_ellipsize(3)
  cpuSec.add(cpuNameLbl)

  // ---- GPU column ----
  const gpuSec = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4, visible: true })
  const gpuSubHdr = new Gtk.Label({ label: 'GPU  VRAM', visible: true, xalign: 0.5 })
  gpuSubHdr.get_style_context().add_class('bar-flyout-sub-title')
  gpuSec.add(gpuSubHdr)

  const gpuDa = new Gtk.DrawingArea({ visible: true })
  gpuDa.set_size_request(GSIZE, GSIZE)
  gpuDa.connect('draw', (_w: any, cr: any) => {
    const d = gpuData
    if (!d.ok) {
      drawRadialGauge(cr, GSIZE, GSIZE, 0, 'N/A', 'No GPU', 0.4, 0.4, 0.4)
    } else {
      const vramPct = d.totalMB > 0 ? d.usedMB / d.totalMB : 0
      drawRadialGauge(cr, GSIZE, GSIZE, vramPct,
        `${Math.round(vramPct * 100)}%`, d.name.slice(0, 14),
        0.94, 0.64, 0.20)
    }
    return false
  })
  gpuSec.add(gpuDa)

  const gpuNameLbl = new Gtk.Label({ label: '—', visible: true, xalign: 0.5 })
  gpuNameLbl.get_style_context().add_class('gauge-legend-text')
  gpuNameLbl.set_max_width_chars(18); gpuNameLbl.set_ellipsize(3)
  gpuSec.add(gpuNameLbl)

  const gpuVramLbl = new Gtk.Label({ label: '', visible: true, xalign: 0.5 })
  gpuVramLbl.get_style_context().add_class('gauge-legend-text')
  gpuSec.add(gpuVramLbl)

  const gpuUtilLbl = new Gtk.Label({ label: '', visible: true, xalign: 0.5 })
  gpuUtilLbl.get_style_context().add_class('gauge-legend-text')
  gpuSec.add(gpuUtilLbl)

  body.add(cpuSec)
  body.add(new Gtk.Separator({ orientation: Gtk.Orientation.VERTICAL, visible: true }))
  body.add(gpuSec)

  const update = () => {
    cpuPct  = readCpuPct()
    gpuData = readGpu()
    cpuDa.queue_draw()
    gpuDa.queue_draw()
    if (gpuData.ok) {
      gpuNameLbl.set_label(gpuData.name)
      gpuVramLbl.set_label(`VRAM: ${gpuData.usedMB}/${gpuData.totalMB} MB`)
      gpuUtilLbl.set_label(`GPU:  ${gpuData.utilPct}%`)
    } else {
      gpuNameLbl.set_label(gpuData.name)
      gpuVramLbl.set_label('')
      gpuUtilLbl.set_label('')
    }
  }

  update()

  let alive = true
  const pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
    if (!alive) return GLib.SOURCE_REMOVE
    update(); return GLib.SOURCE_CONTINUE
  })
  root.connect('destroy', () => { alive = false; GLib.source_remove(pollId) })
  return root
}

// ============================================================
//  RAM FLYOUT BUILDER
// ============================================================
function buildRamFlyout(): Gtk.Widget {
  const COL_USED:  [number, number, number] = [0.94, 0.42, 0.55]
  const COL_CACHE: [number, number, number] = [0x89/255, 0xB1/255, 0x9E/255]
  const COL_FREE:  [number, number, number] = [0.25, 0.40, 0.32]
  const GSIZE = 130

  const readMem = () => {
    try {
      const [ok, raw] = GLib.file_get_contents('/proc/meminfo')
      if (!ok) return null
      const m: Record<string, number> = {}
      for (const line of _dec.decode(raw).split('\n')) {
        const p = line.match(/^(\w+):\s+(\d+)/)
        if (p) m[p[1]] = parseInt(p[2], 10)
      }
      const total = m['MemTotal'] ?? 0, free = m['MemFree'] ?? 0
      const avail = m['MemAvailable'] ?? 0
      const swapTotal = m['SwapTotal'] ?? 0, swapFree = m['SwapFree'] ?? 0
      return {
        total, free,
        used:        Math.max(0, total - avail),
        reclaimable: Math.max(0, avail - free),
        swapTotal, swapFree,
      }
    } catch (_) { return null }
  }

  const fmtKB = (kb: number) => {
    const gb = kb / (1024 * 1024)
    return gb >= 1 ? `${gb.toFixed(1)}G` : `${Math.round(kb / 1024)}M`
  }

  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL, spacing: 8, visible: true,
    margin_top: 12, margin_bottom: 12, margin_start: 14, margin_end: 14,
  })
  root.get_style_context().add_class('bar-flyout-root')

  const hdr = new Gtk.Label({ label: '󰍛  MEMORY', visible: true, xalign: 0 })
  hdr.get_style_context().add_class('bar-flyout-title')
  root.add(hdr)
  root.add(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL, visible: true }))

  const body = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 16, visible: true })
  root.add(body)

  const mkSection = (title: string) => {
    const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4, visible: true })
    const sh = new Gtk.Label({ label: title, visible: true, xalign: 0.5 })
    sh.get_style_context().add_class('bar-flyout-sub-title')
    box.add(sh)
    const da = new Gtk.DrawingArea({ visible: true })
    da.set_size_request(GSIZE, GSIZE)
    box.add(da)
    const legend = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, visible: true })
    box.add(legend)
    return { box, da, legend }
  }

  const mkRow = (parent: Gtk.Box, cr: number, cg: number, cb: number): Gtk.Label => {
    const hex = `#${Math.round(cr*255).toString(16).padStart(2,'0')}${Math.round(cg*255).toString(16).padStart(2,'0')}${Math.round(cb*255).toString(16).padStart(2,'0')}`
    const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4, visible: true })
    const dot = new Gtk.Label({ visible: true })
    dot.set_use_markup(true)
    dot.set_markup(`<span foreground="${hex}">●</span>`)
    dot.get_style_context().add_class('gauge-legend-dot')
    row.add(dot)
    const lbl = new Gtk.Label({ label: '—', visible: true, xalign: 0 })
    lbl.get_style_context().add_class('gauge-legend-text')
    row.add(lbl)
    parent.add(row)
    return lbl
  }

  const ram  = mkSection('RAM')
  const sep  = new Gtk.Separator({ orientation: Gtk.Orientation.VERTICAL, visible: true })
  const swap = mkSection('Swap')

  body.add(ram.box)
  body.add(sep)
  body.add(swap.box)

  const ramUsedLbl  = mkRow(ram.legend,  ...COL_USED)
  const ramCacheLbl = mkRow(ram.legend,  ...COL_CACHE)
  const ramFreeLbl  = mkRow(ram.legend,  ...COL_FREE)
  const swapUsedLbl = mkRow(swap.legend, ...COL_USED)
  const swapFreeLbl = mkRow(swap.legend, ...COL_FREE)

  let memData: ReturnType<typeof readMem> = null

  const update = () => {
    const d = readMem()
    memData = d
    if (!d) return
    const swapUsed = d.swapTotal - d.swapFree
    ramUsedLbl.set_label(`Used:  ${fmtKB(d.used)}`)
    ramCacheLbl.set_label(`Cache: ${fmtKB(d.reclaimable)}`)
    ramFreeLbl.set_label(`Free:  ${fmtKB(d.free)}`)
    swapUsedLbl.set_label(`Used: ${fmtKB(swapUsed)}`)
    swapFreeLbl.set_label(`Free: ${fmtKB(d.swapFree)}`)
    swap.box.set_visible(d.swapTotal > 0)
    sep.set_visible(d.swapTotal > 0)
    ram.da.queue_draw()
    swap.da.queue_draw()
  }

  ram.da.connect('draw', (_w: any, cr: any) => {
    const d = memData
    if (!d) return false
    const usedF  = d.total > 0 ? d.used / d.total : 0
    const cacheF = d.total > 0 ? d.reclaimable / d.total : 0
    const freeF  = d.total > 0 ? d.free / d.total : 0
    const totalG = d.total > 0 ? (d.total / (1024 * 1024)).toFixed(1) : '?'
    drawSegmentedGauge(cr, GSIZE, GSIZE, [
      { frac: usedF,  r: COL_USED[0],  g: COL_USED[1],  b: COL_USED[2]  },
      { frac: cacheF, r: COL_CACHE[0], g: COL_CACHE[1], b: COL_CACHE[2] },
      { frac: freeF,  r: COL_FREE[0],  g: COL_FREE[1],  b: COL_FREE[2]  },
    ], `${Math.round(usedF * 100)}%`, `of ${totalG}G`)
    return false
  })

  swap.da.connect('draw', (_w: any, cr: any) => {
    const d = memData
    if (!d) return false
    const swapUsed = d.swapTotal - d.swapFree
    const usedF = d.swapTotal > 0 ? swapUsed / d.swapTotal : 0
    const freeF = d.swapTotal > 0 ? d.swapFree / d.swapTotal : 0
    const totalG = d.swapTotal > 0 ? (d.swapTotal / (1024 * 1024)).toFixed(1) : '?'
    drawSegmentedGauge(cr, GSIZE, GSIZE, [
      { frac: usedF, r: COL_USED[0], g: COL_USED[1], b: COL_USED[2] },
      { frac: freeF, r: COL_FREE[0], g: COL_FREE[1], b: COL_FREE[2] },
    ], `${Math.round(usedF * 100)}%`, `of ${totalG}G`)
    return false
  })

  update()

  let alive = true
  const pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
    if (!alive) return GLib.SOURCE_REMOVE
    update(); return GLib.SOURCE_CONTINUE
  })
  root.connect('destroy', () => { alive = false; GLib.source_remove(pollId) })
  return root
}

// ============================================================
//  CPU WIDGET
// ============================================================
function CpuWidget({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const [cpuStr, setCpuStr] = createState('—')
  let prevIdle = 0, prevTotal = 0

  const readOverall = (): number => {
    try {
      const [ok, raw] = GLib.file_get_contents('/proc/stat')
      if (!ok) return 0
      const line  = _dec.decode(raw).split('\n')[0]
      const parts = line.split(/\s+/).slice(1).map(Number)
      const idle  = parts[3] + (parts[4] ?? 0)
      const total = parts.reduce((a: number, b: number) => a + b, 0)
      const dIdle = idle - prevIdle, dTotal = total - prevTotal
      prevIdle = idle; prevTotal = total
      return dTotal > 0 ? Math.round((1 - dIdle / dTotal) * 100) : 0
    } catch (_) { return 0 }
  }

  const update = () => setCpuStr(`${readOverall()}%`)
  update()
  const pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => { update(); return GLib.SOURCE_CONTINUE })
  onCleanup(() => GLib.source_remove(pollId))

  return (
    <button class="sys-btn sysmon-btn" tooltip_text="CPU – hover for details"
      $={(self: any) => {
        let closeFlyout: (() => void) | null = null
        let leaveTimer: any = null
        const cancelLeave = () => {
          if (leaveTimer) { GLib.source_remove(leaveTimer); leaveTimer = null }
        }
        self.connect('enter-notify-event', () => {
          cancelLeave()
          if (!closeFlyout) {
            const content = buildCpuFlyout()
            closeFlyout = openBarFlyout(gdkmonitor, content)
            content.connect('destroy', () => { closeFlyout = null })
          }
        })
        self.connect('leave-notify-event', () => {
          leaveTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
            leaveTimer = null
            if (closeFlyout) { closeFlyout(); closeFlyout = null }
            return GLib.SOURCE_REMOVE
          })
        })
        onCleanup(() => {
          cancelLeave()
          if (closeFlyout) { closeFlyout(); closeFlyout = null }
        })
      }}
    >
      <box spacing={4} valign={Gtk.Align.CENTER} halign={Gtk.Align.CENTER}>
        <label class="sys-icon" label="󰻠" />
        <label class="sysmon-val" label={cpuStr} xalign={0.5} />
      </box>
    </button>
  )
}

// ============================================================
//  RAM WIDGET
// ============================================================
function RamWidget({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const [ramStr, setRamStr] = createState('—')

  const readRam = (): number => {
    try {
      const [ok, raw] = GLib.file_get_contents('/proc/meminfo')
      if (!ok) return 0
      const m: Record<string, number> = {}
      for (const line of _dec.decode(raw).split('\n')) {
        const p = line.match(/^(\w+):\s+(\d+)/)
        if (p) m[p[1]] = parseInt(p[2], 10)
      }
      const total = m['MemTotal'] ?? 0, avail = m['MemAvailable'] ?? 0
      return total > 0 ? Math.round((1 - avail / total) * 100) : 0
    } catch (_) { return 0 }
  }

  const update = () => setRamStr(`${readRam()}%`)
  update()
  const pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => { update(); return GLib.SOURCE_CONTINUE })
  onCleanup(() => GLib.source_remove(pollId))

  return (
    <button class="sys-btn sysmon-btn" tooltip_text="RAM – hover for details"
      $={(self: any) => {
        let closeFlyout: (() => void) | null = null
        let leaveTimer: any = null
        const cancelLeave = () => {
          if (leaveTimer) { GLib.source_remove(leaveTimer); leaveTimer = null }
        }
        self.connect('enter-notify-event', () => {
          cancelLeave()
          if (!closeFlyout) {
            const content = buildRamFlyout()
            closeFlyout = openBarFlyout(gdkmonitor, content)
            content.connect('destroy', () => { closeFlyout = null })
          }
        })
        self.connect('leave-notify-event', () => {
          leaveTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
            leaveTimer = null
            if (closeFlyout) { closeFlyout(); closeFlyout = null }
            return GLib.SOURCE_REMOVE
          })
        })
        onCleanup(() => {
          cancelLeave()
          if (closeFlyout) { closeFlyout(); closeFlyout = null }
        })
      }}
    >
      <box spacing={4} valign={Gtk.Align.CENTER} halign={Gtk.Align.CENTER}>
        <label class="sys-icon" label="󰍛" />
        <label class="sysmon-val" label={ramStr} xalign={0.5} />
      </box>
    </button>
  )
}

// ============================================================
//  NOTIFICATION CENTER BELL
// ============================================================
function NotifBell({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const [dnd, setDnd] = createState(isDndEnabled())
  const unsub = subscribeDnd(() => setDnd(isDndEnabled()))
  onCleanup(unsub)

  return (
    <button
      class={dnd.as((d: boolean) => d ? 'sys-btn notif-bell dnd' : 'sys-btn notif-bell')}
      tooltip_text={dnd.as((d: boolean) => d ? 'Notifications (DND)' : 'Notifications')}
      onClicked={() => toggleNotifCenter(gdkmonitor)}
    >
      <label class="sys-icon" label={dnd.as((d: boolean) => d ? '󰂛' : '󰂚')} />
    </button>
  )
}

// ============================================================
//  TASKBAR
// ============================================================
function Taskbar() {
  const hypr = AstalHyprland.get_default()
  const clients = createBinding(hypr, "clients")

  return (
    <box class="taskbar" spacing={4}>
      <For each={clients}>
        {(client: any) => (
          <button
            class="task-btn"
            tooltip_text={client.title ?? client.class}
            onClicked={() => {
              const addr  = client.address
              const wsId  = (client as any).workspace?.id
              const focusCmd = `hyprctl dispatch 'hl.dsp.focus({window="address:${addr}"})'`
              const focus = () => execAsync(focusCmd)
                .catch(() => execAsync(`hyprctl dispatch 'hl.dsp.focus({window="class:${client.class}"})'`))
                .catch((e: any) => console.error('[taskbar]', e))
              if (wsId != null) {
                execAsync(`hyprctl dispatch 'hl.dsp.focus({workspace="${wsId}"})'`)
                  .then(focus).catch(focus)
              } else {
                focus()
              }
            }}
          >
            <Gtk.Image
              icon_name={client.class?.toLowerCase?.() ?? "application-x-executable-symbolic"}
              pixel_size={18}
            />
          </button>
        )}
      </For>
    </box>
  )
}

// ============================================================
//  SYSTEM TRAY  (status area — Steam, Discord, etc.)
// ============================================================
const TRAY_HIDDEN = new Set(['nm-applet', 'network-manager-applet', 'blueman', 'blueman-applet'])

function Tray() {
  const tray = AstalTray.get_default()
  const visibleItems = createBinding(tray, "items").as(
    (list: AstalTray.TrayItem[]) => list.filter(
      (item) => !TRAY_HIDDEN.has((item.id ?? '').toLowerCase())
    )
  )
  return (
    <box class="tray" spacing={2}>
      <For each={visibleItems}>
        {(item: AstalTray.TrayItem) => (
          <button class="tray-item"
            onClicked={() => { try { item.activate(0, 0) } catch (_) {} }}
            tooltip_text={createBinding(item, "title")}
            $={(self: any) => {
              self.add_events(Gdk.EventMask.BUTTON_PRESS_MASK)
              self.connect('button-press-event', (_: any, evt: any) => {
                const [, btn] = evt.get_button()
                if (btn === 3) {
                  try { item.about_to_show() } catch (_) {}
                  try {
                    const menu = item.create_menu()
                    if (menu) { menu.show_all(); menu.popup_at_widget(self, Gdk.Gravity.SOUTH, Gdk.Gravity.NORTH, null) }
                  } catch (_) {}
                  return true
                }
                return false
              })
            }}
          >
            <Gtk.Image gicon={createBinding(item, "gicon")} pixel_size={16} />
          </button>
        )}
      </For>
    </box>
  )
}

// ============================================================
//  BAR SEPARATOR
// ============================================================
function Sep() {
  return <box class="divider-v" />
}

// ============================================================
//  MAIN BOTTOM BAR
// ============================================================
export default function Bar(gdkmonitor: Gdk.Monitor) {
  let win: Astal.Window
  const { BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

  onCleanup(() => { try { win?.destroy() } catch (_) {} })

  return (
    <window
      $={(self: any) => (win = self)}
      visible
      class="Bar"
      namespace="ags-bar"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={BOTTOM | LEFT | RIGHT}
      application={app}
    >
      <box class="bar-root main-bar-root" spacing={0} homogeneous={true}>

        {/* ── LEFT ── Launcher | ColorPicker | Clock | Calendar | sep | Taskbar */}
        <box class="bar-left" halign={Gtk.Align.START} spacing={6} hexpand>
          <Launcher />
          <ColorPicker />
          <Clock />
          <CalendarWidget gdkmonitor={gdkmonitor} />
          <Sep />
          <Taskbar />
        </box>

        {/* ── CENTER ── Workspaces */}
        <box halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
          <WorkspacesWidget />
        </box>

        {/* ── RIGHT ── Tray | sep | Audio | sep | SysMon | sep | Net | BT | Bat | VPN | sep | Notif */}
        <box class="bar-right" halign={Gtk.Align.END} spacing={4} hexpand>
          <Tray />
          <Sep />
          <box class="audio-group" spacing={2}>
            <VolumeWidget />
            <MicWidget />
          </box>
          <Sep />
          <CpuWidget gdkmonitor={gdkmonitor} /><RamWidget gdkmonitor={gdkmonitor} />
          <Sep />
          <NetworkWidget />
          <BluetoothWidget />
          <BatteryWidget />
          <VpnWidget />
          <Sep />
          <NotifBell gdkmonitor={gdkmonitor} />
        </box>

      </box>
    </window>
  )
}
