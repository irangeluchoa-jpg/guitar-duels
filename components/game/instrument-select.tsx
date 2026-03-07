"use client"

import { useState } from "react"

interface InstrumentTrack {
  key: string; label: string; icon: string; url: string
}

interface Props {
  songName: string
  artist: string
  instruments: InstrumentTrack[]
  onSelect: (instrument: InstrumentTrack) => void
  onBack: () => void
}

export function InstrumentSelect({ songName, artist, instruments, onSelect, onBack }: Props) {
  const [selected, setSelected] = useState<string>(instruments[0]?.key ?? "")
  const selectedInstr = instruments.find(i => i.key === selected) ?? instruments[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.96)" }}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,white 2px,white 4px)" }} />

      <div className="relative z-10 w-full max-w-md mx-4 flex flex-col gap-6">
        <div className="text-center">
          <p className="text-xs text-white/30 uppercase tracking-widest mb-1">Escolha o instrumento</p>
          <h2 className="text-xl font-black text-white">{songName}</h2>
          <p className="text-sm text-white/40">{artist}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {instruments.map(instr => {
            const isSel = selected === instr.key
            return (
              <button key={instr.key} onClick={() => setSelected(instr.key)}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]"
                style={{
                  background: isSel ? "rgba(225,29,72,0.15)" : "rgba(255,255,255,0.04)",
                  border: isSel ? "2px solid rgba(225,29,72,0.6)" : "2px solid rgba(255,255,255,0.08)",
                  boxShadow: isSel ? "0 0 20px rgba(225,29,72,0.2)" : "none",
                }}>
                <span className="text-4xl">{instr.icon}</span>
                <span className="text-sm font-bold text-white">{instr.label}</span>
                {isSel && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "rgba(225,29,72,0.3)", color: "#fca5a5" }}>
                    Selecionado
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <button onClick={() => selectedInstr && onSelect(selectedInstr)}
          disabled={!selectedInstr}
          className="w-full h-14 rounded-2xl font-black text-lg tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30"
          style={{ background: "linear-gradient(135deg,#e11d48,#be123c)", color: "#fff", boxShadow: "0 0 30px rgba(225,29,72,0.35)" }}>
          {selectedInstr?.icon} Tocar {selectedInstr?.label}
        </button>

        <button onClick={onBack} className="text-sm text-white/30 hover:text-white/60 transition-colors text-center">
          ← Voltar
        </button>
      </div>
    </div>
  )
}
