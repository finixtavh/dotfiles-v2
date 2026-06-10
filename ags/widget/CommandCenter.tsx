import app from "ags/gtk3/app"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import { execAsync } from "ags/process"

// "PLACEHOLDER" gradient: #89B19E → #33473D
const _chars = 'COMMAND CENTER'.split('')
const _s = [0x89, 0xB1, 0x9E]
const _e = [0x33, 0x47, 0x3D]
const _h = (n: number) => n.toString(16).padStart(2, '0')
const _lp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t)

const TITLE_MARKUP = _chars.map((ch, i) => {
  const t = i / (_chars.length - 1)
  const r = _lp(_s[0], _e[0], t)
  const g = _lp(_s[1], _e[1], t)
  const b = _lp(_s[2], _e[2], t)
  return `<span foreground="#${_h(r)}${_h(g)}${_h(b)}">${ch}</span>`
}).join('')

const ACTIONS = [
  {
    icon:    '󰑓',
    label:   'Restart Bar',
    desc:    'Quit & relaunch AGS',
    cmd:     'ags quit -i ags-bar; sleep 0.3; nohup ags run >/dev/null 2>&1 &',
    isPower: false,
  },
  {
    icon:  '󰮯',
    label: 'System Update',
    desc:  'sudo pacman -Syyu',
    cmd:   'kitty --hold -e sudo pacman -Syyu',
    isPower: false,
  },
  {
    icon:  '󰸉',
    label: 'Wallpaper',
    desc:  'Open wallpicker',
    cmd:   'bash ~/.config/wallman/wallpicker.sh',
    isPower: false,
  },
  {
    icon:    '󰐥',
    label:   'Power',
    desc:    'Session options',
    cmd:     'ags toggle -i ags-bar power-menu',
    isPower: true,
  },
]

export default function CommandCenter() {
  let win: Astal.Window
  const { CENTER } = Astal.WindowAnchor

  const close = () => {
    try { win?.set_visible(false) } catch (_) {}
  }

  return (
    <window
      $={(self: any) => (win = self)}
      name="command-center"
      class="CommandCenter"
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
      <box class="cmd-root" orientation={Gtk.Orientation.VERTICAL} spacing={24}>

        {/* Title with per-character gradient */}
        <label class="cmd-title"
          $={(self: any) => {
            self.set_use_markup(true)
            self.set_markup(TITLE_MARKUP)
            self.set_halign(Gtk.Align.CENTER)
          }}
        />

        <box class="cmd-sep" />

        {/* Action buttons */}
        <box spacing={16} halign={Gtk.Align.CENTER}>
          {ACTIONS.map(({ icon, label, desc, cmd, isPower }) => (
            <button
              class={isPower ? 'cmd-btn cmd-btn-power' : 'cmd-btn'}
              onClicked={() => {
                close()
                execAsync(['bash', '-c', cmd]).catch(() => {})
              }}
            >
              <box orientation={Gtk.Orientation.VERTICAL} spacing={8}
                halign={Gtk.Align.CENTER}
                margin_top={4} margin_bottom={4}
                margin_start={4} margin_end={4}
              >
                <label class={isPower ? 'cmd-btn-icon cmd-btn-icon-power' : 'cmd-btn-icon'}
                  label={icon} halign={Gtk.Align.CENTER} />
                <label class="cmd-btn-label" label={label} halign={Gtk.Align.CENTER} />
                <label class="cmd-btn-desc"  label={desc}  halign={Gtk.Align.CENTER} />
              </box>
            </button>
          ))}
        </box>

        <label class="cmd-hint" label="Press Esc to close" halign={Gtk.Align.CENTER} />

      </box>
    </window>
  )
}
