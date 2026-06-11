import app from "ags/gtk3/app"
import style from "./style.scss"
import Bar from "./widget/Bar"
import MusicBar from "./widget/MusicBar"
import PowerMenu from "./widget/PowerMenu"
import OSD from "./widget/OSD"
import NotificationCenter from "./widget/NotificationCenter"
import CommandCenter from "./widget/CommandCenter"
import Keybinds from "./widget/Keybinds"
import SettingsPanel from "./widget/SettingsPanel"

app.start({
  instanceName: "ags-bar",
  css: style,
  main() {
    const monitors = app.get_monitors()
    monitors.map(monitor => {
      Bar(monitor)
      MusicBar(monitor)
      NotificationCenter(monitor)
    })
    OSD(monitors[0])
    PowerMenu()
    CommandCenter()
    Keybinds()
    SettingsPanel()
  },
})
