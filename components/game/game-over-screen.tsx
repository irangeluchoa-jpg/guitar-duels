"use client"

import { useEffect, useState, useRef } from "react"
import { RotateCcw, ArrowLeft, Zap, Target, TrendingUp, Skull } from "lucide-react"
import type { GameStats } from "@/lib/game/engine"
import type { SongMeta } from "@/lib/songs/types"
import { playClickSound } from "@/lib/game/sounds"
import { updateProfileAfterGame, checkAndUnlockAchievements, loadProfile, xpForLevel, xpInCurrentLevel, type Achievement } from "@/lib/progression"
import { loadSettings } from "@/lib/settings"

interface GameOverScreenProps {
  stats: GameStats
  accuracy: number
  grade: string
  meta: SongMeta
  failed?: boolean
  onRestart: () => void
  onBack?: () => void
}

const GRADE_DATA: Record<string, { color: string; glow: string; label: string }> = {
  S: { color: "#fbbf24", glow: "rgba(251,191,36,0.5)",  label: "PERFEITO!" },
  A: { color: "#22c55e", glow: "rgba(34,197,94,0.4)",   label: "INCRÍVEL!" },
  B: { color: "#3b82f6", glow: "rgba(59,130,246,0.4)",  label: "MUITO BOM!" },
  C: { color: "#a855f7", glow: "rgba(168,85,247,0.4)",  label: "BOM" },
  D: { color: "#f97316", glow: "rgba(249,115,22,0.4)",  label: "PASSOU" },
  F: { color: "#ef4444", glow: "rgba(239,68,68,0.4)",   label: "TENTE DE NOVO" },
}

export function GameOverScreen({ stats, accuracy, grade, meta, failed = false, onRestart, onBack }: GameOverScreenProps) {
  const [phase, setPhase] = useState<"hidden" | "fail" | "grade" | "stats" | "buttons">("hidden")
  const [xpGained, setXpGained] = useState(0)
  const [leveledUp, setLeveledUp] = useState(false)
  const [newLevel, setNewLevel] = useState(0)
  const [newAchs, setNewAchs] = useState<Achievement[]>([])
  const [scoreDisplay, setScoreDisplay] = useState(0)
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Salva score + processa progressão
  useEffect(() => {
    try {
      const playerName = sessionStorage.getItem("playerName") || "Jogador"
      const entry = {
        playerName, trackId: meta.id || "unknown",
        songName: meta.name, artist: meta.artist,
        score: stats.score, accuracy, grade,
        maxCombo: stats.maxCombo,
        perfect: stats.perfect, great: stats.great,
        good: stats.good, miss: stats.miss,
        failed,
        date: new Date().toISOString(),
      }
      const stored = localStorage.getItem("guitar-duels-scores")
      const scores = stored ? JSON.parse(stored) : []
      scores.push(entry)
      scores.sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      localStorage.setItem("guitar-duels-scores", JSON.stringify(scores.slice(0, 100)))
    } catch { /* ignore */ }

    // Progressão XP + conquistas
    try {
      const result = updateProfileAfterGame({
        accuracy, maxCombo: stats.maxCombo, miss: stats.miss,
        difficulty: meta.difficulty ?? 2, failed,
        perfect: stats.perfect,
      })
      setXpGained(result.xpGained)
      if (result.leveledUp) { setLeveledUp(true); setNewLevel(result.newLevel ?? 0) }

      const profile = result.profile
      const achs = checkAndUnlockAchievements({
        accuracy, maxCombo: stats.maxCombo, miss: stats.miss,
        difficulty: meta.difficulty ?? 2, failed,
        totalSongs: profile.totalSongsPlayed,
        level: profile.level,
      })
      setNewAchs(achs)
    } catch { /* ignore */ }
  }, [])

  // Sequência de entrada
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(failed ? "fail" : "grade"), 200)
    const t2 = setTimeout(() => setPhase("grade"), failed ? 1800 : 200)
    const t3 = setTimeout(() => setPhase("stats"), failed ? 2500 : 900)
    const t4 = setTimeout(() => setPhase("buttons"), failed ? 3200 : 1600)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [failed])

  // Contador de score animado
  useEffect(() => {
    if (phase !== "stats" && phase !== "buttons") return
    const target = stats.score
    const duration = 1200
    const start = performance.now()
    animRef.current = setInterval(() => {
      const elapsed = performance.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setScoreDisplay(Math.round(eased * target))
      if (progress >= 1) { clearInterval(animRef.current!); setScoreDisplay(target) }
    }, 16)
    return () => { if (animRef.current) clearInterval(animRef.current) }
  }, [phase, stats.score])

  const gradeInfo = GRADE_DATA[grade] ?? GRADE_DATA["F"]
  const getVol = () => { try { const s = loadSettings(); return (s.masterVolume/100)*(s.sfxVolume/100) } catch { return 1 } }

  // ── TELA DE FAIL ──────────────────────────────────────────────────────────
  if (phase === "fail") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center z-50"
        style={{ background: "rgba(0,0,0,0.92)" }}>
        {/* Crack effect lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.15 }}>
          <line x1="50%" y1="0%" x2="30%" y2="100%" stroke="#ef4444" strokeWidth="1"/>
          <line x1="50%" y1="0%" x2="70%" y2="100%" stroke="#ef4444" strokeWidth="1"/>
          <line x1="50%" y1="0%" x2="10%" y2="80%" stroke="#ef4444" strokeWidth="0.5"/>
          <line x1="50%" y1="0%" x2="90%" y2="75%" stroke="#ef4444" strokeWidth="0.5"/>
        </svg>

        <div style={{
          animation: "failDrop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards",
          textAlign: "center",
        }}>
          <div style={{
            fontSize: "clamp(60px,15vw,120px)",
            fontWeight: 900,
            color: "#ef4444",
            textShadow: "0 0 40px rgba(239,68,68,0.8), 0 0 80px rgba(239,68,68,0.4)",
            letterSpacing: "-2px",
            lineHeight: 1,
          }}>
            FAILED
          </div>
          <div style={{ fontSize: "1.2rem", color: "#ef444480", marginTop: "0.5rem", fontWeight: 700, letterSpacing: "4px" }}>
            ROCK METER ZERADO
          </div>
        </div>

        <Skull size={48} style={{ color: "#ef4444", marginTop: "2rem", opacity: 0.7,
          filter: "drop-shadow(0 0 12px rgba(239,68,68,0.8))" }} />

        <style>{`
          @keyframes failDrop {
            0% { transform: translateY(-80px) scale(1.3); opacity: 0; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    )
  }

  // ── TELA DE RESULTADO ─────────────────────────────────────────────────────
  const isVisible = phase === "grade" || phase === "stats" || phase === "buttons"

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-50"
      style={{
        background: failed
          ? "linear-gradient(180deg, rgba(80,0,0,0.95) 0%, rgba(0,0,0,0.97) 100%)"
          : "linear-gradient(180deg, rgba(10,10,20,0.95) 0%, rgba(0,0,0,0.97) 100%)",
        opacity: isVisible ? 1 : 0,
        transition: "opacity 0.4s ease",
      }}>

      {/* Título da música */}
      <div style={{
        opacity: phase === "grade" || phase === "stats" || phase === "buttons" ? 1 : 0,
        transform: phase === "grade" || phase === "stats" || phase === "buttons" ? "translateY(0)" : "translateY(-20px)",
        transition: "all 0.5s ease",
        textAlign: "center", marginBottom: "1.5rem",
      }}>
        <div style={{ fontSize: "0.7rem", letterSpacing: "4px", color: failed ? "#ef444480" : "#ffffff40", fontWeight: 700 }}>
          {failed ? "❌ FALHOU EM" : "✓ COMPLETOU"}
        </div>
        <div style={{ fontSize: "clamp(14px,2vw,20px)", fontWeight: 800, color: "#fff", maxWidth: "600px" }}>
          {meta.name}
        </div>
        <div style={{ fontSize: "0.85rem", color: "#ffffff60" }}>{meta.artist}</div>
      </div>

      {/* Grade */}
      <div style={{
        opacity: phase === "grade" || phase === "stats" || phase === "buttons" ? 1 : 0,
        transform: phase === "grade" || phase === "stats" || phase === "buttons" ? "scale(1)" : "scale(0.5)",
        transition: "all 0.5s cubic-bezier(0.34,1.56,0.64,1)",
        textAlign: "center", marginBottom: "1rem",
      }}>
        <div style={{
          fontSize: "clamp(70px,12vw,100px)",
          fontWeight: 900,
          color: gradeInfo.color,
          textShadow: `0 0 30px ${gradeInfo.glow}, 0 0 60px ${gradeInfo.glow}`,
          lineHeight: 1,
        }}>{grade}</div>
        <div style={{ fontSize: "1rem", color: gradeInfo.color, fontWeight: 700, letterSpacing: "3px", opacity: 0.9 }}>
          {gradeInfo.label}
        </div>
      </div>

      {/* Stats */}
      <div style={{
        opacity: phase === "stats" || phase === "buttons" ? 1 : 0,
        transform: phase === "stats" || phase === "buttons" ? "translateY(0)" : "translateY(20px)",
        transition: "all 0.5s ease 0.1s",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem",
        width: "100%", maxWidth: "420px", padding: "0 1.5rem",
      }}>
        {/* Score */}
        <div style={{
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "12px", padding: "0.8rem 2rem", textAlign: "center", width: "100%",
        }}>
          <div style={{ fontSize: "0.65rem", letterSpacing: "3px", color: "#ffffff50", fontWeight: 700 }}>PONTUAÇÃO</div>
          <div style={{ fontSize: "clamp(28px,5vw,40px)", fontWeight: 900, color: "#fff",
            textShadow: "0 0 20px rgba(255,255,255,0.3)" }}>
            {scoreDisplay.toLocaleString("pt-BR")}
          </div>
        </div>

        {/* Accuracy + Combo row */}
        <div style={{ display: "flex", gap: "0.75rem", width: "100%" }}>
          <div style={{
            flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: "10px", padding: "0.6rem", textAlign: "center",
          }}>
            <div style={{ fontSize: "0.6rem", letterSpacing: "2px", color: "#ffffff40", fontWeight: 700 }}><Target size={10} style={{ display:"inline" }} /> PRECISÃO</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: accuracy >= 95 ? "#fbbf24" : "#fff" }}>
              {accuracy}%
            </div>
          </div>
          <div style={{
            flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: "10px", padding: "0.6rem", textAlign: "center",
          }}>
            <div style={{ fontSize: "0.6rem", letterSpacing: "2px", color: "#ffffff40", fontWeight: 700 }}><TrendingUp size={10} style={{ display:"inline" }} /> MAX COMBO</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: stats.maxCombo >= 50 ? "#fbbf24" : "#fff" }}>
              {stats.maxCombo}x
            </div>
          </div>
        </div>

        {/* Hit breakdown */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.4rem", width: "100%",
        }}>
          {[
            { label: "PERFECT", val: stats.perfect, color: "#fbbf24" },
            { label: "GREAT",   val: stats.great,   color: "#22c55e" },
            { label: "GOOD",    val: stats.good,    color: "#3b82f6" },
            { label: "MISS",    val: stats.miss,    color: "#ef4444" },
          ].map(({ label, val, color }) => (
            <div key={label} style={{
              background: "rgba(255,255,255,0.04)", border: `1px solid ${color}30`,
              borderRadius: "8px", padding: "0.4rem 0.2rem", textAlign: "center",
            }}>
              <div style={{ fontSize: "0.55rem", color: color + "80", fontWeight: 700, letterSpacing: "1px" }}>{label}</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* XP gained + Level up */}
      {(phase === "stats" || phase === "buttons") && xpGained > 0 && (
        <div style={{
          marginTop: "0.75rem", display: "flex", flexDirection: "column",
          alignItems: "center", gap: "4px", width: "100%", maxWidth: "420px", padding: "0 1.5rem",
        }}>
          <div style={{
            width: "100%", background: "rgba(255,255,255,0.05)", borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.08)", padding: "0.5rem 0.8rem",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <span style={{ fontSize: "0.65rem", color: "#fbbf2480", fontWeight: 700, letterSpacing: "1px" }}>XP GANHO</span>
              <span style={{ fontSize: "0.8rem", color: "#fbbf24", fontWeight: 800 }}>+{xpGained} XP</span>
            </div>
            {leveledUp && (
              <div style={{ textAlign: "center", color: "#fbbf24", fontWeight: 900, fontSize: "0.8rem",
                letterSpacing: "2px", marginBottom: "4px",
                textShadow: "0 0 12px rgba(251,191,36,0.6)" }}>
                ⬆ LEVEL UP! → Nível {newLevel}
              </div>
            )}
          </div>

          {/* Conquistas novas */}
          {newAchs.length > 0 && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center", marginTop: "4px" }}>
              {newAchs.map(a => (
                <div key={a.id} style={{
                  background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.35)",
                  borderRadius: "6px", padding: "4px 8px", display: "flex", alignItems: "center", gap: "5px",
                }}>
                  <span>{a.icon}</span>
                  <div>
                    <div style={{ fontSize: "0.6rem", color: "#fbbf24", fontWeight: 800 }}>{a.name}</div>
                    <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.4)" }}>{a.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Buttons */}
      <div style={{
        opacity: phase === "buttons" ? 1 : 0,
        transform: phase === "buttons" ? "translateY(0)" : "translateY(10px)",
        transition: "all 0.4s ease",
        display: "flex", gap: "0.75rem", marginTop: "1.25rem",
      }}>
        <button
          onClick={() => { playClickSound(getVol()); onRestart() }}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.7rem 1.6rem", borderRadius: "10px", fontWeight: 800,
            fontSize: "0.9rem", cursor: "pointer", border: "2px solid #22c55e",
            background: "rgba(34,197,94,0.15)", color: "#22c55e",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(34,197,94,0.30)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(34,197,94,0.15)")}
        >
          <RotateCcw size={16} /> TENTAR DE NOVO
        </button>
        {onBack && (
          <button
            onClick={() => { playClickSound(getVol()); onBack() }}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.7rem 1.4rem", borderRadius: "10px", fontWeight: 800,
              fontSize: "0.9rem", cursor: "pointer", border: "2px solid rgba(255,255,255,0.25)",
              background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          >
            <ArrowLeft size={16} /> MENU
          </button>
        )}
      </div>

      {/* FC badge */}
      {stats.miss === 0 && !failed && (
        <div style={{
          position: "absolute", top: "1rem", right: "1rem",
          background: "linear-gradient(135deg,#fbbf24,#f97316)",
          borderRadius: "8px", padding: "0.3rem 0.7rem",
          fontSize: "0.75rem", fontWeight: 900, color: "#000",
          boxShadow: "0 0 20px rgba(251,191,36,0.5)",
          display: "flex", alignItems: "center", gap: "4px",
        }}>
          <Zap size={12} /> FULL COMBO!
        </div>
      )}
    </div>
  )
}
