"use client"

import React, { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Star, Trophy, Target, Zap, Clock, Music2, Edit2, Check, Download, Upload, RefreshCw } from "lucide-react"
import { HISTORY_KEY } from "@/app/history/page"
import {
  loadProfile, saveProfile, type PlayerProfile, type Achievement,
  ACHIEVEMENTS, RARITY_COLORS, RARITY_LABELS,
  levelFromXP, levelProgress, xpToNextLevel, levelTitle, formatXP, formatTime,
  SPECIAL_TITLES, getUnlockedTitles, getBestTitle, type SpecialTitle,
  HIGHWAY_THEMES, isThemeUnlocked,
} from "@/lib/progression"

const AVATARS = ["🎸", "🎵", "🎤", "🥁", "🎹", "🎺", "🎻", "🤘", "⚡", "🔥", "💎", "👑"]
const AVATAR_KEY = "guitar-duels-avatar"

function loadAvatar(): string {
  if (typeof window === "undefined") return "🎸"
  return localStorage.getItem(AVATAR_KEY) ?? "🎸"
}
function saveAvatar(a: string) {
  if (typeof window !== "undefined") localStorage.setItem(AVATAR_KEY, a)
}

// ── Componentes ────────────────────────────────────────────────────────────

function XPBar({ profile }: { profile: PlayerProfile }) {
  const progress = levelProgress(profile.totalXP)
  const toNext   = xpToNextLevel(profile.totalXP)
  const title    = levelTitle(profile.level)
  const [animated, setAnimated] = useState(false)

  useEffect(() => { setTimeout(() => setAnimated(true), 200) }, [])

  return (
    <div className="rounded-2xl p-5 space-y-3"
      style={{ background: "linear-gradient(135deg,rgba(168,85,247,0.12),rgba(99,102,241,0.08))", border: "1px solid rgba(168,85,247,0.25)" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(168,85,247,0.7)" }}>Nível {profile.level}</p>
          <p className="text-2xl font-black text-white">{title}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black" style={{ color: "#a855f7" }}>{profile.level}</p>
          <p className="text-[10px] text-white/30">{formatXP(profile.totalXP)} XP total</p>
        </div>
      </div>
      <div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div className="h-full rounded-full relative overflow-hidden transition-all duration-1000 ease-out"
            style={{
              width: animated ? `${progress * 100}%` : "0%",
              background: "linear-gradient(90deg,#7c3aed,#a855f7,#c084fc)",
              boxShadow: "0 0 12px rgba(168,85,247,0.5)",
            }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)", animation: "shimmer 2s infinite" }}/>
          </div>
        </div>
        <div className="flex justify-between mt-1.5 text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
          <span>{formatXP(profile.totalXP - Math.floor(profile.totalXP * (1 - progress)))} XP</span>
          <span>{toNext > 0 ? `${formatXP(toNext)} para nível ${profile.level + 1}` : "Nível máximo!"}</span>
        </div>
      </div>
    </div>
  )
}

function StatBlock({ icon, label, value, sub, color = "#fff" }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="flex flex-col gap-1.5 p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-center gap-2" style={{ color: `${color}80` }}>
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-black" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{sub}</p>}
    </div>
  )
}

function AchievementCard({ ach, unlocked }: { ach: Achievement; unlocked: boolean }) {
  const rc = RARITY_COLORS[ach.rarity]
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl transition-all"
      style={{
        background: unlocked ? `${rc}0f` : "rgba(255,255,255,0.02)",
        border: `1px solid ${unlocked ? rc + "33" : "rgba(255,255,255,0.06)"}`,
        opacity: unlocked ? 1 : 0.45,
        filter: unlocked ? "none" : "grayscale(0.8)",
      }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
        style={{ background: unlocked ? `${rc}1a` : "rgba(255,255,255,0.04)", border: `1px solid ${unlocked ? rc + "44" : "rgba(255,255,255,0.08)"}` }}>
        {unlocked ? ach.icon : "🔒"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-black text-white truncate">{ach.title}</p>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ background: `${rc}1a`, color: rc, border: `1px solid ${rc}33` }}>
            {RARITY_LABELS[ach.rarity]}
          </span>
        </div>
        <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{ach.description}</p>
      </div>
      {ach.xpReward > 0 && (
        <div className="flex-shrink-0 text-right">
          <p className="text-xs font-black" style={{ color: unlocked ? "#fbbf24" : "rgba(255,255,255,0.2)" }}>+{ach.xpReward}</p>
          <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>XP</p>
        </div>
      )}
    </div>
  )
}

// ── Página ─────────────────────────────────────────────────────────────────


// ── Backup / Restore ────────────────────────────────────────────────────────

function exportBackup() {
  try {
    const profile  = localStorage.getItem("guitar-duels-profile") ?? "{}"
    const history  = localStorage.getItem(HISTORY_KEY) ?? "[]"
    const avatar   = localStorage.getItem("guitar-duels-avatar") ?? "🎸"
    const scores   = localStorage.getItem("guitar-duels-scores") ?? "[]"
    const payload  = { v: 1, profile, history, avatar, scores, exportedAt: Date.now() }
    const json     = JSON.stringify(payload)
    const b64      = btoa(unescape(encodeURIComponent(json)))
    const blob     = new Blob([b64], { type: "text/plain" })
    const url      = URL.createObjectURL(blob)
    const a        = document.createElement("a")
    a.href         = url
    a.download     = `guitar-duels-backup-${new Date().toISOString().slice(0,10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
    return true
  } catch { return false }
}

function importBackup(file: File): Promise<boolean> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const b64     = (e.target?.result as string).trim()
        const json    = decodeURIComponent(escape(atob(b64)))
        const payload = JSON.parse(json)
        if (payload.v !== 1) { resolve(false); return }
        if (payload.profile) localStorage.setItem("guitar-duels-profile", payload.profile)
        if (payload.history) localStorage.setItem(HISTORY_KEY, payload.history)
        if (payload.avatar)  localStorage.setItem("guitar-duels-avatar", payload.avatar)
        if (payload.scores)  localStorage.setItem("guitar-duels-scores", payload.scores)
        resolve(true)
      } catch { resolve(false) }
    }
    reader.onerror = () => resolve(false)
    reader.readAsText(file)
  })
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [avatar, setAvatar] = useState("🎸")
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState("")
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [backupMsg, setBackupMsg] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    const ok = exportBackup()
    setBackupMsg(ok ? "✅ Backup exportado!" : "❌ Erro ao exportar")
    setTimeout(() => setBackupMsg(null), 3000)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ok = await importBackup(file)
    if (ok) {
      setBackupMsg("✅ Backup restaurado! Recarregando...")
      setTimeout(() => window.location.reload(), 1200)
    } else {
      setBackupMsg("❌ Arquivo inválido")
      setTimeout(() => setBackupMsg(null), 3000)
    }
    e.target.value = ""
  }
  const [achFilter, setAchFilter] = useState<"all" | "unlocked" | "locked">("all")
  const [achRarity, setAchRarity] = useState<"all" | "common" | "rare" | "epic" | "legendary">("all")
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setProfile(loadProfile())
    setAvatar(loadAvatar())
  }, [])

  if (!profile) return null

  const unlockedSet = new Set(profile.unlockedAchievements)
  const unlockedCount = profile.unlockedAchievements.length
  const totalAch = ACHIEVEMENTS.length

  const filteredAch = ACHIEVEMENTS.filter(a => {
    const un = unlockedSet.has(a.id)
    if (achFilter === "unlocked" && !un) return false
    if (achFilter === "locked"   &&  un) return false
    if (achRarity !== "all" && a.rarity !== achRarity) return false
    return true
  })

  const saveName = () => {
    const name = nameInput.trim() || "Guitarrista"
    const updated = { ...profile, displayName: name }
    setProfile(updated)
    saveProfile(updated)
    setEditingName(false)
  }

  const accuracy = profile.songsPlayed
    ? Math.round((profile.totalPerfects * 100 + profile.totalGreats * 75 + profile.totalGoods * 50) /
        Math.max(1, (profile.totalPerfects + profile.totalGreats + profile.totalGoods + profile.totalMisses)) )
    : 0

  return (
    <div className="min-h-screen overflow-y-auto" style={{ background: "#060608", fontFamily: "'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800;900&display=swap');
        .bebas { font-family: 'Bebas Neue','Impact',sans-serif !important; }
        @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
        @keyframes fade-up { from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar { width: 4px }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px }
      `}</style>

      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-4 px-6 py-4"
        style={{ background: "rgba(6,6,8,0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={() => router.push("/")}
          className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl transition-all hover:scale-105"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <h1 className="bebas text-2xl tracking-[0.2em]" style={{ color: "rgba(168,85,247,0.9)" }}>MEU PERFIL</h1>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={handleExport}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all hover:scale-105"
            style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "rgba(34,197,94,0.8)" }}
            title="Exportar backup dos dados">
            <Download className="w-3.5 h-3.5" /> Backup
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6" style={{ animation: "fade-up 0.3s ease" }}>

        {/* Perfil Header */}
        <div className="flex items-center gap-5 p-5 rounded-3xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowAvatarPicker((v: boolean) => !v)}
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl transition-all hover:scale-105"
              style={{ background: "rgba(168,85,247,0.15)", border: "2px solid rgba(168,85,247,0.4)", boxShadow: "0 0 20px rgba(168,85,247,0.2)" }}>
              {avatar}
            </button>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(168,85,247,0.8)", border: "2px solid #060608" }}>
              <Edit2 className="w-3 h-3 text-white"/>
            </div>
            {/* Avatar picker */}
            {showAvatarPicker && (
              <div className="absolute top-full left-0 mt-2 p-2 rounded-2xl z-10 grid grid-cols-6 gap-1.5"
                style={{ background: "rgba(15,10,30,0.98)", border: "1px solid rgba(168,85,247,0.3)", boxShadow: "0 16px 40px rgba(0,0,0,0.8)" }}>
                {AVATARS.map(em => (
                  <button key={em} onClick={() => { setAvatar(em); saveAvatar(em); setShowAvatarPicker(false) }}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-xl transition-all hover:scale-110"
                    style={{ background: avatar === em ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.05)" }}>
                    {em}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Nome e stats rápidas */}
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  ref={nameRef} value={nameInput} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNameInput(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false) }}
                  autoFocus maxLength={24}
                  className="flex-1 text-xl font-black bg-transparent outline-none border-b-2 pb-1 text-white"
                  style={{ borderColor: "rgba(168,85,247,0.6)" }}
                />
                <button onClick={saveName}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                  style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.4)" }}>
                  <Check className="w-4 h-4" style={{ color: "#22c55e" }}/>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white truncate">{profile.displayName}</h2>
                <button onClick={() => { setNameInput(profile.displayName); setEditingName(true) }}
                  className="w-6 h-6 rounded-lg flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity">
                  <Edit2 className="w-3 h-3 text-white"/>
                </button>
              </div>
            )}
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(168,85,247,0.2)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.3)" }}>
                Nível {profile.level} · {levelTitle(profile.level)}
              </span>
              {/* Melhor título especial */}
              {(() => {
                const t = getBestTitle(profile)
                return (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{ background: `${t.color}18`, color: t.color, border: `1px solid ${t.color}44` }}>
                    {t.icon} {t.label}
                  </span>
                )
              })()}
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                {unlockedCount}/{totalAch} conquistas
              </span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                {formatTime(profile.totalPlaytimeMs)} jogados
              </span>
            </div>
          </div>

          {/* XP total */}
          <div className="text-right flex-shrink-0">
            <p className="text-3xl font-black" style={{ color: "#fbbf24" }}>{formatXP(profile.totalXP)}</p>
            <p className="text-xs text-white/30">XP Total</p>
          </div>
        </div>

        {/* Barra de XP */}
        <XPBar profile={profile} />

        {/* Stats grid */}
        <div>
          <h3 className="bebas text-lg tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>ESTATÍSTICAS</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBlock icon={<Music2 className="w-3.5 h-3.5"/>}  label="Músicas"    value={String(profile.songsPlayed)}              color="#3b82f6" />
            <StatBlock icon={<Trophy className="w-3.5 h-3.5"/>}  label="Melhor"     value={profile.bestScore.toLocaleString()}       color="#fbbf24" />
            <StatBlock icon={<Target className="w-3.5 h-3.5"/>}  label="Precisão"   value={`${accuracy}%`}                          color="#22c55e" />
            <StatBlock icon={<Star   className="w-3.5 h-3.5"/>}  label="Full Combos" value={String(profile.fcCount)}                 color="#a855f7" />
            <StatBlock icon={<Zap    className="w-3.5 h-3.5"/>}  label="Melhor Combo" value={String(profile.bestCombo)}             color="#f97316" />
            <StatBlock icon={<Trophy className="w-3.5 h-3.5"/>}  label="Rank S"     value={String(profile.sRankCount)}              color="#ffd700"
              sub={`${profile.songsPlayed ? Math.round(profile.sRankCount/profile.songsPlayed*100) : 0}% das partidas`} />
            <StatBlock icon={<Clock  className="w-3.5 h-3.5"/>}  label="Tempo Total" value={formatTime(profile.totalPlaytimeMs)}   color="#06b6d4" />
            <StatBlock icon={<Music2 className="w-3.5 h-3.5"/>}  label="Notas Perfeitas" value={profile.totalPerfects.toLocaleString()} color="#22c55e"
              sub={`${profile.totalMisses.toLocaleString()} erros totais`} />
          </div>
        </div>

        {/* Dificuldades */}
        <div className="p-4 rounded-2xl space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Partidas por Dificuldade</p>
          <div className="grid grid-cols-3 gap-3">
            {([
              [4, "Fácil",   "#3b82f6"],
              [5, "Normal",  "#22c55e"],
              [6, "Difícil", "#e11d48"],
            ] as const).map(([lc, label, color]) => {
              const count = profile.songsPerDifficulty[lc] ?? 0
              const pct   = profile.songsPlayed ? count / profile.songsPlayed : 0
              return (
                <div key={lc} className="text-center">
                  <div className="h-16 flex items-end justify-center mb-1.5">
                    <div className="w-10 rounded-t-lg transition-all duration-700"
                      style={{ height: `${Math.max(4, pct * 64)}px`, background: color, opacity: 0.7 }}/>
                  </div>
                  <p className="text-lg font-black" style={{ color }}>{count}</p>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Títulos Especiais ───────────────────────────────────────── */}
        {(() => {
          const unlockedTitles = getUnlockedTitles(profile)
          const bestTitle = getBestTitle(profile)
          return (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="bebas text-lg tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                  TÍTULOS <span style={{ color: "rgba(255,255,255,0.2)" }}>({unlockedTitles.length}/{SPECIAL_TITLES.length})</span>
                </h3>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                  style={{ background: `${bestTitle.color}18`, border: `1px solid ${bestTitle.color}44` }}>
                  <span className="text-sm">{bestTitle.icon}</span>
                  <span className="text-xs font-bold" style={{ color: bestTitle.color }}>{bestTitle.label}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SPECIAL_TITLES.map(title => {
                  const has = title.check(profile)
                  return (
                    <div key={title.id}
                      className="flex items-center gap-2.5 p-3 rounded-xl transition-all"
                      style={{
                        background: has ? `${title.color}12` : "rgba(255,255,255,0.02)",
                        border: has ? `1px solid ${title.color}35` : "1px solid rgba(255,255,255,0.05)",
                        opacity: has ? 1 : 0.45,
                      }}>
                      <span className="text-2xl">{has ? title.icon : "🔒"}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-black truncate" style={{ color: has ? title.color : "rgba(255,255,255,0.25)" }}>
                          {title.label}
                        </p>
                        <p className="text-[9px] truncate" style={{ color: "rgba(255,255,255,0.25)" }}>
                          {title.description}
                        </p>
                        <span className="text-[8px] font-bold uppercase tracking-wide"
                          style={{ color: has ? RARITY_COLORS[title.rarity] : "rgba(255,255,255,0.15)" }}>
                          {RARITY_LABELS[title.rarity]}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* ── Temas de Highway Desbloqueados ─────────────────────────── */}
        {(() => {
          const unlockedThemes = HIGHWAY_THEMES.filter(t => isThemeUnlocked(t.id, profile))
          return (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="bebas text-lg tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                  TEMAS DA HIGHWAY <span style={{ color: "rgba(255,255,255,0.2)" }}>({unlockedThemes.length}/{HIGHWAY_THEMES.length})</span>
                </h3>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {HIGHWAY_THEMES.map(theme => {
                  const unlocked = isThemeUnlocked(theme.id, profile)
                  return (
                    <div key={theme.id} className="flex flex-col items-center gap-1.5">
                      <div className="relative w-full aspect-square rounded-xl overflow-hidden"
                        style={{
                          background: theme.preview,
                          border: unlocked ? `1.5px solid ${theme.border}66` : "1px solid rgba(255,255,255,0.06)",
                          boxShadow: unlocked ? `0 0 12px ${theme.border}33` : "none",
                          opacity: unlocked ? 1 : 0.35,
                        }}>
                        <div className="absolute inset-0 flex items-center justify-center text-xl">
                          {unlocked ? theme.icon : "🔒"}
                        </div>
                      </div>
                      <p className="text-[9px] font-bold text-center leading-tight"
                        style={{ color: unlocked ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)" }}>
                        {theme.label}
                      </p>
                      {!unlocked && (
                        <p className="text-[8px] font-semibold" style={{ color: "rgba(251,191,36,0.6)" }}>
                          Nv.{theme.unlockLevel}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Backup / Restaurar */}
        <div className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-black text-white">Seus Dados</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                Exporte um backup para não perder seu progresso se o servidor reiniciar
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
                style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e" }}>
                <Download className="w-3.5 h-3.5" /> Exportar
              </button>
              <button onClick={() => importInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
                style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", color: "#3b82f6" }}>
                <Upload className="w-3.5 h-3.5" /> Importar
              </button>
              <input
                ref={importInputRef} type="file" accept=".txt" className="hidden"
                onChange={handleImport}
              />
            </div>
          </div>
          {backupMsg && (
            <p className="text-xs mt-2 font-semibold" style={{ color: backupMsg.startsWith("✅") ? "#22c55e" : "#ef4444" }}>
              {backupMsg}
            </p>
          )}
          <p className="text-[9px] mt-2" style={{ color: "rgba(255,255,255,0.18)" }}>
            💡 Dica: salve seu arquivo de backup em um lugar seguro (Google Drive, e-mail...). Para restaurar, clique em "Importar" e selecione o arquivo.
          </p>
        </div>

        {/* Conquistas */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="bebas text-lg tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
              CONQUISTAS <span style={{ color: "rgba(255,255,255,0.2)" }}>({unlockedCount}/{totalAch})</span>
            </h3>
            {/* Barra de progresso total */}
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                <div className="h-full rounded-full" style={{ width: `${unlockedCount/totalAch*100}%`, background: "linear-gradient(90deg,#f59e0b,#fbbf24)" }}/>
              </div>
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{Math.round(unlockedCount/totalAch*100)}%</span>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex gap-2 flex-wrap mb-3">
            {(["all","unlocked","locked"] as const).map(f => (
              <button key={f} onClick={() => setAchFilter(f)}
                className="text-[10px] font-bold px-2.5 py-1 rounded-full transition-all"
                style={{
                  background: achFilter===f ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.05)",
                  color: achFilter===f ? "#fbbf24" : "rgba(255,255,255,0.35)",
                  border: achFilter===f ? "1px solid rgba(251,191,36,0.4)" : "1px solid rgba(255,255,255,0.08)",
                }}>
                {f === "all" ? "Todas" : f === "unlocked" ? `✓ Obtidas (${unlockedCount})` : `🔒 Bloqueadas (${totalAch - unlockedCount})`}
              </button>
            ))}
            <div className="w-px self-stretch bg-white/10 mx-1"/>
            {(["all","common","rare","epic","legendary"] as const).map(r => (
              <button key={r} onClick={() => setAchRarity(r)}
                className="text-[10px] font-bold px-2.5 py-1 rounded-full transition-all"
                style={{
                  background: achRarity===r ? `${r==="all"?"rgba(255,255,255,0.1)":RARITY_COLORS[r]+"22"}` : "rgba(255,255,255,0.04)",
                  color: achRarity===r ? (r==="all"?"#fff":RARITY_COLORS[r]) : "rgba(255,255,255,0.3)",
                  border: achRarity===r ? `1px solid ${r==="all"?"rgba(255,255,255,0.2)":RARITY_COLORS[r]+"44"}` : "1px solid rgba(255,255,255,0.06)",
                }}>
                {r === "all" ? "Todas" : RARITY_LABELS[r]}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredAch.length === 0 ? (
              <p className="text-center py-8 text-white/20 text-sm">Nenhuma conquista neste filtro</p>
            ) : filteredAch.map((ach, i) => (
              <div key={ach.id} style={{ animation: `fade-up 0.2s ${i * 0.02}s ease both`, opacity: 0 }}>
                <AchievementCard ach={ach} unlocked={unlockedSet.has(ach.id)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
