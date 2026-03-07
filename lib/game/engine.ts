import type { ChartData as Chart, ChartNote } from "@/lib/songs/types"

// ── 5 lanes: S D F J K ───────────────────────────────────────────────────────
export const LANE_COUNT = 5
export const LANE_COLORS = ["#22c55e", "#ef4444", "#eab308", "#3b82f6", "#f97316"]
export const LANE_KEYS   = ["a", "s", "d", "j", "k"]
export const ALL_LANE_KEYS = ["a", "s", "d", "j", "k"]
export const LANE_LABELS = ["A", "S", "D", "J", "K"]

// Keep left/right aliases for any code that still references them
export const LANE_KEYS_LEFT  = ["a", "s", "d"]
export const LANE_KEYS_RIGHT = ["j", "k"]

// Timing windows — mais generosos para jogar ser divertido
export const TIMING_PERFECT = 60
export const TIMING_GREAT   = 110
export const TIMING_GOOD    = 170
export const TIMING_MISS    = 220

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

export function getRating(deltaMs: number): HitRating | null {
  const abs = Math.abs(deltaMs)
  if (abs <= TIMING_PERFECT) return "perfect"
  if (abs <= TIMING_GREAT)   return "great"
  if (abs <= TIMING_GOOD)    return "good"
  if (abs <= TIMING_MISS)    return "miss"
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

export function applyHit(stats: GameStats, rating: HitRating): GameStats {
  const s = { ...stats }
  if (rating === "miss") {
    s.miss += 1; s.combo = 0; s.streak = 0; s.multiplier = 1
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

export function prepareNotes(chart: Chart): ActiveNote[] {
  return chart.notes.map((note, i) => ({ ...note, id: i, hit: false, missed: false }))
}

export function getAccuracy(stats: GameStats): number {
  const total = stats.perfect + stats.great + stats.good + stats.miss
  if (total === 0) return 100
  const weighted = stats.perfect * 100 + stats.great * 75 + stats.good * 50
  return Math.round((weighted / (total * 100)) * 100)
}

export function getGrade(accuracy: number): string {
  if (accuracy >= 95) return "S"
  if (accuracy >= 90) return "A"
  if (accuracy >= 80) return "B"
  if (accuracy >= 70) return "C"
  if (accuracy >= 60) return "D"
  return "F"
}
