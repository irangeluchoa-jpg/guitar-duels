"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Volume2, Gauge, Eye, Keyboard, RotateCcw, AlertTriangle } from "lucide-react"
import { loadSettings, saveSettings, DEFAULT_SETTINGS, DEFAULT_KEY_BINDINGS, DEFAULT_KEY_BINDINGS4, DEFAULT_KEY_BINDINGS5, type GameSettings } from "@/lib/settings"
import { loadGamepadBindings, saveGamepadBindings, DEFAULT_GAMEPAD_BINDINGS, GAMEPAD_PROFILES, detectProfile, type GamepadProfile } from "@/hooks/use-gamepad"
import { playClickSound, playHoverSound, playHitSound } from "@/lib/game/sounds"

const LANE_COLORS = ["#22c55e", "#ef4444", "#eab308", "#3b82f6", "#f97316", "#a855f7"]
const LANE_NAMES  = ["Verde", "Vermelho", "Amarelo", "Azul", "Laranja", "Roxo"]

const LANE_MODE_OPTS = [
  { count: 4 as const, label: "Fácil",   desc: "4 lanes",  color: "#3b82f6", keys: DEFAULT_KEY_BINDINGS4, bindKey: "keyBindings4" as const },
  { count: 5 as const, label: "Normal",  desc: "5 lanes",  color: "#22c55e", keys: DEFAULT_KEY_BINDINGS5, bindKey: "keyBindings5" as const },
  { count: 6 as const, label: "Difícil", desc: "6 lanes",  color: "#e11d48", keys: DEFAULT_KEY_BINDINGS,  bindKey: "keyBindings"  as const },
]

function getVol(s: GameSettings) {
  return (s.masterVolume / 100) * (s.sfxVolume / 100)
}

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)

  // Gamepad state
  const [gamepadConnected, setGamepadConnected] = useState(false)
  const [gamepadName, setGamepadName] = useState<string>("")
  const [gamepadBindings, setGamepadBindings] = useState<number[]>([...DEFAULT_GAMEPAD_BINDINGS])
  const [listeningGamepad, setListeningGamepad] = useState<number | null>(null)
  const listeningGamepadRef = useRef<number | null>(null)

  // Key binding state
  const [listeningFor, setListeningFor] = useState<number | null>(null)  // lane index
  const [keyMode, setKeyMode] = useState<4|5|6>(5)  // modo de lanes sendo editado
  const [conflict, setConflict] = useState<string | null>(null)           // conflict message
  const listenRef = useRef<number | null>(null)

  useEffect(() => {
    setSettings(loadSettings())
    setGamepadBindings(loadGamepadBindings())
  }, [])

  // Gamepad detection — polling ativo (necessário para Bluetooth e alguns controles)
  // Eventos gamepadconnected não são confiáveis via Bluetooth; polling a cada 500ms resolve
  useEffect(() => {
    let raf: number
    let lastConnected = false
    let lastName = ""

    const poll = () => {
      const gps = navigator.getGamepads?.() ?? []
      let found = false
      let foundName = ""
      for (const gp of gps) {
        if (gp?.connected) { found = true; foundName = gp.id; break }
      }
      if (found !== lastConnected || foundName !== lastName) {
        setGamepadConnected(found)
        setGamepadName(foundName)
        lastConnected = found
        lastName = foundName
      }
    }

    // Eventos como fallback
    const onConnect    = (e: GamepadEvent) => { setGamepadConnected(true);  setGamepadName(e.gamepad.id) }
    const onDisconnect = ()                 => { setGamepadConnected(false); setGamepadName("") }
    window.addEventListener("gamepadconnected",    onConnect)
    window.addEventListener("gamepaddisconnected", onDisconnect)

    // Poll a cada 500ms (necessário para Bluetooth)
    const interval = setInterval(poll, 500)
    poll() // imediato

    return () => {
      clearInterval(interval)
      window.removeEventListener("gamepadconnected",    onConnect)
      window.removeEventListener("gamepaddisconnected", onDisconnect)
    }
  }, [])

  // Gamepad button listener (para remapeamento)
  useEffect(() => {
    if (listeningGamepad === null) return
    let raf: number
    let prev: boolean[] = []
    const poll = () => {
      const gps = navigator.getGamepads?.() ?? []
      const gp  = [...gps].find(g => g?.connected)
      if (gp) {
        const buttons = gp.buttons.map(b => b.pressed)
        for (let i = 0; i < buttons.length; i++) {
          if (buttons[i] && !prev[i]) {
            // Botão pressionado — salva mapeamento
            const newBindings = [...gamepadBindings]
            newBindings[listeningGamepad] = i
            setGamepadBindings(newBindings)
            saveGamepadBindings(newBindings)
            setListeningGamepad(null)
            listeningGamepadRef.current = null
            return
          }
        }
        prev = buttons
      }
      raf = requestAnimationFrame(poll)
    }
    raf = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(raf)
  }, [listeningGamepad, gamepadBindings])

  // ESC para voltar ao menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && listeningFor === null) {
        router.push("/")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router, listeningFor])

  const update = (patch: Partial<GameSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
  }

  const reset = () => {
    const next = { ...DEFAULT_SETTINGS }
    setSettings(next)
    saveSettings(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
  }

  // ── Key binding listener ────────────────────────────────────────────────────
  const startListening = useCallback((laneIndex: number) => {
    setListeningFor(laneIndex)
    setConflict(null)
    listenRef.current = laneIndex
  }, [])

  const cancelListening = useCallback(() => {
    setListeningFor(null)
    setConflict(null)
    listenRef.current = null
  }, [])

  useEffect(() => {
    if (listeningFor === null) return

    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === "Escape") {
        cancelListening()
        return
      }

      const key = e.key.toLowerCase()

      // Rejeita teclas proibidas / não imprimíveis
      const blocked = ["escape", "enter", "tab", "backspace", "delete", " ", "arrowup", "arrowdown", "arrowleft", "arrowright", "f1","f2","f3","f4","f5","f6","f7","f8","f9","f10","f11","f12"]
      if (blocked.includes(key) || key.length > 1) {
        setConflict(`Tecla "${e.key}" não permitida. Use letras ou números.`)
        return
      }

      const modeOpt = LANE_MODE_OPTS.find(o => o.count === keyMode)!
      const currentBindings = [...(settings[modeOpt.bindKey] as string[])]

      // Verifica conflito com outra lane
      const existingIndex = currentBindings.indexOf(key)
      if (existingIndex !== -1 && existingIndex !== listeningFor) {
        const mOpt2 = LANE_MODE_OPTS.find(o => o.count === keyMode)!
        setConflict(`"${key.toUpperCase()}" já está sendo usada pela lane ${existingIndex + 1} (${LANE_NAMES[existingIndex]}). Escolha outra tecla.`)
        return
      }

      // Atribui a tecla
      currentBindings[listeningFor] = key
      setConflict(null)
      setListeningFor(null)
      listenRef.current = null

      const next = { ...settings, keyBindings: currentBindings }
      setSettings(next)
      saveSettings(next)
      setSaved(true)
      setTimeout(() => setSaved(false), 1200)

      // Som de confirmação
      playHitSound(listeningFor, "perfect", getVol(settings))
    }

    window.addEventListener("keydown", handler, { capture: true })
    return () => window.removeEventListener("keydown", handler, { capture: true })
  }, [listeningFor, settings, cancelListening])

  // Clique fora cancela o listening
  useEffect(() => {
    if (listeningFor === null) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest("[data-keybind]")) cancelListening()
    }
    window.addEventListener("mousedown", handler)
    return () => window.removeEventListener("mousedown", handler)
  }, [listeningFor, cancelListening])

  const vol = getVol(settings)

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ fontFamily:"'Impact','Arial Black',sans-serif", background:"#000", isolation:"isolate" }}>
      {/* GH3 Background layers */}
      <div className="pointer-events-none absolute inset-0 z-0"
        style={{ background:"linear-gradient(180deg,#000 0%,#0a0004 50%,#180008 100%)" }}/>
      <div className="pointer-events-none absolute inset-0 z-0"
        style={{ background:"radial-gradient(ellipse at 50% 40%,rgba(190,18,28,.1),transparent 65%)" }}/>
      <div className="pointer-events-none absolute inset-0 z-10"
        style={{ backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.17) 3px,rgba(0,0,0,.17) 4px)" }}/>
      <div className="pointer-events-none absolute inset-0 z-10"
        style={{ background:"radial-gradient(ellipse at center,transparent 50%,rgba(0,0,0,.82) 100%)" }}/>

      <div className="relative z-20 flex flex-col h-full" style={{pointerEvents:"auto"}}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
        <button onClick={() => { playClickSound(vol); router.push("/") }}
          onMouseEnter={() => playHoverSound(vol)}
          className="flex items-center gap-2 px-4 py-2 transition-all hover:scale-105 active:scale-95"
          style={{ background:"linear-gradient(90deg,rgba(180,0,20,.85),rgba(140,0,15,.70))",
            border:"2px solid rgba(255,100,100,.70)", borderRadius:"6px",
            color:"rgba(255,220,220,1)", letterSpacing:".08em", fontSize:"14px",
            fontWeight:"bold", cursor:"pointer", position:"relative", zIndex:50,
            boxShadow:"0 0 14px rgba(255,50,50,.35), inset 0 1px 0 rgba(255,150,150,.2)" }}>
          ← Menu
        </button>
        <div className="flex flex-col items-center leading-none">
          <h1 className="text-4xl font-black" style={{ color:"#fff", WebkitTextStroke:"2px rgba(200,30,30,.5)",
            textShadow:"0 0 30px rgba(255,30,0,.8),3px 3px 0 rgba(120,0,0,.9)", letterSpacing:"-.02em" }}>GUITAR</h1>
          <h1 className="text-[2.6rem] font-black -mt-1" style={{ background:"linear-gradient(180deg,#ffdd00 0%,#ff8800 40%,#cc3300 100%)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
            filter:"drop-shadow(0 0 18px rgba(255,100,0,.8)) drop-shadow(3px 3px 0 rgba(100,20,0,.9))", letterSpacing:"-.02em" }}>DUELS</h1>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs font-bold px-3 py-1 rounded" style={{ color:"#4ade80",background:"rgba(0,200,0,.15)",border:"1px solid rgba(0,200,0,.3)",fontFamily:"'Arial',sans-serif" }}>✓ Salvo</span>}
          <button onClick={() => { playClickSound(vol); reset() }} onMouseEnter={() => playHoverSound(vol)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs transition-all hover:scale-105"
            style={{ color:"rgba(255,180,100,.6)",border:"1px solid rgba(255,180,100,.2)",borderRadius:"4px",fontFamily:"'Arial',sans-serif" }}>
            <RotateCcw className="w-3 h-3" /> Restaurar
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 px-6 mb-2 flex-shrink-0">
        <div className="h-px flex-1" style={{ background:"linear-gradient(90deg,transparent,rgba(255,60,0,.6))" }}/>
        <h2 className="text-xs tracking-[.3em] uppercase" style={{ color:"rgba(255,180,100,.8)",fontFamily:"'Arial Black',sans-serif",fontWeight:900 }}>⚙️ Opções</h2>
        <div className="h-px flex-1" style={{ background:"linear-gradient(90deg,rgba(255,60,0,.6),transparent)" }}/>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{scrollbarWidth:"none"}}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex flex-col gap-8">

          {/* ── ÁUDIO ── */}
          <Section title="Áudio" icon={<Volume2 className="w-5 h-5" />} color="#e11d48">
            <SliderRow label="Volume Geral" description="Controla o volume de todo o jogo"
              value={settings.masterVolume} onChange={v => update({ masterVolume: v })} color="#e11d48" />
            <SliderRow label="Volume da Música" description="Volume das faixas de áudio das músicas"
              value={settings.musicVolume} onChange={v => update({ musicVolume: v })} color="#3b82f6" />
            <SliderRow label="Volume SFX" description="Sons de acerto, miss e interface"
              value={settings.sfxVolume} onChange={v => update({ sfxVolume: v })} color="#22c55e" />

            <div className="mt-1 p-3 rounded-xl flex items-center gap-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-xs text-white/30 flex-shrink-0">Volume resultante:</p>
              <div className="flex-1 h-2 rounded-full overflow-hidden bg-white/5">
                <div className="h-full rounded-full transition-all duration-150"
                  style={{ width: `${(settings.masterVolume / 100) * (settings.musicVolume / 100) * 100}%`, background: "linear-gradient(90deg, #3b82f6, #e11d48)" }} />
              </div>
              <span className="text-xs font-mono text-white/40 w-8 text-right">
                {Math.round((settings.masterVolume / 100) * (settings.musicVolume / 100) * 100)}%
              </span>
            </div>
          </Section>

          {/* ── GAMEPLAY ── */}
          <Section title="Gameplay" icon={<Gauge className="w-5 h-5" />} color="#f97316">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-medium">Velocidade das Notas</p>
                  <p className="text-xs text-white/30 mt-0.5">Quão rápido as notas descem na tela</p>
                </div>
                <span className="text-sm font-black font-mono" style={{ color: "#f97316" }}>{settings.noteSpeed}x</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
                  <button key={s}
                    onClick={() => { playClickSound(vol); update({ noteSpeed: s }) }}
                    className="flex-1 min-w-[48px] py-2 rounded-lg text-sm font-bold font-mono transition-all hover:scale-105 active:scale-95"
                    style={settings.noteSpeed === s ? {
                      background: "rgba(249,115,22,0.2)", border: "1px solid rgba(249,115,22,0.5)", color: "#f97316",
                    } : {
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)",
                    }}>{s}x</button>
                ))}
              </div>
              <div className="relative h-14 rounded-xl overflow-hidden mt-1"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="absolute top-2 left-3 text-xs text-white/20">Preview</p>
                {[0, 1, 2, 3, 4].map(lane => <NotePreview key={lane} lane={lane} speed={settings.noteSpeed} />)}
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-medium">Calibração de Latência</p>
                  <p className="text-xs text-white/30 mt-0.5">Ajuste se as notas parecem adiantadas ou atrasadas</p>
                </div>
                <span className={`text-sm font-black font-mono ${settings.calibrationOffset === 0 ? "text-white/40" : settings.calibrationOffset > 0 ? "text-yellow-400" : "text-blue-400"}`}>
                  {settings.calibrationOffset > 0 ? "+" : ""}{settings.calibrationOffset}ms
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-blue-400/60 w-16 text-right font-mono">-100ms</span>
                <div className="flex-1 relative">
                  <input type="range" min={-100} max={100} step={5} value={settings.calibrationOffset}
                    onChange={e => update({ calibrationOffset: Number(e.target.value) })}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: settings.calibrationOffset === 0 ? "#666" : settings.calibrationOffset > 0 ? "#facc15" : "#60a5fa" }} />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 bg-white/20 pointer-events-none" />
                </div>
                <span className="text-xs text-yellow-400/60 w-16 font-mono">+100ms</span>
              </div>
              <div className="flex justify-center gap-6 text-xs text-white/20 mt-1">
                <span>← Notas adiantadas</span>
                <span>Notas atrasadas →</span>
              </div>
              {settings.calibrationOffset !== 0 && (
                <button onClick={() => update({ calibrationOffset: 0 })}
                  className="self-center text-xs text-white/30 hover:text-white/60 underline underline-offset-2 transition-colors mt-1">
                  Zerar calibração
                </button>
              )}
            </div>
          </Section>

          {/* ── VISUAL ── */}
          <Section title="Visual" icon={<Eye className="w-5 h-5" />} color="#a855f7">
            <ToggleRow label="Mostrar Guia de Teclas"
              description="Exibe as letras das teclas nas lanes durante o jogo"
              value={settings.showGuide} onChange={v => update({ showGuide: v })} color="#a855f7" />
          </Section>

          {/* ── CONTROLES ── */}
          <Section title="Controles" icon={<Keyboard className="w-5 h-5" />} color="#22c55e">

            {/* ── Toggles de entrada ── */}
            <div className="grid grid-cols-2 gap-3">
              {/* Teclado */}
              <button
                onClick={() => {
                  playClickSound(vol)
                  update({ keyboardEnabled: !(settings.keyboardEnabled ?? true) })
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  background: (settings.keyboardEnabled ?? true) ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${(settings.keyboardEnabled ?? true) ? "rgba(34,197,94,0.40)" : "rgba(255,255,255,0.08)"}`,
                }}>
                <span className="text-2xl">{(settings.keyboardEnabled ?? true) ? "⌨️" : "🚫"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: (settings.keyboardEnabled ?? true) ? "#22c55e" : "rgba(255,255,255,0.35)", fontFamily: "'Arial Black',sans-serif" }}>
                    Teclado
                  </p>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {(settings.keyboardEnabled ?? true) ? "Ativo" : "Desativado"}
                  </p>
                </div>
                <div className="w-10 h-5 rounded-full flex items-center transition-all duration-200 flex-shrink-0"
                  style={{ background: (settings.keyboardEnabled ?? true) ? "#22c55e" : "rgba(255,255,255,0.12)", padding: "2px" }}>
                  <div className="w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
                    style={{ transform: (settings.keyboardEnabled ?? true) ? "translateX(20px)" : "translateX(0)" }} />
                </div>
              </button>

              {/* Controle */}
              <button
                onClick={() => {
                  playClickSound(vol)
                  update({ gamepadEnabled: !(settings.gamepadEnabled ?? true) })
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  background: (settings.gamepadEnabled ?? true) ? "rgba(99,102,241,0.10)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${(settings.gamepadEnabled ?? true) ? "rgba(99,102,241,0.40)" : "rgba(255,255,255,0.08)"}`,
                }}>
                <span className="text-2xl">{(settings.gamepadEnabled ?? true) ? "🎮" : "🚫"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: (settings.gamepadEnabled ?? true) ? "#818cf8" : "rgba(255,255,255,0.35)", fontFamily: "'Arial Black',sans-serif" }}>
                    Controle
                  </p>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {(settings.gamepadEnabled ?? true) ? (gamepadConnected ? "Conectado" : "Ativo (sem controle)") : "Desativado"}
                  </p>
                </div>
                <div className="w-10 h-5 rounded-full flex items-center transition-all duration-200 flex-shrink-0"
                  style={{ background: (settings.gamepadEnabled ?? true) ? "#6366f1" : "rgba(255,255,255,0.12)", padding: "2px" }}>
                  <div className="w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
                    style={{ transform: (settings.gamepadEnabled ?? true) ? "translateX(20px)" : "translateX(0)" }} />
                </div>
              </button>
            </div>

            {/* Aviso se ambos desativados */}
            {!(settings.keyboardEnabled ?? true) && !(settings.gamepadEnabled ?? true) && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
                style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.30)" }}>
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-300">Atenção: teclado e controle estão desativados — você não conseguirá jogar!</p>
              </div>
            )}

            {/* Instrução */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
              <Keyboard className="w-4 h-4 text-green-400/60 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-white/45 leading-relaxed">
                Clique em qualquer botão de tecla abaixo para reatribuí-lo. Em seguida, pressione a nova tecla no teclado. Pressione <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>ESC</kbd> para cancelar.
              </p>
            </div>

            {/* Conflict warning */}
            {conflict && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-300">{conflict}</p>
              </div>
            )}

            {/* Seletor de modo de lanes */}
            <div className="flex gap-2">
              {LANE_MODE_OPTS.map(opt => (
                <button key={opt.count}
                  onClick={() => { setKeyMode(opt.count); setListeningFor(null); setConflict(null) }}
                  className="flex-1 flex flex-col items-center py-2.5 rounded-xl transition-all"
                  style={{
                    background: keyMode === opt.count ? `${opt.color}20` : "rgba(255,255,255,0.04)",
                    border: keyMode === opt.count ? `1px solid ${opt.color}66` : "1px solid rgba(255,255,255,0.08)",
                    boxShadow: keyMode === opt.count ? `0 0 16px ${opt.color}30` : "none",
                  }}>
                  <span className="text-sm font-black" style={{ color: keyMode === opt.count ? opt.color : "rgba(255,255,255,0.4)" }}>
                    {opt.label}
                  </span>
                  <span className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{opt.desc}</span>
                </button>
              ))}
            </div>

            {/* Lane key editor grid — muda conforme modo */}
            {(() => {
              const modeOpt = LANE_MODE_OPTS.find(o => o.count === keyMode)!
              const currentBindings = settings[modeOpt.bindKey] as string[]
              const defaultBindings = modeOpt.keys
              const cols = keyMode === 4 ? "grid-cols-4" : keyMode === 5 ? "grid-cols-5" : "grid-cols-6"
              return (
                <div className={`grid ${cols} gap-3`}>
                  {currentBindings.map((key, i) => {
                    const isListening = listeningFor === i
                    const color = LANE_COLORS[i]
                    return (
                      <div key={i} className="flex flex-col items-center gap-2" data-keybind>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                          <span className="text-[10px] text-white/30 uppercase tracking-wide">{LANE_NAMES[i]}</span>
                        </div>
                        <button data-keybind
                          onClick={() => { if (isListening) { cancelListening(); return }; playClickSound(vol); startListening(i) }}
                          className="relative w-full h-14 rounded-xl font-black text-xl transition-all duration-150"
                          style={isListening ? {
                            background: `${color}25`, border: `2px solid ${color}`, color,
                            boxShadow: `0 0 20px ${color}50, 0 0 40px ${color}25`,
                            transform: "scale(1.06)", animation: "key-pulse 0.8s ease-in-out infinite",
                          } : { background: `${color}12`, border: `1px solid ${color}35`, color, boxShadow: `0 0 8px ${color}20` }}>
                          {isListening ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[10px] font-bold tracking-widest" style={{ color }}>TECLA?</span>
                              <div className="flex gap-1">
                                {[0,1,2].map(d => <div key={d} className="w-1 h-1 rounded-full" style={{ background: color, animation: `dot-blink 0.8s ease-in-out ${d*0.2}s infinite` }}/>)}
                              </div>
                            </div>
                          ) : <span className="uppercase">{key}</span>}
                        </button>
                        {key !== defaultBindings[i] && !isListening && (
                          <button onClick={() => {
                            playClickSound(vol)
                            const nb = [...currentBindings]; nb[i] = defaultBindings[i]
                            update({ [modeOpt.bindKey]: nb })
                          }} className="text-[10px] text-white/25 hover:text-white/50 transition-colors">
                            ↺ padrão ({defaultBindings[i].toUpperCase()})
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {/* Preview das teclas no teclado (visual) — modo correto */}
            {(() => {
              const modeOpt = LANE_MODE_OPTS.find(o => o.count === keyMode)!
              return <KeyboardPreview bindings={settings[modeOpt.bindKey] as string[]} listeningFor={listeningFor} />
            })()}

            {/* ── GAMEPAD ── */}
            <div className="mt-2 rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(99,102,241,0.25)", background: "rgba(99,102,241,0.05)" }}>
              <div className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: "1px solid rgba(99,102,241,0.15)" }}>
                <span className="text-lg">🎮</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white/80">Controle / Gamepad</p>
                  <p className="text-xs text-white/35 mt-0.5">
                    {gamepadConnected
                      ? <span className="text-green-400">● Conectado: <span className="text-white/50 font-mono text-[10px]">{gamepadName.slice(0,40)}</span></span>
                      : <span className="text-white/30">○ Nenhum controle detectado — se for Bluetooth, <strong className="text-white/50">pressione qualquer botão</strong> no controle para ativar</span>
                    }
                  </p>
                </div>
              </div>

              {gamepadConnected && (
                <div className="p-4 space-y-3">
                  <p className="text-xs text-white/40">Clique numa lane e pressione o botão do controle para remapear</p>
                  <div className="grid grid-cols-5 gap-2">
                    {LANE_COLORS.map((color, i) => {
                      const isListening = listeningGamepad === i
                      return (
                        <div key={i} className="flex flex-col items-center gap-1.5">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                            <span className="text-[10px] text-white/30">{LANE_NAMES[i]}</span>
                          </div>
                          <button
                            onClick={() => {
                              if (isListening) { setListeningGamepad(null); return }
                              setListeningGamepad(i)
                              listeningGamepadRef.current = i
                            }}
                            className="w-full h-12 rounded-xl font-black text-sm transition-all duration-150"
                            style={isListening ? {
                              background: `${color}25`, border: `2px solid ${color}`,
                              color: color, animation: "key-pulse 0.8s ease-in-out infinite",
                            } : {
                              background: `${color}12`, border: `1px solid ${color}35`, color: color,
                            }}
                          >
                            {isListening ? "🎮?" : `Btn ${gamepadBindings[i]}`}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => {
                      const def = [...DEFAULT_GAMEPAD_BINDINGS]
                      setGamepadBindings(def)
                      saveGamepadBindings(def)
                    }}
                    className="text-xs text-white/25 hover:text-white/50 transition-colors"
                  >↺ Restaurar mapeamento padrão</button>
                </div>
              )}
            </div>

            {/* Teclas de sistema (não editáveis) */}
            <div>
              <p className="text-xs text-white/25 uppercase tracking-widest mb-3">Teclas de sistema</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "ESC", action: "Pausar / Continuar" },
                  { key: "Enter", action: "Confirmar" },
                  { key: "↑ ↓", action: "Navegar menus" },
                  { key: "Backspace", action: "Voltar" },
                ].map(({ key, action }) => (
                  <div key={key} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <kbd className="px-2 py-1 rounded text-xs font-mono font-bold text-white/50"
                      style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      {key}
                    </kbd>
                    <span className="text-xs text-white/30">{action}</span>
                  </div>
                ))}
              </div>
            </div>

          </Section>
        </div>
      </div>
      </div>{/* z-20 */}

      <style>{`
        @keyframes key-pulse {
          0%, 100% { box-shadow: 0 0 20px var(--kc, #22c55e50), 0 0 40px var(--kc, #22c55e25); }
          50%       { box-shadow: 0 0 30px var(--kc, #22c55e80), 0 0 60px var(--kc, #22c55e40); }
        }
        @keyframes dot-blink {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ── Keyboard visual preview ───────────────────────────────────────────────────
function KeyboardPreview({ bindings, listeningFor }: { bindings: string[]; listeningFor: number | null }) {
  // Rows of a QWERTY keyboard
  const rows = [
    ["q","w","e","r","t","y","u","i","o","p"],
    ["a","s","d","f","g","h","j","k","l"],
    ["z","x","c","v","b","n","m"],
    ["1","2","3","4","5","6","7","8","9","0"],
  ]

  const bindingIndex = (key: string) => bindings.indexOf(key.toLowerCase())
  const isListeningLane = (key: string) => listeningFor !== null && bindings[listeningFor] === key.toLowerCase()

  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <p className="text-[10px] text-white/20 uppercase tracking-widest mb-3">Mapeamento no teclado</p>
      <div className="flex flex-col gap-1.5 items-center">
        {rows.map((row, ri) => (
          <div key={ri} className="flex gap-1.5">
            {row.map(key => {
              const laneIdx = bindingIndex(key)
              const isBound = laneIdx !== -1
              const isActive = isListeningLane(key)
              const color = isBound ? LANE_COLORS[laneIdx] : null

              return (
                <div
                  key={key}
                  className="flex items-center justify-center rounded font-mono font-bold text-[11px] transition-all duration-200"
                  style={{
                    width: "28px",
                    height: "28px",
                    background: isBound ? `${color}22` : "rgba(255,255,255,0.04)",
                    border: isBound
                      ? `1.5px solid ${color}${isActive ? "ff" : "60"}`
                      : "1px solid rgba(255,255,255,0.08)",
                    color: isBound ? color : "rgba(255,255,255,0.2)",
                    boxShadow: isBound ? `0 0 ${isActive ? 14 : 6}px ${color}${isActive ? "60" : "30"}` : "none",
                    transform: isActive ? "scale(1.12)" : "scale(1)",
                  }}
                >
                  {key.toUpperCase()}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex gap-3 mt-3 justify-center flex-wrap">
        {bindings.map((key, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: LANE_COLORS[i] }} />
            <span className="text-[10px]" style={{ color: LANE_COLORS[i] }}>
              {LANE_NAMES[i]}: {key.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Componentes auxiliares ────────────────────────────────────────────────────
function Section({ title, icon, color, children }: { title: string; icon: React.ReactNode; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded p-4 flex flex-col gap-4"
      style={{ background:"linear-gradient(135deg,rgba(20,8,35,.85),rgba(12,4,22,.9))",
        border:"1px solid rgba(180,80,255,.15)", boxShadow:"0 4px 24px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.04)" }}>
      <div className="flex items-center gap-2">
        <span style={{ color }}>{icon}</span>
        <h2 className="text-sm font-black tracking-widest uppercase" style={{ color:"rgba(255,255,255,.9)",fontFamily:"'Impact','Arial Black',sans-serif" }}>{title}</h2>
        <div className="flex-1 h-px ml-1" style={{ background: `linear-gradient(90deg, ${color}40, transparent)` }} />
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  )
}

function SliderRow({ label, description, value, onChange, color }: { label: string; description: string; value: number; onChange: (v: number) => void; color: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white font-medium">{label}</p>
          <p className="text-xs text-white/30">{description}</p>
        </div>
        <span className="text-sm font-black font-mono w-10 text-right" style={{ color }}>{value}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-white/20 font-mono w-4">0</span>
        <div className="flex-1 relative h-6 flex items-center">
          <div className="absolute w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
          <div className="absolute h-1.5 rounded-full transition-all duration-75"
            style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}60, ${color})` }} />
          <input type="range" min={0} max={100} step={1} value={value}
            onChange={e => onChange(Number(e.target.value))}
            className="absolute w-full opacity-0 cursor-pointer h-6" />
          <div className="absolute w-4 h-4 rounded-full border-2 shadow-lg transition-all duration-75 pointer-events-none"
            style={{ left: `calc(${value}% - 8px)`, background: color, borderColor: color, boxShadow: `0 0 12px ${color}80` }} />
        </div>
        <span className="text-xs text-white/20 font-mono w-8 text-right">100</span>
      </div>
    </div>
  )
}

function ToggleRow({ label, description, value, onChange, color }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void; color: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-white font-medium">{label}</p>
        <p className="text-xs text-white/30 mt-0.5">{description}</p>
      </div>
      <button onClick={() => onChange(!value)}
        className="relative flex-shrink-0 w-14 h-7 rounded-full transition-all duration-300"
        style={{ background: value ? color : "rgba(255,255,255,0.1)", boxShadow: value ? `0 0 12px ${color}60` : "none" }}>
        <div className="absolute top-1 w-5 h-5 rounded-full bg-white transition-all duration-300 shadow-md"
          style={{ left: value ? "calc(100% - 24px)" : "4px" }} />
      </button>
    </div>
  )
}

function NotePreview({ lane, speed }: { lane: number; speed: number }) {
  const positions = [10, 27, 44, 61, 78]
  return (
    <div className="absolute w-5 h-5 rounded-full"
      style={{
        left: `${positions[lane]}%`, top: "50%", transform: "translateY(-50%)",
        background: LANE_COLORS[lane], boxShadow: `0 0 10px ${LANE_COLORS[lane]}80`,
        opacity: 0.7, animation: `fall ${2 / speed}s linear infinite`,
      }} />
  )
}
