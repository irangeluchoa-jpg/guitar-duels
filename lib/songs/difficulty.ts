import type { ChartData, SongMeta } from "./types"

/**
 * Calcula dificuldade automaticamente baseada em:
 * - Duração da música
 * - Densidade de notas (notas por segundo)
 * - Presença de sustains e taps
 */
export function computeAutodifficulty(chart: ChartData, meta: SongMeta): number {
  const notes = chart.notes
  if (!notes || notes.length === 0) return 2

  // Duração real (última nota)
  const lastNoteMs = notes[notes.length - 1].time
  const durationSec = Math.max(lastNoteMs / 1000, 1)

  // Notas por segundo
  const nps = notes.length / durationSec

  // Penalidade por muitos sustains (mais difícil manter)
  const sustainCount = notes.filter(n => n.type === "sustain" && n.duration > 300).length
  const sustainRatio = sustainCount / notes.length

  // Score base por NPS
  let score = 0
  if (nps < 2)       score = 0   // Beginner
  else if (nps < 3.5) score = 1   // Easy
  else if (nps < 5)   score = 2   // Medium
  else if (nps < 7)   score = 3   // Hard
  else if (nps < 10)  score = 4   // Expert
  else                score = 5   // Expert+

  // Bônus por músicas longas (>4 min cansa mais)
  if (durationSec > 240) score = Math.min(score + 1, 6)

  // Bônus por sustains frequentes
  if (sustainRatio > 0.4) score = Math.min(score + 1, 6)

  return score
}

export const DIFFICULTY_LABELS = [
  "Iniciante", "Fácil", "Médio", "Difícil", "Expert", "Expert+", "Extremo"
]
export const DIFFICULTY_COLORS = [
  "#22c55e", "#86efac", "#eab308", "#f97316", "#ef4444", "#a855f7", "#ec4899"
]
