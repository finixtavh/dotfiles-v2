import app from "ags/gtk3/app"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import { execAsync } from "ags/process"

export default function PowerMenu() {
  const { CENTER } = Astal.WindowAnchor

  return (
    <window
      name="power-menu"
      class="PowerMenu"
      visible={false}
      keymode={Astal.Keymode.EXCLUSIVE}
      anchor={CENTER}
      exclusivity={Astal.Exclusivity.IGNORE}
      application={app}
      onKeyPressEvent={(self: any, event: any) => {
          const [, keyval] = event.get_keyval()
        if (keyval === Gdk.KEY_Escape) {
          self.set_visible(false)
        }
      }}
    >
      <box class="power-menu-root" orientation={Gtk.Orientation.VERTICAL} spacing={15}>
        <label class="power-menu-title" label="Session Menu" />
        <box class="power-menu-buttons" spacing={10}>
          
          <button class="power-btn shutdown" onClicked={() => { execAsync("systemctl poweroff"); app.get_window("power-menu")?.set_visible(false) }}>
            <box orientation={Gtk.Orientation.VERTICAL} spacing={5}>
              <label class="power-icon" label="󰐥" />
              <label class="power-label" label="Shut Down" />
            </box>
          </button>

          <button class="power-btn reboot" onClicked={() => { execAsync("systemctl reboot"); app.get_window("power-menu")?.set_visible(false) }}>
            <box orientation={Gtk.Orientation.VERTICAL} spacing={5}>
              <label class="power-icon" label="󰜉" />
              <label class="power-label" label="Restart" />
            </box>
          </button>

          <button class="power-btn suspend" onClicked={() => { execAsync("systemctl suspend"); app.get_window("power-menu")?.set_visible(false) }}>
            <box orientation={Gtk.Orientation.VERTICAL} spacing={5}>
              <label class="power-icon" label="󰤄" />
              <label class="power-label" label="Suspend" />
            </box>
          </button>

          <button class="power-btn lock" onClicked={() => { execAsync("hyprlock"); app.get_window("power-menu")?.set_visible(false) }}>
            <box orientation={Gtk.Orientation.VERTICAL} spacing={5}>
              <label class="power-icon" label="󰌾" />
              <label class="power-label" label="Lock" />
            </box>
          </button>

          <button class="power-btn logout" onClicked={() => { execAsync("hyprctl dispatch exit"); app.get_window("power-menu")?.set_visible(false) }}>
            <box orientation={Gtk.Orientation.VERTICAL} spacing={5}>
              <label class="power-icon" label="󰍃" />
              <label class="power-label" label="Log Out" />
            </box>
          </button>

        </box>
      </box>
    </window>
  )
}
