import type { ChartData as Chart, ChartNote } from "@/lib/songs/types"

// ── Lanes por modo ───────────────────────────────────────────────────────────
export const LANE_COUNT = 5
export const LANE_COLORS = ["#FF0000", "#FF7800", "#FFFF00", "#0089FF", "#5AFF00", "#CC44FF"]
export const LANE_KEYS   = ["a", "s", "d", "j", "k"]
export const ALL_LANE_KEYS = ["a", "s", "d", "j", "k", "l"]
export const LANE_LABELS = ["A", "S", "D", "J", "K", "L"]

export const LANE_KEYS_LEFT  = ["a", "s", "d"]
export const LANE_KEYS_RIGHT = ["j", "k", "l"]

// Teclas por número de lanes: 4=ASDJ, 5=ASDJK, 6=ASDJKL
export function getKeysForLaneCount(lc: number): string[] {
  if (lc === 4) return ["a","s","d","j"]
  if (lc === 6) return ["a","s","d","j","k","l"]
  return ["a","s","d","j","k"]  // 5 (padrão)
}

// Timing windows base (dificuldade média)
export const TIMING_PERFECT = 60
export const TIMING_GREAT   = 110
export const TIMING_GOOD    = 170
export const TIMING_MISS    = 220

// Retorna as janelas de timing ajustadas pela dificuldade (0=Beginner, 6=Extreme)
export function getTimingWindows(difficulty: number) {
  // 0 (Beginner) → 1.6x mais generoso; 6 (Extreme) → 0.7x mais apertado
  const scale = 1.6 - Math.min(difficulty, 6) * (0.9 / 6)
  return {
    perfect: Math.round(TIMING_PERFECT * scale),
    great:   Math.round(TIMING_GREAT   * scale),
    good:    Math.round(TIMING_GOOD    * scale),
    miss:    Math.round(TIMING_MISS    * scale),
  }
}

export type HitRating = "perfect" | "great" | "good" | "miss"
export type GameState = "idle" | "countdown" | "playing" | "paused" | "ended"

export interface ActiveNote extends ChartNote {
  id: number
  hit: boolean
  missed: boolean
  hitRating?: HitRating
  hitTime?: number
}

export interface HitEffect {
  lane: number
  rating: HitRating
  time: number
  y: number
  penalty?: number  // pontos perdidos (miss)
}

export interface GameStats {
  score: number
  combo: number
  maxCombo: number
  multiplier: number
  perfect: number
  great: number
  good: number
  miss: number
  totalNotes: number
  rockMeter: number
  streak: number
}

export function createInitialStats(totalNotes: number): GameStats {
  return { score: 0, combo: 0, maxCombo: 0, multiplier: 1, perfect: 0, great: 0,
    good: 0, miss: 0, totalNotes, rockMeter: 50, streak: 0 }
}

export function getRating(deltaMs: number, windows?: { perfect:number; great:number; good:number; miss:number }): HitRating | null {
  const abs = Math.abs(deltaMs)
  const p = windows?.perfect ?? TIMING_PERFECT
  const gr = windows?.great  ?? TIMING_GREAT
  const go = windows?.good   ?? TIMING_GOOD
  const mi = windows?.miss   ?? TIMING_MISS
  if (abs <= p)  return "perfect"
  if (abs <= gr) return "great"
  if (abs <= go) return "good"
  if (abs <= mi) return "miss"
  return null
}

export function getScoreForRating(rating: HitRating, multiplier: number): number {
  const base: Record<HitRating, number> = { perfect: 100, great: 75, good: 50, miss: 0 }
  return base[rating] * multiplier
}

export function calculateMultiplier(combo: number): number {
  if (combo >= 40) return 4
  if (combo >= 20) return 3
  if (combo >= 10) return 2
  return 1
}

export function updateRockMeter(current: number, rating: HitRating): number {
  const delta: Record<HitRating, number> = { perfect: 3, great: 2, good: 1, miss: -8 }
  return Math.max(0, Math.min(100, current + delta[rating]))
}

// Penalidade por miss: perde o equivalente a uma nota "good" × multiplicador atual (mínimo 0)
export const MISS_PENALTY_BASE = 50

export function applyHit(stats: GameStats, rating: HitRating): GameStats {
  const s = { ...stats }
  if (rating === "miss") {
    s.miss += 1
    // Desconta pontos: base × multiplicador atual (quanto maior o combo perdido, maior a dor)
    const penalty = MISS_PENALTY_BASE * s.multiplier
    s.score = Math.max(0, s.score - penalty)
    s.combo = 0; s.streak = 0; s.multiplier = 1
    s.rockMeter = updateRockMeter(s.rockMeter, rating)
    return s
  }
  s[rating] += 1
  s.combo += 1; s.streak += 1
  s.maxCombo = Math.max(s.maxCombo, s.combo)
  s.multiplier = calculateMultiplier(s.combo)
  s.score += getScoreForRating(rating, s.multiplier)
  s.rockMeter = updateRockMeter(s.rockMeter, rating)
  return s
}

export function prepareNotes(chart: Chart, laneCount = 5): ActiveNote[] {
  if (laneCount === 4) {
    // 4 lanes (A S D J): mapeamento fixo sem colisão
    // Lane 0 (verde/G) → 0 (A)
    // Lane 1 (vermelho/R) → 1 (S)
    // Lane 2 (amarelo/Y) → 2 (D)
    // Lane 3 (azul/B) → 3 (J)
    // Lane 4 (laranja/O) → 2 (D/amarelo) ← CORRIGIDO: era 3 (causava miss no azul)
    const MAP4 = [0, 1, 2, 3, 2]
    return chart.notes.map((note, i) => ({
      ...note,
      lane: MAP4[Math.min(note.lane, 4)],
      id: i, hit: false, missed: false,
    }))
  }

  if (laneCount === 5) {
    return chart.notes.map((note, i) => ({
      ...note,
      lane: Math.min(note.lane, 4),
      id: i, hit: false, missed: false,
    }))
  }

  // ── 6 lanes (A S D J K L): espalhar 5 frets originais em 6 lanes ──────────
  // Mapeamento direto: lanes 0-4 ficam iguais; lane 5 (L/roxa) recebe
  // metade das notas da lane 4 (laranja/K) para popular a 6ª lane.
  // Resultado: lanes 0 a 4 têm notas normais; lane 5 tem ~50% das laranjas.
  let orangeToggle = false
  const notes: ActiveNote[] = []
  let id = 0

  for (const note of chart.notes) {
    if (note.lane === 4) {
      orangeToggle = !orangeToggle
      // Alterna entre K (4) e L (5) para distribuir notas na 6ª lane
      notes.push({ ...note, lane: orangeToggle ? 5 : 4, id: id++, hit: false, missed: false })
    } else {
      // Lanes 0-3: mapeamento direto
      notes.push({ ...note, lane: note.lane, id: id++, hit: false, missed: false })
    }
  }
  return notes
}

export function getAccuracy(stats: GameStats): number {
  const total = stats.perfect + stats.great + stats.good + stats.miss
  if (total === 0) return 100
  const weighted = stats.perfect * 100 + stats.great * 75 + stats.good * 50
  return Math.round((weighted / (total * 100)) * 100)
}

export function getGrade(accuracy: number, isFC = false): string {
  if (accuracy === 100 && isFC) return "S+"
  if (accuracy >= 95) return "S"
  if (accuracy >= 90) return "A"
  if (accuracy >= 80) return "B"
  if (accuracy >= 70) return "C"
  if (accuracy >= 60) return "D"
  return "F"
}

export function isFullCombo(stats: GameStats): boolean {
  return stats.miss === 0 && stats.totalNotes > 0
}
