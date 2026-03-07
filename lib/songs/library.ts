/**
 * library.ts — compatível com Vercel (sem fs em runtime)
 * Suporta: .chart, .mid/.midi, áudio .ogg/.mp3/.opus/.wav
 */

import type { SongListItem, SongMeta, ChartData } from "./types"

function hasFs(): boolean {
  try { require("fs"); return true } catch { return false }
}

function getBaseUrl(): string {
  if (typeof process !== "undefined") {
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
    if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  }
  return "http://localhost:3000"
}

// ─── getSongList ──────────────────────────────────────────────────────────────
export async function getSongList(): Promise<SongListItem[]> {
  if (hasFs()) {
    try {
      const fs   = require("fs")   as typeof import("fs")
      const path = require("path") as typeof import("path")
      const { parseSongIni } = await import("./ini-parser")

      const SONGS_DIR = path.join(process.cwd(), "public", "songs")
      if (!fs.existsSync(SONGS_DIR)) return []

      const songs: SongListItem[] = []
      const entries = fs.readdirSync(SONGS_DIR, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const songDir = path.join(SONGS_DIR, entry.name)
        let meta: SongMeta | null = null

        // 1. meta.json
        const metaPath = path.join(songDir, "meta.json")
        if (fs.existsSync(metaPath)) {
          try { meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) } catch {}
        }
        // 2. song.ini
        if (!meta && fs.existsSync(path.join(songDir, "song.ini"))) {
          try { meta = parseSongIni(fs.readFileSync(path.join(songDir, "song.ini"), "utf-8"), entry.name) } catch {}
        }
        // 3. song (sem extensão — comum em pastas Clone Hero)
        if (!meta && fs.existsSync(path.join(songDir, "song"))) {
          try {
            let raw = ""
            try { raw = fs.readFileSync(path.join(songDir, "song"), "utf-8") }
            catch { raw = fs.readFileSync(path.join(songDir, "song"), "latin1") }
            meta = parseSongIni(raw, entry.name)
          } catch {}
        }
        // 4. Fallback por nome da pasta
        if (!meta) {
          const hasNotes = fs.existsSync(path.join(songDir, "notes.chart"))
            || fs.existsSync(path.join(songDir, "notes.mid"))
            || fs.existsSync(path.join(songDir, "notes.midi"))
            || fs.existsSync(path.join(songDir, "notes"))
          if (!hasNotes) continue
          const parts = entry.name.split(" - ")
          meta = {
            id: entry.name,
            name: parts.length >= 2 ? parts.slice(1).join(" - ").trim() : entry.name,
            artist: parts.length >= 2 ? parts[0].trim() : "Unknown Artist",
            album: "", year: "", genre: "", charter: "", difficulty: 3, songLength: 0, previewStart: 0,
          }
        }
        if (!meta) continue
        if (!meta.id) meta.id = entry.name

        // Album art — aceita .jpg, .jpeg, .png, .webp
        let albumArt: string | undefined
        for (const n of ["album.jpg", "album.jpeg", "album.png", "album.webp", "background.jpg", "background.jpeg", "background.png"]) {
          if (fs.existsSync(path.join(songDir, n))) { albumArt = `/songs/${entry.name}/${n}`; break }
        }

        // Preview audio — aceita .ogg, .mp3, .opus, .wav
        let previewUrl: string | undefined
        for (const n of ["preview.ogg", "preview.mp3", "preview.opus", "preview.wav"]) {
          if (fs.existsSync(path.join(songDir, n))) { previewUrl = `/songs/${entry.name}/${n}`; break }
        }

        songs.push({
          id: meta.id,
          name: meta.name || entry.name,
          artist: meta.artist || "Unknown Artist",
          album: meta.album || "",
          year: meta.year || "",
          genre: meta.genre || "",
          difficulty: meta.difficulty ?? 3,
          songLength: meta.songLength || 0,
          charter: meta.charter || "",
          albumArt,
          previewUrl,
        })
      }
      return songs.sort((a, b) => a.name.localeCompare(b.name))
    } catch {}
  }

  // Fallback Vercel: índice estático
  try {
    const res = await fetch(`${getBaseUrl()}/songs/songs-index.json`, { cache: "no-store" })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

// ─── getSongChart ──────────────────────────────────────────────────────────────
export async function getSongChart(trackId: string): Promise<ChartData | null> {
  if (hasFs()) {
    try {
      const fs   = require("fs")   as typeof import("fs")
      const path = require("path") as typeof import("path")
      const SONGS_DIR = path.join(process.cwd(), "public", "songs")
      const songDir   = path.join(SONGS_DIR, trackId)

      // 1. chart.json (pré-processado)
      const chartJsonPath = path.join(songDir, "chart.json")
      if (fs.existsSync(chartJsonPath)) {
        try { return JSON.parse(fs.readFileSync(chartJsonPath, "utf-8")) } catch {}
      }

      // 2. notes.chart (Clone Hero text format)
      const chartPath = path.join(songDir, "notes.chart")
      if (fs.existsSync(chartPath)) {
        try {
          const { parseChart } = await import("./chart-parser")
          let raw = ""
          try { raw = fs.readFileSync(chartPath, "utf-8") }
          catch { raw = fs.readFileSync(chartPath, "latin1") }
          return parseChart(raw)
        } catch (e) { console.error(`Failed to parse notes.chart for ${trackId}:`, e) }
      }

      // 3. notes.mid / notes.midi / notes (MIDI binário)
      for (const fname of ["notes.mid", "notes.midi", "notes"]) {
        const midiPath = path.join(songDir, fname)
        if (fs.existsSync(midiPath)) {
          // Verifica se parece MIDI (começa com MThd)
          const head = fs.readFileSync(midiPath)
          const magic = head.slice(0, 4).toString("ascii")
          if (magic !== "MThd") continue
          try {
            const { parseMidi } = await import("./midi-parser")
            const buf = head.buffer.slice(head.byteOffset, head.byteOffset + head.byteLength)
            return parseMidi(buf)
          } catch (e) { console.error(`Failed to parse MIDI for ${trackId}:`, e) }
        }
      }
    } catch {}
  }

  // Fallback Vercel: chart.json estático
  try {
    const res = await fetch(`${getBaseUrl()}/songs/${encodeURIComponent(trackId)}/chart.json`, { cache: "no-store" })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

// ─── getSongMeta ──────────────────────────────────────────────────────────────
export async function getSongMeta(trackId: string): Promise<SongMeta | null> {
  if (hasFs()) {
    try {
      const fs   = require("fs")   as typeof import("fs")
      const path = require("path") as typeof import("path")
      const { parseSongIni } = await import("./ini-parser")
      const SONGS_DIR = path.join(process.cwd(), "public", "songs")
      const songDir   = path.join(SONGS_DIR, trackId)

      if (fs.existsSync(path.join(songDir, "meta.json"))) {
        try { return JSON.parse(fs.readFileSync(path.join(songDir, "meta.json"), "utf-8")) } catch {}
      }
      if (fs.existsSync(path.join(songDir, "song.ini"))) {
        try { return parseSongIni(fs.readFileSync(path.join(songDir, "song.ini"), "utf-8"), trackId) } catch {}
      }
      if (fs.existsSync(path.join(songDir, "song"))) {
        try {
          let raw = ""
          try { raw = fs.readFileSync(path.join(songDir, "song"), "utf-8") }
          catch { raw = fs.readFileSync(path.join(songDir, "song"), "latin1") }
          return parseSongIni(raw, trackId)
        } catch {}
      }
    } catch {}
  }

  try {
    const res = await fetch(`${getBaseUrl()}/songs/${encodeURIComponent(trackId)}/meta.json`, { cache: "no-store" })
    if (res.ok) return await res.json()
  } catch {}

  const parts = trackId.split(" - ")
  return {
    id: trackId,
    name: parts.length >= 2 ? parts.slice(1).join(" - ").trim() : trackId,
    artist: parts.length >= 2 ? parts[0].trim() : "Unknown Artist",
    album: "", year: "", genre: "", charter: "", difficulty: 3, songLength: 0, previewStart: 0,
  }
}

// ─── getSongAudioUrls ──────────────────────────────────────────────────────────
export function getSongAudioUrls(trackId: string): Record<string, string> {
  const urls: Record<string, string> = {}
  if (!hasFs()) return urls

  try {
    const fs   = require("fs")   as typeof import("fs")
    const path = require("path") as typeof import("path")
    const SONGS_DIR = path.join(process.cwd(), "public", "songs")
    const songDir   = path.join(SONGS_DIR, trackId)
    const musicDir  = path.join(songDir, "Content", "Music")

    // Extensões suportadas — inclui .opus agora!
    const EXTS = [".ogg", ".mp3", ".opus", ".wav"]

    const audioFiles: Record<string, string[]> = {
      guitar:  EXTS.map(e => `guitar${e}`),
      rhythm:  EXTS.map(e => `rhythm${e}`),
      bass:    EXTS.map(e => `bass${e}`),
      backing: EXTS.map(e => `backing${e}`),
      song:    EXTS.flatMap(e => [`song${e}`, `audio${e}`]),
      vocals:  EXTS.flatMap(e => [`vocals${e}`, `vocal${e}`, `voice${e}`]),
      drums:   EXTS.flatMap(e => [`drums${e}`, `drum${e}`]),
      drums_1: EXTS.map(e => `drums_1${e}`),
      drums_2: EXTS.map(e => `drums_2${e}`),
      drums_3: EXTS.map(e => `drums_3${e}`),
      crowd:   EXTS.map(e => `crowd${e}`),
      keys:    EXTS.flatMap(e => [`keys${e}`, `keyboard${e}`, `piano${e}`]),
      preview: EXTS.map(e => `preview${e}`),
    }

    for (const [key, filenames] of Object.entries(audioFiles)) {
      for (const filename of filenames) {
        if (fs.existsSync(path.join(songDir, filename))) {
          urls[key] = `/songs/${trackId}/${filename}`
          break
        }
      }
    }

    // GH-style Content/Music/
    if (fs.existsSync(musicDir)) {
      for (const f of fs.readdirSync(musicDir)) {
        const lower = f.toLowerCase()
        const validExt = EXTS.some(e => lower.endsWith(e))
        if (!validExt) continue
        if (lower.includes("preview"))                                        { if (!urls.preview) urls.preview = `/songs/${trackId}/Content/Music/${f}` }
        else if (lower.includes("guitar") || lower.includes("_1."))           { if (!urls.guitar)  urls.guitar  = `/songs/${trackId}/Content/Music/${f}` }
        else if (lower.includes("rhythm") || lower.includes("bass") || lower.includes("_2.")) { if (!urls.rhythm) urls.rhythm = `/songs/${trackId}/Content/Music/${f}` }
        else if (lower.includes("backing") || lower.includes("_3."))          { if (!urls.backing) urls.backing = `/songs/${trackId}/Content/Music/${f}` }
        else                                                                   { if (!urls.song)    urls.song    = `/songs/${trackId}/Content/Music/${f}` }
      }
    }
  } catch {}

  return urls
}

// ─── getSongBackgroundUrl ──────────────────────────────────────────────────────
export function getSongBackgroundUrl(trackId: string): string | null {
  if (!hasFs()) return null
  try {
    const fs   = require("fs")   as typeof import("fs")
    const path = require("path") as typeof import("path")
    const SONGS_DIR = path.join(process.cwd(), "public", "songs")
    const songDir   = path.join(SONGS_DIR, trackId)
    // Suporta: background.jpg/jpeg/png/webp (imagem) e background.mp4/webm (vídeo)
    for (const n of [
      "background.jpg", "background.jpeg", "background.png", "background.webp",
      "background.mp4", "background.webm",
    ]) {
      if (fs.existsSync(path.join(songDir, n))) return `/songs/${trackId}/${n}`
    }
  } catch {}
  return null
}

// ─── getSongAlbumArt ──────────────────────────────────────────────────────────
export function getSongAlbumArt(trackId: string): string | null {
  if (!hasFs()) return null
  try {
    const fs   = require("fs")   as typeof import("fs")
    const path = require("path") as typeof import("path")
    const SONGS_DIR = path.join(process.cwd(), "public", "songs")
    const songDir   = path.join(SONGS_DIR, trackId)
    for (const n of ["album.jpg", "album.jpeg", "album.png", "album.webp", "background.jpg", "background.jpeg", "background.png"]) {
      if (fs.existsSync(path.join(songDir, n))) return `/songs/${trackId}/${n}`
    }
  } catch {}
  return null
}
