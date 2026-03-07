/**
 * library.ts — busca músicas direto do GitHub via API
 * Lista as pastas de public/songs/ usando a GitHub API
 * Não depende de songs-index.json
 */

import type { SongListItem, SongMeta, ChartData } from "./types"

function getRepo(): string {
  return process.env.NEXT_PUBLIC_GITHUB_SONGS_REPO || "irangeluchoa-jpg/guitar-duels"
}

function getBranch(): string {
  return process.env.NEXT_PUBLIC_GITHUB_SONGS_BRANCH || "main"
}

function getToken(): string {
  return process.env.GITHUB_TOKEN || ""
}

function rawUrl(filePath: string): string {
  return "https://raw.githubusercontent.com/" + getRepo() + "/" + getBranch() + "/" + filePath
}

export function songFileUrl(songId: string, fileName: string): string {
  return "https://raw.githubusercontent.com/" + getRepo() + "/" + getBranch() + "/public/songs/" + encodeURIComponent(songId) + "/" + fileName
}

function apiUrl(path: string): string {
  return "https://api.github.com/repos/" + getRepo() + "/contents/" + path + "?ref=" + getBranch()
}

async function ghFetch(url: string): Promise<Response> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github.v3+json",
  }
  if (token) headers["Authorization"] = "token " + token
  return fetch(url, { headers, cache: "no-store" })
}

// ─── getSongList ──────────────────────────────────────────────────────────────
export async function getSongList(): Promise<SongListItem[]> {
  try {
    // Primeiro tenta o songs-index.json (mais rápido)
    const indexUrl = rawUrl("public/songs/songs-index.json")
    const indexRes = await ghFetch(indexUrl)

    if (indexRes.ok) {
      const data = await indexRes.json()
      const songs: SongListItem[] = Array.isArray(data) ? data : []

      // Filtra a demo e mapeia URLs
      const filtered = songs.filter((s) => s.id !== "demo-song")

      if (filtered.length > 0) {
        return filtered.map((song) => ({
          ...song,
          albumArt: song.albumArt
            ? songFileUrl(song.id, song.albumArt.replace(/^\/songs\/[^/]+\//, ""))
            : undefined,
          previewUrl: song.previewUrl
            ? songFileUrl(song.id, song.previewUrl.replace(/^\/songs\/[^/]+\//, ""))
            : undefined,
        }))
      }
    }

    // Fallback: lista pastas via GitHub API
    console.log("songs-index.json vazio ou so tem demo, listando via API...")
    const apiRes = await ghFetch(apiUrl("public/songs"))
    if (!apiRes.ok) {
      console.error("GitHub API erro:", apiRes.status)
      return []
    }

    const entries: Array<{ name: string; type: string }> = await apiRes.json()
    const folders = entries.filter(
      (e) => e.type === "dir" && e.name !== "demo-song"
    )

    const songs: SongListItem[] = folders.map((folder) => {
      const parts = folder.name.split(" - ")
      return {
        id: folder.name,
        name: parts.length >= 2 ? parts.slice(1).join(" - ").trim() : folder.name,
        artist: parts.length >= 2 ? parts[0].trim() : "Unknown Artist",
        album: "",
        year: "",
        genre: "",
        difficulty: 3,
        albumArt: undefined,
        previewUrl: undefined,
      }
    })

    return songs.sort((a, b) => a.name.localeCompare(b.name))
  } catch (e) {
    console.error("Erro em getSongList:", e)
    return []
  }
}

// ─── getSongChart ──────────────────────────────────────────────────────────────
export async function getSongChart(trackId: string): Promise<ChartData | null> {
  try {
    const chartUrl = rawUrl("public/songs/" + encodeURIComponent(trackId) + "/chart.json")
    const res = await ghFetch(chartUrl)
    if (res.ok) return await res.json()

    const notesUrl = rawUrl("public/songs/" + encodeURIComponent(trackId) + "/notes.chart")
    const notesRes = await ghFetch(notesUrl)
    if (notesRes.ok) {
      const raw = await notesRes.text()
      const { parseChart } = await import("./chart-parser")
      return parseChart(raw)
    }

    return null
  } catch (e) {
    console.error("Erro em getSongChart(" + trackId + "):", e)
    return null
  }
}

// ─── getSongMeta ──────────────────────────────────────────────────────────────
export async function getSongMeta(trackId: string): Promise<SongMeta | null> {
  try {
    const metaUrl = rawUrl("public/songs/" + encodeURIComponent(trackId) + "/meta.json")
    const res = await ghFetch(metaUrl)
    if (res.ok) return await res.json()

    const iniUrl = rawUrl("public/songs/" + encodeURIComponent(trackId) + "/song.ini")
    const iniRes = await ghFetch(iniUrl)
    if (iniRes.ok) {
      const raw = await iniRes.text()
      const { parseSongIni } = await import("./ini-parser")
      return parseSongIni(raw, trackId)
    }

    const parts = trackId.split(" - ")
    return {
      id: trackId,
      name: parts.length >= 2 ? parts.slice(1).join(" - ").trim() : trackId,
      artist: parts.length >= 2 ? parts[0].trim() : "Unknown Artist",
      album: "", year: "", genre: "", charter: "", difficulty: 3, songLength: 0, previewStart: 0,
    }
  } catch (e) {
    console.error("Erro em getSongMeta(" + trackId + "):", e)
    return null
  }
}

// ─── getSongAudioUrls ──────────────────────────────────────────────────────────
export function getSongAudioUrls(trackId: string): Record<string, string> {
  const urls: Record<string, string> = {}

  const audioFiles: Record<string, string> = {
    guitar:  "guitar.ogg",
    rhythm:  "rhythm.ogg",
    backing: "backing.ogg",
    song:    "song.ogg",
    preview: "preview.ogg",
  }

  for (const [key, filename] of Object.entries(audioFiles)) {
    urls[key] = songFileUrl(trackId, filename)
  }

  return urls
}
























