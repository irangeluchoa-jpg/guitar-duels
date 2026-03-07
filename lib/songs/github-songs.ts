/**
 * github-songs.ts
 * Busca músicas do repositório GitHub (branch main, pasta public/songs/).
 * Variável: NEXT_PUBLIC_GITHUB_SONGS_REPO = "usuario/repositorio"
 */

import type { SongListItem, SongMeta, ChartData } from "./types"

function getRepo()   { return process.env.NEXT_PUBLIC_GITHUB_SONGS_REPO   || "" }
function getBranch() { return process.env.NEXT_PUBLIC_GITHUB_SONGS_BRANCH || "main" }

export function isGitHubConfigured(): boolean {
  const repo = getRepo()
  return !!(repo && repo.includes("/"))
}

// URL raw de um arquivo no repositório
export function githubRawUrl(path: string): string {
  const repo   = getRepo()
  const branch = getBranch()
  const encoded = path.split("/").map(p => encodeURIComponent(p)).join("/")
  return `https://raw.githubusercontent.com/${repo}/${branch}/${encoded}`
}

// URL do arquivo dentro de public/songs/
export function songFileUrl(trackId: string, filename: string): string {
  return githubRawUrl(`public/songs/${trackId}/${filename}`)
}

// Busca o songs-index.json da raiz do repositório
let _indexCache: SongIndexEntry[] | null = null
interface SongIndexEntry {
  id: string; name: string; artist: string; album?: string; year?: string
  genre?: string; charter?: string; difficulty?: number; songLength?: number
  audioFiles?: Record<string, string>; albumArtFile?: string; backgroundFile?: string; previewFile?: string
}

export async function fetchSongsIndex(): Promise<SongIndexEntry[]> {
  if (_indexCache) return _indexCache
  try {
    const url = githubRawUrl("songs-index.json")
    const res = await fetch(url, { next: { revalidate: 60 } })
    if (!res.ok) return []
    _indexCache = await res.json()
    return _indexCache ?? []
  } catch { return [] }
}

export async function getGitHubSongList(): Promise<SongListItem[]> {
  const index = await fetchSongsIndex()
  return index.map(s => ({
    id:         s.id,
    name:       s.name,
    artist:     s.artist,
    album:      s.album      || "",
    year:       s.year       || "",
    genre:      s.genre      || "",
    charter:    s.charter    || "",
    difficulty: s.difficulty ?? 3,
    songLength: s.songLength ?? 0,
    previewStart: 0,
    albumArt:   s.albumArtFile ? songFileUrl(s.id, s.albumArtFile) : undefined,
    previewUrl: s.previewFile  ? songFileUrl(s.id, s.previewFile)  : undefined,
  }))
}

export async function getGitHubSongMeta(trackId: string): Promise<SongMeta | null> {
  const index = await fetchSongsIndex()
  const entry = index.find(s => s.id === trackId)
  if (entry) {
    return {
      id: entry.id, name: entry.name, artist: entry.artist,
      album: entry.album || "", year: entry.year || "",
      genre: entry.genre || "", charter: entry.charter || "",
      difficulty: entry.difficulty ?? 3, songLength: entry.songLength ?? 0,
      previewStart: 0,
    }
  }
  // Fallback: tentar song.ini direto
  try {
    const { parseSongIni } = await import("./ini-parser")
    const res = await fetch(songFileUrl(trackId, "song.ini"))
    if (res.ok) return parseSongIni(await res.text(), trackId)
  } catch {}
  return null
}

export async function getGitHubSongChart(trackId: string): Promise<ChartData | null> {
  const { parseChart }     = await import("./chart-parser")
  const { parseMidi }      = await import("./midi-parser")
  // 1. notes.chart
  try {
    const res = await fetch(songFileUrl(trackId, "notes.chart"))
    if (res.ok) return parseChart(await res.text())
  } catch {}
  // 2. notes.mid
  try {
    const res = await fetch(songFileUrl(trackId, "notes.mid"))
    if (res.ok) return parseMidi(await res.arrayBuffer())
  } catch {}
  return null
}

const AUDIO_KEYS: Record<string, string[]> = {
  song:    ["song.opus","song.ogg","song.mp3","audio.opus","audio.ogg","audio.mp3"],
  guitar:  ["guitar.opus","guitar.ogg","guitar.mp3"],
  rhythm:  ["rhythm.opus","rhythm.ogg","rhythm.mp3"],
  bass:    ["bass.opus","bass.ogg","bass.mp3"],
  backing: ["backing.opus","backing.ogg","backing.mp3"],
  vocals:  ["vocals.opus","vocals.ogg","vocals.mp3","vocal.opus","vocal.ogg"],
  drums:   ["drums.opus","drums.ogg","drums.mp3"],
  drums_1: ["drums_1.opus","drums_1.ogg","drums_1.mp3"],
  drums_2: ["drums_2.opus","drums_2.ogg","drums_2.mp3"],
  drums_3: ["drums_3.opus","drums_3.ogg","drums_3.mp3"],
  crowd:   ["crowd.opus","crowd.ogg","crowd.mp3"],
  keys:    ["keys.opus","keys.ogg","keys.mp3"],
  preview: ["preview.opus","preview.ogg","preview.mp3"],
}

export async function getGitHubAudioUrls(trackId: string): Promise<Record<string, string>> {
  const urls: Record<string, string> = {}
  const index = await fetchSongsIndex()
  const entry = index.find(s => s.id === trackId)

  if (entry?.audioFiles) {
    for (const [key, filename] of Object.entries(entry.audioFiles)) {
      urls[key] = songFileUrl(trackId, filename)
    }
    return urls
  }

  // Fallback: testar cada arquivo via HEAD
  const checks = Object.entries(AUDIO_KEYS).flatMap(([key, files]) =>
    files.map(f => ({ key, url: songFileUrl(trackId, f) }))
  )
  await Promise.all(checks.map(async ({ key, url }) => {
    if (urls[key]) return
    try {
      const res = await fetch(url, { method: "HEAD" })
      if (res.ok) urls[key] = url
    } catch {}
  }))
  return urls
}

export async function getGitHubBackgroundUrl(trackId: string): Promise<string | null> {
  const index = await fetchSongsIndex()
  const entry = index.find(s => s.id === trackId)
  if (entry?.backgroundFile) return songFileUrl(trackId, entry.backgroundFile)

  // Fallback: checar arquivos comuns
  for (const f of ["video.mp4","video.webm","background.mp4","background.webm","background.jpg","background.png"]) {
    try {
      const res = await fetch(songFileUrl(trackId, f), { method: "HEAD" })
      if (res.ok) return songFileUrl(trackId, f)
    } catch {}
  }
  return null
}

export async function getGitHubAlbumArt(trackId: string): Promise<string | null> {
  const index = await fetchSongsIndex()
  const entry = index.find(s => s.id === trackId)
  if (entry?.albumArtFile) return songFileUrl(trackId, entry.albumArtFile)

  for (const f of ["album.jpg","album.jpeg","album.png","background.jpg","background.png"]) {
    try {
      const res = await fetch(songFileUrl(trackId, f), { method: "HEAD" })
      if (res.ok) return songFileUrl(trackId, f)
    } catch {}
  }
  return null
}
