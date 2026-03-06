/**
 * library.ts
 * Modos suportados:
 *   1. LOCAL (dev): lê de public/songs/ via fs
 *   2. GitHub Releases (produção): busca músicas do GitHub
 */

import type { SongListItem, SongMeta, ChartData } from "./types"
import { isGitHubConfigured, fetchSongsIndex, fetchGitHubSongMeta,
         fetchGitHubSongChart, githubAssetUrl, getGitHubAudioUrls } from "./github-songs"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hasFs(): boolean {
  try { require("fs"); return true } catch { return false }
}

function getBaseUrl(): string {
  if (typeof process !== "undefined") {
    if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
    if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  }
  return "http://localhost:3000"
}

const AUDIO_EXTS = [".ogg", ".mp3", ".opus", ".wav"]
const AUDIO_KEYS: Record<string, string[]> = {
  guitar:  AUDIO_EXTS.map(e => `guitar${e}`),
  rhythm:  AUDIO_EXTS.map(e => `rhythm${e}`),
  bass:    AUDIO_EXTS.map(e => `bass${e}`),
  backing: AUDIO_EXTS.map(e => `backing${e}`),
  song:    AUDIO_EXTS.flatMap(e => [`song${e}`, `audio${e}`]),
  vocals:  AUDIO_EXTS.flatMap(e => [`vocals${e}`, `vocal${e}`, `voice${e}`]),
  drums:   AUDIO_EXTS.flatMap(e => [`drums${e}`, `drum${e}`]),
  drums_1: AUDIO_EXTS.map(e => `drums_1${e}`),
  drums_2: AUDIO_EXTS.map(e => `drums_2${e}`),
  drums_3: AUDIO_EXTS.map(e => `drums_3${e}`),
  crowd:   AUDIO_EXTS.map(e => `crowd${e}`),
  keys:    AUDIO_EXTS.flatMap(e => [`keys${e}`, `keyboard${e}`, `piano${e}`]),
  preview: AUDIO_EXTS.map(e => `preview${e}`),
}

// ─── getSongList ──────────────────────────────────────────────────────────────

export async function getSongList(): Promise<SongListItem[]> {
  if (isGitHubConfigured()) return fetchSongsIndex()
  if (hasFs()) return getSongListFromFs()
  try {
    const res = await fetch(`${getBaseUrl()}/songs/songs-index.json`, { cache: "no-store" })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

async function getSongListFromFs(): Promise<SongListItem[]> {
  try {
    const fs   = require("fs")   as typeof import("fs")
    const path = require("path") as typeof import("path")
    const { parseSongIni } = await import("./ini-parser")
    const SONGS_DIR = path.join(process.cwd(), "public", "songs")
    if (!fs.existsSync(SONGS_DIR)) return []

    const songs: SongListItem[] = []
    for (const entry of fs.readdirSync(SONGS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const songDir = path.join(SONGS_DIR, entry.name)
      let meta: SongMeta | null = null

      const metaPath = path.join(songDir, "meta.json")
      if (fs.existsSync(metaPath)) {
        try { meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) } catch {}
      }
      if (!meta && fs.existsSync(path.join(songDir, "song.ini"))) {
        try { meta = parseSongIni(fs.readFileSync(path.join(songDir, "song.ini"), "utf-8"), entry.name) } catch {}
      }
      if (!meta && fs.existsSync(path.join(songDir, "song"))) {
        try {
          let raw = ""
          try { raw = fs.readFileSync(path.join(songDir, "song"), "utf-8") }
          catch { raw = fs.readFileSync(path.join(songDir, "song"), "latin1") }
          meta = parseSongIni(raw, entry.name)
        } catch {}
      }
      if (!meta) {
        const hasNotes = ["notes.chart","notes.mid","notes.midi","notes"]
          .some(f => fs.existsSync(path.join(songDir, f)))
        if (!hasNotes) continue
        const parts = entry.name.split(" - ")
        meta = {
          id: entry.name, name: parts.length >= 2 ? parts.slice(1).join(" - ").trim() : entry.name,
          artist: parts.length >= 2 ? parts[0].trim() : "Unknown Artist",
          album: "", year: "", genre: "", charter: "", difficulty: 3, songLength: 0, previewStart: 0,
        }
      }
      if (!meta) continue
      if (!meta.id) meta.id = entry.name

      let albumArt: string | undefined
      for (const n of ["album.jpg","album.jpeg","album.png","album.webp","background.jpg","background.png"]) {
        if (fs.existsSync(path.join(songDir, n))) { albumArt = `/songs/${entry.name}/${n}`; break }
      }
      let previewUrl: string | undefined
      for (const n of ["preview.ogg","preview.mp3","preview.opus","preview.wav"]) {
        if (fs.existsSync(path.join(songDir, n))) { previewUrl = `/songs/${entry.name}/${n}`; break }
      }

      songs.push({
        id: meta.id, name: meta.name || entry.name,
        artist: meta.artist || "Unknown Artist",
        album: meta.album || "", year: meta.year || "",
        genre: meta.genre || "", difficulty: meta.difficulty ?? 3,
        albumArt, previewUrl,
      })
    }
    return songs.sort((a, b) => a.name.localeCompare(b.name))
  } catch { return [] }
}

// ─── getSongChart ─────────────────────────────────────────────────────────────

export async function getSongChart(trackId: string): Promise<ChartData | null> {
  if (isGitHubConfigured()) return fetchGitHubSongChart(trackId)
  if (hasFs()) return getSongChartFromFs(trackId)
  try {
    const res = await fetch(`${getBaseUrl()}/songs/${encodeURIComponent(trackId)}/chart.json`, { cache: "no-store" })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

async function getSongChartFromFs(trackId: string): Promise<ChartData | null> {
  try {
    const fs   = require("fs")   as typeof import("fs")
    const path = require("path") as typeof import("path")
    const SONGS_DIR = path.join(process.cwd(), "public", "songs")
    const songDir   = path.join(SONGS_DIR, trackId)

    const chartJsonPath = path.join(songDir, "chart.json")
    if (fs.existsSync(chartJsonPath)) {
      try { return JSON.parse(fs.readFileSync(chartJsonPath, "utf-8")) } catch {}
    }
    const chartPath = path.join(songDir, "notes.chart")
    if (fs.existsSync(chartPath)) {
      const { parseChart } = await import("./chart-parser")
      let raw = ""
      try { raw = fs.readFileSync(chartPath, "utf-8") }
      catch { raw = fs.readFileSync(chartPath, "latin1") }
      return parseChart(raw)
    }
    for (const fname of ["notes.mid", "notes.midi", "notes"]) {
      const midiPath = path.join(songDir, fname)
      if (fs.existsSync(midiPath)) {
        const head = fs.readFileSync(midiPath)
        if (head.slice(0, 4).toString("ascii") !== "MThd") continue
        const { parseMidi } = await import("./midi-parser")
        const buf = head.buffer.slice(head.byteOffset, head.byteOffset + head.byteLength)
        return parseMidi(buf)
      }
    }
  } catch {}
  return null
}

// ─── getSongMeta ──────────────────────────────────────────────────────────────

export async function getSongMeta(trackId: string): Promise<SongMeta | null> {
  if (isGitHubConfigured()) return fetchGitHubSongMeta(trackId)
  if (hasFs()) return getSongMetaFromFs(trackId)
  try {
    const res = await fetch(`${getBaseUrl()}/songs/${encodeURIComponent(trackId)}/meta.json`, { cache: "no-store" })
    if (res.ok) return await res.json()
  } catch {}
  const parts = trackId.split(" - ")
  return {
    id: trackId, name: parts.length >= 2 ? parts.slice(1).join(" - ").trim() : trackId,
    artist: parts.length >= 2 ? parts[0].trim() : "Unknown Artist",
    album: "", year: "", genre: "", charter: "", difficulty: 3, songLength: 0, previewStart: 0,
  }
}

async function getSongMetaFromFs(trackId: string): Promise<SongMeta | null> {
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
  const parts = trackId.split(" - ")
  return {
    id: trackId, name: parts.length >= 2 ? parts.slice(1).join(" - ").trim() : trackId,
    artist: parts.length >= 2 ? parts[0].trim() : "Unknown Artist",
    album: "", year: "", genre: "", charter: "", difficulty: 3, songLength: 0, previewStart: 0,
  }
}

// ─── getSongAudioUrls / getSongAudioUrlsAsync ─────────────────────────────────

export function getSongAudioUrls(trackId: string): Record<string, string> {
  // Modo local: síncrono
  if (!isGitHubConfigured()) return getAudioUrlsFromFs(trackId)
  return {}
}

export async function getSongAudioUrlsAsync(trackId: string): Promise<Record<string, string>> {
  if (isGitHubConfigured()) return getGitHubAudioUrls(trackId)
  return getAudioUrlsFromFs(trackId)
}

function getAudioUrlsFromFs(trackId: string): Record<string, string> {
  const urls: Record<string, string> = {}
  if (!hasFs()) return urls
  try {
    const fs   = require("fs")   as typeof import("fs")
    const path = require("path") as typeof import("path")
    const SONGS_DIR = path.join(process.cwd(), "public", "songs")
    const songDir   = path.join(SONGS_DIR, trackId)

    for (const [key, filenames] of Object.entries(AUDIO_KEYS)) {
      for (const filename of filenames) {
        if (fs.existsSync(path.join(songDir, filename))) {
          urls[key] = `/songs/${trackId}/${filename}`
          break
        }
      }
    }

    const musicDir = path.join(songDir, "Content", "Music")
    if (fs.existsSync(musicDir)) {
      for (const f of fs.readdirSync(musicDir)) {
        const lower = f.toLowerCase()
        const validExt = AUDIO_EXTS.some(e => lower.endsWith(e))
        if (!validExt) continue
        if (lower.includes("preview"))                                                          { if (!urls.preview) urls.preview = `/songs/${trackId}/Content/Music/${f}` }
        else if (lower.includes("guitar") || lower.includes("_1."))                            { if (!urls.guitar)  urls.guitar  = `/songs/${trackId}/Content/Music/${f}` }
        else if (lower.includes("rhythm") || lower.includes("bass") || lower.includes("_2.")) { if (!urls.rhythm)  urls.rhythm  = `/songs/${trackId}/Content/Music/${f}` }
        else if (lower.includes("backing") || lower.includes("_3."))                           { if (!urls.backing) urls.backing = `/songs/${trackId}/Content/Music/${f}` }
        else                                                                                    { if (!urls.song)    urls.song    = `/songs/${trackId}/Content/Music/${f}` }
      }
    }
  } catch {}
  return urls
}
