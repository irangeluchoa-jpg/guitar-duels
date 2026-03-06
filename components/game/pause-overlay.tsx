"use client"

import { Play, RotateCcw, ArrowLeft } from "lucide-react"
import { playClickSound } from "@/lib/game/sounds"
import { loadSettings } from "@/lib/settings"

interface PauseOverlayProps {
  onResume: () => void
  onRestart: () => void
  onQuit?: () => void
}

export function PauseOverlay({ onResume, onRestart, onQuit }: PauseOverlayProps) {
  const vol = (() => {
    try {
      const s = loadSettings()
      return (s.masterVolume / 100) * (s.sfxVolume / 100)
    } catch { return 0.5 }
  })()

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" }}
    >
      {/* Decorative lines */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-px"
            style={{
              left: `${10 + i * 15}%`,
              background: "linear-gradient(180deg, transparent, #fff 30%, #fff 70%, transparent)",
            }}
          />
        ))}
      </div>

      <div
        className="flex flex-col items-center gap-6 w-60"
        style={{ animation: "pause-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
      >
        {/* Title */}
        <div className="text-center">
          <div className="flex items-center gap-3 justify-center mb-1">
            <div className="h-px w-10" style={{ background: "linear-gradient(90deg, transparent, rgba(225,29,72,0.6))" }} />
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(225,29,72,0.15)", border: "1px solid rgba(225,29,72,0.3)" }}
            >
              <div className="flex gap-1">
                <div className="w-1 h-4 rounded-full" style={{ background: "#e11d48" }} />
                <div className="w-1 h-4 rounded-full" style={{ background: "#e11d48" }} />
              </div>
            </div>
            <div className="h-px w-10" style={{ background: "linear-gradient(90deg, rgba(225,29,72,0.6), transparent)" }} />
          </div>
          <h2
            className="text-xl font-black tracking-[0.25em] uppercase"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            Pausado
          </h2>
        </div>

        <div className="flex flex-col gap-2.5 w-full">
          <button
            onClick={() => { playClickSound(vol); onResume() }}
            className="flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-sm transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]"
            style={{
              background: "linear-gradient(135deg, #e11d48, #be123c)",
              color: "#fff",
              boxShadow: "0 0 24px rgba(225,29,72,0.35), 0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            <Play className="w-4 h-4 fill-current" />
            Continuar
          </button>
          <button
            onClick={() => { playClickSound(vol); onRestart() }}
            className="flex items-center justify-center gap-2 h-12 rounded-xl font-semibold text-sm transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.55)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <RotateCcw className="w-4 h-4" />
            Reiniciar
          </button>
          <button
            onClick={() => { playClickSound(vol); onQuit?.() }}
            className="flex items-center justify-center gap-2 h-11 rounded-xl font-semibold text-sm transition-all duration-150 hover:scale-[1.02] active:scale-[0.97]"
            style={{
              background: "rgba(255,255,255,0.025)",
              color: "rgba(255,255,255,0.25)",
              border: "1px solid rgba(255,255,255,0.04)",
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pause-in {
          from { opacity: 0; transform: scale(0.9) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
