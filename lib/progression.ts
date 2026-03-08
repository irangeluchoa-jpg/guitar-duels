/**
 * progression.ts — Sistema de XP, Níveis e Conquistas
 */

// ── Tipos ──────────────────────────────────────────────────────────────────

export interface PlayerProfile {
  displayName: string
  totalXP: number
  level: number
  songsPlayed: number
  totalScore: number
  bestScore: number
  totalPerfects: number
  totalGreats: number
  totalGoods: number
  totalMisses: number
  totalCombo: number   // soma de maxCombos
  bestCombo: number
  fcCount: number      // full combos
  sRankCount: number
  songsPerDifficulty: { 4: number; 5: number; 6: number }
  totalPlaytimeMs: number
  unlockedAchievements: string[]  // IDs
  createdAt: number
  lastPlayedAt: number
}

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  xpReward: number
  rarity: "common" | "rare" | "epic" | "legendary"
  check: (profile: PlayerProfile, lastRecord?: GameSnapshot) => boolean
}

export interface GameSnapshot {
  score: number
  accuracy: number
  combo: number
  grade: string
  laneCount: 4 | 5 | 6
  noteSpeed: number
  perfect: number
  great: number
  good: number
  miss: number
  songId: string
  songName: string
}

export interface XPGain {
  base: number
  bonuses: { label: string; amount: number }[]
  total: number
}

export interface LevelUpInfo {
  oldLevel: number
  newLevel: number
  levelsGained: number
}

export interface SessionResult {
  xpGain: XPGain
  levelUp: LevelUpInfo | null
  newAchievements: Achievement[]
  profile: PlayerProfile
}

// ── XP & Níveis ────────────────────────────────────────────────────────────

export const LEVEL_NAMES = [
  "Iniciante", "Aprendiz", "Guitarrista", "Músico", "Veterano",
  "Profissional", "Virtuoso", "Lenda", "Ícone", "Deus do Rock",
]

/** XP total necessário para atingir um nível (curva suave) */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  return Math.round(100 * Math.pow(level - 1, 1.6))
}

/** XP total acumulado para começar o nível N */
export function totalXPForLevel(level: number): number {
  let total = 0
  for (let l = 1; l < level; l++) total += xpForLevel(l + 1) - xpForLevel(l)
  // Simpler: cumulative
  if (level <= 1) return 0
  return xpForLevel(level)
}

/** Nível dado o XP total (busca binária simples) */
export function levelFromXP(xp: number): number {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  return Math.min(level, 99)
}

/** Progresso dentro do nível atual (0–1) */
export function levelProgress(xp: number): number {
  const level = levelFromXP(xp)
  const start = xpForLevel(level)
  const end   = xpForLevel(level + 1)
  if (end <= start) return 1
  return Math.max(0, Math.min(1, (xp - start) / (end - start)))
}

/** XP faltando para o próximo nível */
export function xpToNextLevel(xp: number): number {
  const level = levelFromXP(xp)
  return Math.max(0, xpForLevel(level + 1) - xp)
}

/** Nome do nível */
export function levelTitle(level: number): string {
  const idx = Math.min(Math.floor((level - 1) / 10), LEVEL_NAMES.length - 1)
  return LEVEL_NAMES[idx]
}

/** Calcular XP ganho em uma partida */
export function calculateXP(snap: GameSnapshot): XPGain {
  const bonuses: { label: string; amount: number }[] = []

  // Base: pontuação / 1000
  const base = Math.round(snap.score / 800)

  // Bônus de precisão
  if (snap.accuracy >= 100) bonuses.push({ label: "Precisão Perfeita 💯", amount: 80 })
  else if (snap.accuracy >= 95) bonuses.push({ label: "Precisão S+ 🌟", amount: 50 })
  else if (snap.accuracy >= 90) bonuses.push({ label: "Precisão Alta ✨", amount: 25 })

  // Bônus de grade
  if (snap.grade === "S+" || snap.grade === "S") bonuses.push({ label: `Rank ${snap.grade} 🏆`, amount: 60 })
  else if (snap.grade === "A") bonuses.push({ label: "Rank A 🥇", amount: 30 })

  // Full Combo
  if (snap.miss === 0) bonuses.push({ label: "Full Combo 🎯", amount: 100 })

  // Dificuldade
  const diffBonus = { 4: 0, 5: 20, 6: 50 }[snap.laneCount] ?? 0
  if (diffBonus > 0) bonuses.push({ label: snap.laneCount === 6 ? "Difícil 🔥" : "Normal ⚡", amount: diffBonus })

  // Velocidade alta
  if (snap.noteSpeed >= 1.5) bonuses.push({ label: `Velocidade ${snap.noteSpeed}x 💨`, amount: Math.round((snap.noteSpeed - 1) * 40) })

  // Combo alto
  if (snap.combo >= 200) bonuses.push({ label: `Combo ${snap.combo}x 🔗`, amount: 40 })
  else if (snap.combo >= 100) bonuses.push({ label: `Combo ${snap.combo}x 🔗`, amount: 20 })

  const total = Math.max(5, base + bonuses.reduce((s, b) => s + b.amount, 0))
  return { base, bonuses, total }
}

// ── Conquistas ─────────────────────────────────────────────────────────────

export const ACHIEVEMENTS: Achievement[] = [
  // Primeiros passos
  {
    id: "first_song", title: "Primeiros Acordes", icon: "🎸",
    description: "Conclua sua primeira música",
    xpReward: 50, rarity: "common",
    check: (p) => p.songsPlayed >= 1,
  },
  {
    id: "songs_10", title: "Em Ritmo", icon: "🎵",
    description: "Jogue 10 músicas",
    xpReward: 100, rarity: "common",
    check: (p) => p.songsPlayed >= 10,
  },
  {
    id: "songs_50", title: "Maratonista", icon: "🏃",
    description: "Jogue 50 músicas",
    xpReward: 300, rarity: "rare",
    check: (p) => p.songsPlayed >= 50,
  },
  {
    id: "songs_100", title: "Veterano do Palco", icon: "🎭",
    description: "Jogue 100 músicas",
    xpReward: 600, rarity: "epic",
    check: (p) => p.songsPlayed >= 100,
  },
  // Full Combo
  {
    id: "first_fc", title: "Sem Erros", icon: "🎯",
    description: "Faça seu primeiro Full Combo",
    xpReward: 150, rarity: "common",
    check: (p) => p.fcCount >= 1,
  },
  {
    id: "fc_5", title: "Mão de Ferro", icon: "✊",
    description: "Faça 5 Full Combos",
    xpReward: 300, rarity: "rare",
    check: (p) => p.fcCount >= 5,
  },
  {
    id: "fc_20", title: "Intocável", icon: "🛡️",
    description: "Faça 20 Full Combos",
    xpReward: 800, rarity: "epic",
    check: (p) => p.fcCount >= 20,
  },
  // Rank S
  {
    id: "first_s", title: "Excelência", icon: "⭐",
    description: "Alcance Rank S em qualquer música",
    xpReward: 100, rarity: "common",
    check: (p) => p.sRankCount >= 1,
  },
  {
    id: "s_10", title: "Perfeccionista", icon: "💎",
    description: "Alcance Rank S em 10 músicas",
    xpReward: 500, rarity: "rare",
    check: (p) => p.sRankCount >= 10,
  },
  // Combo
  {
    id: "combo_50", title: "Em Chamas", icon: "🔥",
    description: "Alcance 50 de combo em uma partida",
    xpReward: 75, rarity: "common",
    check: (p) => p.bestCombo >= 50,
  },
  {
    id: "combo_100", title: "Centenário", icon: "💯",
    description: "Alcance 100 de combo em uma partida",
    xpReward: 200, rarity: "rare",
    check: (p) => p.bestCombo >= 100,
  },
  {
    id: "combo_300", title: "Imparável", icon: "⚡",
    description: "Alcance 300 de combo em uma partida",
    xpReward: 500, rarity: "epic",
    check: (p) => p.bestCombo >= 300,
  },
  // Dificuldade
  {
    id: "play_hard", title: "Desafiador", icon: "💪",
    description: "Jogue no modo Difícil (6 lanes)",
    xpReward: 80, rarity: "common",
    check: (p) => p.songsPerDifficulty[6] >= 1,
  },
  {
    id: "hard_10", title: "Corajoso", icon: "🦁",
    description: "Jogue 10 músicas no Difícil",
    xpReward: 250, rarity: "rare",
    check: (p) => p.songsPerDifficulty[6] >= 10,
  },
  {
    id: "fc_hard", title: "Lenda do Rock", icon: "👑",
    description: "FC no modo Difícil com Rank S",
    xpReward: 1000, rarity: "legendary",
    check: (p, snap) => !!(snap && snap.miss === 0 && snap.grade.startsWith("S") && snap.laneCount === 6),
  },
  // Score
  {
    id: "score_100k", title: "Pontuador", icon: "📈",
    description: "Alcance 100.000 pontos em uma partida",
    xpReward: 100, rarity: "common",
    check: (p, snap) => !!(snap && snap.score >= 100000),
  },
  {
    id: "score_500k", title: "Pontuação Épica", icon: "🚀",
    description: "Alcance 500.000 pontos em uma partida",
    xpReward: 400, rarity: "rare",
    check: (p, snap) => !!(snap && snap.score >= 500000),
  },
  {
    id: "score_1m", title: "Milionário", icon: "💰",
    description: "Alcance 1.000.000 de pontos em uma partida",
    xpReward: 1000, rarity: "legendary",
    check: (p, snap) => !!(snap && snap.score >= 1000000),
  },
  // Velocidade
  {
    id: "speed_15", title: "Acelerado", icon: "💨",
    description: "Jogue em velocidade 1.5x",
    xpReward: 75, rarity: "common",
    check: (p, snap) => !!(snap && snap.noteSpeed >= 1.5),
  },
  {
    id: "speed_2", title: "Velocidade Máxima", icon: "🏎️",
    description: "Jogue e complete uma música em 2x",
    xpReward: 200, rarity: "rare",
    check: (p, snap) => !!(snap && snap.noteSpeed >= 2),
  },
  // Nível
  {
    id: "level_5", title: "Subindo de Nível", icon: "📊",
    description: "Alcance o nível 5",
    xpReward: 0, rarity: "common",
    check: (p) => p.level >= 5,
  },
  {
    id: "level_20", title: "Dedicado", icon: "🎖️",
    description: "Alcance o nível 20",
    xpReward: 0, rarity: "rare",
    check: (p) => p.level >= 20,
  },
  {
    id: "level_50", title: "Mestre", icon: "🧙",
    description: "Alcance o nível 50",
    xpReward: 0, rarity: "epic",
    check: (p) => p.level >= 50,
  },
  // Precisão
  {
    id: "perfect_accuracy", title: "Perfeição Absoluta", icon: "✨",
    description: "100% de precisão em uma música",
    xpReward: 300, rarity: "epic",
    check: (p, snap) => !!(snap && snap.accuracy >= 100),
  },
  {
    id: "perfects_1000", title: "Mãos de Seda", icon: "🙌",
    description: "Acumule 1000 notas perfeitas",
    xpReward: 200, rarity: "rare",
    check: (p) => p.totalPerfects >= 1000,
  },
  // Tempo
  {
    id: "playtime_1h", title: "Hora do Rock", icon: "⏱️",
    description: "Jogue por 1 hora no total",
    xpReward: 150, rarity: "common",
    check: (p) => p.totalPlaytimeMs >= 3_600_000,
  },
  {
    id: "playtime_10h", title: "Viciado", icon: "🎮",
    description: "Jogue por 10 horas no total",
    xpReward: 500, rarity: "epic",
    check: (p) => p.totalPlaytimeMs >= 36_000_000,
  },
]

// ── Storage ─────────────────────────────────────────────────────────────────

const PROFILE_KEY = "guitar-duels-profile"

export function loadProfile(): PlayerProfile {
  if (typeof window === "undefined") return createProfile()
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (raw) return { ...createProfile(), ...JSON.parse(raw) }
  } catch {}
  return createProfile()
}

export function saveProfile(p: PlayerProfile): void {
  if (typeof window === "undefined") return
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)) } catch {}
}

function createProfile(): PlayerProfile {
  return {
    displayName: "Guitarrista",
    totalXP: 0, level: 1,
    songsPlayed: 0, totalScore: 0, bestScore: 0,
    totalPerfects: 0, totalGreats: 0, totalGoods: 0, totalMisses: 0,
    totalCombo: 0, bestCombo: 0, fcCount: 0, sRankCount: 0,
    songsPerDifficulty: { 4: 0, 5: 0, 6: 0 },
    totalPlaytimeMs: 0,
    unlockedAchievements: [],
    createdAt: Date.now(),
    lastPlayedAt: Date.now(),
  }
}

// ── Processar partida ────────────────────────────────────────────────────────

export function processGameSession(snap: GameSnapshot, songDurationMs = 0): SessionResult {
  const profile = loadProfile()
  const oldLevel = profile.level

  // Atualizar estatísticas
  profile.songsPlayed       += 1
  profile.totalScore        += snap.score
  profile.bestScore          = Math.max(profile.bestScore, snap.score)
  profile.totalPerfects     += snap.perfect
  profile.totalGreats       += snap.great
  profile.totalGoods        += snap.good
  profile.totalMisses       += snap.miss
  profile.totalCombo        += snap.combo
  profile.bestCombo          = Math.max(profile.bestCombo, snap.combo)
  profile.totalPlaytimeMs   += songDurationMs
  profile.lastPlayedAt       = Date.now()
  if (snap.miss === 0) profile.fcCount += 1
  if (snap.grade.startsWith("S")) profile.sRankCount += 1
  profile.songsPerDifficulty[snap.laneCount] = (profile.songsPerDifficulty[snap.laneCount] ?? 0) + 1

  // Calcular XP
  const xpGain = calculateXP(snap)
  profile.totalXP += xpGain.total

  // Verificar conquistas novas
  const newAchievements: Achievement[] = []
  for (const ach of ACHIEVEMENTS) {
    if (profile.unlockedAchievements.includes(ach.id)) continue
    if (ach.check(profile, snap)) {
      profile.unlockedAchievements.push(ach.id)
      profile.totalXP += ach.xpReward
      newAchievements.push(ach)
    }
  }

  // Atualizar nível
  profile.level = levelFromXP(profile.totalXP)
  const newLevel = profile.level
  const levelUp = newLevel > oldLevel
    ? { oldLevel, newLevel, levelsGained: newLevel - oldLevel }
    : null

  saveProfile(profile)
  return { xpGain, levelUp, newAchievements, profile }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export const RARITY_COLORS: Record<string, string> = {
  common:    "#9ca3af",
  rare:      "#3b82f6",
  epic:      "#a855f7",
  legendary: "#f59e0b",
}

export const RARITY_LABELS: Record<string, string> = {
  common: "Comum", rare: "Raro", epic: "Épico", legendary: "Lendário",
}

export function formatXP(xp: number): string {
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M`
  if (xp >= 1_000) return `${(xp / 1_000).toFixed(1)}k`
  return String(xp)
}

export function formatTime(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
