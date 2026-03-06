/**
 * generate-songs-index.mjs
 * Lê as músicas de public/songs/ e gera o songs-index.json
 * que você vai subir no GitHub Release.
 *
 * Uso: node scripts/generate-songs-index.mjs
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from "fs"
import { join, extname } from "path"
import { fileURLToPath } from "url"
import { dirname } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const SONGS_DIR = join(ROOT, "public", "songs")

function parseSongIni(raw, folderName) {
  const lines = raw.split(/\r?\n/)
  const data = {}
  for (const line of lines) {
    const m = line.match(/^\s*([^=]+?)\s*=\s*(.+?)\s*$/)
    if (m) data[m[1].toLowerCase()] = m[2]
  }
  const parts = folderName.split(" - ")
  return {
    id: folderName,
    name: data.name || data.title || (parts.length >= 2 ? parts.slice(1).join(" - ").trim() : folderName),
    artist: data.artist || (parts.length >= 2 ? parts[0].trim() : "Unknown Artist"),
    album: data.album || "",
    year: data.year || "",
    genre: data.genre || "",
    charter: data.charter || data.frets || "",
    difficulty: parseInt(data.diff_guitar || data.difficulty || "3") || 3,
    songLength: parseInt(data.song_length || "0") || 0,
    previewStart: parseInt(data.preview_start_time || "0") || 0,
  }
}

function getAlbumArt(songDir, folderName) {
  for (const n of ["album.jpg","album.jpeg","album.png","album.webp","background.jpg","background.png"]) {
    if (existsSync(join(songDir, n))) return n
  }
  return null
}

function getPreview(songDir) {
  for (const n of ["preview.ogg","preview.mp3","preview.opus","preview.wav"]) {
    if (existsSync(join(songDir, n))) return n
  }
  return null
}

function getAudioFiles(songDir) {
  const AUDIO_EXTS = [".ogg", ".mp3", ".opus", ".wav"]
  const KEY_PATTERNS = {
    guitar: ["guitar"], rhythm: ["rhythm"], bass: ["bass"],
    song: ["song", "audio"], backing: ["backing"],
    vocals: ["vocals", "vocal", "voice"], drums: ["drums", "drum"],
    drums_1: ["drums_1"], drums_2: ["drums_2"], drums_3: ["drums_3"],
    crowd: ["crowd"], keys: ["keys", "keyboard", "piano"],
    preview: ["preview"],
  }
  const found = {}
  try {
    const files = readdirSync(songDir)
    for (const [key, patterns] of Object.entries(KEY_PATTERNS)) {
      for (const pattern of patterns) {
        for (const ext of AUDIO_EXTS) {
          if (files.includes(`${pattern}${ext}`)) {
            found[key] = `${pattern}${ext}`
            break
          }
        }
        if (found[key]) break
      }
    }
  } catch {}
  return found
}

if (!existsSync(SONGS_DIR)) {
  console.error("❌ Pasta public/songs/ não encontrada!")
  process.exit(1)
}

const songs = []
const entries = readdirSync(SONGS_DIR, { withFileTypes: true })

for (const entry of entries) {
  if (!entry.isDirectory()) continue
  const songDir = join(SONGS_DIR, entry.name)
  let meta = null

  // Tenta meta.json
  if (existsSync(join(songDir, "meta.json"))) {
    try { meta = JSON.parse(readFileSync(join(songDir, "meta.json"), "utf-8")) } catch {}
  }
  // Tenta song.ini
  if (!meta && existsSync(join(songDir, "song.ini"))) {
    try { meta = parseSongIni(readFileSync(join(songDir, "song.ini"), "utf-8"), entry.name) } catch {}
  }
  // Fallback
  if (!meta) {
    const hasChart = ["notes.chart","notes.mid","notes.midi"].some(f => existsSync(join(songDir, f)))
    if (!hasChart) continue
    const parts = entry.name.split(" - ")
    meta = {
      id: entry.name,
      name: parts.length >= 2 ? parts.slice(1).join(" - ").trim() : entry.name,
      artist: parts.length >= 2 ? parts[0].trim() : "Unknown Artist",
      album: "", year: "", genre: "", charter: "", difficulty: 3, songLength: 0, previewStart: 0,
    }
  }
  if (!meta.id) meta.id = entry.name

  const albumArtFile = getAlbumArt(songDir, entry.name)
  const previewFile  = getPreview(songDir)
  const audioFiles   = getAudioFiles(songDir)

  songs.push({
    id: meta.id,
    name: meta.name,
    artist: meta.artist,
    album: meta.album || "",
    year: meta.year || "",
    genre: meta.genre || "",
    difficulty: meta.difficulty ?? 3,
    // Guarda quais arquivos de áudio existem (para a API saber construir as URLs)
    audioFiles,
    albumArtFile,
    previewFile,
  })

  console.log(`✅ ${meta.artist} - ${meta.name}`)
}

songs.sort((a, b) => a.name.localeCompare(b.name))

const outputPath = join(ROOT, "songs-index.json")
writeFileSync(outputPath, JSON.stringify(songs, null, 2), "utf-8")
console.log(`\n🎸 ${songs.length} músicas indexadas → songs-index.json`)
console.log(`\nPróximo passo: suba o arquivo songs-index.json no GitHub Release!`)
