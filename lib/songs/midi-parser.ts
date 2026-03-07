/**
 * midi-parser.ts — converte notes.mid (MIDI binário) para ChartData
 *
 * Lê apenas as tracks de notas do Guitar Hero/Clone Hero:
 *   - PART GUITAR (Expert, Hard, Medium, Easy)
 *   - PART BASS, PART RHYTHM (fallback)
 *
 * Notas GH no MIDI: canal 0, pitches 60-64 (Easy), 72-76 (Medium),
 * 84-88 (Hard), 96-100 (Expert) + 116 (open/forced)
 */

import type { ChartData, GameNote, BPMChange, TimeSignature, SongSection } from "./types"
import { reduceDensity } from "./chart-parser"

// Pitch ranges por dificuldade (5 frets cada)
const DIFFICULTY_RANGES: Array<{ name: string; base: number }> = [
  { name: "Expert", base: 96 },
  { name: "Hard",   base: 84 },
  { name: "Medium", base: 72 },
  { name: "Easy",   base: 60 },
]

// Fret index (0-4) → lane (0-4)
const FRET_TO_LANE: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4 }

export function parseMidi(buffer: ArrayBuffer): ChartData {
  const view = new DataView(buffer)
  let offset = 0

  // ── Lê uint helpers ──────────────────────────────────────────────────────
  const readU8  = () => view.getUint8(offset++)
  const readU16 = () => { const v = view.getUint16(offset); offset += 2; return v }
  const readU32 = () => { const v = view.getUint32(offset); offset += 4; return v }
  const readVarLen = () => {
    let val = 0
    let b: number
    do { b = readU8(); val = (val << 7) | (b & 0x7f) } while (b & 0x80)
    return val
  }
  const skip = (n: number) => { offset += n }

  // ── Header ───────────────────────────────────────────────────────────────
  const headerTag = String.fromCharCode(...[readU8(), readU8(), readU8(), readU8()])
  if (headerTag !== "MThd") throw new Error("Not a MIDI file")
  const headerLen = readU32()
  const format    = readU16()
  const numTracks = readU16()
  const ticksPerBeat = readU16() // resolution
  skip(headerLen - 6)

  const resolution = ticksPerBeat

  // ── Tracks ───────────────────────────────────────────────────────────────
  interface MidiEvent {
    tick: number
    type: "noteOn" | "noteOff" | "tempo" | "text" | "timeSig"
    note?: number
    velocity?: number
    tempo?: number  // microseconds per beat
    text?: string
    numerator?: number
    denominator?: number
  }

  const tracks: MidiEvent[][] = []

  for (let t = 0; t < numTracks; t++) {
    const tag = String.fromCharCode(...[readU8(), readU8(), readU8(), readU8()])
    const trackLen = readU32()
    if (tag !== "MTrk") { skip(trackLen); tracks.push([]); continue }

    const trackEnd = offset + trackLen
    const events: MidiEvent[] = []
    let tick = 0
    let runningStatus = 0

    while (offset < trackEnd) {
      const delta = readVarLen()
      tick += delta

      let statusByte = view.getUint8(offset)

      if (statusByte & 0x80) {
        runningStatus = statusByte
        offset++
      } else {
        statusByte = runningStatus
      }

      const type    = (statusByte >> 4) & 0xf
      const channel = statusByte & 0xf

      if (type === 0x9) { // Note On
        const note = readU8()
        const vel  = readU8()
        events.push({ tick, type: vel > 0 ? "noteOn" : "noteOff", note, velocity: vel })
      } else if (type === 0x8) { // Note Off
        const note = readU8(); readU8()
        events.push({ tick, type: "noteOff", note })
      } else if (type === 0xa) { readU8(); readU8() } // Aftertouch
      else if (type === 0xb) { readU8(); readU8() }   // CC
      else if (type === 0xc) { readU8() }              // Program Change
      else if (type === 0xd) { readU8() }              // Channel Pressure
      else if (type === 0xe) { readU8(); readU8() }    // Pitch Bend
      else if (statusByte === 0xff) { // Meta event
        const metaType = readU8()
        const metaLen  = readVarLen()
        if (metaType === 0x51 && metaLen === 3) { // Set Tempo
          const tempo = (readU8() << 16) | (readU8() << 8) | readU8()
          events.push({ tick, type: "tempo", tempo })
        } else if (metaType === 0x01 || metaType === 0x03 || metaType === 0x05) { // Text/Track Name
          const bytes = []
          for (let i = 0; i < metaLen; i++) bytes.push(readU8())
          events.push({ tick, type: "text", text: String.fromCharCode(...bytes) })
        } else if (metaType === 0x58 && metaLen === 4) { // Time Signature
          const num = readU8()
          const den = Math.pow(2, readU8())
          readU8(); readU8()
          events.push({ tick, type: "timeSig", numerator: num, denominator: den })
        } else {
          skip(metaLen)
        }
      } else if (statusByte === 0xf0 || statusByte === 0xf7) { // SysEx
        const sysLen = readVarLen()
        skip(sysLen)
      } else {
        // Unknown, skip 1
        offset++
      }
    }
    offset = trackEnd
    tracks.push(events)
  }

  // ── BPM & Time Signatures (from track 0) ─────────────────────────────────
  const bpmChanges: BPMChange[] = []
  const timeSignatures: TimeSignature[] = []

  for (const ev of tracks[0] || []) {
    if (ev.type === "tempo" && ev.tempo !== undefined) {
      bpmChanges.push({ tick: ev.tick, bpm: 60000000 / ev.tempo, time: 0 })
    }
    if (ev.type === "timeSig" && ev.numerator !== undefined) {
      timeSignatures.push({ tick: ev.tick, numerator: ev.numerator, denominator: ev.denominator! })
    }
  }

  if (bpmChanges.length === 0) bpmChanges.push({ tick: 0, bpm: 120, time: 0 })
  bpmChanges.sort((a, b) => a.tick - b.tick)

  // Compute BPM times
  bpmChanges[0].time = 0
  for (let i = 1; i < bpmChanges.length; i++) {
    const prev = bpmChanges[i - 1]
    const curr = bpmChanges[i]
    curr.time = prev.time + ((curr.tick - prev.tick) / resolution) * (60000 / prev.bpm)
  }

  function tickToMs(tick: number): number {
    if (bpmChanges.length === 0) return (tick / resolution) * 500
    let idx = 0
    for (let i = bpmChanges.length - 1; i >= 0; i--) {
      if (bpmChanges[i].tick <= tick) { idx = i; break }
    }
    const b = bpmChanges[idx]
    return b.time + ((tick - b.tick) / resolution) * (60000 / b.bpm)
  }

  // ── Find guitar track ─────────────────────────────────────────────────────
  const GH_TRACK_NAMES = [
    "PART GUITAR", "T1 GEMS",
    "PART BASS", "PART RHYTHM",
    "PART KEYS",
  ]

  let guitarTrackIndex = -1
  let guitarTrackName = ""

  for (let t = 1; t < tracks.length; t++) {
    const nameEvt = tracks[t].find(e => e.type === "text")
    const name = nameEvt?.text?.trim().toUpperCase() || ""
    for (const n of GH_TRACK_NAMES) {
      if (name.includes(n)) {
        guitarTrackIndex = t
        guitarTrackName = name
        break
      }
    }
    if (guitarTrackIndex !== -1) break
  }

  // Fallback: use track 1 if no named guitar track found
  if (guitarTrackIndex === -1 && tracks.length > 1) guitarTrackIndex = 1

  const guitarEvents = guitarTrackIndex >= 0 ? tracks[guitarTrackIndex] : []

  // ── Sections from Events track ────────────────────────────────────────────
  const songSections: SongSection[] = []
  for (const track of tracks) {
    for (const ev of track) {
      if (ev.type === "text" && ev.text) {
        const t = ev.text.trim()
        if (t.startsWith("[section ") || t.startsWith("[prc_")) {
          const name = t.replace(/^\[section\s+/i, "").replace(/^\[prc_/i, "").replace(/\]$/, "")
          songSections.push({ time: tickToMs(ev.tick), name })
        }
      }
    }
  }

  // ── Extract notes ─────────────────────────────────────────────────────────
  let notes: GameNote[] = []

  for (const { name: diffName, base } of DIFFICULTY_RANGES) {
    const noteOns = new Map<number, { tick: number; velocity: number }>()
    const candidates: GameNote[] = []

    for (const ev of guitarEvents) {
      if (ev.note === undefined) continue
      const fret = ev.note - base
      if (fret < 0 || fret > 4) continue

      if (ev.type === "noteOn" && ev.velocity! > 0) {
        noteOns.set(ev.note, { tick: ev.tick, velocity: ev.velocity! })
      } else if (ev.type === "noteOff" || (ev.type === "noteOn" && ev.velocity === 0)) {
        const on = noteOns.get(ev.note)
        if (on) {
          const timeMs    = tickToMs(on.tick)
          const endMs     = tickToMs(ev.tick)
          const durationMs = Math.max(0, endMs - timeMs - 10)
          const lane = FRET_TO_LANE[fret] ?? fret
          const type: GameNote["type"] = durationMs > 50 ? "sustain" : "normal"
          candidates.push({ time: timeMs, lane, type, duration: durationMs })
          noteOns.delete(ev.note)
        }
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.time - b.time || a.lane - b.lane)
      notes = reduceDensity(candidates)
      break // Use first available difficulty
    }
  }

  return {
    resolution,
    offset: 0,
    bpmChanges,
    timeSignatures,
    sections: songSections,
    notes,
  }
}
