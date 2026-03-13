// Supabase via fetch nativo — sem dependência de @supabase/supabase-js
// Funciona no browser e no Node.js sem precisar instalar nenhum pacote

const SUPABASE_URL  = (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_URL  : "") ?? ""
const SUPABASE_KEY  = (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : "") ?? ""

function isConfigured() { return !!(SUPABASE_URL && SUPABASE_KEY) }

async function sbFetch(path: string, options?: RequestInit) {
  if (!isConfigured()) return null
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      "apikey":        SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type":  "application/json",
      "Prefer":        "return=representation",
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) return null
  const text = await res.text()
  return text ? JSON.parse(text) : []
}

export type GlobalScore = {
  id?: number
  player_name: string
  track_id: string
  song_name: string
  artist: string
  score: number
  accuracy: number
  grade: string
  max_combo: number
  perfect: number
  great: number
  good: number
  miss: number
  is_fc: boolean
  created_at?: string
}

export type DailyScore = {
  id?: number
  player_name: string
  track_id: string
  song_name: string
  artist: string
  score: number
  accuracy: number
  grade: string
  max_combo: number
  is_fc: boolean
  day: string
  attempts?: number
  created_at?: string
}

export async function submitGlobalScore(entry: GlobalScore): Promise<void> {
  if (!isConfigured()) return
  try {
    const existing: GlobalScore[] | null = await sbFetch(
      `/global_scores?player_name=eq.${encodeURIComponent(entry.player_name)}&track_id=eq.${encodeURIComponent(entry.track_id)}&select=id,score`
    )
    const prev = existing?.[0]
    if (prev && (prev.score ?? 0) >= entry.score) return
    if (prev?.id) {
      await sbFetch(`/global_scores?id=eq.${prev.id}`, { method: "PATCH", body: JSON.stringify(entry) })
    } else {
      await sbFetch(`/global_scores`, { method: "POST", body: JSON.stringify(entry) })
    }
  } catch {}
}

export async function getGlobalTop(limit = 100): Promise<GlobalScore[]> {
  if (!isConfigured()) return []
  try {
    const data = await sbFetch(`/global_scores?order=score.desc&limit=${limit}&select=*`)
    return (data ?? []) as GlobalScore[]
  } catch { return [] }
}

export async function getGlobalLeaderboard(trackId: string, limit = 50): Promise<GlobalScore[]> {
  if (!isConfigured()) return []
  try {
    const data = await sbFetch(`/global_scores?track_id=eq.${encodeURIComponent(trackId)}&order=score.desc&limit=${limit}&select=*`)
    return (data ?? []) as GlobalScore[]
  } catch { return [] }
}

export function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function getDailySong(songIds: string[]): string {
  if (!songIds.length) return ""
  const seed = getTodayKey().replace(/-/g, "")
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff
  }
  return songIds[Math.abs(hash) % songIds.length]
}

export async function submitDailyScore(entry: DailyScore): Promise<void> {
  if (!isConfigured()) return
  try {
    const existing: DailyScore[] | null = await sbFetch(
      `/daily_scores?player_name=eq.${encodeURIComponent(entry.player_name)}&day=eq.${entry.day}&select=id,score,attempts`
    )
    const prev = existing?.[0]
    if (prev?.id) {
      const attempts = (prev.attempts ?? 1) + 1
      if (attempts > 3) return
      await sbFetch(`/daily_scores?id=eq.${prev.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...entry, score: Math.max(prev.score ?? 0, entry.score), attempts }),
      })
    } else {
      await sbFetch(`/daily_scores`, { method: "POST", body: JSON.stringify({ ...entry, attempts: 1 }) })
    }
  } catch {}
}

export async function getDailyLeaderboard(day: string, limit = 50): Promise<DailyScore[]> {
  if (!isConfigured()) return []
  try {
    const data = await sbFetch(`/daily_scores?day=eq.${day}&order=score.desc&limit=${limit}&select=*`)
    return (data ?? []) as DailyScore[]
  } catch { return [] }
}
