"use client"

import { useEffect, useRef, useState } from "react"
import type { GameStats } from "@/lib/game/engine"

interface GameHUDProps {
  stats: GameStats
  accuracy: number
}

export function GameHUD({ stats, accuracy }: GameHUDProps) {
  const [flashAccuracy, setFlashAccuracy] = useState(false)
  const prevAccuracy = useRef(accuracy)

  useEffect(() => {
    if (accuracy !== prevAccuracy.current) {
      prevAccuracy.current = accuracy
      setFlashAccuracy(true)
      const t = setTimeout(() => setFlashAccuracy(false), 300)
      return () => clearTimeout(t)
    }
  }, [accuracy])

  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
      {/* Accuracy */}
      <div
        className="rounded-lg px-3 py-1.5 flex items-center gap-2"
        style={{
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.08)",
          transition: "all 0.2s",
          boxShadow: flashAccuracy ? "0 0 12px rgba(255,255,255,0.2)" : "none",
        }}
      >
        <span
          className="text-sm font-bold font-mono"
          style={{
            color: accuracy >= 95 ? "#fbbf24" : accuracy >= 80 ? "#22c55e" : accuracy >= 60 ? "#3b82f6" : "#ef4444",
            textShadow: flashAccuracy ? "0 0 12px currentColor" : "none",
            transition: "color 0.3s",
          }}
        >
          {accuracy}%
        </span>
        <span className="text-[10px] text-white/25 uppercase tracking-widest">precisão</span>
      </div>

      {/* Stats pills */}
      <div
        className="flex gap-1.5 px-2 py-1.5 rounded-lg"
        style={{
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <AnimatedStatPill label="P" value={stats.perfect} color="#fbbf24" />
        <AnimatedStatPill label="G" value={stats.great}   color="#22c55e" />
        <AnimatedStatPill label="OK" value={stats.good}   color="#3b82f6" />
        <AnimatedStatPill label="✕" value={stats.miss}    color="#ef4444" />
      </div>
    </div>
  )
}

function AnimatedStatPill({ label, value, color }: { label: string; value: number; color: string }) {
  const [flash, setFlash] = useState(false)
  const prev = useRef(value)

  useEffect(() => {
    if (value !== prev.current) {
      prev.current = value
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 250)
      return () => clearTimeout(t)
    }
  }, [value])

  return (
    <div
      className="flex items-center gap-1 rounded-md px-2 py-0.5 transition-all duration-200"
      style={{
        backgroundColor: flash ? color + "35" : color + "15",
        color,
        boxShadow: flash ? `0 0 8px ${color}60` : "none",
        transform: flash ? "scale(1.1)" : "scale(1)",
      }}
    >
      <span className="text-[9px] font-black tracking-wide">{label}</span>
      <span className="text-xs font-mono font-bold">{value}</span>
    </div>
  )
}
