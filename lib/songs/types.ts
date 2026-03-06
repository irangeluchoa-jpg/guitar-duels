// === Song metadata ===

export interface InstrumentTrack {
  key: string           // ex: "guitar", "rhythm", "vocals"
  label: string         // ex: "Guitarra", "Baixo", "Vocais"
  icon: string          // emoji
  url: string
}

export interface SongMeta {
  id: string
  name: string
  artist: string
  album: string
  year: string
  genre: string
  charter: string
  difficulty: number // 0-6, from song.ini diff_guitar
  songLength: number // ms
  previewStart: number // ms
}

// === Chart / Notes ===

export type NoteType = "normal" | "sustain" | "tap" | "forced"

export interface GameNote {
  time: number // ms from song start
  lane: number // 0-5 (2 rows x 3 cols)
  type: NoteType
  duration: number // ms, > 0 for sustain
  hit?: boolean
  missed?: boolean
}

export interface BPMChange {
  tick: number
  bpm: number
  time: number // computed ms
}

export interface TimeSignature {
  tick: number
  numerator: number
  denominator: number
}

export interface SongSection {
  time: number // ms
  name: string
}

export interface ChartData {
  resolution: number // ticks per beat (default 192)
  offset: number // ms
  bpmChanges: BPMChange[]
  timeSignatures: TimeSignature[]
  sections: SongSection[]
  notes: GameNote[]
}

// === Song (full loaded) ===

export interface Song {
  meta: SongMeta
  chart: ChartData
  audioUrls: {
    guitar?: string
    rhythm?: string
    bass?: string
    backing?: string
    song?: string
    vocals?: string
    drums?: string
    drums_1?: string
    drums_2?: string
    drums_3?: string
    crowd?: string
    keys?: string
    preview?: string
  }
  availableInstruments?: InstrumentTrack[]
  albumArt?: string
}

// === Song listing (for library) ===

export interface SongListItem {
  id: string
  name: string
  artist: string
  album: string
  year: string
  genre: string
  difficulty: number
  albumArt?: string
  previewUrl?: string
}

// === Lane mapping ===
// Row 1 (keys S, D, F): Lane 0 = Green, Lane 1 = Red, Lane 2 = Yellow
// Row 2 (keys J, K, L): Lane 3 = Blue, Lane 4 = Orange, Lane 5 = Open/Tap

export const LANE_COLORS = [
  "#22c55e", // Green  (lane 0)
  "#ef4444", // Red    (lane 1)
  "#eab308", // Yellow (lane 2)
  "#3b82f6", // Blue   (lane 3)
  "#f97316", // Orange (lane 4)
  
] as const

export const LANE_KEYS_ROW1 = ["s", "d", "f"] as const
export const LANE_KEYS_ROW2 = ["j", "k", "l"] as const
export const LANE_NAMES = ["Green", "Red", "Yellow", "Blue", "Orange", "Open"] as const

// GH fret -> lane mapping
// GH: 0=Green, 1=Red, 2=Yellow, 3=Blue, 4=Orange, 7=Open
export const GH_FRET_TO_LANE: Record<number, number> = {
  0: 0, // Green  -> Lane 0 (S)
  1: 1, // Red    -> Lane 1 (D)
  2: 2, // Yellow -> Lane 2 (F)
  3: 3, // Blue   -> Lane 3 (J)
  4: 4, // Orange -> Lane 4 (K)
  7: 2, // Open   -> Lane 2 (mapeado para middle)
}

// Aliases for backwards compatibility
export type Chart = ChartData
export type ChartNote = GameNote
