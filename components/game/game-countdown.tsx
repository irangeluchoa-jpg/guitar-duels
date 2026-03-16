"use client"

import { useEffect, useState } from "react"

export function GameCountdown({ count }: { count: number }) {
  const [phase, setPhase] = useState<"enter"|"hold"|"exit">("enter")
  const [shockwave, setShockwave] = useState(false)

  useEffect(() => {
    setPhase("enter"); setShockwave(false)
    const t1 = setTimeout(() => setShockwave(true), 30)
    const t2 = setTimeout(() => setPhase("hold"), 80)
    const t3 = setTimeout(() => setPhase("exit"), 700)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [count])

  const isGo = count <= 0
  const color = isGo ? "#22c55e" : count === 1 ? "#ef4444" : count === 2 ? "#f97316" : "#eab308"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Dark overlay */}
      <div style={{
        position:"absolute",inset:0,
        background:"rgba(0,0,0,0.55)",
        opacity: phase==="exit" ? 0 : 1,
        transition:"opacity 0.3s ease-out",
      }}/>

      {/* Shockwave rings */}
      {shockwave && [0,1,2].map(i=>(
        <div key={i} style={{
          position:"absolute",
          width:"clamp(80px,15vw,120px)", height:"clamp(80px,15vw,120px)",
          borderRadius:"50%",
          border:`3px solid ${color}`,
          animation:`shockwave-out ${0.6+i*0.15}s ease-out ${i*0.08}s forwards`,
          opacity:0,
        }}/>
      ))}

      {/* Main number/text */}
      <div style={{
        position:"relative", zIndex:2,
        fontSize: isGo ? "clamp(5rem,15vw,10rem)" : "clamp(6rem,18vw,12rem)",
        fontFamily:"'Impact','Arial Black',sans-serif",
        fontWeight:900,
        color:"#fff",
        textShadow:`0 0 40px ${color}, 0 0 80px ${color}88, 4px 4px 0 rgba(0,0,0,0.8)`,
        transform: phase==="enter" ? "scale(1.8)" : phase==="exit" ? "scale(0.6)" : "scale(1)",
        opacity: phase==="exit" ? 0 : 1,
        transition: phase==="enter"
          ? "transform 0.08s cubic-bezier(0.34,1.56,0.64,1), opacity 0.05s"
          : "transform 0.3s ease-out, opacity 0.3s ease-out",
        letterSpacing:"-0.02em",
        WebkitTextStroke:`2px ${color}88`,
      }}>
        {isGo ? "GO!" : count}
      </div>

      {/* Color flash on screen edges */}
      {phase !== "exit" && (
        <div style={{
          position:"absolute",inset:0,
          background:`radial-gradient(ellipse 50% 50% at 50% 50%, transparent 40%, ${color}22 100%)`,
          animation:"edge-pulse 0.4s ease-out forwards",
        }}/>
      )}

      <style>{`
        @keyframes shockwave-out {
          0%   { transform:scale(0.2); opacity:0.8; }
          100% { transform:scale(4);   opacity:0; }
        }
        @keyframes edge-pulse {
          0%   { opacity:1; }
          100% { opacity:0; }
        }
      `}</style>
    </div>
  )
}
