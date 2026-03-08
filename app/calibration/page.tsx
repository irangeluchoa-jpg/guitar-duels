"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Play, Square, RefreshCw, CheckCircle } from "lucide-react"
import { loadSettings, saveSettings } from "@/lib/settings"

const BPM = 80
const BEAT_MS = (60 / BPM) * 1000   // ~750ms por beat
const TAP_COUNT = 8                  // número de taps para calcular média
const MAX_OFFSET = 200               // ±200ms de range

function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)) }

export default function CalibrationPage() {
  const router  = useRouter()
  const audioCtx = useRef<AudioContext | null>(null)
  const nextBeat  = useRef(0)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTime = useRef(0)
  const beatCount = useRef(0)
  const [isPlaying, setIsPlaying]   = useState(false)
  const [pulse, setPulse]           = useState(false)
  const [taps, setTaps]             = useState<number[]>([])
  const [offset, setOffset]         = useState(0)
  const [saved, setSaved]           = useState(false)
  const [currentBeat, setCurrentBeat] = useState(0)

  // Carrega offset atual
  useEffect(() => {
    setOffset(loadSettings().calibrationOffset)
  }, [])

  // Cria AudioContext ao montar
  useEffect(() => {
    audioCtx.current = new AudioContext()
    return () => { audioCtx.current?.close() }
  }, [])

  // Toca um clique de metrônomo
  const playClick = useCallback((accent = false) => {
    const ctx = audioCtx.current
    if (!ctx) return
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = accent ? 1200 : 800
    gain.gain.setValueAtTime(accent ? 0.5 : 0.32, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.07)
  }, [])

  // Loop do metrônomo
  const scheduleBeat = useCallback(() => {
    const now = Date.now()
    if (now >= nextBeat.current) {
      beatCount.current++
      const accent = beatCount.current % 4 === 1
      playClick(accent)
      setPulse(true)
      setCurrentBeat(beatCount.current)
      setTimeout(() => setPulse(false), 80)
      nextBeat.current = now + BEAT_MS
    }
    timerRef.current = setTimeout(scheduleBeat, 4)
  }, [playClick])

  const start = useCallback(() => {
    if (audioCtx.current?.state === "suspended") audioCtx.current.resume()
    beatCount.current = 0
    nextBeat.current  = Date.now()
    startTime.current = Date.now()
    setTaps([])
    setIsPlaying(true)
    scheduleBeat()
  }, [scheduleBeat])

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setIsPlaying(false)
    setPulse(false)
  }, [])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  // Tap do usuário — calcula diferença ao beat mais próximo
  const handleTap = useCallback(() => {
    if (!isPlaying) return
    const now = Date.now()
    // Calcula fase do metrônomo no momento do tap
    const elapsed   = now - startTime.current
    const beatPhase = elapsed % BEAT_MS
    // Diferença ao beat anterior e ao próximo
    const diffPrev  = beatPhase                   // distância ao beat anterior
    const diffNext  = BEAT_MS - beatPhase         // distância ao próximo beat
    const diff      = diffPrev < diffNext ? -diffPrev : diffNext   // negativo = atrasado, positivo = adiantado

    setTaps((prev: number[]) => {
      const next = [...prev, diff].slice(-TAP_COUNT)
      if (next.length >= 4) {
        const avg = Math.round(next.reduce((a, b) => a + b, 0) / next.length)
        setOffset(clamp(avg, -MAX_OFFSET, MAX_OFFSET))
      }
      return next
    })
  }, [isPlaying])

  // Tecla Space como tap
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); handleTap() }
      if (e.code === "Escape") router.push("/settings")
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [handleTap, router])

  const applyAndSave = () => {
    const s = loadSettings()
    saveSettings({ ...s, calibrationOffset: offset })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const reset = () => {
    setOffset(0)
    setTaps([])
    const s = loadSettings()
    saveSettings({ ...s, calibrationOffset: 0 })
  }

  const offsetColor = Math.abs(offset) < 20 ? "#22c55e" : Math.abs(offset) < 60 ? "#f97316" : "#ef4444"
  const barW = ((offset + MAX_OFFSET) / (MAX_OFFSET * 2)) * 100

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "#060608", fontFamily: "'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800;900&display=swap');
        .bebas { font-family: 'Bebas Neue','Impact',sans-serif !important; }
        @keyframes pulse-ring { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.6);opacity:0} }
      `}</style>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 flex items-center gap-4 px-6 py-4 z-10"
        style={{ background: "rgba(6,6,8,0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={() => { stop(); router.push("/settings") }}
          className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl transition-all hover:scale-105"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
          <ArrowLeft className="w-4 h-4" /> Configurações
        </button>
        <h1 className="bebas text-2xl tracking-[0.2em]" style={{ color: "rgba(255,180,60,0.8)" }}>CALIBRAÇÃO DE ÁUDIO</h1>
      </div>

      <div className="w-full max-w-lg space-y-8 mt-16">

        {/* Instrução */}
        <div className="text-center space-y-1">
          <p className="text-white/60 text-sm">
            Pressione <kbd className="px-2 py-0.5 rounded-md text-xs font-mono" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>SPACE</kbd> ou o botão abaixo
            no ritmo exato do metrônomo
          </p>
          <p className="text-white/30 text-xs">O jogo vai ajustar automaticamente com base nos seus taps</p>
        </div>

        {/* Metrônomo visual */}
        <div className="flex flex-col items-center gap-6">
          {/* Batida visual */}
          <div className="relative flex items-center justify-center">
            {pulse && (
              <div className="absolute rounded-full"
                style={{ width: 120, height: 120, background: "rgba(225,29,72,0.2)", animation: "pulse-ring 0.4s ease-out forwards" }}/>
            )}
            <div className="w-28 h-28 rounded-full flex items-center justify-center transition-all duration-75"
              style={{
                background: pulse
                  ? "radial-gradient(circle, rgba(225,29,72,0.4), rgba(225,29,72,0.1))"
                  : "rgba(255,255,255,0.04)",
                border: pulse
                  ? "2px solid rgba(225,29,72,0.8)"
                  : "2px solid rgba(255,255,255,0.08)",
                transform: pulse ? "scale(1.08)" : "scale(1)",
                boxShadow: pulse ? "0 0 40px rgba(225,29,72,0.4)" : "none",
              }}>
              <span className="bebas text-4xl" style={{ color: pulse ? "#e11d48" : "rgba(255,255,255,0.15)" }}>
                {isPlaying ? ((currentBeat - 1) % 4) + 1 : "•"}
              </span>
            </div>
          </div>

          {/* BPM badge */}
          <div className="text-xs font-bold px-3 py-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.1)" }}>
            {BPM} BPM
          </div>

          {/* Controles play/stop */}
          <div className="flex gap-3">
            {!isPlaying ? (
              <button onClick={start}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all hover:scale-105 active:scale-95"
                style={{ background: "linear-gradient(135deg,#991b1b,#dc2626)", color: "#fff", boxShadow: "0 0 20px rgba(220,38,38,0.3)" }}>
                <Play className="w-4 h-4" /> Iniciar Metrônomo
              </button>
            ) : (
              <button onClick={stop}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all hover:scale-105 active:scale-95"
                style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}>
                <Square className="w-4 h-4" /> Parar
              </button>
            )}

            {isPlaying && (
              <button onClick={handleTap}
                className="flex items-center gap-2 px-8 py-3 rounded-2xl font-black text-lg transition-all active:scale-95"
                style={{
                  background: "linear-gradient(135deg,#1e3a5f,#2563eb)",
                  color: "#fff", boxShadow: "0 0 20px rgba(37,99,235,0.3)",
                  transform: "scale(1)",
                }}>
                TAP
              </button>
            )}
          </div>

          {/* Taps coletados */}
          {taps.length > 0 && (
            <div className="flex gap-1.5 items-center">
              {Array.from({ length: TAP_COUNT }).map((_, i) => (
                <div key={i} className="w-2.5 h-2.5 rounded-full transition-all"
                  style={{ background: i < taps.length ? "#3b82f6" : "rgba(255,255,255,0.1)" }}/>
              ))}
              <span className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.3)" }}>{taps.length}/{TAP_COUNT} taps</span>
            </div>
          )}
        </div>

        {/* Offset medido */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white/60">Offset Calculado</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black font-mono" style={{ color: offsetColor }}>
                {offset > 0 ? "+" : ""}{offset}ms
              </span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                {Math.abs(offset) < 20 ? "✓ ótimo" : Math.abs(offset) < 60 ? "razoável" : "ajuste necessário"}
              </span>
            </div>
          </div>

          {/* Barra de offset */}
          <div className="relative h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
            {/* Centro = 0ms */}
            <div className="absolute top-0 bottom-0 w-0.5 left-1/2 -translate-x-1/2" style={{ background: "rgba(255,255,255,0.2)" }}/>
            <div className="absolute top-0 h-full rounded-full transition-all duration-300"
              style={{ left: `${Math.min(barW, 50)}%`, width: `${Math.abs(offset) / MAX_OFFSET * 50}%`, background: offsetColor, opacity: 0.7 }}/>
          </div>
          <div className="flex justify-between text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
            <span>Atrasado -{MAX_OFFSET}ms</span>
            <span>0ms</span>
            <span>+{MAX_OFFSET}ms Adiantado</span>
          </div>

          {/* Ajuste manual fino */}
          <div className="space-y-2">
            <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>Ajuste Manual</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setOffset(o => clamp(o - 5, -MAX_OFFSET, MAX_OFFSET))}
                className="w-8 h-8 rounded-lg font-black transition-all hover:scale-110 active:scale-95"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}>−</button>
              <input type="range" min={-MAX_OFFSET} max={MAX_OFFSET} value={offset}
                onChange={e => setOffset(Number(e.target.value))}
                className="flex-1 accent-red-500 h-1.5 rounded-full"/>
              <button onClick={() => setOffset(o => clamp(o + 5, -MAX_OFFSET, MAX_OFFSET))}
                className="w-8 h-8 rounded-lg font-black transition-all hover:scale-110 active:scale-95"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}>+</button>
            </div>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex gap-3">
          <button onClick={reset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}>
            <RefreshCw className="w-3.5 h-3.5" /> Zerar
          </button>

          <button onClick={applyAndSave}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm transition-all hover:scale-105 active:scale-95"
            style={{
              background: saved ? "rgba(34,197,94,0.2)" : "linear-gradient(135deg,#1a1a2e,#e11d48)",
              border: saved ? "1px solid rgba(34,197,94,0.5)" : "none",
              color: saved ? "#22c55e" : "#fff",
              boxShadow: saved ? "0 0 20px rgba(34,197,94,0.2)" : "0 0 20px rgba(225,29,72,0.25)",
            }}>
            {saved ? <><CheckCircle className="w-4 h-4"/> Salvo!</> : "Aplicar e Salvar"}
          </button>
        </div>

        <p className="text-center text-[11px]" style={{ color: "rgba(255,255,255,0.15)" }}>
          Use também o slider de Calibração em Opções → Gameplay para ajustar manualmente.
        </p>
      </div>
    </div>
  )
}
