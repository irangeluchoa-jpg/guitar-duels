"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { RotateCcw, ArrowLeft, Zap, Target, TrendingUp, Trophy, Star, Share2 } from "lucide-react"
import type { GameStats } from "@/lib/game/engine"
import type { SongMeta } from "@/lib/songs/types"
import { playClickSound } from "@/lib/game/sounds"
import { loadSettings } from "@/lib/settings"
import { submitGlobalScore } from "@/lib/supabase"

interface GameOverScreenProps {
  stats: GameStats
  accuracy: number
  grade: string
  meta: SongMeta
  onRestart: () => void
  onBack?: () => void
  failed?: boolean
  isFC?: boolean
  isDaily?: boolean
  onNextSong?: () => void
  playlistCount?: number
  playlistPosition?: number
}

const GRADE_DATA: Record<string, { color: string; glow: string; label: string }> = {
  "S+": { color: "#ffd700", glow: "rgba(255,215,0,0.7)",   label: "FULL COMBO PERFEITO!" },
  S:    { color: "#fbbf24", glow: "rgba(251,191,36,0.5)",  label: "PERFEITO!" },
  A:    { color: "#22c55e", glow: "rgba(34,197,94,0.4)",   label: "INCRÍVEL!" },
  B:    { color: "#3b82f6", glow: "rgba(59,130,246,0.4)",  label: "MUITO BOM!" },
  C:    { color: "#a855f7", glow: "rgba(168,85,247,0.4)",  label: "BOM" },
  D:    { color: "#f97316", glow: "rgba(249,115,22,0.4)",  label: "PASSOU" },
  F:    { color: "#ef4444", glow: "rgba(239,68,68,0.4)",   label: "TENTE DE NOVO" },
  FAIL: { color: "#ef4444", glow: "rgba(239,68,68,0.6)",   label: "FALHOU!" },
}

export function GameOverScreen({
  stats, accuracy, grade, isFC = false,
  meta, onRestart, onBack, failed = false, isDaily = false,
  onNextSong, playlistCount = 0, playlistPosition = 0
}: GameOverScreenProps) {
  const [phase, setPhase] = useState<"hidden" | "grade" | "stats" | "buttons">("hidden")
  const [scoreDisplay, setScoreDisplay] = useState(0)
  const [newRecord, setNewRecord] = useState(false)
  const [prevBest, setPrevBest] = useState<number | null>(null)
  const [starsShown, setStarsShown] = useState(0)
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Salva score + detecta novo recorde
  useEffect(() => {
    try {
      const profileRaw = localStorage.getItem("guitar-duels-profile")
      const profileName = profileRaw ? (JSON.parse(profileRaw).displayName || "") : ""
      const playerName = sessionStorage.getItem("playerName") || profileName || "Guitarrista"

      // Verificar recorde anterior
      const scoresRaw = localStorage.getItem("guitar-duels-scores")
      const scores: Array<{ trackId: string; score: number; [k: string]: unknown }> =
        scoresRaw ? JSON.parse(scoresRaw) : []
      const personal = scores
        .filter(s => s.trackId === (meta.id || "unknown"))
        .sort((a, b) => b.score - a.score)
      const oldBest = personal[0]?.score ?? null
      setPrevBest(oldBest)
      if (oldBest !== null && stats.score > oldBest) setNewRecord(true)
      else if (oldBest === null && stats.score > 0) setNewRecord(true)

      const entry = {
        playerName, trackId: meta.id || "unknown",
        songName: meta.name, artist: meta.artist,
        score: stats.score, accuracy, grade,
        maxCombo: stats.maxCombo,
        perfect: stats.perfect, great: stats.great,
        good: stats.good, miss: stats.miss,
        isFC, date: new Date().toISOString(),
      }
      scores.push(entry)
      scores.sort((a, b) => b.score - a.score)
      localStorage.setItem("guitar-duels-scores", JSON.stringify(scores.slice(0, 100)))

      // Melhor score pessoal por música (usado na song-select)
      const bestRaw = localStorage.getItem("guitar-duels-scores")
      const allScores: Array<{ trackId: string; score: number; grade: string }> =
        bestRaw ? JSON.parse(bestRaw) : []
      const bestPerSong: Record<string, { score: number; grade: string }> = {}
      for (const s of allScores) {
        if (!bestPerSong[s.trackId] || s.score > bestPerSong[s.trackId].score) {
          bestPerSong[s.trackId] = { score: s.score, grade: s.grade }
        }
      }
      localStorage.setItem("gh-best-scores", JSON.stringify(bestPerSong))

      // Envia para Supabase em background (sem bloquear)
      submitGlobalScore({
        player_name: playerName,
        track_id: meta.id || "unknown",
        song_name: meta.name,
        artist: meta.artist,
        score: stats.score,
        accuracy,
        grade,
        max_combo: stats.maxCombo,
        perfect: stats.perfect,
        great: stats.great,
        good: stats.good,
        miss: stats.miss,
        is_fc: isFC,
      }).catch(() => {})

    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sequência de aparecimento
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("grade"), 150)
    const t2 = setTimeout(() => setPhase("stats"), 700)
    const t3 = setTimeout(() => setPhase("buttons"), 1200)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  // Score counter animation
  useEffect(() => {
    if (phase !== "stats") return
    const target = stats.score
    const duration = 1000
    const steps = 60
    const step = target / steps
    let current = 0
    animRef.current = setInterval(() => {
      current = Math.min(current + step, target)
      setScoreDisplay(Math.round(current))
      if (current >= target) clearInterval(animRef.current!)
    }, duration / steps)
    return () => { if (animRef.current) clearInterval(animRef.current) }
  }, [phase, stats.score])

  // Estrelas animadas — aparecem uma a uma
  useEffect(() => {
    if (phase !== "stats") return
    const stars = accuracy >= 95 ? 5 : accuracy >= 85 ? 4 : accuracy >= 70 ? 3 : accuracy >= 55 ? 2 : 1
    let i = 0
    const iv = setInterval(() => {
      i++
      setStarsShown(i)
      if (i >= stars) clearInterval(iv)
    }, 180)
    return () => clearInterval(iv)
  }, [phase, accuracy])

  const totalStars = accuracy >= 95 ? 5 : accuracy >= 85 ? 4 : accuracy >= 70 ? 3 : accuracy >= 55 ? 2 : 1
  const gradeInfo = failed
    ? GRADE_DATA["FAIL"]
    : (GRADE_DATA[grade] || { color: "#888", glow: "rgba(128,128,128,0.3)", label: "" })
  const displayGrade = failed ? "💀" : grade
  const totalHit = stats.perfect + stats.great + stats.good
  const totalNotes = stats.totalNotes

  const vol = (() => {
    try {
      const s = loadSettings()
      return (s.masterVolume / 100) * (s.sfxVolume / 100)
    } catch { return 0.5 }
  })()

  const handleShare = useCallback(() => {
    const gradeEmoji: Record<string,string> = { "S+":"🌟","S":"⭐","A":"✅","B":"🔵","C":"🟣","D":"🟠","F":"❌" }
    const stars = "⭐".repeat(accuracy >= 95 ? 5 : accuracy >= 85 ? 4 : accuracy >= 70 ? 3 : accuracy >= 55 ? 2 : 1)
    const fc = isFC ? " ✨ FULL COMBO!" : ""
    const text = [
      `🎸 Guitar Duels${fc}`,
      `${gradeEmoji[grade] ?? "🎵"} ${grade} — ${meta.name}`,
      `📊 ${stats.score.toLocaleString()} pts · ${accuracy}% precisão · ${stats.maxCombo}x combo`,
      stars,
    ].join("\n")
    if (navigator.share) {
      navigator.share({ title: "Guitar Duels", text }).catch(() => {})
    } else {
      navigator.clipboard?.writeText(text).then(() => alert("Resultado copiado!")).catch(() => {})
    }
    playClickSound(vol)
  }, [grade, meta, stats, accuracy, isFC, vol])

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(12px)" }}
    >
      {(grade === "S" || grade === "S+") && !failed && <GoldParticles />}
      {failed && <FailOverlay />}
      {newRecord && !failed && <NewRecordBurst />}

      <div className="w-full max-w-sm mx-4 flex flex-col gap-3">

        {/* Badge Diário */}
        {isDaily && (
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase"
              style={{ background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.35)", color: "#eab308" }}>
              ⚡ DESAFIO DIÁRIO
            </div>
          </div>
        )}

        {/* Badge Playlist */}
        {playlistCount > 1 && (
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase"
              style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e" }}>
              🎵 {playlistPosition}/{playlistCount} NA FILA
            </div>
          </div>
        )}

        {/* Grade + Título */}
        <div
          className="text-center transition-all duration-500"
          style={{
            opacity: phase !== "hidden" ? 1 : 0,
            transform: phase !== "hidden" ? "translateY(0) scale(1)" : "translateY(-30px) scale(0.8)",
          }}
        >
          <div className="relative inline-flex items-center justify-center mb-2">
            <div className="absolute rounded-full" style={{ width: "140px", height: "140px", border: `1px solid ${gradeInfo.color}25`, animation: phase !== "hidden" ? "spin-slow 8s linear infinite" : "none" }} />
            <div className="absolute rounded-full" style={{ width: "116px", height: "116px", border: `1px solid ${gradeInfo.color}15`, animation: phase !== "hidden" ? "spin-slow 12s linear infinite reverse" : "none" }} />
            <div className="relative w-24 h-24 rounded-full flex items-center justify-center"
              style={{ background: `radial-gradient(circle, ${gradeInfo.color}20, transparent 70%)`, border: `2px solid ${gradeInfo.color}50`, boxShadow: `0 0 50px ${gradeInfo.glow}, inset 0 0 20px ${gradeInfo.color}10` }}>
              <span className="text-5xl font-black" style={{ color: gradeInfo.color, textShadow: `0 0 30px ${gradeInfo.glow}` }}>
                {displayGrade}
              </span>
            </div>
          </div>

          <p className="text-xs font-bold tracking-[0.4em] uppercase mb-1" style={{ color: gradeInfo.color, opacity: 0.8 }}>
            {gradeInfo.label}
          </p>

          {/* Estrelas */}
          <div className="flex justify-center gap-1 mb-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-4 h-4 transition-all duration-200 ${i < starsShown ? "scale-125" : "scale-100 opacity-15"}`}
                style={{
                  color: i < starsShown ? "#fbbf24" : "rgba(255,255,255,0.15)",
                  fill: i < starsShown ? "#fbbf24" : "transparent",
                  filter: i < starsShown ? "drop-shadow(0 0 6px rgba(251,191,36,0.8))" : "none",
                  transform: i < starsShown ? "scale(1.2)" : "scale(0.9)",
                  transition: `all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.02}s`,
                }}
              />
            ))}
          </div>

          {isFC && !failed && (
            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full mb-1"
              style={{ background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.4)" }}>
              <span className="text-[10px] font-black tracking-widest" style={{ color: "#ffd700" }}>✨ FULL COMBO</span>
            </div>
          )}
          <h2 className="text-base font-bold text-white">{meta.name}</h2>
          <p className="text-white/35 text-xs">{meta.artist}</p>
        </div>

        {/* Stats card */}
        <div
          className="rounded-2xl overflow-hidden transition-all duration-500"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: newRecord ? `1px solid rgba(251,191,36,0.35)` : "1px solid rgba(255,255,255,0.07)",
            boxShadow: newRecord ? "0 0 30px rgba(251,191,36,0.12)" : "0 8px 32px rgba(0,0,0,0.4)",
            opacity: phase === "stats" || phase === "buttons" ? 1 : 0,
            transform: phase === "stats" || phase === "buttons" ? "translateY(0)" : "translateY(15px)",
          }}
        >
          {/* Score */}
          <div className="text-center py-4 px-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <p className="text-4xl font-black font-mono text-white" style={{ textShadow: `0 0 30px ${gradeInfo.glow}` }}>
              {scoreDisplay.toLocaleString()}
            </p>
            <p className="text-white/30 text-xs mt-0.5 tracking-widest uppercase">pontos</p>

            {/* Novo recorde */}
            {newRecord && phase === "buttons" && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
                style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.4)", animation: "record-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>
                <Trophy className="w-3 h-3" style={{ color: "#fbbf24" }} />
                <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: "#fbbf24" }}>
                  Novo Recorde!
                  {prevBest !== null && prevBest > 0 && (
                    <span className="ml-1 font-normal opacity-70">+{(stats.score - prevBest).toLocaleString()}</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-3 divide-x" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <MetricCell icon={<Target className="w-3 h-3" />} label="Precisão" value={`${accuracy}%`} color={accuracy >= 90 ? "#fbbf24" : "#fff"} />
            <MetricCell icon={<Zap className="w-3 h-3" />} label="Combo Máx." value={`${stats.maxCombo}x`} color="#eab308" />
            <MetricCell icon={<TrendingUp className="w-3 h-3" />} label="Notas" value={`${totalHit}/${totalNotes}`} color="#22c55e" />
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-2 gap-2 p-3">
            <HitRow label="Perfect" value={stats.perfect} total={totalNotes} color="#fbbf24" />
            <HitRow label="Great"   value={stats.great}   total={totalNotes} color="#22c55e" />
            <HitRow label="Good"    value={stats.good}    total={totalNotes} color="#3b82f6" />
            <HitRow label="Miss"    value={stats.miss}    total={totalNotes} color="#ef4444" bad />
          </div>
        </div>

        {/* Botões */}
        <div className="flex gap-3 transition-all duration-500"
          style={{ opacity: phase === "buttons" ? 1 : 0, transform: phase === "buttons" ? "translateY(0)" : "translateY(10px)" }}>
          <button
            onClick={() => { playClickSound(vol); onBack?.() }}
            className="flex items-center justify-center gap-2 flex-1 h-12 rounded-xl text-sm font-semibold transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Menu
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-1.5 h-12 px-4 rounded-xl text-sm font-semibold transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
            title="Compartilhar resultado"
          >
            <Share2 className="w-4 h-4" />
          </button>
          {onNextSong && playlistCount > 1 && playlistPosition < playlistCount ? (
            <button
              onClick={() => { playClickSound(vol); onNextSong() }}
              className="flex items-center justify-center gap-2 flex-[2] h-12 rounded-xl text-sm font-bold transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg,#15803d,#16a34a)", color: "#fff", boxShadow: "0 0 24px rgba(34,197,94,0.35)" }}
            >
              Próxima ▶
            </button>
          ) : (
            <button
              onClick={() => { playClickSound(vol); onRestart() }}
              className="flex items-center justify-center gap-2 flex-[2] h-12 rounded-xl text-sm font-bold transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg, #e11d48, #be123c)", color: "#fff", boxShadow: "0 0 24px rgba(225,29,72,0.4), 0 4px 12px rgba(0,0,0,0.3)" }}
            >
              <RotateCcw className="w-4 h-4" />
              Jogar Novamente
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes float-up { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-80px) scale(0.3); opacity: 0; } }
        @keyframes record-pop { 0% { transform: scale(0.7); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes record-burst { 0% { transform: scale(0); opacity: 1; } 100% { transform: scale(4); opacity: 0; } }
      `}</style>
    </div>
  )
}

function MetricCell({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center py-3 gap-1">
      <div style={{ color: "rgba(255,255,255,0.25)" }}>{icon}</div>
      <span className="text-sm font-bold" style={{ color }}>{value}</span>
      <span className="text-[9px] text-white/25 uppercase tracking-widest">{label}</span>
    </div>
  )
}

function HitRow({ label, value, total, color, bad }: { label: string; value: number; total: number; color: string; bad?: boolean }) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[10px] text-white/35 uppercase tracking-wide">{label}</span>
        <span className="text-xs font-bold font-mono" style={{ color }}>{value}</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: bad ? `linear-gradient(90deg, ${color}80, ${color})` : color, boxShadow: `0 0 6px ${color}80` }} />
      </div>
    </div>
  )
}

function FailOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(239,68,68,0.15) 0%, transparent 70%)", animation: "fail-pulse 1.2s ease-in-out infinite" }} />
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="absolute rounded-full"
          style={{
            width: `${4 + Math.random() * 8}px`, height: `${4 + Math.random() * 8}px`,
            background: `rgba(239,68,68,${0.4 + Math.random() * 0.4})`,
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            animation: `float-up ${1.5 + Math.random()}s ease-out ${Math.random() * 2}s infinite`,
          }} />
      ))}
      <style>{`@keyframes fail-pulse { 0%,100%{opacity:.6} 50%{opacity:1} }`}</style>
    </div>
  )
}

function GoldParticles() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="absolute rounded-full"
          style={{
            width: `${3 + Math.random() * 6}px`, height: `${3 + Math.random() * 6}px`,
            background: `rgba(251,191,36,${0.5 + Math.random() * 0.5})`,
            left: `${Math.random() * 100}%`, top: `${50 + Math.random() * 50}%`,
            animation: `float-up ${2 + Math.random() * 2}s ease-out ${Math.random() * 3}s infinite`,
          }} />
      ))}
    </div>
  )
}

function NewRecordBurst() {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 1 }}>
      <div className="rounded-full" style={{ width: "8px", height: "8px", border: "2px solid rgba(251,191,36,0.6)", animation: "record-burst 0.6s ease-out forwards" }} />
      <div className="absolute rounded-full" style={{ width: "8px", height: "8px", border: "1px solid rgba(251,191,36,0.3)", animation: "record-burst 0.8s ease-out 0.1s forwards" }} />
    </div>
  )
}
