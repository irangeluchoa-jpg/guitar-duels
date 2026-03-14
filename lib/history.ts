/**
 * lib/history.ts — Armazenamento do histórico de partidas
 * Separado de app/history/page.tsx para evitar importar um componente React
 * de dentro de outros módulos (causa TDZ / "Cannot access before initialization").
 */

export interface GameRecord {
  id: string
  songName: string
  artist: string
  score: number
  accuracy: number
  grade: string
  maxCombo: number
  perfect: number
  great: number
  good: number
  miss: number
  laneCount: number
  difficulty: number
  timestamp: number
  durationMs?: number
}

export const HISTORY_KEY = "guitar-duels-history"
export const MAX_HISTORY = 50

export function saveRecord(record: Omit<GameRecord, "id">) {
  try {
    const history: GameRecord[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]")
    const entry: GameRecord = { ...record, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` }
    history.unshift(entry)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
  } catch {}
}

export function loadHistory(): GameRecord[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]")
  } catch {
    return []
  }
}

export function clearHistory() {
  try { localStorage.removeItem(HISTORY_KEY) } catch {}
}
