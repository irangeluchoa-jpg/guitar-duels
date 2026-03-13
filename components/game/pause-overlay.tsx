"use client"

import { useState, useEffect } from "react"
import { Play, RotateCcw, ArrowLeft, Settings, Volume2, Gauge, Eye, Minus, Plus } from "lucide-react"
import { playClickSound } from "@/lib/game/sounds"
import { loadSettings, saveSettings, type GameSettings } from "@/lib/settings"

interface PauseOverlayProps {
  onResume: () => void
  onRestart: () => void
  onQuit?: () => void
}

const NOTE_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

export function PauseOverlay({ onResume, onRestart, onQuit }: PauseOverlayProps) {
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<GameSettings>(loadSettings)
  const [saved, setSaved] = useState(false)

  const vol = (settings.masterVolume / 100) * (settings.sfxVolume / 100)

  function update<K extends keyof GameSettings>(key: K, value: GameSettings[K]) {
    const next = { ...settings, [key]: value }
    setSettings(next)
    saveSettings(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
  }

  function stepSpeed(dir: 1 | -1) {
    const idx = NOTE_SPEEDS.indexOf(settings.noteSpeed)
    const next = NOTE_SPEEDS[Math.max(0, Math.min(NOTE_SPEEDS.length - 1, idx + dir))]
    if (next !== undefined) update("noteSpeed", next)
    playClickSound(vol)
  }

  useEffect(() => { setSettings(loadSettings()) }, [])

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
    >
      <div
        className="flex flex-col items-center gap-4 w-72"
        style={{ animation: "pause-in 0.22s cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center gap-3 justify-center mb-1">
            <div className="h-px w-10" style={{ background: "linear-gradient(90deg,transparent,rgba(225,29,72,0.6))" }} />
            <div className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(225,29,72,0.15)", border: "1px solid rgba(225,29,72,0.3)" }}>
              <div className="flex gap-1">
                <div className="w-1 h-4 rounded-full" style={{ background: "#e11d48" }} />
                <div className="w-1 h-4 rounded-full" style={{ background: "#e11d48" }} />
              </div>
            </div>
            <div className="h-px w-10" style={{ background: "linear-gradient(90deg,rgba(225,29,72,0.6),transparent)" }} />
          </div>
          <h2 className="text-xl font-black tracking-[0.25em] uppercase" style={{ color: "rgba(255,255,255,0.8)" }}>
            {showSettings ? "Configurações" : "Pausado"}
          </h2>
          {saved && <p className="text-[10px] mt-0.5" style={{ color: "#4ade80" }}>✓ Salvo</p>}
        </div>

        {!showSettings ? (
          /* ── Menu principal ── */
          <div className="flex flex-col gap-2.5 w-full">
            <button onClick={() => { playClickSound(vol); onResume() }}
              className="flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-sm transition-all hover:scale-[1.03] active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg,#e11d48,#be123c)", color: "#fff", boxShadow: "0 0 24px rgba(225,29,72,0.35)" }}>
              <Play className="w-4 h-4 fill-current" /> Continuar
            </button>

            {/* Velocidade rápida — direto no pause sem entrar em configurações */}
            <div className="rounded-xl px-3 py-2.5 flex items-center gap-3"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Gauge className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(255,255,255,0.35)" }} />
              <span className="text-xs font-semibold flex-1" style={{ color: "rgba(255,255,255,0.5)" }}>Velocidade</span>
              <div className="flex items-center gap-2">
                <button onClick={() => stepSpeed(-1)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
                  disabled={settings.noteSpeed <= NOTE_SPEEDS[0]}>
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-black w-10 text-center" style={{ color: "#fbbf24" }}>{settings.noteSpeed}x</span>
                <button onClick={() => stepSpeed(1)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
                  disabled={settings.noteSpeed >= NOTE_SPEEDS[NOTE_SPEEDS.length - 1]}>
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <button onClick={() => { playClickSound(vol); setShowSettings(true) }}
              className="flex items-center justify-center gap-2 h-12 rounded-xl font-semibold text-sm transition-all hover:scale-[1.03] active:scale-[0.97]"
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Settings className="w-4 h-4" /> Mais configurações
            </button>

            <button onClick={() => { playClickSound(vol); onRestart() }}
              className="flex items-center justify-center gap-2 h-12 rounded-xl font-semibold text-sm transition-all hover:scale-[1.03] active:scale-[0.97]"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <RotateCcw className="w-4 h-4" /> Reiniciar
            </button>

            <button onClick={() => { playClickSound(vol); onQuit?.() }}
              className="flex items-center justify-center gap-2 h-11 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.97]"
              style={{ background: "rgba(255,255,255,0.025)", color: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <ArrowLeft className="w-4 h-4" /> Sair
            </button>
          </div>
        ) : (
          /* ── Configurações inline ── */
          <div className="flex flex-col gap-3 w-full">

            {/* Volume Master */}
            <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Volume2 className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.4)" }} />
                <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Volume</span>
                <span className="ml-auto text-xs font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>{settings.masterVolume}%</span>
              </div>
              <input type="range" min={0} max={100} step={5} value={settings.masterVolume}
                onChange={e => update("masterVolume", +e.target.value)}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: "#e11d48" }} />
            </div>

            {/* Velocidade das notas */}
            <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.4)" }} />
                <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Velocidade das notas</span>
              </div>
              <div className="flex gap-1">
                {NOTE_SPEEDS.map(s => (
                  <button key={s} onClick={() => update("noteSpeed", s)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: settings.noteSpeed === s ? "#e11d48" : "rgba(255,255,255,0.07)",
                      color: settings.noteSpeed === s ? "#fff" : "rgba(255,255,255,0.4)",
                      border: settings.noteSpeed === s ? "1px solid rgba(255,100,100,0.4)" : "1px solid transparent",
                    }}>
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Guia de notas */}
            <div className="flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.4)" }} />
                <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Guia visual</span>
              </div>
              <button onClick={() => update("showGuide", !settings.showGuide)}
                className="w-10 h-5 rounded-full transition-all relative"
                style={{ background: settings.showGuide ? "#e11d48" : "rgba(255,255,255,0.12)" }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                  style={{ left: settings.showGuide ? "calc(100% - 18px)" : "2px" }} />
              </button>
            </div>

            {/* Calibração */}
            <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Calibração de áudio</span>
                <span className="ml-auto text-xs font-bold" style={{ color: settings.calibrationOffset !== 0 ? "#fbbf24" : "rgba(255,255,255,0.4)" }}>
                  {settings.calibrationOffset > 0 ? "+" : ""}{settings.calibrationOffset}ms
                </span>
              </div>
              <input type="range" min={-150} max={150} step={5} value={settings.calibrationOffset}
                onChange={e => update("calibrationOffset", +e.target.value)}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: "#fbbf24" }} />
            </div>

            <button onClick={() => setShowSettings(false)}
              className="flex items-center justify-center gap-2 h-10 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02]"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
              ← Voltar
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pause-in {
          from { opacity:0; transform:scale(0.9) translateY(8px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
