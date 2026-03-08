"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Star, Trophy, Music2, Target, Zap, Edit2 } from "lucide-react"
import {
  loadProfile, saveProfile, getAllAchievements, getUnlockedAchievements,
  xpForLevel, xpInCurrentLevel, titleForLevel, type PlayerProfile, type Achievement
} from "@/lib/progression"

const FRAME_STYLES: Record<string, string> = {
  default: "2px solid rgba(255,255,255,0.2)",
  bronze:  "2px solid #cd7f32",
  silver:  "2px solid #c0c0c0",
  gold:    "2px solid #fbbf24",
  diamond: "2px solid #00e5ff",
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [allAchs, setAllAchs] = useState<Achievement[]>([])
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState("")

  useEffect(() => {
    const p = loadProfile()
    setProfile(p)
    setNameInput(p.name)
    setAllAchs(getAllAchievements())
    const ul = getUnlockedAchievements()
    setUnlockedIds(new Set(ul.map(a => a.id)))
  }, [])

  if (!profile) return null

  const xpNeeded = xpForLevel(profile.level)
  const xpCurrent = xpInCurrentLevel(profile.xp)
  const xpPct = Math.min((xpCurrent / xpNeeded) * 100, 100)

  const saveName = () => {
    if (!nameInput.trim()) return
    const updated = { ...profile, name: nameInput.trim() }
    saveProfile(updated)
    setProfile(updated)
    setEditing(false)
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem("playerName", nameInput.trim())
  }

  const glowColor = profile.frame === "diamond" ? "#00e5ff"
    : profile.frame === "gold" ? "#fbbf24"
    : profile.frame === "silver" ? "#c0c0c0"
    : profile.frame === "bronze" ? "#cd7f32"
    : "rgba(255,255,255,0.2)"

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0a0a14,#0e0a18,#0a0e14)",
      color: "#fff", padding: "1.5rem", fontFamily: "'Arial Black', Arial, sans-serif" }}>
      <button onClick={() => router.push("/")} style={{
        display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none",
        color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "0.85rem", marginBottom: "1.5rem",
      }}>
        <ArrowLeft size={16} /> Voltar
      </button>
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        {/* Avatar + info */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "2rem" }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            border: FRAME_STYLES[profile.frame] || FRAME_STYLES.default,
            boxShadow: `0 0 16px ${glowColor}40`,
            background: "linear-gradient(135deg,#1a1a2e,#0e1020)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "2.5rem", flexShrink: 0,
          }}>🎸</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {editing ? (
                <div style={{ display: "flex", gap: "6px" }}>
                  <input value={nameInput} onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && saveName()}
                    style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)",
                      color: "#fff", borderRadius: "6px", padding: "4px 8px", fontSize: "1rem", fontWeight: 700 }}
                    autoFocus maxLength={20} />
                  <button onClick={saveName} style={{ background: "#22c55e", border: "none", color: "#000",
                    borderRadius: "6px", padding: "4px 10px", fontWeight: 800, cursor: "pointer" }}>✓</button>
                </div>
              ) : (
                <>
                  <h1 style={{ fontSize: "1.4rem", fontWeight: 900, margin: 0 }}>{profile.name}</h1>
                  <button onClick={() => setEditing(true)} style={{ background: "none", border: "none",
                    color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: "2px" }}><Edit2 size={14} /></button>
                </>
              )}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#fbbf2480", fontWeight: 700, letterSpacing: "1px" }}>{profile.title}</div>
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>
              Nível {profile.level} · {profile.xp.toLocaleString("pt-BR")} XP total
            </div>
          </div>
        </div>
        {/* XP Bar */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem",
            color: "rgba(255,255,255,0.4)", marginBottom: "4px" }}>
            <span>Nível {profile.level}</span>
            <span>{xpCurrent} / {xpNeeded} XP → Nível {profile.level + 1}</span>
          </div>
          <div style={{ height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 5, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${xpPct}%`, borderRadius: 5,
              background: "linear-gradient(90deg,#fbbf24,#f97316)",
              boxShadow: "0 0 8px rgba(251,191,36,0.5)" }} />
          </div>
        </div>
        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {[
            { icon: "🎵", label: "Músicas",      val: profile.totalSongsPlayed },
            { icon: "⚡", label: "Full Combos",  val: profile.totalFCs },
            { icon: "🎯", label: "Precisão Méd.", val: `${profile.avgAccuracy}%` },
            { icon: "🏆", label: "Melhor Combo", val: `${profile.bestCombo}x` },
            { icon: "⭐", label: "Perfects",     val: profile.totalPerfects },
            { icon: "🎸", label: "Frame",        val: profile.frame },
          ].map((s, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "10px", padding: "0.7rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.2rem", marginBottom: "4px" }}>{s.icon}</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>{s.val}</div>
              <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.35)", letterSpacing: "1px" }}>{s.label}</div>
            </div>
          ))}
        </div>
        {/* Achievements */}
        <h2 style={{ fontSize: "0.75rem", letterSpacing: "3px", color: "rgba(255,255,255,0.4)",
          marginBottom: "0.75rem", fontWeight: 700 }}>
          CONQUISTAS ({unlockedIds.size}/{allAchs.length})
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "0.5rem" }}>
          {allAchs.map(a => {
            const unlocked = unlockedIds.has(a.id)
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "10px",
                background: unlocked ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${unlocked ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: "8px", padding: "0.55rem 0.7rem", opacity: unlocked ? 1 : 0.45 }}>
                <span style={{ fontSize: "1.3rem" }}>{unlocked ? a.icon : "🔒"}</span>
                <div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 800, color: unlocked ? "#fbbf24" : "rgba(255,255,255,0.4)" }}>
                    {a.name}
                  </div>
                  <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)" }}>{a.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
