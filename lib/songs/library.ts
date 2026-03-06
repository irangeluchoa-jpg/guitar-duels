/**
 * library.ts — busca músicas do repositório GitHub (guitar-duels-songs)
 * Lê o songs-index.json do repo e serve os arquivos via raw.githubusercontent.com
 */

import type { SongListItem, SongMeta, ChartData } from "./types"

// ─── Config GitHub ────────────────────────────────────────────────────────────
function getGitHubRepo(): string {
  return process.env.NEXT_PUBLIC_GITHUB_SONGS_REPO || ""
}

function getGitHubBranch(): string {
  return process.env.NEXT_PUBLIC_GITHUB_SONGS_BRANCH || "main"
}

function getGitHubToken(): string {
  return process.env.GITHUB_TOKEN || ""
}

// URL base para arquivos raw do GitHub
function rawUrl(filePath: string): string {
  const repo = getGitHubRepo()
  const branch = getGitHubBranch()
  return `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`
}

// URL pública para servir para o browser (áudio, imagens)
export function songFileUrl(songId: string, fileName: string): string {
  const repo = getGitHubRepo()
  const branch = getGitHubBranch()
  return `https://raw.githubusercontent.com/${repo}/${branch}/public/songs/${encodeURIComponent(songId)}/${fileName}`
}

async function githubFetch(url: string): Promise<Response> {
  const token = getGitHubToken()
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `token ${token}`
  return fetch(url, { headers, cache: "no-store" })
}

// ─── getSongList ──────────────────────────────────────────────────────────────
export async function getSongList(): Promise<SongListItem[]> {
  const repo = getGitHubRepo()
  if (!repo) {
    console.error("NEXT_PUBLIC_GITHUB_SONGS_REPO nao configurado")
    return []
  }

  try {
    const url = rawUrl("public/songs/songs-index.json")
    const res = await githubFetch(url)

    if (!res.ok) {
      console.error(`Erro ao buscar songs-index.json: ${res.status} — ${url}`)
      return []
    }

    const data = await res.json()
    const songs: SongListItem[] = Array.isArray(data) ? data : []

    // Substitui URLs locais para apontar para o GitHub
    return songs.map((song) => ({
      ...song,
      albumArt: song.albumArt
        ? songFileUrl(song.id, song.albumArt.replace(/^\/songs\/[^/]+\//, ""))
        : undefined,
      previewUrl: song.previewUrl
        ? songFileUrl(song.id, song.previewUrl.replace(/^\/songs\/[^/]+\//, ""))
        : undefined,
    }))
  } catch (e) {
    console.error("Erro em getSongList:", e)
    return []
  }
}

// ─── getSongChart ──────────────────────────────────────────────────────────────
export async function getSongChart(trackId: string): Promise<ChartData | null> {
  try {
    // Tenta chart.json primeiro
    const chartUrl = rawUrl(`public/songs/${encodeURIComponent(trackId)}/chart.json`)
    const res = await githubFetch(chartUrl)
    if (res.ok) {
      return await res.json()
    }

    // Tenta notes.chart
    const notesUrl = rawUrl(`public/songs/${encodeURIComponent(trackId)}/notes.chart`)
    const notesRes = await githubFetch(notesUrl)
    if (notesRes.ok) {
      const raw = await notesRes.text()
      const { parseChart } = await import("./chart-parser")
      return parseChart(raw)
    }

    console.error(`Chart nao encontrado para: ${trackId}`)
    return null
  } catch (e) {
    console.error(`Erro em getSongChart(${trackId}):`, e)
    return null
  }
}

// ─── getSongMeta ──────────────────────────────────────────────────────────────
export async function getSongMeta(trackId: string): Promise<SongMeta | null> {
  try {
    // Tenta meta.json primeiro
    const metaUrl = rawUrl(`public/songs/${encodeURIComponent(trackId)}/meta.json`)
    const res = await githubFetch(metaUrl)
    if (res.ok) {
      return await res.json()
    }

    // Tenta song.ini
    const iniUrl = rawUrl(`public/songs/${encodeURIComponent(trackId)}/song.ini`)
    const iniRes = await githubFetch(iniUrl)
    if (iniRes.ok) {
      const raw = await iniRes.text()
      const { parseSongIni } = await import("./ini-parser")
      return parseSongIni(raw, trackId)
    }

    // Fallback por nome da pasta
    const parts = trackId.split(" - ")
    return {
      id: trackId,
      name: parts.length >= 2 ? parts.slice(1).join(" - ").trim() : trackId,
      artist: parts.length >= 2 ? parts[0].trim() : "Unknown Artist",
      album: "", year: "", genre: "", charter: "", difficulty: 3, songLength: 0, previewStart: 0,
    }
  } catch (e) {
    console.error(`Erro em getSongMeta(${trackId}):`, e)
    return null
  }
}

// ─── getSongAudioUrls ──────────────────────────────────────────────────────────
export function getSongAudioUrls(trackId: string): Record<string, string> {
  const urls: Record<string, string> = {}

  const audioFiles: Record<string, string[]> = {
    guitar:  ["guitar.ogg", "guitar.mp3", "guitar.opus", "guitar.wav"],
    rhythm:  ["rhythm.ogg", "rhythm.mp3", "bass.ogg", "bass.mp3"],
    backing: ["backing.ogg", "backing.mp3", "backing.opus"],
    song:    ["song.ogg", "song.mp3", "audio.ogg", "audio.mp3"],
    preview: ["preview.ogg", "preview.mp3", "preview.opus"],
  }

  for (const [key, filenames] of Object.entries(audioFiles)) {
    urls[key] = songFileUrl(trackId, filenames[0])
  }

  return urls
}
