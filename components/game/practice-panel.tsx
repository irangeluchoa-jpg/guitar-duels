"use client"

import { useState, useCallback } from "react"
import { BookOpen, Play, ChevronDown, ChevronUp, RotateCcw } from "lucide-react"
import type { PracticeConfig } from "@/lib/game/engine"
import { PRACTICE_SPEEDS } from "@/lib/game/engine"

interface PracticePanelProps {
  songLengthMs: number
  config: PracticeConfig
  onChange: (c: PracticeConfig) => void
  onMarkStart: () => void
  onMarkEnd: () => void
  currentMs: number
}

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`
}

export function PracticePanel({
  songLengthMs, config, onChange, onMarkStart, onMarkEnd, currentMs
}: PracticePanelProps) {
  const [open, setOpen] = useState(false)

  const toggle = () => {
    onChange({ ...config, enabled: !config.enabled })
  }

  return (
    <div style={{
      position: "absolute", bottom: "52px", right: "8px",
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
      border: "1px solid rgba(249,115,22,0.35)", borderRadius: "10px",
      minWidth: "180px", zIndex: 30, overflow: "hidden",
      boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "7px 10px", background: "none", border: "none", cursor: "pointer",
          color: config.enabled ? "#f97316" : "rgba(255,255,255,0.6)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "0.75rem" }}>
          <BookOpen size={13} />
          MODO PRÁTICA
          {config.enabled && (
            <span style={{ background: "#f97316", color: "#000", fontSize: "0.55rem",
              padding: "1px 4px", borderRadius: "3px", fontWeight: 900 }}>ON</span>
          )}
        </span>
        {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
      </button>

      {open && (
        <div style={{ padding: "8px 10px 10px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {/* Enable toggle */}
          <button
            onClick={toggle}
            style={{
              width: "100%", padding: "5px", borderRadius: "6px", border: "none",
              background: config.enabled ? "rgba(249,115,22,0.25)" : "rgba(255,255,255,0.08)",
              color: config.enabled ? "#f97316" : "rgba(255,255,255,0.5)",
              fontWeight: 700, fontSize: "0.7rem", cursor: "pointer", marginBottom: "8px",
            }}
          >
            {config.enabled ? "✓ ATIVO" : "ATIVAR"}
          </button>

          {/* Speed */}
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)", marginBottom: "4px", letterSpacing: "1px" }}>
            VELOCIDADE
          </div>
          <div style={{ display: "flex", gap: "4px", marginBottom: "10px" }}>
            {PRACTICE_SPEEDS.map(s => (
              <button key={s}
                onClick={() => onChange({ ...config, speed: s })}
                style={{
                  flex: 1, padding: "4px 0", borderRadius: "5px", border: "none",
                  background: config.speed === s ? "rgba(249,115,22,0.35)" : "rgba(255,255,255,0.07)",
                  color: config.speed === s ? "#f97316" : "rgba(255,255,255,0.5)",
                  fontWeight: 700, fontSize: "0.65rem", cursor: "pointer",
                }}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Loop markers */}
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)", marginBottom: "4px", letterSpacing: "1px" }}>
            TRECHO DO LOOP
          </div>
          <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
            <button onClick={onMarkStart} style={{
              flex: 1, padding: "4px", borderRadius: "5px", border: "1px solid rgba(34,197,94,0.3)",
              background: "rgba(34,197,94,0.08)", color: "#22c55e", fontSize: "0.6rem",
              fontWeight: 700, cursor: "pointer",
            }}>
              ▶ {fmtMs(config.loopStart)}
            </button>
            <button onClick={onMarkEnd} style={{
              flex: 1, padding: "4px", borderRadius: "5px", border: "1px solid rgba(239,68,68,0.3)",
              background: "rgba(239,68,68,0.08)", color: "#ef4444", fontSize: "0.6rem",
              fontWeight: 700, cursor: "pointer",
            }}>
              ◼ {fmtMs(config.loopEnd)}
            </button>
          </div>

          <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
            Posição atual: {fmtMs(currentMs)}
          </div>
          <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: "2px" }}>
            Pressione [W] para whammy
          </div>
        </div>
      )}
    </div>
  )
}
