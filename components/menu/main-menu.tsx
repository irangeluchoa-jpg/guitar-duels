"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { playClickSound, playHoverSound } from "@/lib/game/sounds"
import { loadSettings, DEFAULT_KEY_BINDINGS } from "@/lib/settings"

function getVol() {
  try { const s = loadSettings(); return (s.masterVolume/100)*(s.sfxVolume/100) } catch { return 0.5 }
}

const LANE_COLORS = ["#22c55e","#ef4444","#eab308","#3b82f6","#f97316"]

import { loadProfile, levelFromXP, levelProgress, levelTitle } from "@/lib/progression"

export function MainMenu() {
  const router = useRouter()
  const [keyBindings, setKeyBindings] = useState<string[]>([...DEFAULT_KEY_BINDINGS])
  const [hovered, setHovered] = useState<number | null>(null)
  const [profileData, setProfileData] = useState<{ level: number; totalXP: number; displayName: string } | null>(null)

  useEffect(() => {
    try { const p = loadProfile(); setProfileData(p) } catch {}
  }, [])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)
  const timeRef   = useRef(0)

  useEffect(() => {
    const s = loadSettings()
    setKeyBindings(s.keyBindings ?? [...DEFAULT_KEY_BINDINGS])
  }, [])

  // ── Background canvas — chamas, fumaça e relâmpagos estilo GH3 ──────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.offsetWidth, h = canvas.offsetHeight
      canvas.width  = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width  = w + "px"
      canvas.style.height = h + "px"
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener("resize", resize)

    // Partículas de chama / fumaça
    type Particle = {
      x: number; y: number; vx: number; vy: number
      size: number; alpha: number; life: number; maxLife: number
      type: "flame" | "ember" | "smoke"
      hue: number
    }
    const particles: Particle[] = []

    function spawnFlame() {
      const w = canvas.width, h = canvas.height
      // Chamas saem de baixo do canvas
      particles.push({
        x: Math.random() * w,
        y: h + 10,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -(1.5 + Math.random() * 2.5),
        size: 4 + Math.random() * 12,
        alpha: 0.6 + Math.random() * 0.4,
        life: 0, maxLife: 80 + Math.random() * 80,
        type: Math.random() < 0.15 ? "ember" : "flame",
        hue: 10 + Math.random() * 30,  // laranja-vermelho
      })
    }

    function draw(ts: number) {
      const dt = ts - timeRef.current
      timeRef.current = ts
      const w = canvas.width, h = canvas.height

      // Fundo — gradiente escuro dramático
      const bg = ctx.createLinearGradient(0, 0, 0, h)
      bg.addColorStop(0,   "#000000")
      bg.addColorStop(0.5, "#0a0005")
      bg.addColorStop(1,   "#1a0008")
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      // Grades de fundo estilo fretboard (sutis)
      ctx.save()
      ctx.globalAlpha = 0.04
      for (let i = 0; i < 7; i++) {
        const x = (w / 6) * i
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h)
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke()
      }
      for (let i = 0; i < 5; i++) {
        const y = (h / 4) * i
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y)
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke()
      }
      ctx.restore()

      // Glow central vermelho-laranja estilo logo GH
      const t = ts * 0.001
      const pulse = 0.85 + Math.sin(t * 1.2) * 0.15
      const glow = ctx.createRadialGradient(w/2, h*0.42, 0, w/2, h*0.42, w * 0.55 * pulse)
      glow.addColorStop(0,   `rgba(200,20,30,${0.12 * pulse})`)
      glow.addColorStop(0.4, `rgba(160,15,20,${0.07 * pulse})`)
      glow.addColorStop(0.8, `rgba(100,5,10,${0.03})`)
      glow.addColorStop(1,   "transparent")
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)

      // Raios de luz saindo do centro (efeito spotlight)
      ctx.save()
      ctx.globalAlpha = 0.025 + Math.sin(t * 0.7) * 0.01
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + t * 0.08
        ctx.beginPath()
        ctx.moveTo(w/2, h * 0.42)
        ctx.lineTo(w/2 + Math.cos(angle) * w, h * 0.42 + Math.sin(angle) * h)
        ctx.strokeStyle = "#ff4400"
        ctx.lineWidth = 30
        ctx.stroke()
      }
      ctx.restore()

      // Spawn partículas
      if (Math.random() < 0.35) spawnFlame()

      // Atualiza e desenha partículas
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life += 1
        if (p.life >= p.maxLife) { particles.splice(i, 1); continue }

        const lifeRatio = p.life / p.maxLife
        p.x += p.vx + Math.sin(p.life * 0.15) * 0.3
        p.y += p.vy
        p.vy *= 0.992  // diminui velocidade
        p.size *= (p.type === "smoke" ? 1.008 : 0.997)

        ctx.save()
        if (p.type === "flame") {
          const fade = 1 - lifeRatio
          const r = Math.round(255)
          const g = Math.round(Math.max(0, 160 * (1 - lifeRatio * 1.2)))
          const b = 0
          ctx.globalAlpha = p.alpha * fade * fade
          const fg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size)
          fg.addColorStop(0,   `rgba(255,255,200,${p.alpha})`)
          fg.addColorStop(0.3, `rgba(${r},${g},${b},${p.alpha * 0.8})`)
          fg.addColorStop(1,   "transparent")
          ctx.fillStyle = fg
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill()
        } else if (p.type === "ember") {
          ctx.globalAlpha = p.alpha * (1 - lifeRatio) * 0.9
          ctx.fillStyle = `hsl(${p.hue}, 100%, 70%)`
          ctx.shadowColor = `hsl(${p.hue}, 100%, 50%)`
          ctx.shadowBlur = 6
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI*2); ctx.fill()
          ctx.shadowBlur = 0
        }
        ctx.restore()
      }

      // Fumaça acima das chamas
      ctx.save()
      const smokeGrad = ctx.createLinearGradient(0, h * 0.6, 0, 0)
      smokeGrad.addColorStop(0, "rgba(0,0,0,0)")
      smokeGrad.addColorStop(0.4, "rgba(5,2,10,0.15)")
      smokeGrad.addColorStop(1, "rgba(0,0,0,0.4)")
      ctx.fillStyle = smokeGrad
      ctx.fillRect(0, 0, w, h)
      ctx.restore()

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener("resize", resize)
    }
  }, [])

  const menuItems = [
    { label: "Jogar Solo",       sub: "Modo carreira",     icon: "🎸", path: "/songs",    primary: true },
    { label: "Multiplayer",      sub: "Até 4 jogadores",   icon: "⚔️",  path: "/lobby",   primary: false },
    { label: "Ranking",          sub: "Melhores placares", icon: "🏆", path: "/ranking",  primary: false },
    { label: "Perfil",           sub: "XP e conquistas",   icon: "🏆", path: "/profile",  primary: false },
    { label: "Histórico",        sub: "Últimas partidas",  icon: "📋", path: "/history",  primary: false },
    { label: "Opções",           sub: "Configurações",     icon: "⚙️",  path: "/settings", primary: false },
  ]

  return (
    <div className="relative w-full h-screen overflow-hidden select-none"
      style={{ fontFamily: "'Impact', 'Arial Black', sans-serif", background: "#000" }}>

      {/* Canvas de background animado */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Scanlines estilo CRT */}
      <div className="pointer-events-none absolute inset-0 z-10"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px)",
        }} />

      {/* Vinheta nas bordas */}
      <div className="pointer-events-none absolute inset-0 z-10"
        style={{ background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.85) 100%)" }} />

      {/* Conteúdo principal */}
      <div className="relative z-20 flex flex-col h-full">

        {/* ── LOGO ESTILO GH3 ── */}
        <div className="flex-1 flex flex-col items-center justify-center pb-4"
          style={{ animation: "gh-drop 0.7s cubic-bezier(0.34,1.56,0.64,1) both" }}>

          {/* Estrela decorativa acima */}
          <div className="mb-2 flex items-center gap-4">
            <div className="h-px w-12" style={{ background: "linear-gradient(90deg, transparent, rgba(255,60,0,0.7))" }} />
            <span className="text-xl" style={{ filter: "drop-shadow(0 0 8px #ff4400)" }}>★</span>
            <div className="h-px w-12" style={{ background: "linear-gradient(90deg, rgba(255,60,0,0.7), transparent)" }} />
          </div>

          {/* GUITAR */}
          <div className="relative leading-none">
            <h1
              className="text-[5.5rem] font-black tracking-tight leading-none"
              style={{
                fontFamily: "'Impact', 'Arial Black', sans-serif",
                color: "#fff",
                WebkitTextStroke: "3px rgba(200,30,30,0.6)",
                textShadow: `
                  0 0 40px rgba(255,30,0,0.9),
                  0 0 80px rgba(200,10,0,0.5),
                  4px 4px 0 rgba(120,0,0,0.9),
                  8px 8px 0 rgba(60,0,0,0.6),
                  0 2px 0 #000
                `,
                letterSpacing: "-0.02em",
              }}>
              GUITAR
            </h1>
            {/* Reflexo */}
            <h1 className="text-[5.5rem] font-black tracking-tight leading-none absolute top-full left-0 right-0"
              style={{
                fontFamily: "'Impact', 'Arial Black', sans-serif",
                color: "transparent",
                WebkitTextStroke: "1px rgba(255,60,0,0.15)",
                transform: "scaleY(-0.3) translateY(-4px)",
                transformOrigin: "top",
                opacity: 0.4,
                filter: "blur(2px)",
                letterSpacing: "-0.02em",
              }}>
              GUITAR
            </h1>
          </div>

          {/* DUELS — gradiente laranja-dourado */}
          <div className="relative leading-none -mt-1">
            <h1
              className="text-[5.8rem] font-black tracking-tight leading-none"
              style={{
                fontFamily: "'Impact', 'Arial Black', sans-serif",
                background: "linear-gradient(180deg, #ffdd00 0%, #ff8800 40%, #cc3300 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                WebkitTextStroke: "2px transparent",
                filter: "drop-shadow(0 0 25px rgba(255,100,0,0.8)) drop-shadow(4px 4px 0 rgba(100,20,0,0.9))",
                letterSpacing: "-0.02em",
              }}>
              DUELS
            </h1>
            {/* Reflexo */}
            <h1 className="text-[5.8rem] font-black tracking-tight leading-none absolute top-full left-0 right-0"
              style={{
                fontFamily: "'Impact', 'Arial Black', sans-serif",
                background: "linear-gradient(180deg, #cc3300 0%, transparent 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                transform: "scaleY(-0.25) translateY(-4px)",
                transformOrigin: "top",
                opacity: 0.35,
                filter: "blur(3px)",
                letterSpacing: "-0.02em",
              }}>
              DUELS
            </h1>
          </div>

          {/* Subtítulo estilo GH3 — faixa com texto */}
          <div className="mt-3 px-8 py-1 relative"
            style={{ animation: "gh-drop 0.9s cubic-bezier(0.34,1.56,0.64,1) 0.1s both" }}>
            <div className="absolute inset-0"
              style={{ background: "linear-gradient(90deg, transparent, rgba(200,20,0,0.4), transparent)" }} />
            <p className="relative text-xs tracking-[0.6em] uppercase text-center"
              style={{ color: "rgba(255,180,100,0.8)", fontFamily: "'Arial', sans-serif", fontWeight: 700 }}>
              Batalhas de Guitarra
            </p>
          </div>
        </div>

        {/* ── BOTÕES MENU — estilo placas de pedal GH ── */}
        <div className="flex flex-col items-center gap-2 pb-4 px-6"
          style={{ animation: "gh-drop 0.8s cubic-bezier(0.34,1.56,0.64,1) 0.15s both" }}>
          {menuItems.map((item, i) => (
            <button
              key={i}
              onClick={() => { playClickSound(getVol()); router.push(item.path) }}
              onMouseEnter={() => { playHoverSound(getVol()); setHovered(i) }}
              onMouseLeave={() => setHovered(null)}
              className="w-full max-w-xs flex items-center gap-3 px-5 py-3 relative overflow-hidden transition-all duration-100"
              style={{
                background: hovered === i
                  ? item.primary
                    ? "linear-gradient(90deg, #cc0020, #ff1a35, #cc0020)"
                    : "linear-gradient(90deg, #1a1a2e, #252540, #1a1a2e)"
                  : item.primary
                    ? "linear-gradient(90deg, #990018, #cc001f, #990018)"
                    : "linear-gradient(90deg, #111118, #1a1a26, #111118)",
                border: item.primary
                  ? "2px solid rgba(255,80,80,0.6)"
                  : "1px solid rgba(255,255,255,0.1)",
                borderRadius: "4px",
                boxShadow: hovered === i
                  ? item.primary
                    ? "0 0 30px rgba(255,30,0,0.6), inset 0 1px 0 rgba(255,180,180,0.3)"
                    : "0 0 20px rgba(100,100,255,0.3), inset 0 1px 0 rgba(200,200,255,0.1)"
                  : item.primary
                    ? "0 0 15px rgba(200,0,0,0.4), inset 0 1px 0 rgba(255,120,120,0.15)"
                    : "0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
                transform: hovered === i ? "scale(1.02) translateX(4px)" : "scale(1)",
              }}>

              {/* Faixa lateral esquerda colorida */}
              <div className="absolute left-0 top-0 bottom-0 w-1"
                style={{
                  background: item.primary
                    ? "linear-gradient(180deg, #ff8888, #ff0000, #ff8888)"
                    : "linear-gradient(180deg, #8888ff, #4444cc, #8888ff)",
                  boxShadow: item.primary ? "0 0 8px #ff0000" : "0 0 8px #4444cc",
                }} />

              {/* Ícone */}
              <span className="text-xl flex-shrink-0 ml-1"
                style={{ filter: hovered === i ? "drop-shadow(0 0 8px rgba(255,200,0,0.8))" : "none" }}>
                {item.icon}
              </span>

              {/* Texto */}
              <div className="flex-1">
                <div className="text-base font-black leading-none"
                  style={{
                    fontFamily: "'Impact', 'Arial Black', sans-serif",
                    color: hovered === i ? "#fff" : item.primary ? "#ffcccc" : "rgba(255,255,255,0.75)",
                    textShadow: hovered === i ? "0 0 12px rgba(255,255,255,0.8)" : "none",
                    letterSpacing: "0.02em",
                  }}>
                  {item.label}
                </div>
                <div className="text-[10px] mt-0.5"
                  style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'Arial', sans-serif" }}>
                  {item.sub}
                </div>
              </div>

              {/* Seta direita */}
              <span className="text-sm flex-shrink-0"
                style={{ color: hovered === i ? "#ffdd00" : "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>
                {hovered === i ? "▶" : "›"}
              </span>
            </button>
          ))}
        </div>

        {/* ── MINI PERFIL / XP BAR ── */}
        {profileData && (
          <div className="flex justify-center mb-1">
            <button
              onClick={() => router.push("/profile")}
              className="flex items-center gap-3 px-4 py-2 rounded-2xl transition-all hover:scale-105"
              style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}>
              <div className="flex items-center gap-1.5">
                <span className="text-base">{typeof window !== "undefined" ? (localStorage.getItem("guitar-duels-avatar") ?? "🎸") : "🎸"}</span>
                <span className="text-xs font-bold text-white/70">{profileData.displayName}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-black"
                  style={{ background: "rgba(168,85,247,0.25)", color: "#a855f7" }}>
                  Nv.{profileData.level}
                </span>
              </div>
              <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-full rounded-full" style={{
                  width: `${levelProgress(profileData.totalXP) * 100}%`,
                  background: "linear-gradient(90deg,#7c3aed,#a855f7)",
                }}/>
              </div>
            </button>
          </div>
        )}

        {/* ── TECLAS — estilo frets do GH ── */}
        <div className="flex flex-col items-center pb-6 gap-2"
          style={{ animation: "gh-drop 1s cubic-bezier(0.34,1.56,0.64,1) 0.25s both" }}>
          <div className="flex items-center gap-2">
            {keyBindings.map((key: string, i: number) => (
              <div key={i} className="flex flex-col items-center gap-1">
                {/* Fret circle — exatamente como GH */}
                <div className="relative flex items-center justify-center"
                  style={{
                    width: "28px", height: "28px",
                    borderRadius: "50%",
                    background: `radial-gradient(circle at 35% 30%, ${LANE_COLORS[i]}ee, ${LANE_COLORS[i]}88, ${LANE_COLORS[i]}22)`,
                    border: `2px solid ${LANE_COLORS[i]}`,
                    boxShadow: `0 0 10px ${LANE_COLORS[i]}66, inset 0 2px 0 rgba(255,255,255,0.4), 0 3px 0 rgba(0,0,0,0.8)`,
                  }}>
                  {/* Shine */}
                  <div className="absolute top-1 left-1.5 w-2 h-1 rounded-full"
                    style={{ background: "rgba(255,255,255,0.5)", filter: "blur(1px)" }} />
                  <span className="text-[9px] font-black text-white relative z-10"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)", fontFamily: "'Impact', sans-serif" }}>
                    {key.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[9px] tracking-[0.5em] uppercase"
            style={{ color: "rgba(255,180,100,0.4)", fontFamily: "'Arial', sans-serif" }}>
            pressione para jogar
          </p>
        </div>
      </div>

      <style>{`
        @keyframes gh-drop {
          from { opacity: 0; transform: translateY(-30px) scale(0.92); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
