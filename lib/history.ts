/**
 * history.ts — tipos e utilitários de histórico de partidas
 * Separado de app/history/page.tsx para evitar circular dependency no bundle.
 */

export interface GameRecord {
  id: string; songId: string; songName: string; artist: string; albumArt?: string
  score: number; accuracy: number; combo: number; grade: string
  laneCount: 4|5|6; noteSpeed: number
  perfect: number; great: number; good: number; miss: number
  timestamp: number
}

export const HISTORY_KEY = "guitar-duels-history"

export function saveRecord(record: Omit<GameRecord, "id">) {
  if (typeof window === "undefined") return
  try {
    const history: GameRecord[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]")
    const newRecord = { ...record, id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}` }
    const existingIdx = history.findIndex(r => r.songId === record.songId)
    if (existingIdx === -1) {
      history.unshift(newRecord)
    } else if (record.score > history[existingIdx].score) {
      history.splice(existingIdx, 1)
      history.unshift(newRecord)
    }
    if (history.length > 200) history.splice(200)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch {}
}

export function loadHistory(): GameRecord[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]")
  } catch { return [] }
}
