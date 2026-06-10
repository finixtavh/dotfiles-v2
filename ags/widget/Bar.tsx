import app from "ags/gtk3/app"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import GLib from "gi://GLib"
import AstalTray from "gi://AstalTray"
import AstalHyprland from "gi://AstalHyprland"
import AstalWp from "gi://AstalWp"
import AstalNetwork from "gi://AstalNetwork"
import AstalBluetooth from "gi://AstalBluetooth"
import { For, createBinding, createState, onCleanup } from "ags"
import { toggleNotifCenter } from "./NotificationCenter"
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
function CalendarWidget() {
  const dateStr = createPoll("Fecha", 1000, () => {
    const tz = GLib.TimeZone.new("America/Santiago")
    return GLib.DateTime.new_now(tz)?.format("%a %d %b") ?? "Fecha"
  })

  return (
    <button class="calendar-btn"
      tooltip_text="Click: mini calendar | Right-click: calcure"
      onClicked={(self: any) => {
        const popover = new Gtk.Popover({ relative_to: self })
        const cal = new Gtk.Calendar()
        popover.add(cal)
        cal.show()
        popover.popup()
      }}
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
        const iface = getPrimaryIface()
        if (iface) {
          found = true
          icon = iface.startsWith('w') ? '󰤢' : '󰈁'
        }
      }

      setNetIcon(icon)
      setNetSsid(ssid.length > 14 ? ssid.slice(0, 14) + '…' : ssid)

      const iface = getPrimaryIface()
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
//  NOTIFICATION CENTER BELL
// ============================================================
function NotifBell({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  return (
    <button class="sys-btn notif-bell" tooltip_text="Notifications"
      onClicked={() => toggleNotifCenter(gdkmonitor)}
    >
      <label class="sys-icon" label="󰂚" />
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
function Tray() {
  const tray = AstalTray.get_default()
  return (
    <box class="tray" spacing={2}>
      <For each={createBinding(tray, "items")}>
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
      <box class="bar-root main-bar-root" spacing={0}>

        {/* ── LEFT ── Launcher | Clock | Calendar | sep | Taskbar — hexpand pushes right group to edge */}
        <box class="bar-left" halign={Gtk.Align.START} spacing={6} hexpand>
          <Launcher />
          <Clock />
          <CalendarWidget />
          <Sep />
          <Taskbar />
        </box>

        {/* ── RIGHT ── Tray | sep | Audio | sep | Net | BT | VPN | sep | Notif */}
        <box class="bar-right" halign={Gtk.Align.END} spacing={4}>
          <Tray />
          <Sep />
          <box class="audio-group" spacing={2}>
            <VolumeWidget />
            <MicWidget />
          </box>
          <Sep />
          <NetworkWidget />
          <BluetoothWidget />
          <VpnWidget />
          <Sep />
          <NotifBell gdkmonitor={gdkmonitor} />
        </box>

      </box>
    </window>
  )
}
