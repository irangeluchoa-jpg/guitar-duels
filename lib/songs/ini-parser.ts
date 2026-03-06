import type { SongMeta } from "./types"

/**
 * Parse a song.ini / song file (INI format) into SongMeta.
 * Supports both `[song]` section format and bare key=value.
 */
export function parseSongIni(content: string, fallbackId: string): SongMeta {
  const lines = content.split(/\r?\n/)
  const data: Record<string, string> = {}

  for (const raw of lines) {
    const line = raw.trim()
    // Skip empty lines, comments, and section headers
    if (!line || line.startsWith(";") || line.startsWith("#") || line.startsWith("[")) {
      continue
    }
    const eqIndex = line.indexOf("=")
    if (eqIndex === -1) continue

    const key = line.slice(0, eqIndex).trim().toLowerCase()
    const value = line.slice(eqIndex + 1).trim()
    data[key] = value
  }

  return {
    id: fallbackId,
    name: data["name"] || data["title"] || data["song_name"] || fallbackId,
    artist: data["artist"] || data["artist_text"] || "Unknown Artist",
    album: data["album"] || "",
    year: data["year"] || "",
    genre: data["genre"] || "",
    charter: data["charter"] || data["frets"] || "",
    difficulty: parseDifficulty(data["diff_guitar"] || data["difficulty"] || ""),
    songLength: parseInt(data["song_length"] || "0", 10),
    previewStart: parseInt(data["preview_start_time"] || data["preview"] || "0", 10),
  }
}

function parseDifficulty(val: string): number {
  const n = parseInt(val, 10)
  if (isNaN(n)) return 3 // default medium
  return Math.max(0, Math.min(6, n))
}
