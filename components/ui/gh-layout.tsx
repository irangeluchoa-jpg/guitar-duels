"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { playClickSound, playHoverSound } from "@/lib/game/sounds"
import { loadSettings } from "@/lib/settings"

function getVol() {
  try { const s = loadSettings(); return (s.masterVolume/100)*(s.sfxVolume/100) } catch { return 0.5 }
}

// ── Canvas de fundo animado (chamas + partículas) — compartilhado ─────────────
export function GHBackground({ children }: { children?: React.ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef(0)
  const tsRef     = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext("2d")!

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize(); window.addEventListener("resize", resize)

    type P = { x:number;y:number;vx:number;vy:number;size:number;alpha:number;life:number;maxLife:number;type:"flame"|"ember" }
    const ps: P[] = []

    function spawn() {
      const w = canvas.width, h = canvas.height
      ps.push({ x:Math.random()*w, y:h+8, vx:(Math.random()-.5)*.7, vy:-(1.4+Math.random()*2.2),
        size:3+Math.random()*10, alpha:.55+Math.random()*.4, life:0, maxLife:70+Math.random()*90,
        type: Math.random()<.14 ? "ember" : "flame" })
    }

    function draw(ts: number) {
      tsRef.current = ts
      const w = canvas.width, h = canvas.height
      const t = ts * .001

      // Background
      const bg = ctx.createLinearGradient(0,0,0,h)
      bg.addColorStop(0,"#000000"); bg.addColorStop(.5,"#0a0004"); bg.addColorStop(1,"#180008")
      ctx.fillStyle = bg; ctx.fillRect(0,0,w,h)

      // Subtle grid
      ctx.save(); ctx.globalAlpha = .025
      for(let i=0;i<8;i++){ ctx.beginPath(); ctx.moveTo((w/7)*i,0); ctx.lineTo((w/7)*i,h); ctx.strokeStyle="#fff"; ctx.lineWidth=1; ctx.stroke() }
      for(let i=0;i<5;i++){ ctx.beginPath(); ctx.moveTo(0,(h/4)*i); ctx.lineTo(w,(h/4)*i); ctx.strokeStyle="#fff"; ctx.lineWidth=1; ctx.stroke() }
      ctx.restore()

      // Central glow
      const pulse = .88 + Math.sin(t*1.1)*.12
      const glow = ctx.createRadialGradient(w/2,h*.42,0,w/2,h*.42,w*.52*pulse)
      glow.addColorStop(0,`rgba(190,18,28,${.13*pulse})`); glow.addColorStop(.45,`rgba(140,12,18,${.07*pulse})`); glow.addColorStop(1,"transparent")
      ctx.fillStyle=glow; ctx.fillRect(0,0,w,h)

      // Light rays
      ctx.save(); ctx.globalAlpha=.02+Math.sin(t*.65)*.008
      for(let i=0;i<8;i++){
        const a=(i/8)*Math.PI*2+t*.07
        ctx.beginPath(); ctx.moveTo(w/2,h*.42); ctx.lineTo(w/2+Math.cos(a)*w,h*.42+Math.sin(a)*h)
        ctx.strokeStyle="#ff4400"; ctx.lineWidth=28; ctx.stroke()
      }
      ctx.restore()

      // Embers on floor
      const emCount = Math.floor(5+Math.sin(t*.3)*3)
      for(let e=0;e<emCount;e++){
        const ex = ((e*317+ts*.02)%1000)/1000*w
        const ey = h-.94*h+((e*53)%100)/100*(h*.12)
        const ea = .08+Math.sin(t*.5+e)*.05
        ctx.beginPath(); ctx.arc(ex,ey,1+Math.sin(t+e)*.5,0,Math.PI*2)
        ctx.fillStyle=`rgba(255,160,30,${ea})`; ctx.fill()
      }

      // Spawn + draw particles
      if(Math.random()<.32) spawn()
      for(let i=ps.length-1;i>=0;i--){
        const p=ps[i]; p.life++
        if(p.life>=p.maxLife){ps.splice(i,1);continue}
        const lr=p.life/p.maxLife
        p.x+=p.vx+Math.sin(p.life*.14)*.28; p.y+=p.vy; p.vy*=.993
        ctx.save()
        if(p.type==="flame"){
          const r=255,g=Math.round(Math.max(0,155*(1-lr*1.3))),b=0
          ctx.globalAlpha=p.alpha*(1-lr)*(1-lr)
          const fg=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.size*(1-lr*.5))
          fg.addColorStop(0,`rgba(255,255,200,${p.alpha})`); fg.addColorStop(.3,`rgba(${r},${g},${b},${p.alpha*.8})`); fg.addColorStop(1,"transparent")
          ctx.fillStyle=fg; ctx.beginPath(); ctx.arc(p.x,p.y,p.size*(1-lr*.5),0,Math.PI*2); ctx.fill()
        } else {
          ctx.globalAlpha=p.alpha*(1-lr)*.85; ctx.fillStyle=`hsl(25,100%,65%)`
          ctx.shadowColor="rgba(255,120,0,.8)"; ctx.shadowBlur=6
          ctx.beginPath(); ctx.arc(p.x,p.y,p.size*.35,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0
        }
        ctx.restore()
      }

      // Smoke vignette
      ctx.save()
      const sv=ctx.createLinearGradient(0,h*.55,0,0)
      sv.addColorStop(0,"rgba(0,0,0,0)"); sv.addColorStop(.5,"rgba(0,0,0,.18)"); sv.addColorStop(1,"rgba(0,0,0,.55)")
      ctx.fillStyle=sv; ctx.fillRect(0,0,w,h); ctx.restore()

      // Edge vignette
      const ev=ctx.createRadialGradient(w/2,h/2,w*.3,w/2,h/2,w*.8)
      ev.addColorStop(0,"transparent"); ev.addColorStop(1,"rgba(0,0,0,.82)")
      ctx.fillStyle=ev; ctx.fillRect(0,0,w,h)

      animRef.current=requestAnimationFrame(draw)
    }
    animRef.current=requestAnimationFrame(draw)
    return ()=>{ cancelAnimationFrame(animRef.current); window.removeEventListener("resize",resize) }
  },[])

  return (
    <div className="relative w-full h-screen overflow-hidden select-none" style={{ fontFamily:"'Impact','Arial Black',sans-serif", background:"#000" }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {/* Scanlines */}
      <div className="pointer-events-none absolute inset-0 z-10"
        style={{ backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.17) 3px,rgba(0,0,0,.17) 4px)" }} />
      <div className="relative z-20 w-full h-full">
        {children}
      </div>
    </div>
  )
}

// ── Logo GH3 compacta (usada em sub-telas) ────────────────────────────────────
export function GHLogo({ size = "sm" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: { title:"text-4xl", duels:"text-[2.6rem]" }, md: { title:"text-5xl", duels:"text-6xl" }, lg: { title:"text-[5.5rem]", duels:"text-[5.8rem]" } }
  const s = sizes[size]
  return (
    <div className="flex flex-col items-center leading-none">
      <h1 className={`${s.title} font-black tracking-tight leading-none`}
        style={{ fontFamily:"'Impact','Arial Black',sans-serif", color:"#fff",
          WebkitTextStroke:"2px rgba(200,30,30,.5)",
          textShadow:"0 0 30px rgba(255,30,0,.8),0 0 60px rgba(200,10,0,.4),3px 3px 0 rgba(120,0,0,.9),6px 6px 0 rgba(60,0,0,.6)",
          letterSpacing:"-.02em" }}>
        GUITAR
      </h1>
      <h1 className={`${s.duels} font-black tracking-tight leading-none -mt-1`}
        style={{ fontFamily:"'Impact','Arial Black',sans-serif",
          background:"linear-gradient(180deg,#ffdd00 0%,#ff8800 40%,#cc3300 100%)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          filter:"drop-shadow(0 0 18px rgba(255,100,0,.8)) drop-shadow(3px 3px 0 rgba(100,20,0,.9))",
          letterSpacing:"-.02em" }}>
        DUELS
      </h1>
    </div>
  )
}

// ── Botão de voltar GH3 ───────────────────────────────────────────────────────
export function GHBackButton({ label = "Voltar" }: { label?: string }) {
  const router = useRouter()
  return (
    <button
      onClick={() => { playClickSound(getVol()); router.back() }}
      onMouseEnter={() => playHoverSound(getVol())}
      className="flex items-center gap-2 px-4 py-2 transition-all hover:scale-105 active:scale-95"
      style={{ fontFamily:"'Impact','Arial Black',sans-serif",
        background:"linear-gradient(90deg,rgba(180,0,20,.7),rgba(140,0,15,.5))",
        border:"1px solid rgba(255,80,80,.4)", borderRadius:"4px",
        color:"rgba(255,180,180,.9)", letterSpacing:".06em", fontSize:"13px",
        boxShadow:"0 0 12px rgba(200,0,0,.3)" }}>
      ‹ {label}
    </button>
  )
}

// ── Card de conteúdo GH3 ──────────────────────────────────────────────────────
export function GHCard({ children, className="" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`}
      style={{ background:"linear-gradient(135deg,rgba(20,8,35,.92),rgba(12,4,22,.95))",
        border:"1px solid rgba(180,80,255,.18)", borderRadius:"6px",
        boxShadow:"0 4px 24px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.05)" }}>
      {/* Top colored stripe */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background:"linear-gradient(90deg,transparent,rgba(220,100,255,.5),transparent)" }} />
      {children}
    </div>
  )
}

// ── Título de seção estilo GH ─────────────────────────────────────────────────
export function GHSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-px flex-1" style={{ background:"linear-gradient(90deg,transparent,rgba(255,60,0,.6))" }} />
      <h2 className="text-sm tracking-[.3em] uppercase"
        style={{ fontFamily:"'Arial Black',sans-serif", color:"rgba(255,180,100,.8)", fontWeight:900 }}>
        {children}
      </h2>
      <div className="h-px flex-1" style={{ background:"linear-gradient(90deg,rgba(255,60,0,.6),transparent)" }} />
    </div>
  )
}

// ── Input estilo GH ───────────────────────────────────────────────────────────
export function GHInput({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block mb-1.5 text-[10px] uppercase tracking-[.3em]"
        style={{ color:"rgba(255,180,100,.6)", fontFamily:"'Arial Black',sans-serif" }}>
        {label}
      </label>
      <input {...props}
        className="w-full h-11 px-4 text-sm font-medium outline-none transition-all"
        style={{ background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,80,80,.25)",
          borderRadius:"4px", color:"#fff", fontFamily:"'Arial',sans-serif",
          ...props.style }} />
    </div>
  )
}

// ── Botão primário GH (vermelho) ──────────────────────────────────────────────
export function GHButton({ children, variant="primary", loading=false, ...props }:
  { children: React.ReactNode; variant?:"primary"|"secondary"|"ghost"; loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {

  const base = "flex items-center justify-center gap-2 px-6 h-12 font-black text-sm tracking-wide transition-all hover:scale-[1.02] active:scale-[.97] disabled:opacity-50 relative overflow-hidden"

  const styles = {
    primary:   { background:"linear-gradient(90deg,#990018,#cc001f,#990018)", border:"2px solid rgba(255,80,80,.55)", color:"#fff", boxShadow:"0 0 20px rgba(200,0,0,.4), inset 0 1px 0 rgba(255,150,150,.2)" },
    secondary: { background:"linear-gradient(90deg,#111118,#1a1a26,#111118)", border:"1px solid rgba(255,255,255,.12)", color:"rgba(255,255,255,.75)", boxShadow:"0 2px 10px rgba(0,0,0,.5)" },
    ghost:     { background:"transparent", border:"1px solid rgba(255,80,80,.3)", color:"rgba(255,150,150,.8)" },
  }

  return (
    <button {...props}
      onMouseEnter={e => { playHoverSound(getVol()); props.onMouseEnter?.(e) }}
      onClick={e => { playClickSound(getVol()); props.onClick?.(e) }}
      className={`${base} ${props.className||""}`}
      style={{ borderRadius:"4px", fontFamily:"'Impact','Arial Black',sans-serif", letterSpacing:".06em", ...styles[variant], ...props.style }}>
      {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : children}
    </button>
  )
}
