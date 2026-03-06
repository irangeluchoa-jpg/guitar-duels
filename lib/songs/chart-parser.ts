import type { ChartData, GameNote, BPMChange, TimeSignature, SongSection } from "./types"
import { GH_FRET_TO_LANE } from "./types"

/**
 * Parse a .chart file (Clone Hero / GH text format) into ChartData.
 *
 * The .chart format has sections like:
 *   [Song] - metadata
 *   [SyncTrack] - BPM and time signature events
 *   [Events] - section markers, lyrics
 *   [ExpertSingle] - notes for Expert difficulty on guitar
 */
export function parseChart(content: string): ChartData {
  const sections = parseSections(content)

  // Parse Song section for resolution and offset
  const songSection = sections["Song"] || {}
  const resolution = parseInt(songSection["Resolution"] || "192", 10)
  const offset = parseFloat(songSection["Offset"] || "0") * 1000 // to ms

  // Parse SyncTrack
  const syncTrackLines = sections["SyncTrack"]?.__events || []
  const bpmChanges: BPMChange[] = []
  const timeSignatures: TimeSignature[] = []

  for (const evt of syncTrackLines) {
    const { tick, type, values } = evt
    if (type === "B") {
      // BPM event: tick = B bpm (bpm is in milli-BPM, so 120000 = 120 BPM)
      bpmChanges.push({
        tick,
        bpm: parseInt(values[0], 10) / 1000,
        time: 0, // computed below
      })
    } else if (type === "TS") {
      // Time signature: tick = TS numerator [denominator_exponent]
      timeSignatures.push({
        tick,
        numerator: parseInt(values[0], 10),
        denominator: values[1] ? Math.pow(2, parseInt(values[1], 10)) : 4,
      })
    }
  }

  // Sort BPM changes by tick
  bpmChanges.sort((a, b) => a.tick - b.tick)

  // Compute time for each BPM change
  computeBPMTimes(bpmChanges, resolution)

  // Parse Events for sections
  const eventLines = sections["Events"]?.__events || []
  const songSections: SongSection[] = []
  for (const evt of eventLines) {
    if (evt.type === "E" && evt.values[0]?.startsWith('"section ')) {
      const name = evt.values.join(" ").replace(/^"section\s+/, "").replace(/"$/, "")
      songSections.push({
        time: tickToMs(evt.tick, bpmChanges, resolution),
        name,
      })
    }
  }

  // Parse notes - try Expert first, then Hard, Medium, Easy
  const difficultyOrder = [
    "ExpertSingle",
    "HardSingle",
    "MediumSingle",
    "EasySingle",
  ]

  let rawNotes: Array<{ tick: number; fret: number; duration: number }> = []

  for (const diff of difficultyOrder) {
    const noteEvents = sections[diff]?.__events || []
    if (noteEvents.length === 0) continue

    for (const evt of noteEvents) {
      if (evt.type === "N") {
        const fret = parseInt(evt.values[0], 10)
        const duration = parseInt(evt.values[1], 10)
        rawNotes.push({ tick: evt.tick, fret, duration })
      }
    }
    break // Use first available difficulty
  }

  // Convert raw notes to GameNotes
  const notes: GameNote[] = []
  const forcedTicks = new Set<number>()
  const tapTicks = new Set<number>()

  // First pass: collect forced and tap flags
  for (const rn of rawNotes) {
    if (rn.fret === 5) forcedTicks.add(rn.tick)
    if (rn.fret === 6) tapTicks.add(rn.tick)
  }

  // Second pass: create actual notes
  for (const rn of rawNotes) {
    // Skip modifier-only notes
    if (rn.fret === 5 || rn.fret === 6) continue

    let lane = GH_FRET_TO_LANE[rn.fret]
    if (lane === undefined) continue // unknown fret
    lane = Math.min(lane, 4) // clamp to 5 lanes (0-4)

    const timeMs = tickToMs(rn.tick, bpmChanges, resolution)
    const durationMs = rn.duration > 0
      ? tickToMs(rn.tick + rn.duration, bpmChanges, resolution) - timeMs
      : 0

    let type: GameNote["type"] = "normal"
    if (tapTicks.has(rn.tick)) type = "tap"
    else if (forcedTicks.has(rn.tick)) type = "forced"
    if (durationMs > 50) type = "sustain" // sustain overrides

    notes.push({
      time: timeMs + offset,
      lane,
      type,
      duration: durationMs,
    })
  }

  // Sort notes by time, then lane
  notes.sort((a, b) => a.time - b.time || a.lane - b.lane)

  // Reduz densidade (remove notas muito proximas na mesma lane)
  const cleanNotes = reduceDensity(notes)

  return {
    resolution,
    offset,
    bpmChanges,
    timeSignatures,
    sections: songSections,
    notes: cleanNotes,
  }
}

// === Internal helpers ===

interface ParsedEvent {
  tick: number
  type: string
  values: string[]
}

interface ParsedSection {
  [key: string]: string | ParsedEvent[] | undefined
  __events?: ParsedEvent[]
}

function parseSections(content: string): Record<string, ParsedSection> {
  const sections: Record<string, ParsedSection> = {}
  const lines = content.split(/\r?\n/)
  let currentSection: string | null = null

  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line === "{" || line === "}") {
      if (line === "}") currentSection = null
      continue
    }

    // Section header
    const sectionMatch = line.match(/^\[(.+)\]$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1]
      sections[currentSection] = { __events: [] }
      continue
    }

    if (!currentSection) continue
    const section = sections[currentSection]

    // Key = Value pair (Song section)
    const kvMatch = line.match(/^(\w+)\s*=\s*(.+)$/)
    if (kvMatch && currentSection === "Song") {
      section[kvMatch[1]] = kvMatch[2].trim()
      continue
    }

    // Event line: tick = TYPE values...
    const eventMatch = line.match(/^(\d+)\s*=\s*(\w+)\s*(.*)$/)
    if (eventMatch) {
      const tick = parseInt(eventMatch[1], 10)
      const type = eventMatch[2]
      const rest = eventMatch[3].trim()
      const values = rest ? rest.split(/\s+/) : []
      section.__events = section.__events || []
      ;(section.__events as ParsedEvent[]).push({ tick, type, values })
    }
  }

  return sections
}

function computeBPMTimes(bpmChanges: BPMChange[], resolution: number) {
  if (bpmChanges.length === 0) return
  bpmChanges[0].time = 0

  for (let i = 1; i < bpmChanges.length; i++) {
    const prev = bpmChanges[i - 1]
    const curr = bpmChanges[i]
    const tickDelta = curr.tick - prev.tick
    const msPerTick = 60000 / (prev.bpm * resolution)
    curr.time = prev.time + tickDelta * msPerTick
  }
}

export function tickToMs(tick: number, bpmChanges: BPMChange[], resolution: number): number {
  if (bpmChanges.length === 0) {
    // default 120 BPM
    return (tick / resolution) * (60000 / 120)
  }

  // Find the BPM change just before (or at) this tick
  let bpmIndex = 0
  for (let i = bpmChanges.length - 1; i >= 0; i--) {
    if (bpmChanges[i].tick <= tick) {
      bpmIndex = i
      break
    }
  }

  const bpm = bpmChanges[bpmIndex]
  const tickDelta = tick - bpm.tick
  const msPerTick = 60000 / (bpm.bpm * resolution)
  return bpm.time + tickDelta * msPerTick
}

/**
 * Reduz densidade removendo notas muito próximas na mesma lane (< 80ms),
 * e limita acordes a no máximo 2 notas simultâneas.
 */
export function reduceDensity(notes: import("./types").GameNote[]): import("./types").GameNote[] {
  const MIN_INTERVAL = 80 // ms mínimo entre notas na mesma lane
  const MAX_CHORD = 2     // máximo de notas simultâneas

  const lastTimePerLane: Record<number, number> = {}
  const result: import("./types").GameNote[] = []

  // Group by time for chord limiting
  const byTime = new Map<number, import("./types").GameNote[]>()
  for (const n of notes) {
    const t = n.time
    if (!byTime.has(t)) byTime.set(t, [])
    byTime.get(t)!.push(n)
  }

  for (const [, group] of byTime) {
    // Limit chord size
    const chord = group.slice(0, MAX_CHORD)
    for (const note of chord) {
      const last = lastTimePerLane[note.lane] ?? -Infinity
      if (note.time - last >= MIN_INTERVAL) {
        result.push(note)
        lastTimePerLane[note.lane] = note.time
      }
    }
  }

  return result.sort((a, b) => a.time - b.time || a.lane - b.lane)
}
