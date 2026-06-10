import app from "ags/gtk3/app"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import GLib from "gi://GLib"
import AstalNotifd from "gi://AstalNotifd"
import GdkPixbuf from "gi://GdkPixbuf"
import { createState, createEffect, onCleanup } from "ags"

const _togglers = new Map<Gdk.Monitor, () => void>()
export function toggleNotifCenter(monitor: Gdk.Monitor) {
  _togglers.get(monitor)?.()
}

function timeAgo(epoch: number): string {
  const diff = Math.floor(Date.now() / 1000) - epoch
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function buildNotifItem(n: any, onDismiss: () => void): Gtk.Box {
  const urgency = n.urgency ?? 1

  const item = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL, spacing: 10,
    visible: true, margin_start: 2, margin_end: 2,
  })
  item.get_style_context().add_class('notif-item')
  item.get_style_context().add_class(`urgency-${urgency}`)

  // Icon
  const iconBox = new Gtk.Box({ visible: true, valign: Gtk.Align.START })
  iconBox.get_style_context().add_class('notif-icon-box')
  try {
    if (n.image) {
      const pb = GdkPixbuf.Pixbuf.new_from_file_at_scale(n.image, 32, 32, true)
      const img = new Gtk.Image({ visible: true })
      img.set_from_pixbuf(pb)
      iconBox.add(img)
    } else {
      const appIcon = n.appIcon ?? n.app_icon ?? ''
      const img = new Gtk.Image({ visible: true })
      img.set_from_icon_name(appIcon || 'dialog-information-symbolic', Gtk.IconSize.DND)
      img.set_pixel_size(32)
      iconBox.add(img)
    }
  } catch (_) {
    const img = new Gtk.Image({ visible: true })
    img.set_from_icon_name('dialog-information-symbolic', Gtk.IconSize.DND)
    img.set_pixel_size(32)
    iconBox.add(img)
  }
  item.add(iconBox)

  // Content
  const content = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL, spacing: 2,
    visible: true, hexpand: true, valign: Gtk.Align.START,
  })

  const headerRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6, visible: true })

  const appLbl = new Gtk.Label({
    label: n.appName ?? n.app_name ?? '',
    visible: true, xalign: 0,
  })
  appLbl.get_style_context().add_class('notif-app')
  headerRow.add(appLbl)

  const timeLbl = new Gtk.Label({
    label: timeAgo(n.time ?? 0),
    visible: true, xalign: 1, hexpand: true,
  })
  timeLbl.get_style_context().add_class('notif-time')
  headerRow.add(timeLbl)
  content.add(headerRow)

  if (n.summary) {
    const summaryLbl = new Gtk.Label({
      label: n.summary,
      visible: true, xalign: 0,
    })
    summaryLbl.get_style_context().add_class('notif-summary')
    summaryLbl.set_ellipsize(3)
    summaryLbl.set_max_width_chars(34)
    content.add(summaryLbl)
  }

  if (n.body) {
    const bodyLbl = new Gtk.Label({
      label: n.body,
      visible: true, xalign: 0,
    })
    bodyLbl.get_style_context().add_class('notif-body')
    bodyLbl.set_line_wrap(true)
    bodyLbl.set_max_width_chars(34)
    bodyLbl.set_ellipsize(3)
    content.add(bodyLbl)
  }

  item.add(content)

  // Dismiss
  const dismissBtn = new Gtk.Button({ visible: true, valign: Gtk.Align.CENTER })
  dismissBtn.get_style_context().add_class('notif-dismiss')
  const xLbl = new Gtk.Label({ label: '✕', visible: true })
  dismissBtn.add(xLbl)
  dismissBtn.connect('clicked', () => {
    try { n.dismiss?.() } catch (_) {}
    onDismiss()
  })
  item.add(dismissBtn)

  return item
}

export default function NotificationCenter(gdkmonitor: Gdk.Monitor) {
  let win: Astal.Window
  const { TOP, RIGHT } = Astal.WindowAnchor

  const notifd = AstalNotifd.get_default()
  const [notifs, setNotifs] = createState<any[]>([])

  const refresh = () => {
    try {
      const ns = notifd.get_notifications?.() ?? []
      setNotifs([...ns].reverse())
    } catch (_) { setNotifs([]) }
  }

  try { notifd.connect('notified',  () => refresh()) } catch (_) {}
  try { notifd.connect('resolved',  () => refresh()) } catch (_) {}
  refresh()

  _togglers.set(gdkmonitor, () => {
    try { if (win) win.set_visible(!win.get_visible()) } catch (_) {}
  })
  onCleanup(() => {
    _togglers.delete(gdkmonitor)
    try { win?.destroy() } catch (_) {}
  })

  return (
    <window
      $={(self: any) => (win = self)}
      visible={false}
      class="NotifCenter"
      namespace="ags-notif-center"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.IGNORE}
      layer={Astal.Layer.OVERLAY}
      anchor={TOP | RIGHT}
      marginTop={60}
      marginRight={8}
      keymode={Astal.Keymode.ON_DEMAND}
      application={app}
    >
      <box class="notif-panel" orientation={Gtk.Orientation.VERTICAL} spacing={0}
        $={(self: any) => {
          // Header
          const header = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL, spacing: 8,
            visible: true, margin_start: 14, margin_end: 14,
            margin_top: 12, margin_bottom: 8,
          })
          const titleLbl = new Gtk.Label({ label: '󰂚  Notifications', visible: true, xalign: 0, hexpand: true })
          titleLbl.get_style_context().add_class('notif-panel-title')
          header.add(titleLbl)

          const clearBtn = new Gtk.Button({ visible: true })
          clearBtn.get_style_context().add_class('notif-clear-btn')
          const clearLbl = new Gtk.Label({ label: '󰃢  Clear', visible: true })
          clearBtn.add(clearLbl)
          clearBtn.connect('clicked', () => {
            try {
              notifd.get_notifications?.()?.forEach((n: any) => {
                try { n.dismiss?.() } catch (_) {}
              })
            } catch (_) {}
            refresh()
          })
          header.add(clearBtn)
          self.add(header)

          const sep = new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL, visible: true })
          self.add(sep)

          // Scroll + list
          const scroll = new Gtk.ScrolledWindow({ visible: true })
          scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
          scroll.set_min_content_height(750)
          scroll.set_max_content_height(750)
          self.add(scroll)

          const list = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL, spacing: 4,
            visible: true,
            margin_start: 10, margin_end: 10,
            margin_top: 25, margin_bottom: 8,
          })
          scroll.add(list)

          const emptyLbl = new Gtk.Label({
            label: 'No notifications',
            visible: true, xalign: 0.5,
          })
          emptyLbl.get_style_context().add_class('notif-empty')

          createEffect(() => {
            const ns = notifs()
            list.get_children().forEach((c: any) => list.remove(c))

            if (ns.length === 0) {
              list.add(emptyLbl)
            } else {
              ns.forEach((n: any) => {
                const item = buildNotifItem(n, refresh)
                list.add(item)
              })
            }
            list.show_all()
          })

          self.show_all()
        }}
      />
    </window>
  )
}
