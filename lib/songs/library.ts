/**
 * library.ts — lê songs-index.json do GitHub (gerado localmente)
 * Rápido e sem rate limit — uma única chamada para listar músicas
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
  return (
    "https://raw.githubusercontent.com/" +
    getRepo() + "/" + getBranch() +
    "/public/songs/" + encodeURIComponent(songId) + "/" + fileName
  )
}

async function ghFetch(url: string): Promise<Response> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = "token " + token
  return fetch(url, { headers, cache: "no-store" })
}

// ─── getSongList ──────────────────────────────────────────────────────────────
export async function getSongList(): Promise<SongListItem[]> {
  try {
    const url = rawUrl("public/songs/songs-index.json")
    const res = await ghFetch(url)

    if (!res.ok) {
      console.error("Erro ao buscar songs-index.json:", res.status, url)
      return []
    }

    const data = await res.json()
    const songs: SongListItem[] = Array.isArray(data) ? data : []

    // Filtra demo e mapeia URLs de album art e preview para o GitHub
    return songs
      .filter((s) => s.id !== "demo-song")
      .map((song) => ({
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
    // 1. chart.json
    const chartJsonRes = await ghFetch(rawUrl("public/songs/" + encodeURIComponent(trackId) + "/chart.json"))
    if (chartJsonRes.ok) return await chartJsonRes.json()

    // 2. notes.chart
    const notesChartRes = await ghFetch(rawUrl("public/songs/" + encodeURIComponent(trackId) + "/notes.chart"))
    if (notesChartRes.ok) {
      const raw = await notesChartRes.text()
      const { parseChart } = await import("./chart-parser")
      return parseChart(raw)
    }

    // 3. notes.mid / notes.midi
    for (const fname of ["notes.mid", "notes.midi"]) {
      const midiRes = await ghFetch(rawUrl("public/songs/" + encodeURIComponent(trackId) + "/" + fname))
      if (!midiRes.ok) continue
      const buf = await midiRes.arrayBuffer()
      const magic = new TextDecoder().decode(new Uint8Array(buf).slice(0, 4))
      if (magic === "MThd") {
        const { parseMidi } = await import("./midi-parser")
        return parseMidi(buf)
      }
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
    const metaRes = await ghFetch(rawUrl("public/songs/" + encodeURIComponent(trackId) + "/meta.json"))
    if (metaRes.ok) return await metaRes.json()

    const iniRes = await ghFetch(rawUrl("public/songs/" + encodeURIComponent(trackId) + "/song.ini"))
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
  const audioMap: Record<string, string> = {
    guitar:  "guitar.opus",
    rhythm:  "rhythm.opus",
    backing: "backing.opus",
    song:    "song.opus",
    drums:   "drums_1.opus",
    vocals:  "vocals.opus",
    preview: "preview.opus",
  }
  for (const [key, filename] of Object.entries(audioMap)) {
    urls[key] = songFileUrl(trackId, filename)
  }
  return urls
}
