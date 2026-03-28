"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { loadSettings, saveSettings } from "@/lib/settings"

interface KeyRemapModalProps {
  laneCount: number
  onClose: () => void
  onApply: (bindings: string[], spKey: string) => void
}

const LANE_NAMES_4 = ["Verde","Vermelho","Amarelo","Azul"]
const LANE_NAMES_5 = ["Verde","Vermelho","Amarelo","Azul","Laranja"]
const LANE_NAMES_6 = ["Verde","Vermelho","Amarelo","Azul","Laranja","Roxo"]
const LANE_COLORS  = ["#22c55e","#ef4444","#eab308","#3b82f6","#f97316","#a855f7"]

function prettyKey(k: string) {
  if (!k) return "—"
  if (k === " ") return "Espaço"
  if (k.length === 1) return k.toUpperCase()
  const map: Record<string,string> = {
    ArrowUp:"↑", ArrowDown:"↓", ArrowLeft:"←", ArrowRight:"→",
    Control:"Ctrl", Shift:"Shift", Alt:"Alt", Tab:"Tab",
    Enter:"Enter", Backspace:"←⌫", Escape:"Esc", Delete:"Del",
  }
  return map[k] ?? k
}

export function KeyRemapModal({ laneCount, onClose, onApply }: KeyRemapModalProps) {
  const settings   = loadSettings()
  const laneNames  = laneCount === 4 ? LANE_NAMES_4 : laneCount === 5 ? LANE_NAMES_5 : LANE_NAMES_6
  const initBindings = laneCount === 4 ? settings.keyBindings4
                     : laneCount === 5 ? settings.keyBindings5
                     : settings.keyBindings

  const [bindings,    setBindings]    = useState<string[]>([...initBindings])
  const [spKey,       setSpKey]       = useState(settings.starPowerKey ?? "r")
  const [listening,   setListening]   = useState<number | "sp" | null>(null)  // index or "sp"
  const [gpListening, setGpListening] = useState(false)
  const [gpSpBtn,     setGpSpBtn]     = useState(settings.gamepadSpButton ?? 4)
  const [conflict,    setConflict]    = useState("")
  const listenRef = useRef(listening)
  useEffect(() => { listenRef.current = listening }, [listening])

  // Capture keyboard
  useEffect(() => {
    if (listening === null) return
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      if (e.key === "Escape") { setListening(null); return }
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key

      if (listening === "sp") {
        // SP key cannot clash with lane bindings
        if (bindings.includes(key)) {
          setConflict(`"${prettyKey(key)}" já é uma tecla de lane`); return
        }
        setSpKey(key); setConflict(""); setListening(null); return
      }
      // Lane key
      if (key === spKey) {
        setConflict(`"${prettyKey(key)}" já é a tecla de Star Power`); return
      }
      const existIdx = bindings.indexOf(key)
      if (existIdx !== -1 && existIdx !== listening) {
        // Swap
        const next = [...bindings]
        next[existIdx] = next[listening as number]
        next[listening as number] = key
        setBindings(next); setConflict(""); setListening(null); return
      }
      const next = [...bindings]
      next[listening as number] = key
      setBindings(next); setConflict(""); setListening(null)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [listening, bindings, spKey])

  // Capture gamepad SP button
  useEffect(() => {
    if (!gpListening) return
    let frame: number
    const poll = () => {
      const gps = navigator.getGamepads?.()
      if (gps) {
        for (const gp of gps) {
          if (!gp) continue
          for (let i = 0; i < gp.buttons.length; i++) {
            if (gp.buttons[i].pressed) {
              setGpSpBtn(i); setGpListening(false); return
            }
          }
        }
      }
      frame = requestAnimationFrame(poll)
    }
    frame = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(frame)
  }, [gpListening])

  const handleApply = useCallback(() => {
    const s = loadSettings()
    if (laneCount === 4) s.keyBindings4 = bindings
    else if (laneCount === 5) s.keyBindings5 = bindings
    else s.keyBindings = bindings
    s.starPowerKey    = spKey
    s.gamepadSpButton = gpSpBtn
    saveSettings(s)
    // Dispatch storage event so hook picks it up
    window.dispatchEvent(new StorageEvent("storage", { key: "guitar-duels-settings" }))
    onApply(bindings, spKey)
  }, [bindings, spKey, gpSpBtn, laneCount, onApply])

  const handleReset = () => {
    const defaults4 = ["a","s","d","j"]
    const defaults5 = ["a","s","d","j","k"]
    const defaults6 = ["a","s","d","j","k","l"]
    const def = laneCount === 4 ? defaults4 : laneCount === 5 ? defaults5 : defaults6
    setBindings(def); setSpKey("r"); setGpSpBtn(4); setConflict("")
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(12px)" }}>
      <div className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
        style={{ background: "rgba(10,10,16,0.98)", border: "1px solid rgba(255,255,255,0.10)" }}>
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <h2 className="text-base font-black tracking-widest uppercase text-white">
            🎮 Remapear Teclas
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            Clique numa tecla e pressione a nova
          </p>
        </div>

        <div className="px-5 py-4 flex flex-col gap-2">
          {/* Lane keys */}
          {bindings.slice(0, laneCount).map((k, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: LANE_COLORS[i] }} />
              <span className="text-xs font-semibold flex-1" style={{ color: "rgba(255,255,255,0.60)" }}>
                {laneNames[i]}
              </span>
              <button
                onClick={() => { setListening(listening === i ? null : i); setConflict("") }}
                className="w-20 py-1.5 rounded-lg text-xs font-black text-center transition-all"
                style={{
                  background: listening === i ? "rgba(225,29,72,0.25)" : "rgba(255,255,255,0.07)",
                  border: `1px solid ${listening === i ? "rgba(225,29,72,0.6)" : "rgba(255,255,255,0.12)"}`,
                  color: listening === i ? "#f87171" : "#fff",
                  animation: listening === i ? "pulse-border 0.8s ease infinite" : "none",
                }}>
                {listening === i ? "..." : prettyKey(k)}
              </button>
            </div>
          ))}

          {/* Divider */}
          <div className="my-1 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }} />

          {/* Star Power key */}
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: "#f59e0b" }} />
            <span className="text-xs font-semibold flex-1" style={{ color: "rgba(255,255,255,0.60)" }}>
              ⚡ Star Power
            </span>
            <button
              onClick={() => { setListening(listening === "sp" ? null : "sp"); setConflict("") }}
              className="w-20 py-1.5 rounded-lg text-xs font-black text-center transition-all"
              style={{
                background: listening === "sp" ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.07)",
                border: `1px solid ${listening === "sp" ? "rgba(245,158,11,0.6)" : "rgba(255,255,255,0.12)"}`,
                color: listening === "sp" ? "#fcd34d" : "#fff",
              }}>
              {listening === "sp" ? "..." : prettyKey(spKey)}
            </button>
          </div>

          {/* Gamepad SP button */}
          <div className="flex items-center gap-3">
            <span className="text-sm flex-shrink-0">🎮</span>
            <span className="text-xs font-semibold flex-1" style={{ color: "rgba(255,255,255,0.60)" }}>
              SP Controle
            </span>
            <button
              onClick={() => setGpListening(l => !l)}
              className="w-20 py-1.5 rounded-lg text-xs font-black text-center transition-all"
              style={{
                background: gpListening ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.07)",
                border: `1px solid ${gpListening ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.12)"}`,
                color: gpListening ? "#a5b4fc" : "#fff",
              }}>
              {gpListening ? "..." : `Btn ${gpSpBtn}`}
            </button>
          </div>

          {/* Conflict warning */}
          {conflict && (
            <p className="text-xs text-center py-1 px-2 rounded-lg"
              style={{ color: "#fca5a5", background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)" }}>
              ⚠ {conflict}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={handleReset}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.50)" }}>
            Padrão
          </button>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.50)" }}>
            Cancelar
          </button>
          <button onClick={handleApply}
            className="flex-1 py-2.5 rounded-xl text-xs font-black transition-all"
            style={{ background: "linear-gradient(135deg,#e11d48,#be123c)", color: "#fff", boxShadow: "0 0 16px rgba(225,29,72,0.35)" }}>
            Aplicar
          </button>
        </div>
      </div>
      <style>{`@keyframes pulse-border { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  )
}
