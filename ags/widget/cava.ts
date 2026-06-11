import { subprocess, execAsync } from "ags/process"
import Gdk from "gi://Gdk"
import GLib from "gi://GLib"

export const NUM_BARS = 20
export const cavaData = { bars: Array(NUM_BARS).fill(0) as number[] }

const SETTINGS_FILE = `${GLib.get_home_dir()}/.config/ags/user-settings.json`

function detectRefreshHz(): number {
  try {
    const mon = Gdk.Display.get_default()?.get_monitor(0)
    if (mon) {
      const mhz = (mon as any).get_refresh_rate?.()
      if (mhz && mhz > 0) return Math.round(mhz / 1000)
    }
  } catch (_) {}
  return 60
}

function loadSettings(): Record<string, any> {
  try {
    const [ok, raw] = GLib.file_get_contents(SETTINGS_FILE)
    if (ok) return JSON.parse(new TextDecoder().decode(raw))
  } catch (_) {}
  return {}
}

export const GDK_HZ = detectRefreshHz()

const _settings  = loadSettings()
const _autoHz    = _settings.cavaAutoHz !== false
const _manualHz  = typeof _settings.cavaManualHz === 'number' ? _settings.cavaManualHz : GDK_HZ

export let REFRESH_HZ = _autoHz ? GDK_HZ : _manualHz

function buildCavaPy(hz: number): string {
  return `
import sys, subprocess, tempfile, os, signal
N=20
conf="""[general]
bars=20
framerate=${hz}
sensitivity=200
autosens=1
lower_cutoff_freq=25
higher_cutoff_freq=15000

[input]
method=pipewire
source=auto

[output]
method=raw
raw_target=/dev/stdout
bit_format=8bit
bar_delimiter = 0
channels=mono

[smoothing]
noise_reduction=17
"""
with tempfile.NamedTemporaryFile(mode='w',suffix='.conf',delete=False) as f:
    f.write(conf); cfg=f.name
p=subprocess.Popen(['cava','-p',cfg],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
signal.signal(signal.SIGTERM,lambda*_:(p.terminate(),os.unlink(cfg),sys.exit(0)))
try:
    while True:
        data=p.stdout.read(N)
        if not data or len(data)<N: break
        sys.stdout.write(';'.join(str(b) for b in data)+'\\n'); sys.stdout.flush()
except: pass
finally:
    p.terminate()
    try: os.unlink(cfg)
    except: pass
`
}

let _proc: any     = null
let _started       = false
let _currentHz     = REFRESH_HZ

function startCavaSubprocess(hz: number) {
  try {
    _proc = subprocess(
      ['python3', '-c', buildCavaPy(hz)],
      (line: string) => {
        const vals = line.trim().split(';').map(Number)
        for (let i = 0; i < NUM_BARS; i++) {
          const v = vals[i]
          if (v !== undefined && !isNaN(v)) cavaData.bars[i] = v
        }
      },
      () => {}
    ) as any
  } catch (_) {}
}

export function ensureCavaStarted() {
  if (_started) return
  _started = true
  startCavaSubprocess(_currentHz)
}

export function restartCavaWithHz(hz: number) {
  REFRESH_HZ   = hz
  _currentHz   = hz
  try { execAsync(['pkill', '-x', 'cava']).catch(() => {}) } catch (_) {}
  try { (_proc as any)?.force_exit?.() } catch (_) {}
  _proc = null
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 600, () => {
    startCavaSubprocess(hz)
    return GLib.SOURCE_REMOVE
  })
}
