/**
 * library.ts — busca músicas do GitHub via API
 * Lê song.ini, album art e suporta notes.mid, notes.chart, chart.json
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
    getRepo() +
    "/" +
    getBranch() +
    "/public/songs/" +
    encodeURIComponent(songId) +
    "/" +
    fileName
  )
}

function apiUrl(path: string): string {
  return (
    "https://api.github.com/repos/" +
    getRepo() +
    "/contents/" +
    path +
    "?ref=" +
    getBranch()
  )
}

async function ghFetch(url: string): Promise<Response> {
  const token = getToken()
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  }
  if (token) headers["Authorization"] = "token " + token
  return fetch(url, { headers, cache: "no-store" })
}

// Lê song.ini do GitHub e extrai metadados
async function fetchSongIni(songId: string): Promise<Partial<SongMeta> | null> {
  try {
    const res = await ghFetch(rawUrl("public/songs/" + encodeURIComponent(songId) + "/song.ini"))
    if (!res.ok) return null
    const text = await res.text()
    const { parseSongIni } = await import("./ini-parser")
    return parseSongIni(text, songId)
  } catch {
    return null
  }
}

// Detecta qual arquivo de album art existe na pasta
function getAlbumArtUrl(songId: string, files: string[]): string | undefined {
  const artNames = ["album.jpg", "album.jpeg", "album.png", "album.webp", "background.jpg", "background.jpeg", "background.png"]
  for (const name of artNames) {
    if (files.includes(name)) return songFileUrl(songId, name)
  }
  return undefined
}

// Detecta qual arquivo de preview existe
function getPreviewUrl(songId: string, files: string[]): string | undefined {
  const previewNames = ["preview.ogg", "preview.mp3", "preview.opus", "preview.wav"]
  for (const name of previewNames) {
    if (files.includes(name)) return songFileUrl(songId, name)
  }
  return undefined
}

// ─── getSongList ──────────────────────────────────────────────────────────────
export async function getSongList(): Promise<SongListItem[]> {
  try {
    // Lista todas as pastas de public/songs/ via GitHub API
    const apiRes = await ghFetch(apiUrl("public/songs"))
    if (!apiRes.ok) {
      console.error("GitHub API erro ao listar pastas:", apiRes.status)
      return []
    }

    const entries: Array<{ name: string; type: string }> = await apiRes.json()
    const folders = entries.filter(
      (e) => e.type === "dir" && e.name !== "demo-song"
    )

    // Para cada pasta, busca os arquivos e o song.ini em paralelo
    const songs = await Promise.all(
      folders.map(async (folder): Promise<SongListItem> => {
        // Lista arquivos da pasta para detectar album art e preview
        let files: string[] = []
        try {
          const filesRes = await ghFetch(apiUrl("public/songs/" + encodeURIComponent(folder.name)))
          if (filesRes.ok) {
            const fileEntries: Array<{ name: string; type: string }> = await filesRes.json()
            files = fileEntries.map((f) => f.name.toLowerCase())
          }
        } catch {}

        // Lê song.ini para metadados reais
        const meta = await fetchSongIni(folder.name)

        // Fallback por nome da pasta (ex: "Slipknot - Duality (Harmonix)")
        const parts = folder.name.split(" - ")
        const fallbackArtist = parts.length >= 2 ? parts[0].trim() : "Unknown Artist"
        const fallbackName = parts.length >= 2 ? parts.slice(1).join(" - ").trim() : folder.name

        return {
          id: folder.name,
          name: meta?.name || fallbackName,
          artist: meta?.artist || fallbackArtist,
          album: meta?.album || "",
          year: meta?.year || "",
          genre: meta?.genre || "",
          difficulty: meta?.difficulty ?? 3,
          albumArt: getAlbumArtUrl(folder.name, files),
          previewUrl: getPreviewUrl(folder.name, files),
        }
      })
    )

    return songs.sort((a, b) => a.name.localeCompare(b.name))
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

    console.error("Chart nao encontrado para: " + trackId)
    return null
  } catch (e) {
    console.error("Erro em getSongChart(" + trackId + "):", e)
    return null
  }
}

// ─── getSongMeta ──────────────────────────────────────────────────────────────
export async function getSongMeta(trackId: string): Promise<SongMeta | null> {
  try {
    // 1. meta.json
    const metaRes = await ghFetch(rawUrl("public/songs/" + encodeURIComponent(trackId) + "/meta.json"))
    if (metaRes.ok) return await metaRes.json()

    // 2. song.ini
    const iniRes = await ghFetch(rawUrl("public/songs/" + encodeURIComponent(trackId) + "/song.ini"))
    if (iniRes.ok) {
      const raw = await iniRes.text()
      const { parseSongIni } = await import("./ini-parser")
      return parseSongIni(raw, trackId)
    }

    // 3. Fallback por nome da pasta
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

  // Suporta todos os formatos encontrados nas pastas
  const audioMap: Record<string, string[]> = {
    guitar:  ["guitar.opus", "guitar.ogg", "guitar.mp3", "guitar.wav"],
    rhythm:  ["rhythm.opus", "rhythm.ogg", "bass.opus", "bass.ogg"],
    backing: ["backing.opus", "backing.ogg", "backing.mp3"],
    song:    ["song.opus", "song.ogg", "song.mp3", "audio.opus", "audio.ogg"],
    drums:   ["drums_1.opus", "drums_1.ogg"],
    vocals:  ["vocals.opus", "vocals.ogg"],
    preview: ["preview.opus", "preview.ogg", "preview.mp3"],
  }

  for (const [key, filenames] of Object.entries(audioMap)) {
    // Usa o primeiro formato de cada tipo como URL principal
    urls[key] = songFileUrl(trackId, filenames[0])
  }

  return urls
}