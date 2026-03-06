/**
 * github-songs.ts
 * Busca músicas hospedadas no GitHub Releases.
 *
 * Variáveis de ambiente:
 *   NEXT_PUBLIC_GITHUB_SONGS_REPO = usuario/repositorio
 *   NEXT_PUBLIC_GITHUB_SONGS_TAG  = songs  (tag do release)
 *   GITHUB_TOKEN                  = ghp_xxx (opcional)
 */

import type { SongListItem, SongMeta, ChartData } from "./types"

function getRepo() { return process.env.NEXT_PUBLIC_GITHUB_SONGS_REPO || "" }
function getTag()  { return process.env.NEXT_PUBLIC_GITHUB_SONGS_TAG  || "songs" }
function getToken(){ return process.env.GITHUB_TOKEN || "" }

export function isGitHubConfigured(): boolean {
  const repo = getRepo()
  return !!(repo && !repo.includes("usuario/repositorio") && repo.includes("/"))
}

// URL de download de um asset do release
export function githubAssetUrl(path: string): string {
  const repo = getRepo()
  const tag  = getTag()
  // Codifica apenas os componentes do path que precisam
  const encodedPath = path.split("/").map(p => encodeURIComponent(p)).join("/")
  return `https://github.com/${repo}/releases/download/${tag}/${encodedPath}`
}

function ghFetchOptions(cache: RequestCache = "no-store"): RequestInit {
  const token = getToken()
  const headers: HeadersInit = {}
  if (token) headers["Authorization"] = `Bearer ${token}`
  return { headers, cache }
}

// ─── Índice ───────────────────────────────────────────────────────────────────

interface SongIndexEntry extends SongListItem {
  audioFiles?: Record<string, string>
  albumArtFile?: string | null
  previewFile?: string | null
}

let _indexCache: SongIndexEntry[] | null = null

export async function fetchSongsIndex(): Promise<SongListItem[]> {
  if (_indexCache) return _indexCache
  try {
    const url = githubAssetUrl("songs-index.json")
    const res = await fetch(url, ghFetchOptions("no-store"))
    if (!res.ok) { console.error("GitHub index fetch failed:", res.status, url); return [] }
    const data: SongIndexEntry[] = await res.json()
    // Reconstrói URLs de álbum e preview
    const songs: SongIndexEntry[] = data.map(s => ({
      ...s,
      albumArt: s.albumArtFile ? githubAssetUrl(`${s.id}/${s.albumArtFile}`) : undefined,
      previewUrl: s.previewFile ? githubAssetUrl(`${s.id}/${s.previewFile}`) : undefined,
    }))
    _indexCache = songs
    return songs
  } catch (e) {
    console.error("fetchSongsIndex error:", e)
    return []
  }
}

// ─── Áudio ────────────────────────────────────────────────────────────────────

export async function getGitHubAudioUrls(trackId: string): Promise<Record<string, string>> {
  const index = await fetchSongsIndex() as SongIndexEntry[]
  const entry = index.find(s => s.id === trackId) as SongIndexEntry | undefined
  const urls: Record<string, string> = {}

  if (entry?.audioFiles) {
    for (const [key, filename] of Object.entries(entry.audioFiles)) {
      urls[key] = githubAssetUrl(`${trackId}/${filename}`)
    }
  } else {
    // Fallback: tenta os nomes mais comuns
    const defaults: Record<string, string> = {
      song: "song.opus", guitar: "guitar.opus", rhythm: "rhythm.opus",
      bass: "bass.opus", vocals: "vocals.opus", drums: "drums.opus",
      crowd: "crowd.opus", keys: "keys.opus",
    }
    for (const [key, file] of Object.entries(defaults)) {
      urls[key] = githubAssetUrl(`${trackId}/${file}`)
    }
  }

  return urls
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

export async function fetchGitHubSongMeta(trackId: string): Promise<SongMeta | null> {
  // Primeiro tenta pegar do índice (mais rápido)
  const index = await fetchSongsIndex()
  const entry = index.find(s => s.id === trackId)
  if (entry) {
    return {
      id: entry.id, name: entry.name, artist: entry.artist,
      album: entry.album || "", year: entry.year || "",
      genre: entry.genre || "", charter: "", difficulty: entry.difficulty ?? 3,
      songLength: 0, previewStart: 0,
    }
  }

  // Fallback: busca song.ini direto
  try {
    const res = await fetch(githubAssetUrl(`${trackId}/song.ini`), ghFetchOptions())
    if (res.ok) {
      const { parseSongIni } = await import("./ini-parser")
      return parseSongIni(await res.text(), trackId)
    }
  } catch {}

  const parts = trackId.split(" - ")
  return {
    id: trackId,
    name: parts.length >= 2 ? parts.slice(1).join(" - ").trim() : trackId,
    artist: parts.length >= 2 ? parts[0].trim() : "Unknown Artist",
    album: "", year: "", genre: "", charter: "", difficulty: 3, songLength: 0, previewStart: 0,
  }
}

// ─── Chart ────────────────────────────────────────────────────────────────────

export async function fetchGitHubSongChart(trackId: string): Promise<ChartData | null> {
  // 1. chart.json pré-processado
  try {
    const res = await fetch(githubAssetUrl(`${trackId}/chart.json`), ghFetchOptions())
    if (res.ok) return await res.json()
  } catch {}

  // 2. notes.chart
  try {
    const res = await fetch(githubAssetUrl(`${trackId}/notes.chart`), ghFetchOptions())
    if (res.ok) {
      const { parseChart } = await import("./chart-parser")
      return parseChart(await res.text())
    }
  } catch {}

  // 3. MIDI
  for (const fname of ["notes.mid", "notes.midi"]) {
    try {
      const res = await fetch(githubAssetUrl(`${trackId}/${fname}`), ghFetchOptions())
      if (!res.ok) continue
      const buf = await res.arrayBuffer()
      const magic = new TextDecoder().decode(new Uint8Array(buf).slice(0, 4))
      if (magic === "MThd") {
        const { parseMidi } = await import("./midi-parser")
        return parseMidi(buf)
      }
    } catch {}
  }

  return null
}
