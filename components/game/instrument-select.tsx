"use client"

import { useState } from "react"
import type { InstrumentTrack, SongMeta } from "@/lib/songs/types"

interface InstrumentSelectProps {
  meta: SongMeta
  instruments: InstrumentTrack[]
  onSelect: (instrument: InstrumentTrack) => void
  onBack: () => void
}

export function InstrumentSelect({ meta, instruments, onSelect, onBack }: InstrumentSelectProps) {
  const [selected, setSelected] = useState<string>(instruments[0]?.key ?? "")

  const selectedInstr = instruments.find(i => i.key === selected) ?? instruments[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.95)" }}>

      {/* Scanlines */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, white 2px, white 4px)" }} />

      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, rgba(225,29,72,0.06) 0%, transparent 70%)" }} />

      <div className="relative z-10 w-full max-w-md mx-4 flex flex-col gap-6">

        {/* Header */}
        <div className="text-center">
          <p className="text-xs text-white/30 uppercase tracking-widest mb-1">Escolha o instrumento</p>
          <h2 className="text-xl font-black text-white">{meta.name}</h2>
          <p className="text-sm text-white/40">{meta.artist}</p>
        </div>

        {/* Instrument grid */}
        <div className="grid grid-cols-2 gap-3">
          {instruments.map(instr => {
            const isSelected = selected === instr.key
            return (
              <button
                key={instr.key}
                onClick={() => setSelected(instr.key)}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]"
                style={{
                  background: isSelected ? "rgba(225,29,72,0.15)" : "rgba(255,255,255,0.04)",
                  border: isSelected ? "2px solid rgba(225,29,72,0.6)" : "2px solid rgba(255,255,255,0.08)",
                  boxShadow: isSelected ? "0 0 20px rgba(225,29,72,0.2)" : "none",
                }}
              >
                <span className="text-4xl">{instr.icon}</span>
                <span className="text-sm font-bold text-white">{instr.label}</span>
                {isSelected && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "rgba(225,29,72,0.3)", color: "#fca5a5" }}>
                    Selecionado
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Confirm */}
        <button
          onClick={() => selectedInstr && onSelect(selectedInstr)}
          disabled={!selectedInstr}
          className="w-full h-14 rounded-2xl font-black text-lg tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30"
          style={{
            background: "linear-gradient(135deg, #e11d48, #be123c)",
            color: "#fff",
            boxShadow: "0 0 30px rgba(225,29,72,0.35)",
          }}
        >
          {selectedInstr?.icon} Tocar {selectedInstr?.label}
        </button>

        {/* Back */}
        <button onClick={onBack}
          className="text-sm text-white/30 hover:text-white/60 transition-colors text-center">
          ← Voltar para seleção de música
        </button>
      </div>
    </div>
  )
}
