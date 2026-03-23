"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { playClickSound, playHoverSound } from "@/lib/game/sounds"
import { loadSettings, DEFAULT_KEY_BINDINGS } from "@/lib/settings"
import { loadProfile, levelProgress, getActiveTitle } from "@/lib/progression"
import { startGamepadNav, stopGamepadNav } from "@/lib/gamepad-nav"

function getVol() {
  try { const s = loadSettings(); return (s.masterVolume/100)*(s.sfxVolume/100) } catch { return 0.5 }
}

const MENU_ITEMS = [
  { label: "Jogar Solo",     path: "/songs",    icon: "🎸", badge: null },
  { label: "Desafio Diário", path: "/daily",    icon: "⚡", badge: "DIÁRIO" },
  { label: "Multiplayer",    path: "/lobby",    icon: "⚔️",  badge: null },
  { label: "Ranking",        path: "/ranking",  icon: "🏆", badge: null },
  { label: "Perfil",         path: "/profile",  icon: "👤", badge: null },
  { label: "Histórico",      path: "/history",  icon: "📋", badge: null },
  { label: "Opções",         path: "/settings", icon: "⚙️",  badge: null },
]

const FRETS = [
  { color: "#22c55e", shadow: "#15803d", key: 0 },
  { color: "#ef4444", shadow: "#b91c1c", key: 1 },
  { color: "#eab308", shadow: "#a16207", key: 2 },
  { color: "#3b82f6", shadow: "#1d4ed8", key: 3 },
  { color: "#f97316", shadow: "#c2410c", key: 4 },
]

export function MainMenu() {
  const router = useRouter()
  const [hovered,  setHovered]  = useState<number | null>(null)
  const [selected, setSelected] = useState(0)
  const [pressed,  setPressed]  = useState<number | null>(null)
  const [fretLit,  setFretLit]  = useState([false,false,false,false,false])
  const [profile,  setProfile]  = useState<{level:number;totalXP:number;displayName:string;selectedTitle?:string;selectedBorder?:string}|null>(null)
  const [bindings, setBindings] = useState<string[]>([...DEFAULT_KEY_BINDINGS])
  const [avatar,   setAvatar]   = useState("🎸")
  const [tick,     setTick]     = useState(0)
  const bgRef   = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    try { setProfile(loadProfile()) } catch {}
    try { setBindings(loadSettings().keyBindings ?? [...DEFAULT_KEY_BINDINGS]) } catch {}
    try { setAvatar(localStorage.getItem("guitar-duels-avatar") ?? "🎸") } catch {}
  }, [])

  // Keyboard + Gamepad nav
  useEffect(() => {
    const navigate = (dir: "up" | "down") => {
      if (dir === "down") setSelected(s => (s+1)%MENU_ITEMS.length)
      else                setSelected(s => (s-1+MENU_ITEMS.length)%MENU_ITEMS.length)
    }
    const confirm = (i: number) => {
      setPressed(i); playClickSound(getVol())
      setTimeout(() => { setPressed(null); router.push(MENU_ITEMS[i].path) }, 130)
    }

    startGamepadNav((action) => {
      if (action === "up")      navigate("up")
      if (action === "down")    navigate("down")
      if (action === "confirm") confirm(selected)
    })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); navigate("down") }
      if (e.key === "ArrowUp")   { e.preventDefault(); navigate("up") }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault(); confirm(selected)
      }
      const fi = bindings.map(k=>k.toLowerCase()).indexOf(e.key.toLowerCase())
      if (fi >= 0 && fi < 5) {
        setFretLit(p => { const n=[...p]; n[fi]=true; return n })
        setTimeout(() => setFretLit(p => { const n=[...p]; n[fi]=false; return n }), 200)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => { window.removeEventListener("keydown", onKey); stopGamepadNav() }
  }, [selected, router, bindings])

  // Background canvas — sepia stage with smoke, flying embers
  useEffect(() => {
    const cv = bgRef.current; if (!cv) return
    const ctx = cv.getContext("2d")!
    let W = 0, H = 0, t = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      W = cv.offsetWidth; H = cv.offsetHeight
      cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr)
      ctx.scale(dpr, dpr)
    }
    resize(); window.addEventListener("resize", resize)

    const MUSIC_NOTES = ["♩","♪","♫","♬","🎵","🎶"]
    type P = {x:number;y:number;vx:number;vy:number;r:number;a:number;life:number;max:number;type:string;note?:string;hue?:number;spin?:number}
    const particles: P[] = []

    const spawn = () => {
      const roll = Math.random()
      let type = "smoke"
      if (roll < 0.18) type = "ember"
      else if (roll < 0.30) type = "laser"
      else if (roll < 0.42) type = "note"
      else if (roll < 0.52) type = "star"

      if (type === "laser") {
        // Raios de luz verticais do palco
        particles.push({
          x: W*(0.15 + Math.random()*0.70),
          y: 0, vx: 0, vy: 0,
          r: 0.5 + Math.random()*1.5,
          a: 0.15 + Math.random()*0.25,
          life: 0, max: 120 + Math.random()*80,
          type: "laser",
          hue: 0 + Math.floor(Math.random()*3)*40, // vermelho, laranja, amarelo
        })
        return
      }
      if (type === "note") {
        particles.push({
          x: W*(0.1 + Math.random()*0.8),
          y: H*(0.5 + Math.random()*0.3),
          vx: (Math.random()-0.5)*0.8,
          vy: -(0.6 + Math.random()*1.2),
          r: 14 + Math.random()*8,
          a: 0.7 + Math.random()*0.3,
          life: 0, max: 100 + Math.random()*80,
          type: "note",
          note: MUSIC_NOTES[Math.floor(Math.random()*MUSIC_NOTES.length)],
          spin: (Math.random()-0.5)*0.05,
        })
        return
      }
      if (type === "star") {
        particles.push({
          x: Math.random()*W,
          y: Math.random()*H*0.7,
          vx: 0, vy: 0,
          r: 1 + Math.random()*2.5,
          a: 0, life: 0,
          max: 80 + Math.random()*120,
          type: "star",
          hue: Math.random()*60,
        })
        return
      }
      particles.push({
        x: W*(0.05 + Math.random()*0.9),
        y: H*(0.75 + Math.random()*0.15),
        vx: (Math.random()-0.5)*(type==="ember"?1.2:0.4),
        vy: -(type==="ember" ? 1.5+Math.random()*2.5 : 0.4+Math.random()*0.9),
        r: type==="ember" ? 1.5+Math.random()*3 : 20+Math.random()*55,
        a: type==="ember" ? 0.7+Math.random()*0.3 : 0.025+Math.random()*0.045,
        life: 0, max: type==="ember" ? 50+Math.random()*50 : 160+Math.random()*120,
        type,
      })
    }

    const drawBg = () => {
      // Deep sepia-brown background
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, "#1a0e06")
      bg.addColorStop(0.4, "#2a1508")
      bg.addColorStop(0.7, "#1e0f05")
      bg.addColorStop(1, "#0f0703")
      ctx.fillStyle = bg; ctx.fillRect(0,0,W,H)

      // Stage floor perspective
      ctx.save()
      const floorY = H * 0.72
      const floorGrad = ctx.createLinearGradient(0, floorY, 0, H)
      floorGrad.addColorStop(0, "rgba(80,50,20,0.0)")
      floorGrad.addColorStop(0.3, "rgba(90,55,22,0.85)")
      floorGrad.addColorStop(1, "rgba(60,35,12,0.95)")
      ctx.fillStyle = floorGrad
      ctx.beginPath()
      ctx.moveTo(0, H); ctx.lineTo(W, H)
      ctx.lineTo(W*0.85, floorY); ctx.lineTo(W*0.15, floorY)
      ctx.closePath(); ctx.fill()

      // Floor planks
      ctx.globalAlpha = 0.25
      for (let i=0; i<12; i++) {
        const progress = i/12
        const y = floorY + (H-floorY)*progress
        const xL = W*0.15 + (0 - W*0.15)*(progress)
        const xR = W*0.85 + (W - W*0.85)*(progress)
        ctx.strokeStyle = i%2===0 ? "rgba(120,80,30,0.6)" : "rgba(60,35,10,0.4)"
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(xL,y); ctx.lineTo(xR,y); ctx.stroke()
      }
      // Vertical plank lines converging
      for (let i=0; i<=6; i++) {
        const frac = i/6
        const topX = W*0.15 + (W*0.7)*frac
        ctx.strokeStyle = "rgba(80,50,15,0.3)"
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(topX, floorY)
        ctx.lineTo(W*frac, H)
        ctx.stroke()
      }
      ctx.restore()

      // Left poster panel  
      ctx.save()
      ctx.globalAlpha = 0.55
      ctx.fillStyle = "#3d2810"
      // Left panel (angled)
      ctx.beginPath()
      ctx.moveTo(-W*0.05, 0); ctx.lineTo(W*0.28, 0)
      ctx.lineTo(W*0.22, H*0.72); ctx.lineTo(-W*0.05, H*0.85)
      ctx.closePath(); ctx.fill()
      // Sketch lines on poster
      ctx.globalAlpha = 0.18
      ctx.strokeStyle = "#8b6030"
      ctx.lineWidth = 1.5
      for (let i=0; i<8; i++) {
        ctx.beginPath()
        ctx.moveTo(W*0.02+Math.random()*W*0.2, H*0.05+i*H*0.09)
        ctx.lineTo(W*0.04+Math.random()*W*0.18, H*0.12+i*H*0.09)
        ctx.stroke()
      }
      ctx.restore()

      // Right poster panel
      ctx.save()
      ctx.globalAlpha = 0.55
      ctx.fillStyle = "#3d2810"
      ctx.beginPath()
      ctx.moveTo(W*1.05, 0); ctx.lineTo(W*0.72, 0)
      ctx.lineTo(W*0.78, H*0.72); ctx.lineTo(W*1.05, H*0.85)
      ctx.closePath(); ctx.fill()
      ctx.restore()

      // Center vignette/spotlight
      const spot = ctx.createRadialGradient(W/2, H*0.35, 0, W/2, H*0.35, W*0.6)
      spot.addColorStop(0, "rgba(80,50,20,0.15)")
      spot.addColorStop(0.5, "rgba(20,10,3,0.0)")
      spot.addColorStop(1, "rgba(0,0,0,0.65)")
      ctx.fillStyle = spot; ctx.fillRect(0,0,W,H)

      // Red tint top
      const redTop = ctx.createLinearGradient(0,0,0,H*0.3)
      redTop.addColorStop(0,"rgba(80,15,5,0.3)")
      redTop.addColorStop(1,"transparent")
      ctx.fillStyle = redTop; ctx.fillRect(0,0,W,H*0.3)
    }

    // Spotlights state
    let spotAngle1 = 0, spotAngle2 = Math.PI/3

    const drawSpotlights = () => {
      // Dois refletores de palco oscilantes
      const floorY = H * 0.72
      spotAngle1 += 0.008; spotAngle2 -= 0.006
      const spots = [
        { ox: W*0.2, angle: spotAngle1, color: "255,80,80" },
        { ox: W*0.8, angle: spotAngle2, color: "80,120,255" },
      ]
      for (const sp of spots) {
        const tx = W/2 + Math.sin(sp.angle) * W * 0.35
        const ty = H * 0.15
        // Cone de luz
        ctx.save(); ctx.globalAlpha = 0.06
        const grad = ctx.createLinearGradient(sp.ox, floorY, tx, ty)
        grad.addColorStop(0, `rgba(${sp.color},0.8)`)
        grad.addColorStop(1, `rgba(${sp.color},0)`)
        ctx.beginPath()
        const spread = 0.08
        ctx.moveTo(sp.ox, floorY)
        ctx.lineTo(tx - W * spread, ty)
        ctx.lineTo(tx + W * spread, ty)
        ctx.closePath()
        ctx.fillStyle = grad; ctx.fill()
        ctx.restore()
        // Ponto de luz no topo
        ctx.save(); ctx.globalAlpha = 0.35
        const glow = ctx.createRadialGradient(tx, ty, 0, tx, ty, 30)
        glow.addColorStop(0, `rgba(${sp.color},0.9)`)
        glow.addColorStop(1, "transparent")
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(tx, ty, 30, 0, Math.PI*2); ctx.fill()
        ctx.restore()
      }
    }

    const drawCrowd = () => {
      // Silhuetas de multidão na parte inferior
      ctx.save()
      ctx.globalAlpha = 0.18
      const floorY = H * 0.73
      const crowdCount = Math.floor(W / 22)
      for (let i = 0; i < crowdCount; i++) {
        const cx = (i / crowdCount) * W + 11
        const sway = Math.sin(t * 1.5 + i * 0.7) * 3
        const h = 28 + Math.sin(i * 1.3) * 8
        // Corpo
        ctx.fillStyle = "#0a0501"
        ctx.beginPath()
        ctx.ellipse(cx, floorY + sway, 7, h * 0.55, 0, 0, Math.PI * 2)
        ctx.fill()
        // Cabeça
        ctx.beginPath()
        ctx.arc(cx + sway * 0.3, floorY - h * 0.55 + sway, 5, 0, Math.PI * 2)
        ctx.fill()
        // Braços levantados alternando
        if (Math.floor(t * 1.2 + i * 0.5) % 2 === 0) {
          ctx.beginPath()
          ctx.moveTo(cx - 4, floorY - h * 0.2 + sway)
          ctx.lineTo(cx - 12, floorY - h * 0.55 + sway - 8)
          ctx.lineWidth = 2; ctx.strokeStyle = "#0a0501"; ctx.stroke()
        } else {
          ctx.beginPath()
          ctx.moveTo(cx + 4, floorY - h * 0.2 + sway)
          ctx.lineTo(cx + 12, floorY - h * 0.55 + sway - 8)
          ctx.lineWidth = 2; ctx.strokeStyle = "#0a0501"; ctx.stroke()
        }
      }
      ctx.restore()
    }

    const drawLightning = () => {
      // Relâmpagos aleatórios ocasionais
      if (Math.random() > 0.015) return
      ctx.save(); ctx.globalAlpha = 0.7
      ctx.strokeStyle = Math.random() > 0.5 ? "#ffcc44" : "#ff6644"
      ctx.lineWidth = 1.5
      ctx.shadowColor = "#ff8800"; ctx.shadowBlur = 12
      const sx = Math.random() * W
      let lx = sx, ly = H * 0.05
      ctx.beginPath(); ctx.moveTo(lx, ly)
      while (ly < H * 0.45) {
        lx += (Math.random() - 0.5) * 40
        ly += 15 + Math.random() * 20
        ctx.lineTo(lx, ly)
      }
      ctx.stroke(); ctx.restore()
    }

    const draw = (ts: number) => {
      t = ts * 0.001
      ctx.clearRect(0,0,W,H)
      drawBg()
      drawSpotlights()
      drawCrowd()
      drawLightning()

      if (Math.random() < 0.14) spawn()

      for (let i=particles.length-1; i>=0; i--) {
        const p = particles[i]; p.life++
        if (p.life >= p.max) { particles.splice(i,1); continue }
        const lr = p.life/p.max
        p.x += p.vx + Math.sin(p.life*0.1+i)*0.2
        p.y += p.vy; p.vy *= 0.994
        if (p.type === "smoke") {
          p.r *= 1.004
          const fade = lr<0.15 ? lr/0.15 : 1-(lr-0.15)/0.85
          ctx.save(); ctx.globalAlpha = p.a * fade
          const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r)
          g.addColorStop(0,"rgba(50,32,14,0.9)")
          g.addColorStop(0.5,"rgba(30,18,7,0.5)")
          g.addColorStop(1,"transparent")
          ctx.fillStyle=g; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill()
          ctx.restore()
        } else {
          const fade = (1-lr)*(1-lr)
          const gv = Math.round(Math.max(0,120*(1-lr*1.5)))
          ctx.save(); ctx.globalAlpha = p.a*fade*0.8
          const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r)
          g.addColorStop(0,"rgba(255,240,160,1)")
          g.addColorStop(0.4,`rgba(255,${gv},0,1)`)
          g.addColorStop(1,"transparent")
          ctx.fillStyle=g; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill()
          ctx.restore()
        }
      }

      // Scanlines
      ctx.save(); ctx.globalAlpha = 0.03
      for (let y=0; y<H; y+=3) {
        ctx.fillStyle = "rgba(0,0,0,1)"
        ctx.fillRect(0,y,W,1)
      }
      ctx.restore()

      setTick(t => t+1)
      animRef.current = requestAnimationFrame(draw)
    }
    animRef.current = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener("resize", resize) }
  }, [])

  const handleClick = useCallback((i:number, path:string) => {
    playClickSound(getVol()); setPressed(i)
    setTimeout(() => { setPressed(null); router.push(path) }, 130)
  }, [router])

  const activeIdx = hovered ?? selected

  return (
    <div className="relative w-full overflow-hidden select-none"
      style={{ height:"100dvh", background:"#0f0703", fontFamily:"'Impact','Arial Black',sans-serif" }}>

      {/* Background canvas */}
      <canvas ref={bgRef} className="absolute inset-0 w-full h-full" style={{zIndex:0}}/>

      {/* Content */}
      <div className="relative flex flex-col items-center h-full" style={{zIndex:2}}>

        {/* ── LOGO ── */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center"
          style={{height:"27%", paddingTop:"1%", animation:"gh3-drop 0.5s cubic-bezier(.34,1.56,.64,1) both"}}>

          {/* Star ornament */}
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"2px"}}>
            <div style={{height:"1px",width:"32px",background:"linear-gradient(90deg,transparent,#c8922a)"}}/>
            <span style={{color:"#e8b84a",fontSize:"11px",textShadow:"0 0 8px #e8b84a"}}>★</span>
            <div style={{height:"1px",width:"32px",background:"linear-gradient(90deg,#c8922a,transparent)"}}/>
          </div>

          {/* GUITAR */}
          <div style={{position:"relative"}}>
            <h1 style={{
              margin:0, lineHeight:1,
              fontSize:"clamp(2.8rem,7.5vw,5.2rem)",
              fontFamily:"'Impact','Arial Black',sans-serif",
              fontWeight:900, letterSpacing:"0.06em",
              color:"#f5e8cc",
              textShadow:"2px 2px 0 #5a2800, 4px 4px 0 #3a1800, 0 0 30px rgba(220,140,20,0.4)",
              WebkitTextStroke:"1.5px rgba(90,40,5,0.6)",
            }}>GUITAR</h1>
          </div>

          {/* DUELS */}
          <div style={{position:"relative",marginTop:"-6px"}}>
            <h1 style={{
              margin:0, lineHeight:1,
              fontSize:"clamp(3rem,8vw,5.6rem)",
              fontFamily:"'Impact','Arial Black',sans-serif",
              fontWeight:900, letterSpacing:"0.06em",
              background:"linear-gradient(180deg,#ffe566 0%,#d4820a 40%,#8a3200 100%)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
              filter:"drop-shadow(2px 3px 0 rgba(60,15,0,0.95)) drop-shadow(0 0 20px rgba(210,110,5,0.5))",
            }}>DUELS</h1>
          </div>

          {/* Subtitle ribbon */}
          <div style={{
            marginTop:"6px", padding:"2px 20px",
            background:"linear-gradient(90deg,transparent,rgba(180,100,10,0.35),transparent)",
            borderTop:"1px solid rgba(200,150,50,0.2)",
            borderBottom:"1px solid rgba(200,150,50,0.2)",
          }}>
            <p style={{
              margin:0, fontSize:"clamp(7px,1vw,10px)",
              letterSpacing:"0.55em", textTransform:"uppercase",
              color:"rgba(210,170,100,0.7)", fontFamily:"Arial,sans-serif", fontWeight:700,
            }}>Batalhas de Guitarra</p>
          </div>
        </div>

        {/* ── MENU PANEL ── GH3 metal frame style */}
        <div className="flex-1 flex items-center justify-center w-full"
          style={{paddingBottom:"0.5%"}}>

          <div style={{
            width:"min(420px,56vw)",
            animation:"gh3-drop 0.45s cubic-bezier(.34,1.56,.64,1) 0.06s both",
          }}>

            {/* Metal frame — outer */}
            <div style={{
              background:"linear-gradient(180deg,#3a3028 0%,#1e1610 40%,#151008 100%)",
              border:"2px solid #5a4020",
              borderRadius:"6px",
              boxShadow:"0 0 0 1px #8a6030, 0 0 30px rgba(0,0,0,0.8), inset 0 1px 0 rgba(180,140,60,0.2)",
              padding:"5px",
            }}>
              {/* Inner panel */}
              <div style={{
                background:"linear-gradient(180deg,#0d0906 0%,#120c06 100%)",
                border:"1px solid #2a1c0c",
                borderRadius:"3px",
                padding:"4px 4px",
              }}>

                {MENU_ITEMS.map((item, i) => {
                  const isActive = activeIdx === i
                  const isPrs    = pressed === i

                  return (
                    <button key={item.label}
                      onClick={() => handleClick(i, item.path)}
                      onMouseEnter={() => { playHoverSound(getVol()); setHovered(i); setSelected(i) }}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        display:"flex", alignItems:"center",
                        width:"100%", padding:"0 10px",
                        height:"clamp(36px,5.2vh,46px)",
                        marginBottom: i < MENU_ITEMS.length-1 ? "3px" : "0",
                        position:"relative", overflow:"hidden",
                        border:"none", outline:"none", cursor:"pointer",
                        borderRadius:"3px",
                        // GH3-style button — dark metal with color tint on hover
                        background: isActive
                          ? "linear-gradient(90deg,#3a0808 0%,#6a1010 20%,#5a0d0d 50%,#6a1010 80%,#3a0808 100%)"
                          : isPrs
                          ? "linear-gradient(90deg,#200505,#380808)"
                          : "linear-gradient(90deg,#1a1208 0%,#2a1e0e 30%,#221608 60%,#2a1e0e 80%,#1a1208 100%)",
                        transform: isPrs ? "scaleY(0.96)" : "scaleY(1)",
                        transition:"transform 55ms ease",
                        boxShadow: isActive
                          ? "inset 0 1px 0 rgba(255,80,80,0.3), inset 0 -1px 0 rgba(255,0,0,0.15), 0 0 12px rgba(200,20,20,0.4)"
                          : "inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.3)",
                      }}>

                      {/* Active left glow bar */}
                      {isActive && (
                        <div style={{
                          position:"absolute",left:0,top:0,bottom:0,width:"3px",
                          background:"linear-gradient(180deg,#ff4444,#cc0000,#ff4444)",
                          boxShadow:"0 0 8px #ff0000",
                        }}/>
                      )}

                      {/* Rivets top/bottom */}
                      <div style={{position:"absolute",top:"3px",left:"8px",width:"4px",height:"4px",
                        borderRadius:"50%",background:"radial-gradient(circle at 35% 30%,#8a7050,#4a3020)",
                        boxShadow:"0 1px 0 rgba(0,0,0,0.5)"}}/>
                      <div style={{position:"absolute",bottom:"3px",left:"8px",width:"4px",height:"4px",
                        borderRadius:"50%",background:"radial-gradient(circle at 35% 30%,#8a7050,#4a3020)",
                        boxShadow:"0 1px 0 rgba(0,0,0,0.5)"}}/>
                      <div style={{position:"absolute",top:"3px",right:"8px",width:"4px",height:"4px",
                        borderRadius:"50%",background:"radial-gradient(circle at 35% 30%,#8a7050,#4a3020)",
                        boxShadow:"0 1px 0 rgba(0,0,0,0.5)"}}/>
                      <div style={{position:"absolute",bottom:"3px",right:"8px",width:"4px",height:"4px",
                        borderRadius:"50%",background:"radial-gradient(circle at 35% 30%,#8a7050,#4a3020)",
                        boxShadow:"0 1px 0 rgba(0,0,0,0.5)"}}/>

                      {/* Label */}
                      <span style={{
                        flex:1, textAlign:"center",
                        fontSize:"clamp(13px,2.1vw,18px)",
                        fontFamily:"'Impact','Arial Black',sans-serif",
                        fontWeight:900, letterSpacing:"0.04em",
                        color: isActive ? "#ffffff" : "#c8a878",
                        textShadow: isActive
                          ? "0 0 15px rgba(255,180,180,0.8), 0 2px 0 rgba(0,0,0,0.9)"
                          : "0 2px 0 rgba(0,0,0,0.8)",
                        transition:"color 60ms",
                      }}>{item.label}</span>

                      {/* Badge */}
                      {item.badge && (
                        <span style={{
                          fontSize:"clamp(9px,1.2vw,12px)", fontWeight:900,
                          fontFamily:"Impact,sans-serif", letterSpacing:"0.05em",
                          color:"#ff4400", textShadow:"0 0 8px rgba(255,80,0,0.8)",
                          marginLeft:"4px",
                        }}>{item.badge}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Profile belt below panel */}
            {profile && (
              <button onClick={()=>{playClickSound(getVol());router.push("/profile")}}
                style={{
                  display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",
                  width:"100%", marginTop:"4px", padding:"5px 12px",
                  background:"linear-gradient(90deg,#2a1c0a,#3a2810,#2a1c0a)",
                  border:"1px solid #5a3c18",
                  borderRadius:"4px",
                  boxShadow:"0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(180,130,50,0.15)",
                  cursor:"pointer",
                }}>
                <span style={{fontSize:"14px"}}>{avatar}</span>
                <span style={{fontSize:"clamp(8px,1vw,11px)",fontWeight:700,
                  color:"rgba(220,185,110,0.9)",fontFamily:"Arial,sans-serif"}}>
                  {profile.displayName}
                </span>
                {(() => {
                  const t = getActiveTitle(profile as any)
                  return t ? (
                    <span style={{fontSize:"clamp(6px,.8vw,9px)",padding:"1px 5px",borderRadius:"8px",
                      background:`${t.color}22`,color:t.color,fontWeight:900,border:`1px solid ${t.color}44`}}>
                      {t.icon} {t.label}
                    </span>
                  ) : null
                })()}
                <span style={{fontSize:"clamp(7px,.9vw,10px)",padding:"1px 5px",borderRadius:"8px",
                  background:"rgba(168,85,247,0.3)",color:"#c084fc",fontWeight:900}}>
                  Nv.{profile.level}
                </span>
                <div style={{width:"clamp(24px,3vw,40px)",height:"3px",borderRadius:"2px",
                  background:"rgba(0,0,0,0.5)",overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:"2px",
                    background:"linear-gradient(90deg,#7c3aed,#a855f7)",
                    width:`${levelProgress(profile.totalXP)*100}%`}}/>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* ── BOTTOM BAR — GH3 style ── */}
        <div className="flex-shrink-0 w-full"
          style={{animation:"gh3-up 0.5s cubic-bezier(.34,1.56,.64,1) 0.12s both"}}>

          {/* Fret buttons row */}
          <div style={{
            display:"flex", alignItems:"center", justifyContent:"center",
            gap:"clamp(8px,1.8vw,18px)", paddingBottom:"4px",
          }}>
            {FRETS.map((fret, i) => {
              const lit = fretLit[i]
              return (
                <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"2px"}}>
                  <div style={{
                    width:"clamp(26px,3.2vw,38px)", height:"clamp(26px,3.2vw,38px)",
                    borderRadius:"50%",
                    background: lit
                      ? `radial-gradient(circle at 35% 28%,#ffffff,${fret.color},${fret.shadow})`
                      : `radial-gradient(circle at 35% 28%,${fret.color}cc,${fret.color}88,${fret.shadow}66)`,
                    border:`2.5px solid ${lit ? "#fff" : fret.color}`,
                    boxShadow: lit
                      ? `0 0 20px 6px ${fret.color}, inset 0 2px 0 rgba(255,255,255,0.6)`
                      : `0 0 8px ${fret.color}55, inset 0 2px 0 rgba(255,255,255,0.35), 0 3px 0 rgba(0,0,0,0.7)`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    position:"relative", transition:"all .08s ease",
                    transform: lit ? "scale(1.2) translateY(-2px)" : "scale(1)",
                  }}>
                    {/* Shine */}
                    <div style={{
                      position:"absolute",top:"3px",left:"5px",
                      width:"35%",height:"25%",
                      borderRadius:"50%",
                      background:"rgba(255,255,255,0.55)",
                      filter:"blur(1px)",
                    }}/>
                    <span style={{
                      fontSize:"clamp(8px,1vw,11px)", fontWeight:900,
                      color:"#fff", fontFamily:"Impact,sans-serif",
                      textShadow:"0 1px 3px rgba(0,0,0,0.9)", zIndex:1,
                    }}>{bindings[i]?.toUpperCase()}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* GH3-style bottom controls bar */}
          <div style={{
            display:"flex", alignItems:"center", justifyContent:"center",
            gap:"clamp(12px,3vw,28px)",
            padding:"5px 16px 8px",
            background:"linear-gradient(180deg,rgba(10,6,2,0) 0%,rgba(5,3,1,0.9) 100%)",
          }}>
            {[
              { key: "⬤", color:"#22c55e", label:"SELECT" },
              { key: "⬤", color:"#ef4444", label:"BACK"   },
              { key: "▬▬", color:"#aaa",    label:"UP/DOWN" },
            ].map((ctrl, i) => (
              <div key={i} style={{display:"flex",alignItems:"center",gap:"5px"}}>
                <span style={{
                  fontSize: i===2 ? "14px" : "10px",
                  color: ctrl.color,
                  textShadow:`0 0 6px ${ctrl.color}`,
                  lineHeight:1,
                }}>{ctrl.key}</span>
                <span style={{
                  fontSize:"clamp(7px,.9vw,10px)", fontWeight:700,
                  color:"rgba(200,170,110,0.7)", fontFamily:"Arial,sans-serif",
                  letterSpacing:"0.05em",
                }}>{ctrl.label}</span>
              </div>
            ))}
          </div>

          {/* PRESSIONE PARA JOGAR */}
          <div style={{
            textAlign:"center", paddingBottom:"6px",
            fontSize:"clamp(10px,1.6vw,15px)",
            fontFamily:"'Impact','Arial Black',sans-serif",
            fontWeight:900, letterSpacing:"0.18em",
            color:"#e8c060",
            textShadow:"0 0 15px rgba(220,160,20,0.6), 0 2px 0 rgba(0,0,0,0.9)",
            animation:"blink 1.4s ease-in-out infinite",
          }}>PRESSIONE PARA JOGAR</div>
        </div>
      </div>

      <style>{`
        @keyframes gh3-drop { from{opacity:0;transform:translateY(-20px) scale(.95)} to{opacity:1;transform:none} }
        @keyframes gh3-up   { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:none} }
        @keyframes blink    { 0%,100%{opacity:1} 50%{opacity:0.45} }
      `}</style>
    </div>
  )
}
