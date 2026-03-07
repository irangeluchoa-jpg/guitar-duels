"use client"

import { useEffect, useState, useRef } from "react"
import { RotateCcw, ArrowLeft, Zap, Target, TrendingUp } from "lucide-react"
import type { GameStats } from "@/lib/game/engine"
import type { SongMeta } from "@/lib/songs/types"
import { playClickSound } from "@/lib/game/sounds"
import { loadSettings } from "@/lib/settings"

interface GameOverScreenProps {
  stats: GameStats
  accuracy: number
  grade: string
  meta: SongMeta
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

export function GameOverScreen({ stats, accuracy, grade, meta, onRestart, onBack }: GameOverScreenProps) {
  const [phase, setPhase] = useState<"hidden" | "grade" | "stats" | "buttons">("hidden")
  const [scoreDisplay, setScoreDisplay] = useState(0)
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Salva score no ranking
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
        date: new Date().toISOString(),
      }
      const stored = localStorage.getItem("guitar-duels-scores")
      const scores = stored ? JSON.parse(stored) : []
      scores.push(entry)
      scores.sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      localStorage.setItem("guitar-duels-scores", JSON.stringify(scores.slice(0, 100)))
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

  const gradeInfo = GRADE_DATA[grade] || { color: "#888", glow: "rgba(128,128,128,0.3)", label: "" }
  const totalHit = stats.perfect + stats.great + stats.good
  const totalNotes = stats.totalNotes

  const vol = (() => {
    try {
      const s = loadSettings()
      return (s.masterVolume / 100) * (s.sfxVolume / 100)
    } catch { return 0.5 }
  })()

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(12px)" }}
    >
      {/* Partículas de fundo para S rank */}
      {grade === "S" && <GoldParticles />}

      <div className="w-full max-w-sm mx-4 flex flex-col gap-4">

        {/* Grade + Título */}
        <div
          className="text-center transition-all duration-500"
          style={{
            opacity: phase !== "hidden" ? 1 : 0,
            transform: phase !== "hidden" ? "translateY(0) scale(1)" : "translateY(-30px) scale(0.8)",
          }}
        >
          {/* Grade círculo */}
          <div className="relative inline-flex items-center justify-center mb-3">
            {/* Anéis decorativos */}
            <div
              className="absolute rounded-full"
              style={{
                width: "140px", height: "140px",
                border: `1px solid ${gradeInfo.color}25`,
                animation: phase !== "hidden" ? "spin-slow 8s linear infinite" : "none",
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: "116px", height: "116px",
                border: `1px solid ${gradeInfo.color}15`,
                animation: phase !== "hidden" ? "spin-slow 12s linear infinite reverse" : "none",
              }}
            />
            {/* Círculo principal */}
            <div
              className="relative w-24 h-24 rounded-full flex items-center justify-center"
              style={{
                background: `radial-gradient(circle, ${gradeInfo.color}20, transparent 70%)`,
                border: `2px solid ${gradeInfo.color}50`,
                boxShadow: `0 0 50px ${gradeInfo.glow}, inset 0 0 20px ${gradeInfo.color}10`,
              }}
            >
              <span
                className="text-5xl font-black"
                style={{
                  color: gradeInfo.color,
                  textShadow: `0 0 30px ${gradeInfo.glow}`,
                }}
              >
                {grade}
              </span>
            </div>
          </div>

          <p
            className="text-xs font-bold tracking-[0.4em] uppercase mb-1"
            style={{ color: gradeInfo.color, opacity: 0.8 }}
          >
            {gradeInfo.label}
          </p>
          <h2 className="text-base font-bold text-white">{meta.name}</h2>
          <p className="text-white/35 text-xs">{meta.artist}</p>
        </div>

        {/* Stats card */}
        <div
          className="rounded-2xl overflow-hidden transition-all duration-500"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            opacity: phase === "stats" || phase === "buttons" ? 1 : 0,
            transform: phase === "stats" || phase === "buttons" ? "translateY(0)" : "translateY(15px)",
          }}
        >
          {/* Score principal */}
          <div
            className="text-center py-5 px-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            <p
              className="text-4xl font-black font-mono text-white"
              style={{ textShadow: `0 0 30px ${gradeInfo.glow}` }}
            >
              {scoreDisplay.toLocaleString()}
            </p>
            <p className="text-white/30 text-xs mt-1 tracking-widest uppercase">pontos</p>
          </div>

          {/* Métricas rápidas */}
          <div className="grid grid-cols-3 divide-x" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <MetricCell icon={<Target className="w-3 h-3" />} label="Precisão" value={`${accuracy}%`} color={accuracy >= 90 ? "#fbbf24" : "#fff"} />
            <MetricCell icon={<Zap className="w-3 h-3" />} label="Combo Máx." value={`${stats.maxCombo}x`} color="#eab308" />
            <MetricCell icon={<TrendingUp className="w-3 h-3" />} label="Notas" value={`${totalHit}/${totalNotes}`} color="#22c55e" />
          </div>

          {/* Breakdown de hits */}
          <div className="grid grid-cols-2 gap-2 p-3">
            <HitRow label="Perfect" value={stats.perfect} total={totalNotes} color="#fbbf24" />
            <HitRow label="Great"   value={stats.great}   total={totalNotes} color="#22c55e" />
            <HitRow label="Good"    value={stats.good}    total={totalNotes} color="#3b82f6" />
            <HitRow label="Miss"    value={stats.miss}    total={totalNotes} color="#ef4444" bad />
          </div>
        </div>

        {/* Botões */}
        <div
          className="flex gap-3 transition-all duration-500"
          style={{
            opacity: phase === "buttons" ? 1 : 0,
            transform: phase === "buttons" ? "translateY(0)" : "translateY(10px)",
          }}
        >
          <button
            onClick={() => { playClickSound(vol); onBack?.() }}
            className="flex items-center justify-center gap-2 flex-1 h-12 rounded-xl text-sm font-semibold transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]"
            style={{
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.45)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Menu
          </button>
          <button
            onClick={() => { playClickSound(vol); onRestart() }}
            className="flex items-center justify-center gap-2 flex-[2] h-12 rounded-xl text-sm font-bold transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]"
            style={{
              background: "linear-gradient(135deg, #e11d48, #be123c)",
              color: "#fff",
              boxShadow: "0 0 24px rgba(225,29,72,0.4), 0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            <RotateCcw className="w-4 h-4" />
            Jogar Novamente
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes float-up { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-80px) scale(0.3); opacity: 0; } }
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
    <div
      className="rounded-lg px-3 py-2"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
    >
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[10px] text-white/35 uppercase tracking-wide">{label}</span>
        <span className="text-xs font-bold font-mono" style={{ color }}>{value}</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: bad ? `linear-gradient(90deg, ${color}80, ${color})` : color,
            boxShadow: `0 0 6px ${color}80`,
          }}
        />
      </div>
    </div>
  )
}

function GoldParticles() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${2 + Math.random() * 4}px`,
            height: `${2 + Math.random() * 4}px`,
            background: i % 3 === 0 ? "#fbbf24" : i % 3 === 1 ? "#f97316" : "#fff",
            left: `${Math.random() * 100}%`,
            bottom: `${Math.random() * 30}%`,
            animation: `float-up ${2 + Math.random() * 3}s ease-out ${Math.random() * 2}s infinite`,
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  )
}
