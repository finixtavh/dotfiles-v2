import GLib from "gi://GLib"
import Gio  from "gi://Gio"

export const YTDLP_AVAILABLE: boolean = !!GLib.find_program_in_path('yt-dlp')

const CACHE_FILE = `${GLib.get_home_dir()}/.cache/ags/ytdlp-categories.json`
const CACHE_TTL  = 7 * 24 * 3600 * 1000  // 7 days

interface CacheEntry { isMusic: boolean; checkedAt: number }
const _cache = new Map<string, CacheEntry>()

function _loadCache() {
  try {
    const [ok, raw] = GLib.file_get_contents(CACHE_FILE)
    if (!ok) return
    const obj = JSON.parse(new TextDecoder().decode(raw)) as Record<string, CacheEntry>
    const now = Date.now()
    for (const [k, v] of Object.entries(obj)) {
      if (now - v.checkedAt < CACHE_TTL) _cache.set(k, v)
    }
  } catch (_) {}
}

function _saveCache() {
  try {
    const dir = CACHE_FILE.slice(0, CACHE_FILE.lastIndexOf('/'))
    GLib.mkdir_with_parents(dir, 0o755)
    const obj: Record<string, CacheEntry> = {}
    for (const [k, v] of _cache) obj[k] = v
    const bytes = new TextEncoder().encode(JSON.stringify(obj))
    Gio.File.new_for_path(CACHE_FILE).replace_contents(bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null)
  } catch (_) {}
}

_loadCache()

// Categories that are clearly not music — everything else is allowed.
// Allows: Music, Film & Animation (anime), Entertainment, People & Blogs, etc.
const NON_MUSIC_CATEGORIES = new Set([
  'Gaming', 'Science & Technology', 'Sports', 'News & Politics',
  'Howto & Style', 'Education', 'Travel & Events', 'Autos & Vehicles',
  'Pets & Animals', 'Nonprofits & Activism',
])

function _isMusic(out: string): boolean {
  if (!out || out.trim() === 'NA' || out.trim() === '[]') return true
  const cats = out.match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) ?? []
  if (cats.length === 0) return true
  return !cats.some(c => NON_MUSIC_CATEGORIES.has(c))
}

// Extract YouTube video ID from a URL
export function youtubeVideoId(url: string): string | null {
  if (!url) return null
  const m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

// Build canonical watch URL from video ID
export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

// Check if a YouTube watch URL is music content (by direct yt-dlp category lookup).
// Cache key = canonical watch URL.
// Returns true (allow tracking) on any error or unknown result (fail-open).
export function checkIsMusic(ytWatchUrl: string): Promise<boolean> {
  if (!YTDLP_AVAILABLE || !ytWatchUrl) return Promise.resolve(true)

  const cached = _cache.get(ytWatchUrl)
  if (cached) return Promise.resolve(cached.isMusic)

  return new Promise((resolve) => {
    try {
      const proc = Gio.Subprocess.new(
        ['yt-dlp', '--print', '%(categories)s', '--no-warnings', ytWatchUrl],
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
      )
      proc.communicate_utf8_async(null, null, (_p: any, res: any) => {
        try {
          const [, stdout] = proc.communicate_utf8_finish(res)
          const isMusic = _isMusic(stdout ?? '')
          _cache.set(ytWatchUrl, { isMusic, checkedAt: Date.now() })
          _saveCache()
          resolve(isMusic)
        } catch (_) { resolve(true) }
      })
    } catch (_) { resolve(true) }
  })
}

// Synchronous cache check — returns null if not cached
export function getCachedResult(ytWatchUrl: string): boolean | null {
  const entry = _cache.get(ytWatchUrl)
  return entry ? entry.isMusic : null
}
