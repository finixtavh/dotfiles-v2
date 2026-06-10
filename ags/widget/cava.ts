// Shared CAVA singleton — single subprocess, shared buffer
// Both MusicBar spectrum and Bar bottom-spectrum read cavaData.
import { subprocess } from "ags/process"

export const NUM_BARS = 20
export const cavaData = { bars: Array(NUM_BARS).fill(0) as number[] }

const CAVA_PY = `
import sys, subprocess, tempfile, os, signal
N=20
conf="""[general]
bars=20
framerate=144
sensitivity=175
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
channels=mono

[smoothing]
noise_reduction=25
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

let _started = false
export function ensureCavaStarted() {
  if (_started) return
  _started = true
  try {
    subprocess(
      ['python3', '-c', CAVA_PY],
      (line: string) => {
        const vals = line.trim().split(';').map(Number)
        for (let i = 0; i < NUM_BARS; i++) {
          const v = vals[i]
          if (v !== undefined && !isNaN(v)) cavaData.bars[i] = v
        }
      },
      () => {}
    )
  } catch (_) {}
}
