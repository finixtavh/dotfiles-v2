import GLib from "gi://GLib"
import Gio  from "gi://Gio"

const HISTORY_FILE = `${GLib.get_home_dir()}/.config/ags/listen-history.json`
const MAX_RECENT   = 100

export interface ListenEntry {
  title:         string
  artist:        string
  coverPath:     string
  totalSeconds:  number
  completePlays: number
  partialPlays:  number
}

export interface RecentEntry {
  title:    string
  artist:   string
  coverPath: string
  url:      string
  playedAt: number
}

interface HistoryData {
  listened: Record<string, ListenEntry>
  recent:   RecentEntry[]
}

let data: HistoryData = { listened: {}, recent: [] }
const changeSubs: Set<() => void> = new Set()

function save() {
  try {
    const json  = JSON.stringify(data, null, 2)
    const bytes = new TextEncoder().encode(json)
    const file  = Gio.File.new_for_path(HISTORY_FILE)
    file.replace_contents(bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null)
  } catch (e) {
    console.warn('[ListenHistory] save failed:', e)
  }
}

function load() {
  try {
    const [ok, raw] = GLib.file_get_contents(HISTORY_FILE)
    if (ok) {
      const parsed = JSON.parse(new TextDecoder().decode(raw))
      data = {
        listened: parsed.listened ?? {},
        recent:   parsed.recent   ?? [],
      }
    }
  } catch (_) {}
}

function notifyChange() {
  changeSubs.forEach(cb => { try { cb() } catch (_) {} })
}

load()

export function subscribeHistory(cb: () => void): () => void {
  changeSubs.add(cb)
  return () => changeSubs.delete(cb)
}

export function getTopListened(n = 5): ListenEntry[] {
  return Object.values(data.listened)
    .sort((a, b) => b.totalSeconds - a.totalSeconds)
    .slice(0, n)
}

export function getRecent(n = 7): RecentEntry[] {
  return [...data.recent].slice(0, n)
}

function listenKey(title: string, artist: string): string {
  return `${title.toLowerCase().trim()}|${artist.toLowerCase().trim()}`
}

// Periodic progress save — adds time + upserts recent so data survives AGS restarts.
// Call with seconds=0 on song start to immediately add to recent without counting time.
export function saveProgress(
  title:     string,
  artist:    string,
  coverPath: string,
  url:       string,
  seconds:   number
): void {
  if (!title) return

  const key = listenKey(title, artist)
  if (!data.listened[key]) {
    data.listened[key] = {
      title, artist, coverPath,
      totalSeconds: 0, completePlays: 0, partialPlays: 0,
    }
  }
  const entry = data.listened[key]
  if (seconds > 0) entry.totalSeconds += Math.round(seconds)
  if (coverPath) entry.coverPath = coverPath

  // Always upsert recent so current song shows up immediately and survives restarts
  const dedupeKey = url || key
  const existing  = data.recent.find(r => (r.url || listenKey(r.title, r.artist)) === dedupeKey)
  if (existing) {
    existing.playedAt  = Date.now()
    if (coverPath) existing.coverPath = coverPath
    data.recent = [existing, ...data.recent.filter(r => r !== existing)]
  } else {
    data.recent.unshift({ title, artist, coverPath, url, playedAt: Date.now() })
    data.recent = data.recent.slice(0, MAX_RECENT)
  }
  save()
  notifyChange()
}

// Song-end flush — adds remaining time, determines completion, upserts recent.
// Pass sessionTotalSeconds (full time for this song play) for correct completion detection.
export function flushSession(
  title:              string,
  artist:             string,
  coverPath:          string,
  url:                string,
  remainingSeconds:   number,  // seconds since last saveProgress (may be 0)
  sessionTotalSeconds: number, // full session time for completion %
  duration:           number
): void {
  if (!title || sessionTotalSeconds < 1) return

  const key = listenKey(title, artist)
  if (!data.listened[key]) {
    data.listened[key] = {
      title, artist, coverPath,
      totalSeconds: 0, completePlays: 0, partialPlays: 0,
    }
  }
  const entry = data.listened[key]
  if (remainingSeconds > 0) entry.totalSeconds += Math.round(remainingSeconds)
  if (coverPath) entry.coverPath = coverPath

  const pct = duration > 0 ? sessionTotalSeconds / duration : 0
  if (pct >= 0.9) entry.completePlays++
  else            entry.partialPlays++

  const dedupeKey = url || key
  data.recent = data.recent.filter(r => (r.url || listenKey(r.title, r.artist)) !== dedupeKey)
  data.recent.unshift({ title, artist, coverPath, url, playedAt: Date.now() })
  data.recent = data.recent.slice(0, MAX_RECENT)

  save()
  notifyChange()
}

export function clearRecent(): void {
  data.recent = []
  save()
  notifyChange()
}

export function clearListened(): void {
  data.listened = {}
  save()
  notifyChange()
}
