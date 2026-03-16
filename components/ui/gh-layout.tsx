"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { playClickSound, playHoverSound } from "@/lib/game/sounds"
import { loadSettings } from "@/lib/settings"

function getVol() {
  try { const s = loadSettings(); return (s.masterVolume/100)*(s.sfxVolume/100) } catch { return 0.5 }
}

// ── GH3-style sepia background ──────────────────────────────────────────────
export function GHBackground({ children }: { children?: React.ReactNode }) {
  const cvRef  = useRef<HTMLCanvasElement>(null)
  const animRef = useRef(0)

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return
    const ctx = cv.getContext("2d")!
    let W=0, H=0

    const resize = () => {
      const dpr = window.devicePixelRatio||1
      W=cv.offsetWidth; H=cv.offsetHeight
      cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr)
      ctx.scale(dpr,dpr)
    }
    resize(); window.addEventListener("resize",resize)

    type P={x:number;y:number;vx:number;vy:number;r:number;a:number;life:number;max:number;ember:boolean}
    const ps:P[]=[]
    const spawn=()=>{ const e=Math.random()<0.28; ps.push({
      x:W*(0.05+Math.random()*.9), y:H*(0.78+Math.random()*.12),
      vx:(Math.random()-.5)*(e?1.1:.35), vy:-(e?1.4+Math.random()*2.2:.35+Math.random()*.8),
      r:e?1.5+Math.random()*2.8:18+Math.random()*48,
      a:e?.65+Math.random()*.3:.022+Math.random()*.042,
      life:0, max:e?48+Math.random()*48:155+Math.random()*110, ember:e
    })}

    const draw=()=>{
      ctx.clearRect(0,0,W,H)
      // BG gradient
      const bg=ctx.createLinearGradient(0,0,0,H)
      bg.addColorStop(0,"#190d05"); bg.addColorStop(.45,"#281305"); bg.addColorStop(1,"#0e0703")
      ctx.fillStyle=bg; ctx.fillRect(0,0,W,H)
      // Side panels
      ctx.save(); ctx.globalAlpha=.45
      ctx.fillStyle="#3a2610"
      ctx.beginPath(); ctx.moveTo(-W*.04,0); ctx.lineTo(W*.26,0); ctx.lineTo(W*.2,H*.78); ctx.lineTo(-W*.04,H*.9); ctx.closePath(); ctx.fill()
      ctx.beginPath(); ctx.moveTo(W*1.04,0); ctx.lineTo(W*.74,0); ctx.lineTo(W*.8,H*.78); ctx.lineTo(W*1.04,H*.9); ctx.closePath(); ctx.fill()
      ctx.restore()
      // Sketch lines on panels
      ctx.save(); ctx.globalAlpha=.12; ctx.strokeStyle="#7a5525"; ctx.lineWidth=1.2
      for(let i=0;i<6;i++){
        ctx.beginPath(); ctx.moveTo(W*.02+Math.random()*W*.2,H*.08+i*H*.13); ctx.lineTo(W*.04+Math.random()*W*.18,H*.16+i*H*.13); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(W*.78+Math.random()*W*.18,H*.08+i*H*.13); ctx.lineTo(W*.76+Math.random()*W*.18,H*.16+i*H*.13); ctx.stroke()
      }
      ctx.restore()
      // Vignette
      const vig=ctx.createRadialGradient(W/2,H*.4,0,W/2,H*.4,W*.65)
      vig.addColorStop(0,"rgba(0,0,0,0)"); vig.addColorStop(1,"rgba(0,0,0,0.72)")
      ctx.fillStyle=vig; ctx.fillRect(0,0,W,H)
      // Red top tint
      const rt=ctx.createLinearGradient(0,0,0,H*.28)
      rt.addColorStop(0,"rgba(70,12,4,.28)"); rt.addColorStop(1,"transparent")
      ctx.fillStyle=rt; ctx.fillRect(0,0,W,H*.28)
      // Particles
      if(Math.random()<.12) spawn()
      for(let i=ps.length-1;i>=0;i--){
        const p=ps[i]; p.life++
        if(p.life>=p.max){ps.splice(i,1);continue}
        p.x+=p.vx+Math.sin(p.life*.09+i)*.18; p.y+=p.vy; p.vy*=.993
        if(!p.ember){p.r*=1.003}
        const lr=p.life/p.max
        if(p.ember){
          const fade=(1-lr)*(1-lr)
          const gv=Math.round(Math.max(0,110*(1-lr*1.5)))
          ctx.save(); ctx.globalAlpha=p.a*fade*.75
          const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r)
          g.addColorStop(0,"rgba(255,240,140,1)"); g.addColorStop(.45,`rgba(255,${gv},0,1)`); g.addColorStop(1,"transparent")
          ctx.fillStyle=g; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); ctx.restore()
        } else {
          const fade=lr<.14?lr/.14:1-(lr-.14)/.86
          ctx.save(); ctx.globalAlpha=p.a*fade
          const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r)
          g.addColorStop(0,"rgba(48,30,12,.88)"); g.addColorStop(.5,"rgba(28,16,6,.5)"); g.addColorStop(1,"transparent")
          ctx.fillStyle=g; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); ctx.restore()
        }
      }
      animRef.current=requestAnimationFrame(draw)
    }
    animRef.current=requestAnimationFrame(draw)
    return()=>{cancelAnimationFrame(animRef.current);window.removeEventListener("resize",resize)}
  },[])

  return (
    <div className="relative w-full overflow-hidden" style={{height:"100dvh",background:"#0e0703",fontFamily:"'Impact','Arial Black',sans-serif"}}>
      <canvas ref={cvRef} className="absolute inset-0 w-full h-full" style={{zIndex:0}}/>
      <div className="relative h-full flex flex-col" style={{zIndex:2}}>{children}</div>
      <style>{`
        @keyframes gh3-in  { from{opacity:0;transform:translateY(-16px) scale(.96)} to{opacity:1;transform:none} }
        @keyframes gh3-up  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        @keyframes gh3-blink { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes gh3-shine { from{left:-60%} to{left:120%} }
      `}</style>
    </div>
  )
}

// ── GH3 Logo ────────────────────────────────────────────────────────────────
export function GHLogo({ size="md" }: { size?:"sm"|"md" }) {
  const big = size==="md"
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",animation:"gh3-in .45s cubic-bezier(.34,1.56,.64,1) both"}}>
      <div style={{display:"flex",alignItems:"center",gap:"7px",marginBottom:"1px"}}>
        <div style={{height:"1px",width:"28px",background:"linear-gradient(90deg,transparent,#c8902a)"}}/>
        <span style={{color:"#e8b84a",fontSize:"10px",textShadow:"0 0 7px #e8b84a"}}>★</span>
        <div style={{height:"1px",width:"28px",background:"linear-gradient(90deg,#c8902a,transparent)"}}/>
      </div>
      <h1 style={{
        margin:0,lineHeight:1,
        fontSize: big ? "clamp(2.4rem,6.5vw,4.4rem)" : "clamp(1.6rem,4.5vw,3rem)",
        fontFamily:"'Impact','Arial Black',sans-serif",fontWeight:900,letterSpacing:".06em",
        color:"#f4e6ca",
        textShadow:"2px 2px 0 #5a2600,4px 4px 0 #3a1600,0 0 25px rgba(210,130,15,.35)",
        WebkitTextStroke:"1.5px rgba(80,35,5,.55)",
      }}>GUITAR</h1>
      <h1 style={{
        margin:0,lineHeight:1,marginTop:"-5px",
        fontSize: big ? "clamp(2.6rem,7vw,4.8rem)" : "clamp(1.8rem,5vw,3.2rem)",
        fontFamily:"'Impact','Arial Black',sans-serif",fontWeight:900,letterSpacing:".06em",
        background:"linear-gradient(180deg,#ffe055 0%,#d07808 40%,#883000 100%)",
        WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
        filter:"drop-shadow(2px 3px 0 rgba(55,12,0,.95)) drop-shadow(0 0 18px rgba(200,100,5,.45))",
      }}>DUELS</h1>
      <p style={{
        margin:"4px 0 0",fontSize:"clamp(6px,.85vw,9px)",
        letterSpacing:".5em",textTransform:"uppercase",
        color:"rgba(205,165,85,.6)",fontFamily:"Arial,sans-serif",fontWeight:700,
      }}>Batalhas de Guitarra</p>
    </div>
  )
}

// ── GH3 Metal Panel ─────────────────────────────────────────────────────────
export function GHCard({ children, className, style }: { children:React.ReactNode; className?:string; style?:React.CSSProperties }) {
  return (
    <div className={className} style={{
      background:"linear-gradient(180deg,#3a3028,#1e1610 40%,#151008)",
      border:"2px solid #5a4020",borderRadius:"6px",
      boxShadow:"0 0 0 1px #8a6030,0 0 28px rgba(0,0,0,.75),inset 0 1px 0 rgba(180,140,55,.18)",
      padding:"5px",
      ...style,
    }}>
      <div style={{
        background:"linear-gradient(180deg,#0d0906,#120c06)",
        border:"1px solid #2a1c0c",borderRadius:"3px",
        padding:"10px 12px",
      }}>
        {children}
      </div>
    </div>
  )
}

// ── GH3 Section Title ────────────────────────────────────────────────────────
export function GHSectionTitle({ children }: { children:React.ReactNode }) {
  return (
    <div style={{textAlign:"center",marginBottom:"12px"}}>
      <h2 style={{
        margin:0,
        fontSize:"clamp(12px,2vw,17px)",
        fontFamily:"'Impact','Arial Black',sans-serif",
        fontWeight:900,letterSpacing:".18em",textTransform:"uppercase",
        color:"#e8c060",
        textShadow:"0 0 14px rgba(220,155,15,.6),0 2px 0 rgba(0,0,0,.9)",
      }}>{children}</h2>
      <div style={{height:"1px",background:"linear-gradient(90deg,transparent,rgba(200,150,40,.5),transparent)",marginTop:"4px"}}/>
    </div>
  )
}

// ── GH3 Red Button ───────────────────────────────────────────────────────────
export function GHButton({ children, onClick, disabled, style }: {
  children:React.ReactNode; onClick?:()=>void; disabled?:boolean; style?:React.CSSProperties
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        position:"relative",overflow:"hidden",
        width:"100%",padding:"10px 24px",
        background:disabled
          ?"linear-gradient(180deg,#2a2018,#1a1208)"
          :"linear-gradient(180deg,#cc1010 0%,#8a0808 40%,#700606 60%,#8a0808 100%)",
        border:disabled?"1px solid #3a2810":"1px solid #ff4444",
        borderRadius:"4px",
        boxShadow:disabled?"none":"0 0 0 1px #660000,0 4px 0 #440000,0 0 20px rgba(180,0,0,.35),inset 0 1px 0 rgba(255,100,100,.3)",
        cursor:disabled?"not-allowed":"pointer",
        transform:"translateY(0)",
        transition:"transform 60ms,box-shadow 60ms",
        fontFamily:"'Impact','Arial Black',sans-serif",
        fontSize:"clamp(14px,2.2vw,20px)",
        fontWeight:900,letterSpacing:".1em",
        color:disabled?"rgba(200,170,100,.35)":"#ffffff",
        textShadow:disabled?"none":"0 0 12px rgba(255,180,180,.7),0 2px 0 rgba(0,0,0,.9)",
        ...style,
      }}
      onMouseDown={e=>{if(!disabled)(e.currentTarget.style.transform="translateY(2px)")}}
      onMouseUp={e=>{(e.currentTarget.style.transform="translateY(0)")}}
      onMouseLeave={e=>{(e.currentTarget.style.transform="translateY(0)")}}>
      {/* Shine sweep */}
      {!disabled&&<div style={{
        position:"absolute",top:0,left:"-60%",width:"40%",height:"100%",
        background:"linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent)",
        animation:"gh3-shine 2.5s linear infinite",
      }}/>}
      {children}
    </button>
  )
}

// ── GH3 Input ────────────────────────────────────────────────────────────────
export function GHInput({ label, value, onChange, placeholder, maxLength, onKeyDown }: {
  label?:string; value:string; onChange:(e:React.ChangeEvent<HTMLInputElement>)=>void
  placeholder?:string; maxLength?:number; onKeyDown?:(e:React.KeyboardEvent<HTMLInputElement>)=>void
}) {
  return (
    <div>
      {label&&<label style={{display:"block",marginBottom:"4px",fontSize:"clamp(9px,1.1vw,11px)",
        fontWeight:700,letterSpacing:".25em",textTransform:"uppercase",
        color:"rgba(205,165,80,.7)",fontFamily:"Arial,sans-serif"}}>{label}</label>}
      <input value={value} onChange={onChange} placeholder={placeholder} maxLength={maxLength} onKeyDown={onKeyDown}
        style={{
          width:"100%",padding:"8px 12px",
          background:"#0a0806",border:"1px solid #5a4020",borderRadius:"3px",
          color:"#f0e0b0",fontFamily:"Arial,sans-serif",fontSize:"clamp(12px,1.6vw,15px)",
          boxShadow:"inset 0 2px 6px rgba(0,0,0,.5),0 0 0 1px rgba(200,150,40,.08)",
          outline:"none",
        }}/>
    </div>
  )
}

// ── GH3 Back Button ──────────────────────────────────────────────────────────
export function GHBackButton({ label="Menu", href="/" }: { label?:string; href?:string }) {
  const router = useRouter()
  return (
    <button onClick={()=>{playClickSound(getVol());router.push(href)}}
      style={{
        display:"flex",alignItems:"center",gap:"5px",padding:"5px 10px",
        background:"rgba(0,0,0,.4)",border:"1px solid rgba(120,80,20,.4)",borderRadius:"3px",
        color:"rgba(200,165,80,.65)",fontFamily:"'Impact',sans-serif",
        fontSize:"clamp(10px,1.2vw,13px)",letterSpacing:".08em",cursor:"pointer",
      }}>
      ← {label}
    </button>
  )
}

// ── GH3 Bottom Controls Bar ──────────────────────────────────────────────────
export function GHBottomBar() {
  return (
    <div style={{
      display:"flex",flexDirection:"column",alignItems:"center",
      padding:"4px 0 8px",
      background:"linear-gradient(180deg,transparent,rgba(5,3,1,.85))",
    }}>
      <div style={{display:"flex",alignItems:"center",gap:"clamp(10px,2.5vw,24px)"}}>
        {[
          {key:"⬤",color:"#22c55e",label:"SELECT"},
          {key:"⬤",color:"#ef4444",label:"BACK"},
          {key:"▬▬",color:"#aaa",label:"UP/DOWN"},
        ].map((c,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:"4px"}}>
            <span style={{fontSize:i===2?"13px":"9px",color:c.color,textShadow:`0 0 5px ${c.color}`,lineHeight:1}}>{c.key}</span>
            <span style={{fontSize:"clamp(7px,.85vw,10px)",fontWeight:700,
              color:"rgba(195,162,100,.65)",fontFamily:"Arial,sans-serif",letterSpacing:".04em"}}>{c.label}</span>
          </div>
        ))}
      </div>
      <div style={{
        marginTop:"3px",fontSize:"clamp(9px,1.4vw,13px)",
        fontFamily:"'Impact','Arial Black',sans-serif",fontWeight:900,letterSpacing:".16em",
        color:"#e0b840",textShadow:"0 0 14px rgba(215,148,10,.55),0 2px 0 rgba(0,0,0,.9)",
        animation:"gh3-blink 1.4s ease-in-out infinite",
      }}>PRESSIONE PARA JOGAR</div>
    </div>
  )
}
