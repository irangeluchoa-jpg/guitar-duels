// ── Sistema de Progressão: XP, Níveis, Conquistas ────────────────────────────

export interface PlayerProfile {
  name: string
  xp: number
  level: number
  totalSongsPlayed: number
  totalFCs: number
  totalPerfects: number
  bestCombo: number
  avgAccuracy: number
  title: string
  frame: string       // borda do avatar
  createdAt: number
}

// XP para passar de nível (nivel * 500 + 500)
export function xpForLevel(level: number): number {
  return level * 500 + 500
}

export function totalXpForLevel(level: number): number {
  let total = 0
  for (let i = 1; i < level; i++) total += xpForLevel(i)
  return total
}

export function levelFromXp(xp: number): number {
  let level = 1
  let accumulated = 0
  while (accumulated + xpForLevel(level) <= xp) {
    accumulated += xpForLevel(level)
    level++
  }
  return level
}

export function xpInCurrentLevel(xp: number): number {
  return xp - totalXpForLevel(levelFromXp(xp))
}

// XP ganho por partida
export function calcXpGain(opts: {
  accuracy: number
  maxCombo: number
  miss: number
  difficulty: number
  failed: boolean
}): number {
  if (opts.failed) return Math.floor(10 + opts.accuracy * 0.3)
  let base = 50
  base += Math.floor(opts.accuracy * 0.8)
  base += Math.floor(opts.maxCombo * 0.4)
  base -= Math.min(opts.miss * 2, 30)
  base *= (1 + opts.difficulty * 0.15)
  return Math.max(15, Math.floor(base))
}

export const TITLES: Record<number, string> = {
  1: "Iniciante",
  3: "Guitarrista",
  5: "Músico",
  8: "Virtuoso",
  10: "Lendário",
  15: "Mestre",
  20: "Deus das Cordas",
}

export function titleForLevel(level: number): string {
  const levels = Object.keys(TITLES).map(Number).sort((a,b) => b - a)
  for (const l of levels) {
    if (level >= l) return TITLES[l]
  }
  return "Iniciante"
}

export const FRAMES: Record<number, string> = {
  1: "default",
  5: "bronze",
  10: "silver",
  15: "gold",
  20: "diamond",
}

export function frameForLevel(level: number): string {
  const levels = Object.keys(FRAMES).map(Number).sort((a,b) => b - a)
  for (const l of levels) {
    if (level >= l) return FRAMES[l]
  }
  return "default"
}

// ── Conquistas ────────────────────────────────────────────────────────────────
export interface Achievement {
  id: string
  name: string
  desc: string
  icon: string
  unlockedAt?: number
}

const ALL_ACHIEVEMENTS: Achievement[] = [
  { id: "first_song",    name: "Primeira Nota",    desc: "Complete sua primeira música",           icon: "🎸" },
  { id: "fc_easy",       name: "Sem Errar",         desc: "Full Combo em qualquer dificuldade",     icon: "✨" },
  { id: "fc_expert",     name: "Mestre do FC",      desc: "Full Combo no Expert",                   icon: "🏆" },
  { id: "combo_50",      name: "Combo 50",           desc: "Alcance 50 notas em sequência",          icon: "🔥" },
  { id: "combo_100",     name: "Combo 100",          desc: "Alcance 100 notas em sequência",         icon: "💯" },
  { id: "combo_200",     name: "Combo 200",          desc: "Alcance 200 notas em sequência",         icon: "⚡" },
  { id: "songs_10",      name: "Músico Dedicado",    desc: "Jogue 10 músicas",                       icon: "🎵" },
  { id: "songs_50",      name: "Veterano",           desc: "Jogue 50 músicas",                       icon: "🎤" },
  { id: "accuracy_95",   name: "Precisão Cirúrgica", desc: "Termine uma música com 95%+ precisão", icon: "🎯" },
  { id: "level_5",       name: "Guitarrista",        desc: "Alcance o nível 5",                     icon: "⭐" },
  { id: "level_10",      name: "Virtuoso",           desc: "Alcance o nível 10",                    icon: "🌟" },
  { id: "whammy",        name: "Whammy!",            desc: "Use o whammy bar em uma música",        icon: "〰️" },
  { id: "practice",      name: "Estudioso",          desc: "Use o modo prática",                    icon: "📚" },
  { id: "daily_done",    name: "Desafio do Dia",     desc: "Complete o desafio diário",             icon: "📅" },
]

export function getAllAchievements(): Achievement[] {
  return ALL_ACHIEVEMENTS
}

export function getUnlockedAchievements(): Achievement[] {
  try {
    const stored = localStorage.getItem("guitar-duels-achievements")
    if (!stored) return []
    const unlocked: string[] = JSON.parse(stored)
    return ALL_ACHIEVEMENTS
      .filter(a => unlocked.includes(a.id))
      .map(a => ({ ...a, unlockedAt: 0 }))
  } catch { return [] }
}

export function checkAndUnlockAchievements(opts: {
  accuracy: number
  maxCombo: number
  miss: number
  difficulty: number
  failed: boolean
  totalSongs: number
  level: number
  usedWhammy?: boolean
  usedPractice?: boolean
  isDailyCompleted?: boolean
}): Achievement[] {
  try {
    const stored = localStorage.getItem("guitar-duels-achievements")
    const unlocked: string[] = stored ? JSON.parse(stored) : []
    const newlyUnlocked: Achievement[] = []

    function tryUnlock(id: string) {
      if (!unlocked.includes(id)) {
        unlocked.push(id)
        const ach = ALL_ACHIEVEMENTS.find(a => a.id === id)
        if (ach) newlyUnlocked.push({ ...ach, unlockedAt: Date.now() })
      }
    }

    if (!opts.failed && opts.totalSongs >= 1)     tryUnlock("first_song")
    if (!opts.failed && opts.miss === 0)           tryUnlock("fc_easy")
    if (!opts.failed && opts.miss === 0 && opts.difficulty >= 5) tryUnlock("fc_expert")
    if (opts.maxCombo >= 50)                       tryUnlock("combo_50")
    if (opts.maxCombo >= 100)                      tryUnlock("combo_100")
    if (opts.maxCombo >= 200)                      tryUnlock("combo_200")
    if (opts.totalSongs >= 10)                     tryUnlock("songs_10")
    if (opts.totalSongs >= 50)                     tryUnlock("songs_50")
    if (!opts.failed && opts.accuracy >= 95)       tryUnlock("accuracy_95")
    if (opts.level >= 5)                           tryUnlock("level_5")
    if (opts.level >= 10)                          tryUnlock("level_10")
    if (opts.usedWhammy)                           tryUnlock("whammy")
    if (opts.usedPractice)                         tryUnlock("practice")
    if (opts.isDailyCompleted)                     tryUnlock("daily_done")

    localStorage.setItem("guitar-duels-achievements", JSON.stringify(unlocked))
    return newlyUnlocked
  } catch { return [] }
}

// ── Perfil ────────────────────────────────────────────────────────────────────
const PROFILE_KEY = "guitar-duels-profile"

export function loadProfile(): PlayerProfile {
  try {
    const stored = localStorage.getItem(PROFILE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return {
    name: "Jogador", xp: 0, level: 1, totalSongsPlayed: 0, totalFCs: 0,
    totalPerfects: 0, bestCombo: 0, avgAccuracy: 0,
    title: "Iniciante", frame: "default", createdAt: Date.now(),
  }
}

export function saveProfile(p: PlayerProfile): void {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)) } catch {}
}

export function updateProfileAfterGame(opts: {
  accuracy: number
  maxCombo: number
  miss: number
  difficulty: number
  failed: boolean
  perfect: number
}): { profile: PlayerProfile; xpGained: number; leveledUp: boolean; newLevel?: number } {
  const profile = loadProfile()
  const xpGained = calcXpGain({
    accuracy: opts.accuracy, maxCombo: opts.maxCombo,
    miss: opts.miss, difficulty: opts.difficulty, failed: opts.failed,
  })
  const oldLevel = profile.level
  const newXp = profile.xp + xpGained
  const newLevel = levelFromXp(newXp)

  profile.xp = newXp
  profile.level = newLevel
  profile.title = titleForLevel(newLevel)
  profile.frame = frameForLevel(newLevel)
  profile.totalSongsPlayed += 1
  if (!opts.failed && opts.miss === 0) profile.totalFCs += 1
  profile.totalPerfects += opts.perfect
  if (opts.maxCombo > profile.bestCombo) profile.bestCombo = opts.maxCombo
  // Running average
  const total = profile.totalSongsPlayed
  profile.avgAccuracy = Math.round((profile.avgAccuracy * (total - 1) + opts.accuracy) / total)

  saveProfile(profile)
  return { profile, xpGained, leveledUp: newLevel > oldLevel, newLevel: newLevel > oldLevel ? newLevel : undefined }
}

// ── Desafio Diário ────────────────────────────────────────────────────────────
export interface DailyChallenge {
  date: string        // YYYY-MM-DD
  trackId: string
  songName: string
  artist: string
  targetScore: number
  completed: boolean
  score?: number
}

export function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function getDailyChallenge(): DailyChallenge | null {
  try {
    const stored = localStorage.getItem("guitar-duels-daily")
    if (!stored) return null
    const d: DailyChallenge = JSON.parse(stored)
    return d.date === getTodayKey() ? d : null
  } catch { return null }
}

export function saveDailyChallenge(c: DailyChallenge): void {
  try { localStorage.setItem("guitar-duels-daily", JSON.stringify(c)) } catch {}
}
