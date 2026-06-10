import app from "ags/gtk3/app"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import GdkPixbuf from "gi://GdkPixbuf"
import GLib from "gi://GLib"
import Gio from "gi://Gio"
import AstalMpris from "gi://AstalMpris"
import { createBinding, onCleanup, createState, createEffect } from "ags"
import { execAsync } from "ags/process"
import { NUM_BARS, cavaData, ensureCavaStarted } from "./cava"

// ============================================================
//  TYPES
// ============================================================
interface LyricLine {
  start: number   // microseconds
  end:   number   // microseconds
  text:  string
}

interface LyricFile {
  path:        string
  name:        string | null
  other:       string[]
  author:      string | null
  authorOther: string[]
  lines:       LyricLine[]
}

interface CacheEntry {
  lyricFile:    LyricFile | null
  playCount:    number
  lastPlayedAt: number
}

const NO_TRACK = '/org/mpris/MediaPlayer2/TrackList/NoTrack'
const DECAY_λ  = 0.001

function normalizeSongStr(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s*[\(\[](remaster(?:ed)?|live|feat\.?|ft\.?|explicit|radio\s*edit)[^\)\]]*[\)\]]/gi, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isTrackLevelId(tid: string): boolean {
  const base = tid.replace(/^\/org\/mpris\/MediaPlayer2\//, '')
  return base.includes('/')
}

function buildSongId(player: AstalMpris.Player): string {
  const tid = player.trackid
  if (tid && tid !== NO_TRACK && isTrackLevelId(tid)) return `tid:${tid}`
  const t = normalizeSongStr(player.title  ?? '')
  const a = normalizeSongStr(player.artist ?? '')
  return `norm:${a}|${t}`
}

// ============================================================
//  TIMESTAMP PARSING
// ============================================================
function parseTimeMicros(raw: string): number {
  const match = raw.trim().match(/^(\d+):(\d{2})(?:\.(\d+))?$/)
  if (!match) return 0
  const mins = parseInt(match[1], 10)
  const secs = parseInt(match[2], 10)
  const frac = parseInt((match[3] ?? '').padEnd(6, '0').slice(0, 6), 10)
  return (mins * 60 + secs) * 1_000_000 + frac
}

function fmtMicros(us: number): string {
  const totalSecs = Math.floor(us / 1_000_000)
  const m    = Math.floor(totalSecs / 60)
  const s    = totalSecs % 60
  const frac = us % 1_000_000
  const base = `${m}:${String(s).padStart(2, '0')}`
  if (frac === 0) return base
  return `${base}.${String(frac).padStart(6, '0').replace(/0+$/, '')}`
}

// ============================================================
//  .LYR FILE PARSER
// ============================================================
const decoder = new TextDecoder()

function parseLyrFile(path: string, content: string): LyricFile {
  const result: LyricFile = { path, name: null, other: [], author: null, authorOther: [], lines: [] }
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    let m: RegExpMatchArray | null
    if ((m = line.match(/^name:\s*"(.+)"$/i)))         { result.name        = m[1]; continue }
    if ((m = line.match(/^other:\s*"(.+)"$/i)))         { result.other       = m[1].split(',').map(s => s.trim()); continue }
    if ((m = line.match(/^author:\s*"(.+)"$/i)))        { result.author      = m[1]; continue }
    if ((m = line.match(/^author_other:\s*"(.+)"$/i)))  { result.authorOther = m[1].split(',').map(s => s.trim()); continue }
    if ((m = line.match(/^\(\s*([^-]+?)\s*-\s*([^)]+?)\s*\):\s*"(.*)"$/))) {
      const start = parseTimeMicros(m[1])
      const end   = parseTimeMicros(m[2])
      if (start >= end) { console.warn(`[lyrics] Invalid range: "${m[3]}" @ ${path}`); continue }
      result.lines.push({ start, end, text: m[3] })
    }
  }
  return result
}

// ============================================================
//  DISK INDEX
// ============================================================
const LYRICS_DIR = `${GLib.get_home_dir()}/lyrics`
let lyricsIndex: Map<string, LyricFile[]> = new Map()
let indexReady  = false

const normKey = (s: string) => s.toLowerCase().trim()

function buildIndex() {
  lyricsIndex = new Map()
  indexReady  = false
  if (!GLib.file_test(LYRICS_DIR, GLib.FileTest.IS_DIR)) { indexReady = true; return }
  try {
    const d = GLib.Dir.open(LYRICS_DIR, 0)
    let fn = d.read_name()
    while (fn) {
      if (fn.endsWith('.lyr')) {
        const fp = `${LYRICS_DIR}/${fn}`
        try {
          const [ok, raw] = GLib.file_get_contents(fp)
          if (ok) {
            const parsed = parseLyrFile(fp, decoder.decode(raw))
            const keys   = [fn.replace(/\.lyr$/i, ''), ...(parsed.name ? [parsed.name] : []), ...parsed.other]
              .map(normKey).filter(Boolean)
            for (const k of keys) {
              if (!lyricsIndex.has(k)) lyricsIndex.set(k, [])
              lyricsIndex.get(k)!.push(parsed)
            }
          }
        } catch (e) { console.warn(`[lyrics] Error reading ${fp}:`, e) }
      }
      fn = d.read_name()
    }
    d.close()
  } catch (e) { console.warn('[lyrics] Dir open error:', e) }
  indexReady = true
  console.log(`[lyrics] Index: ${lyricsIndex.size} aliases, dir: ${LYRICS_DIR}`)
}

function watchLyricsDir() {
  try {
    GLib.mkdir_with_parents(LYRICS_DIR, 0o755)
    const monitor = Gio.File.new_for_path(LYRICS_DIR)
      .monitor_directory(Gio.FileMonitorFlags.NONE, null)
    let debounce: any = null
    monitor.connect('changed', () => {
      if (debounce) GLib.source_remove(debounce)
      debounce = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 400, () => {
        buildIndex(); debounce = null; return GLib.SOURCE_REMOVE
      })
    })
    ;(globalThis as any).__lyricsMonitor = monitor
  } catch (e) { console.warn('[lyrics] Cannot watch dir:', e) }
}

buildIndex()
watchLyricsDir()

// ============================================================
//  DISK LOOKUP
// ============================================================
function lookupOnDisk(title: string, artist: string): LyricFile | null {
  if (!indexReady || !title) return null
  const tn = normKey(title)
  const an = normKey(artist)

  const scoreOf = (lf: LyricFile): number => {
    const allAuthors = [
      ...(lf.author      ? [normKey(lf.author)] : []),
      ...lf.authorOther.map(normKey),
    ]
    if (allAuthors.length > 0) {
      if (!allAuthors.some(a => an.includes(a) || a.includes(an))) return -1
    }
    if (lf.name && normKey(lf.name) === tn) return 3
    if (lf.name && (normKey(lf.name).includes(tn) || tn.includes(normKey(lf.name)))) return 2
    if (lf.other.some(o => normKey(o) === tn)) return 2
    if (lf.other.some(o => normKey(o).includes(tn) || tn.includes(normKey(o)))) return 1
    return 0
  }

  const seen  = new Set<LyricFile>()
  const cands: LyricFile[] = []
  for (const [k, files] of lyricsIndex) {
    if (tn.includes(k) || k.includes(tn)) {
      for (const f of files) if (!seen.has(f)) { seen.add(f); cands.push(f) }
    }
  }
  if (!cands.length) return null
  return cands.map(f => ({ f, s: scoreOf(f) })).filter(x => x.s >= 0).sort((a, b) => b.s - a.s)[0]?.f ?? null
}

// ============================================================
//  MEMORY CACHE
// ============================================================
const MAX_CACHE  = 200
const lyricCache = new Map<string, CacheEntry>()

function cacheScore(e: CacheEntry): number {
  const t = (Date.now() - e.lastPlayedAt) / 1000
  return e.playCount * Math.exp(-DECAY_λ * t)
}

function cacheLookup(songId: string, title: string, artist: string): LyricFile | null {
  const hit = lyricCache.get(songId)
  if (hit) {
    hit.playCount++
    hit.lastPlayedAt = Date.now()
    return hit.lyricFile
  }
  const found = lookupOnDisk(title, artist)
  if (lyricCache.size >= MAX_CACHE) {
    let worstKey = '', worstScore = Infinity
    for (const [k, v] of lyricCache) {
      const s = cacheScore(v)
      if (s < worstScore) { worstScore = s; worstKey = k }
    }
    if (worstKey) lyricCache.delete(worstKey)
  }
  lyricCache.set(songId, { lyricFile: found, playCount: 1, lastPlayedAt: Date.now() })
  return found
}

// ============================================================
//  LINE FINDER
// ============================================================
function findActiveLine(lines: LyricLine[], posMicros: number): number {
  for (let i = 0; i < lines.length; i++) {
    if (posMicros >= lines[i].start && posMicros < lines[i].end) return i
  }
  return -1
}

// ============================================================
//  ALBUM ART
// ============================================================
function AlbumArt({ player }: { player: AstalMpris.Player }) {
  return (
    <box class="album-art-box"
      $={(self: any) => {
        const img = new Gtk.Image()
        img.set_pixel_size(36)
        img.set_from_icon_name('audio-x-generic-symbolic', Gtk.IconSize.DND)
        self.add(img); img.show()
        const ART_SIZE = 36
        const setArt = (cover: string) => {
          const path = cover || (() => {
            const url: string = (player as any).artUrl ?? ''
            return url.startsWith('file://') ? decodeURIComponent(url.slice(7)) : ''
          })()
          try {
            if (path) {
              const pb = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, ART_SIZE, ART_SIZE, true)
              img.set_from_pixbuf(pb)
            } else {
              img.set_from_icon_name('audio-x-generic-symbolic', Gtk.IconSize.DND)
            }
          } catch (_) {
            img.set_from_icon_name('audio-x-generic-symbolic', Gtk.IconSize.DND)
          }
        }
        createBinding(player, 'coverArt').subscribe(setArt)
        createBinding(player, 'artUrl').subscribe(() => setArt((player as any).coverArt ?? ''))
      }}
    />
  )
}

// ============================================================
//  MEDIA INFO
// ============================================================
function MediaInfo({ player }: { player: AstalMpris.Player }) {
  const title  = createBinding(player, 'title').as((t: string) =>
    !t ? 'No music' : t.length > 22 ? t.slice(0, 22) + '…' : t)
  const artist = createBinding(player, 'artist').as((a: string) =>
    !a ? 'Unknown artist' : a.length > 16 ? a.slice(0, 16) + '…' : a)
  return (
    <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} class="media-info">
      <label class="song-title"  label={title}  xalign={0} />
      <label class="song-artist" label={artist} xalign={0} />
    </box>
  )
}

// ============================================================
//  MEDIA CONTROLS
// ============================================================
function MediaControls({ player }: { player: AstalMpris.Player }) {
  const status    = createBinding(player, 'playbackStatus')
  const playIcon  = status.as((s: AstalMpris.PlaybackStatus) =>
    s === AstalMpris.PlaybackStatus.PLAYING ? '󰏤' : '󰐊')
  const playClass = status.as((s: AstalMpris.PlaybackStatus) =>
    s === AstalMpris.PlaybackStatus.PLAYING ? 'ctrl-btn play active' : 'ctrl-btn play')
  return (
    <box class="media-controls" spacing={6} valign={Gtk.Align.CENTER}>
      <button class="ctrl-btn" onClicked={() => player.previous()}>
        <label label="󰒮" />
      </button>
      <button class={playClass} onClicked={() => player.play_pause()}>
        <label label={playIcon} />
      </button>
      <button class="ctrl-btn" onClicked={() => player.next()}>
        <label label="󰒭" />
      </button>
    </box>
  )
}

// ============================================================
//  PROGRESS BAR (music bar strip)
// ============================================================
function ProgressBar({ player }: { player: AstalMpris.Player }) {
  return (
    <box class="progress-bar-container" valign={Gtk.Align.CENTER} hexpand
      $={(self: any) => {
        const adj = new Gtk.Adjustment({ lower: 0, upper: 1, value: 0, step_increment: 0.01, page_increment: 0.1 })
        const scale = new Gtk.Scale({
          orientation: Gtk.Orientation.HORIZONTAL,
          adjustment: adj,
          draw_value: false,
          visible: true,
        })
        scale.get_style_context().add_class('song-seek-scale')
        scale.set_hexpand(true)
        self.add(scale)

        let isSeeking = false
        let curLen = 0

        scale.add_events(Gdk.EventMask.BUTTON_PRESS_MASK | Gdk.EventMask.BUTTON_RELEASE_MASK)
        scale.connect('button-press-event', () => { isSeeking = true; return false })
        scale.connect('button-release-event', () => {
          isSeeking = false
          const target = adj.get_value() * curLen
          if (curLen > 0) execAsync(['playerctl', 'position', target.toFixed(3)]).catch(() => {})
          return false
        })

        const pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
          try {
            const pos = player.position
            const len = player.length
            curLen = len
            if (!isSeeking) adj.set_value(len > 0 ? Math.min(1, Math.max(0, pos / len)) : 0)
          } catch (_) {}
          return GLib.SOURCE_CONTINUE
        })
        onCleanup(() => GLib.source_remove(pollId))
      }}
    />
  )
}

// ============================================================
//  FLYOUT WINDOW — OVERLAY layer-shell (not Gtk.Popover)
// ============================================================
function openFlyoutWin(gdkmonitor: Gdk.Monitor, content: Gtk.Widget): () => void {
  let closed = false

  const flyWin = new (Astal.Window as any)({
    gdkmonitor,
    exclusivity:   Astal.Exclusivity.IGNORE,
    layer:         Astal.Layer.OVERLAY,
    anchor:        Astal.WindowAnchor.TOP,
    margin_top:    40,
    keymode:       Astal.Keymode.NONE,
    application:   app,
  }) as Astal.Window
  flyWin.get_style_context().add_class('FlyoutWindow')
  flyWin.add(content)
  flyWin.show_all()

  // Explicitly resize the layer-shell surface after GTK has measured content.
  // Margins on the child widget alone are not reliably reflected in the
  // Wayland surface size — we must set it on the window directly.
  GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
    try {
      const [, natW] = (content as any).get_preferred_width()
      const margins = (content as any).get_margin_start() + (content as any).get_margin_end()
      if (natW > 0) flyWin.set_size_request(natW + margins, -1)
    } catch (_) {}
    return GLib.SOURCE_REMOVE
  })

  const close = () => {
    if (closed) return
    closed = true
    try { flyWin.destroy() } catch (_) {}
  }
  return close
}

// ============================================================
//  NOW-PLAYING FLYOUT (hover album art / song name)
// ============================================================
function buildNowPlayingContent(player: AstalMpris.Player): Gtk.Box {
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL, spacing: 12,
    margin_top: 25, margin_bottom: 16,
    margin_start: 83, margin_end: 83, visible: true,
  })
  root.get_style_context().add_class('npp-root')

  // ── Top row: art + title/artist ────────────────────────
  const topRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 14, visible: true })
  root.add(topRow)

  const artImg = new Gtk.Image({ visible: true })
  artImg.get_style_context().add_class('npp-art')
  const updateArt = () => {
    const cover: string = (player as any).coverArt ?? ''
    const artUrl: string = (player as any).artUrl ?? ''
    const path = cover || (artUrl.startsWith('file://') ? decodeURIComponent(artUrl.slice(7)) : '')
    try {
      if (path) {
        const pb = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, 128, 128, true)
        artImg.set_from_pixbuf(pb)
      } else {
        artImg.set_from_icon_name('audio-x-generic-symbolic', Gtk.IconSize.DND)
        artImg.set_pixel_size(128)
      }
    } catch (_) {
      artImg.set_from_icon_name('audio-x-generic-symbolic', Gtk.IconSize.DND)
      artImg.set_pixel_size(128)
    }
  }
  updateArt()
  topRow.add(artImg)

  const infoBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL, spacing: 6,
    visible: true, valign: Gtk.Align.CENTER,
  })
  topRow.add(infoBox)

  const titleLbl = new Gtk.Label({ visible: true, xalign: 0 })
  titleLbl.get_style_context().add_class('npp-title')
  titleLbl.set_ellipsize(3)
  titleLbl.set_max_width_chars(26)
  infoBox.add(titleLbl)

  const artistLbl = new Gtk.Label({ visible: true, xalign: 0 })
  artistLbl.get_style_context().add_class('npp-artist')
  artistLbl.set_ellipsize(3)
  artistLbl.set_max_width_chars(26)
  infoBox.add(artistLbl)

  root.add(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL, visible: true }))

  // ── Seekable progress: pos ─── scale ─── dur ───────────
  const progRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10, visible: true })
  root.add(progRow)

  const posLbl = new Gtk.Label({ label: '0:00', visible: true })
  posLbl.get_style_context().add_class('npp-time')
  progRow.add(posLbl)

  const adj = new Gtk.Adjustment({ lower: 0, upper: 1, value: 0, step_increment: 0.01, page_increment: 0.1 })
  const progScale = new Gtk.Scale({
    orientation: Gtk.Orientation.HORIZONTAL,
    adjustment: adj,
    draw_value: false,
    visible: true,
  })
  progScale.get_style_context().add_class('npp-scale')
  progScale.set_hexpand(true)
  progRow.add(progScale)

  const durLbl = new Gtk.Label({ label: '0:00', visible: true })
  durLbl.get_style_context().add_class('npp-time')
  progRow.add(durLbl)

  // ── Spectrum visualizer (Cairo) ────────────────────────
  const SPEC_COLORS: [number, number, number][] = [
    [0x89/255, 0xB1/255, 0x9E/255],
    [0x74/255, 0xA0/255, 0x8B/255],
    [0x5F/255, 0x8E/255, 0x79/255],
    [0x4D/255, 0x6B/255, 0x5C/255],
    [0x33/255, 0x47/255, 0x3D/255],
  ]
  const specDA = new Gtk.DrawingArea({ visible: true })
  specDA.set_size_request(NUM_BARS * 8, 44)
  specDA.set_hexpand(true)
  root.add(specDA)

  specDA.connect('draw', (_w: any, cr: any) => {
    const dw   = specDA.get_allocated_width()
    const dh   = specDA.get_allocated_height()
    const step = Math.floor(dw / NUM_BARS)
    const bw   = Math.max(2, step - 2)
    const seg  = Math.ceil(NUM_BARS / SPEC_COLORS.length)
    for (let i = 0; i < NUM_BARS; i++) {
      const v  = cavaData.bars[i] ?? 0
      const bh = Math.max(3, Math.round((v / 255) * dh))
      const [r, g, b] = SPEC_COLORS[Math.min(Math.floor(i / seg), SPEC_COLORS.length - 1)]
      cr.setSourceRGB(r, g, b)
      cr.rectangle(i * step, dh - bh, bw, bh)
      cr.fill()
    }
    return false
  })

  root.show_all()

  // ── Poll progress + spectrum ────────────────────────────
  const fmtSec = (s: number): string => {
    const m = Math.floor(Math.max(0, s) / 60)
    const ss = Math.floor(Math.max(0, s) % 60)
    return `${m}:${String(ss).padStart(2, '0')}`
  }

  let lastCover  = ''
  let alive      = true
  let isSeeking  = false
  let curLen     = 0

  progScale.add_events(Gdk.EventMask.BUTTON_PRESS_MASK | Gdk.EventMask.BUTTON_RELEASE_MASK)
  progScale.connect('button-press-event', () => { isSeeking = true; return false })
  progScale.connect('button-release-event', () => {
    isSeeking = false
    const target = adj.get_value() * curLen
    if (curLen > 0) execAsync(['playerctl', 'position', target.toFixed(3)]).catch(() => {})
    return false
  })

  let pollId: any = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
    if (!alive) return GLib.SOURCE_REMOVE
    try {
      titleLbl.set_label(player.title  ?? '')
      artistLbl.set_label(player.artist ?? '')

      const curCover = (player as any).coverArt ?? (player as any).artUrl ?? ''
      if (curCover !== lastCover) { lastCover = curCover; updateArt() }

      const pos = player.position
      const len = player.length
      curLen = len
      posLbl.set_label(fmtSec(pos))
      durLbl.set_label(fmtSec(len))
      if (!isSeeking) adj.set_value(len > 0 ? Math.min(1, Math.max(0, pos / len)) : 0)

      specDA.queue_draw()
    } catch (_) { alive = false; return GLib.SOURCE_REMOVE }
    return GLib.SOURCE_CONTINUE
  })

  root.connect('destroy', () => {
    alive = false
    if (pollId != null) { GLib.source_remove(pollId); pollId = null }
  })

  return root
}

// ============================================================
//  LYRICS VIEWER
// ============================================================
function LyricsViewer({ player, gdkmonitor }: { player: AstalMpris.Player, gdkmonitor: Gdk.Monitor }) {
  let lyricsFile: LyricFile | null = null
  let activeIdx = -1

  const [lyricText,   setLyricText]   = createState('No lyrics loaded')
  const [lyricsFound, setLyricsFound] = createState(false)

  const reload = () => {
    lyricsFile = null
    activeIdx  = -1
    setLyricsFound(false)
    setLyricText('No lyrics loaded')

    const title  = player.title  ?? ''
    const artist = player.artist ?? ''
    if (!title) return

    const songId = buildSongId(player)
    const found  = cacheLookup(songId, title, artist)
    if (found) {
      lyricsFile = found
      setLyricsFound(true)
      setLyricText('♫ ... ♫')
      console.log(`[lyrics] Loaded (${songId}): ${found.path}`)
    }
  }

  const unsubTitle  = createBinding(player, 'title').subscribe(reload)
  const unsubArtist = createBinding(player, 'artist').subscribe(reload)

  const pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
    if (lyricsFile && player.playbackStatus === AstalMpris.PlaybackStatus.PLAYING) {
      const posMicros = player.position * 1_000_000
      const idx = findActiveLine(lyricsFile.lines, posMicros)
      if (idx !== activeIdx) {
        activeIdx = idx
        setLyricText(idx >= 0 ? lyricsFile.lines[idx].text : '♫ ... ♫')
      }
    }
    return GLib.SOURCE_CONTINUE
  })

  onCleanup(() => {
    unsubTitle()
    unsubArtist()
    GLib.source_remove(pollId)
  })

  const buildLyricsContent = (): Gtk.Box => {
    const vbox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 6,
      margin_top: 25, margin_bottom: 14,
      margin_start: 20, margin_end: 20,
    })
    vbox.get_style_context().add_class('lyrics-flyout-root')

    const filenameLbl = new Gtk.Label({
      label:   lyricsFile ? lyricsFile.path.split('/').pop()! : 'No lyrics loaded',
      visible: true,
      xalign:  0.5,
    })
    filenameLbl.get_style_context().add_class('pop-lyric-filename')
    vbox.add(filenameLbl)

    vbox.add(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL, visible: true }))

    const makeRow = (cls: string) => {
      const lbl = new Gtk.Label({ label: '', visible: true, xalign: 0.5 })
      lbl.get_style_context().add_class(cls)
      lbl.set_line_wrap(true)
      vbox.add(lbl)
      return lbl
    }
    const prevLbl = makeRow('pop-lyric-context')
    const currLbl = makeRow('pop-lyric-current')
    const nextLbl = makeRow('pop-lyric-context')

    const fmtRow = (ln: LyricLine | null): string => {
      if (!ln) return ''
      return `${fmtMicros(ln.start)} – ${fmtMicros(ln.end)}  |  ${ln.text}`
    }

    let lastIdx = -2
    const refreshRows = () => {
      const cur   = activeIdx
      if (cur === lastIdx) return
      lastIdx = cur

      const lines = lyricsFile?.lines ?? []
      const prev  = cur > 0                ? lines[cur - 1] : null
      const curr  = cur >= 0               ? lines[cur]     : null
      const next  = cur < lines.length - 1 ? lines[cur + 1] : null

      prevLbl.set_label(fmtRow(prev))
      currLbl.set_label(curr ? fmtRow(curr) : (lyricsFile ? '♫ ... ♫' : ''))
      nextLbl.set_label(fmtRow(next))
    }

    refreshRows()
    vbox.show_all()

    let flyAlive  = true
    let flyPollId: any = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
      if (!flyAlive) return GLib.SOURCE_REMOVE
      try { refreshRows() } catch (_) { flyAlive = false; return GLib.SOURCE_REMOVE }
      return GLib.SOURCE_CONTINUE
    })
    vbox.connect('destroy', () => {
      flyAlive = false
      if (flyPollId != null) { GLib.source_remove(flyPollId); flyPollId = null }
    })

    return vbox
  }

  return (
    <button class="lyrics-container" valign={Gtk.Align.CENTER}
      $={(self: any) => {
        self.set_relief(Gtk.ReliefStyle.NONE)
        self.set_can_focus(false)

        let closeFlyout: (() => void) | null = null
        let leaveTimer: any = null

        const cancelLeave = () => {
          if (leaveTimer) { GLib.source_remove(leaveTimer); leaveTimer = null }
        }

        self.connect('enter-notify-event', () => {
          cancelLeave()
          if (!closeFlyout) {
            const content = buildLyricsContent()
            closeFlyout = openFlyoutWin(gdkmonitor, content)
            content.connect('destroy', () => { closeFlyout = null })
          }
        })

        self.connect('leave-notify-event', () => {
          leaveTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
            leaveTimer = null
            if (closeFlyout) { closeFlyout(); closeFlyout = null }
            return GLib.SOURCE_REMOVE
          })
        })

        self.connect('clicked', () => {
          cancelLeave()
          if (closeFlyout) { closeFlyout(); closeFlyout = null }
          else {
            const content = buildLyricsContent()
            closeFlyout = openFlyoutWin(gdkmonitor, content)
            content.connect('destroy', () => { closeFlyout = null })
          }
        })
      }}
    >
      <label
        class={lyricsFound.as((f: boolean) => f ? 'lyric-label active' : 'lyric-label no-lyrics')}
        label={lyricText}
        hexpand
        halign={Gtk.Align.CENTER}
        ellipsize={3}
      />
    </button>
  )
}

// ============================================================
//  MAIN MUSIC BAR
//  centerbox is a direct child of bar-root (same pattern as Bar.tsx)
//  so Astal.CenterBox gets the full window width for true centering
// ============================================================
export default function MusicBar(gdkmonitor: Gdk.Monitor) {
  let win: Astal.Window
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor
  const mpris = AstalMpris.get_default()

  const [activePlayer, setActivePlayer] = createState<AstalMpris.Player | null>(null)

  const refresh = () => {
    try {
      const players: AstalMpris.Player[] = mpris.get_players() as any ?? []
      setActivePlayer(players[0] ?? null)
    } catch (e) {
      console.warn('[MusicBar] refresh error:', e)
      setActivePlayer(null)
    }
  }

  let addedId: any, closedId: any
  try { addedId  = mpris.connect('player-added',  refresh) } catch (_) {}
  try { closedId = mpris.connect('player-closed', refresh) } catch (_) {}
  const subPlayers = createBinding(mpris, 'players').subscribe(refresh)

  onCleanup(() => {
    try { if (addedId  != null) mpris.disconnect(addedId)  } catch (_) {}
    try { if (closedId != null) mpris.disconnect(closedId) } catch (_) {}
    subPlayers()
    try { win?.destroy() } catch (_) {}
  })

  refresh()
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 400,  () => { if (activePlayer() === null) refresh(); return GLib.SOURCE_REMOVE })
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1800, () => { if (activePlayer() === null) refresh(); return GLib.SOURCE_REMOVE })

  // Spectrum state at component scope — refs filled by JSX $= callbacks below
  ensureCavaStarted()
  const specRefs: (any | null)[] = Array(NUM_BARS).fill(null)
  let specAlive = true
  const specPollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 40, () => {
    if (!specAlive) return GLib.SOURCE_REMOVE
    for (let i = 0; i < NUM_BARS; i++) {
      const v = cavaData.bars[i] ?? 0
      try { specRefs[i]?.set_size_request(6, Math.max(2, Math.round((v / 255) * 20))) } catch (_) {}
    }
    return GLib.SOURCE_CONTINUE
  })
  onCleanup(() => { specAlive = false; GLib.source_remove(specPollId) })

  return (
    <window
      $={(self: any) => (win = self)}
      visible={activePlayer.as((p: AstalMpris.Player | null) => p !== null)}
      class="MusicBar" namespace="ags-music-bar"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={TOP | LEFT | RIGHT}
      application={app}
    >
      {/* 3-pill layout: spectrum as JSX (AGS guarantees show), left/right via $= */}
      <box class="music-3pill-root" hexpand homogeneous={true}>

        {/* LEFT PILL: player info — populated imperatively */}
        <box hexpand halign={Gtk.Align.START} valign={Gtk.Align.CENTER}>
        <box class="m-left-pill" spacing={8} valign={Gtk.Align.CENTER}
          $={(leftPill: any) => {
            createEffect(() => {
              const player = activePlayer()
              leftPill.get_children().forEach((c: any) => leftPill.remove(c))

              if (!player) { leftPill.hide(); return }

              let closeFlyout: (() => void) | null = null

              const npBtn = (<button class="now-playing-btn"
                $={(self: any) => {
                  self.set_relief(Gtk.ReliefStyle.NONE)
                  self.set_can_focus(false)
                  self.connect('clicked', () => {
                    if (closeFlyout) { closeFlyout(); closeFlyout = null }
                    else {
                      const content = buildNowPlayingContent(player)
                      closeFlyout = openFlyoutWin(gdkmonitor, content)
                      content.connect('destroy', () => { closeFlyout = null })
                    }
                  })
                }}
              >
                <box spacing={8}>
                  <AlbumArt  player={player} />
                  <MediaInfo player={player} />
                </box>
              </button>) as Gtk.Widget

              const ctrl = (<MediaControls player={player} />) as Gtk.Widget

              leftPill.add(npBtn)
              leftPill.add(ctrl)
              leftPill.show_all()

              onCleanup(() => {
                if (closeFlyout) { closeFlyout(); closeFlyout = null }
                ;[npBtn, ctrl].forEach((w: any) => {
                  try { leftPill.remove(w) } catch (_) {}
                })
              })
            })
          }}
        />
        </box>

        {/* CENTER PILL: spectrum as JSX children — AGS shows them automatically */}
        <box hexpand halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
        <box class="m-center-pill" spacing={2} valign={Gtk.Align.CENTER} halign={Gtk.Align.CENTER}>
          {Array.from({ length: NUM_BARS }, (_, i) => (
            <box class="spec-wrap" orientation={Gtk.Orientation.VERTICAL}
              valign={Gtk.Align.END} heightRequest={22} widthRequest={6}>
              <box
                class={`spec-bar sc${Math.floor(i / (NUM_BARS / 5))}`}
                widthRequest={6} heightRequest={2} valign={Gtk.Align.END}
                $={(bar: any) => { specRefs[i] = bar }}
              />
            </box>
          ))}
        </box>
        </box>

        {/* RIGHT PILL: lyrics — populated imperatively */}
        <box hexpand halign={Gtk.Align.END} valign={Gtk.Align.CENTER}>
        <box class="m-right-pill" spacing={4} valign={Gtk.Align.CENTER}
          $={(rightPill: any) => {
            createEffect(() => {
              const player = activePlayer()
              rightPill.get_children().forEach((c: any) => rightPill.remove(c))

              if (!player) { rightPill.hide(); return }

              const lv = (<LyricsViewer player={player} gdkmonitor={gdkmonitor} />) as Gtk.Widget
              rightPill.add(lv)
              rightPill.show_all()

              onCleanup(() => { try { rightPill.remove(lv) } catch (_) {} })
            })
          }}
        />
        </box>

      </box>
    </window>
  )
}
