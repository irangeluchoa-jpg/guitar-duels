/**
 * GH3-style shared UI components — all drawn in pure CSS/SVG
 * No external assets needed.
 */

// ── Shared color tokens ──────────────────────────────────────────────────────
export const GH = {
  bg:        "#1a0d00",
  sepia:     "#2a1800",
  panel:     "#1c1c1c",
  panelEdge: "#3a3a3a",
  rivet:     "#888",
  red:       "#cc0000",
  redHot:    "#ff2200",
  redBorder: "#ff4400",
  gold:      "#d4a017",
  goldLight: "#ffe066",
  cream:     "#f5e6c0",
  text:      "#ffffff",
  textDim:   "rgba(255,255,255,0.55)",
  frets:     ["#ef4444","#f97316","#eab308","#22c55e","#38bdf8","#a855f7"],
}

// ── Metal panel with corner rivets ──────────────────────────────────────────
export function MetalPanel({
  children, className = "", style = {},
  glowColor = GH.red,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  glowColor?: string
}) {
  const rivetSize = 10
  return (
    <div className={className} style={{
      position: "relative",
      background: "linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 40%, #111 100%)",
      border: `2px solid ${GH.panelEdge}`,
      borderRadius: "4px",
      boxShadow: `0 0 0 1px rgba(0,0,0,0.8), 0 0 30px ${glowColor}44, 0 8px 32px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)`,
      ...style,
    }}>
      {/* Carbon fibre texture overlay */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "3px",
        backgroundImage: `repeating-linear-gradient(
          45deg,
          rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px,
          transparent 1px, transparent 4px
        )`,
        pointerEvents: "none",
      }}/>
      {/* Corner rivets */}
      {[["4px","4px"],["calc(100% - 14px)","4px"],["4px","calc(100% - 14px)"],["calc(100% - 14px)","calc(100% - 14px)"]].map(([l,t],i) => (
        <div key={i} style={{
          position: "absolute", left: l, top: t,
          width: rivetSize, height: rivetSize, borderRadius: "50%",
          background: "radial-gradient(circle at 35% 30%, #ccc, #666 50%, #333)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.3)",
          pointerEvents: "none", zIndex: 2,
        }}/>
      ))}
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  )
}

// ── Red GH3-style button ─────────────────────────────────────────────────────
export function GHButton({
  children, onClick, disabled = false, style = {}, size = "md",
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  style?: React.CSSProperties
  size?: "sm" | "md" | "lg"
}) {
  const heights: Record<string, string> = { sm:"36px", md:"46px", lg:"58px" }
  const fonts:   Record<string, string> = { sm:"14px", md:"18px", lg:"24px" }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%", height: heights[size],
        position: "relative", overflow: "hidden",
        border: "none", outline: "none", cursor: disabled ? "default" : "pointer",
        borderRadius: "3px",
        background: disabled
          ? "linear-gradient(180deg,#444 0%,#2a2a2a 100%)"
          : "linear-gradient(180deg,#dd1111 0%,#aa0000 45%,#880000 100%)",
        boxShadow: disabled ? "none" : "0 0 0 1px #ff220044, 0 0 20px #cc000066, 0 3px 0 #550000, 0 4px 0 rgba(0,0,0,0.5)",
        transform: "translateY(0)",
        transition: "all 0.07s ease",
        ...style,
      }}
      onMouseDown={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(2px)" }}
      onMouseUp={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)" }}
      onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)" }}
    >
      {/* Shine strip */}
      {!disabled && <div style={{
        position:"absolute", top:0, left:0, right:0, height:"42%",
        background:"linear-gradient(180deg,rgba(255,255,255,0.18),transparent)",
        pointerEvents:"none",
      }}/>}
      <span style={{
        position: "relative", zIndex: 1,
        fontFamily: "'Impact','Arial Black',sans-serif",
        fontSize: fonts[size], fontWeight: 900, letterSpacing: "0.08em",
        color: disabled ? "#666" : GH.text,
        textShadow: disabled ? "none" : "0 1px 0 rgba(0,0,0,0.6), 0 0 12px rgba(255,100,100,0.4)",
      }}>{children}</span>
    </button>
  )
}

// ── Wood-plank menu row ──────────────────────────────────────────────────────
export function WoodRow({
  children, active = false, pressed = false, onClick, onMouseEnter, onMouseLeave,
  style = {},
}: {
  children: React.ReactNode
  active?: boolean
  pressed?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  style?: React.CSSProperties
}) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "relative", overflow: "hidden",
        height: "42px", cursor: "pointer",
        background: pressed
          ? "linear-gradient(180deg,#2a1500 0%,#3a1e08 50%,#2a1500 100%)"
          : active
          ? "linear-gradient(180deg,#7a4818 0%,#9a5a20 35%,#8a5020 65%,#6a3c14 100%)"
          : "linear-gradient(180deg,#4a2a0e 0%,#6a3c18 35%,#5a3214 65%,#3a2008 100%)",
        borderTop:    "1px solid rgba(255,200,100,0.15)",
        borderBottom: "1px solid rgba(0,0,0,0.5)",
        transition: "all 0.06s ease",
        transform: pressed ? "scaleY(0.96)" : "scaleY(1)",
        boxShadow: active ? `inset 0 0 0 2px ${GH.gold}, 0 0 12px ${GH.gold}44` : "none",
        ...style,
      }}
    >
      {/* Wood grain lines */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none", opacity: 0.4,
        backgroundImage: "repeating-linear-gradient(90deg,transparent,transparent 22px,rgba(0,0,0,0.08) 22px,rgba(0,0,0,0.08) 23px)",
      }}/>
      {/* Shine on hover */}
      {active && !pressed && <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        background:"linear-gradient(100deg,transparent 15%,rgba(255,210,80,0.1) 45%,rgba(255,240,160,0.15) 55%,transparent 80%)",
        animation:"wood-sheen 1.8s linear infinite",
      }}/>}
      {/* Top edge highlight */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:"1px", background:"rgba(255,200,100,0.25)", pointerEvents:"none" }}/>
      {/* Metal brackets left/right */}
      {["left","right"].map(side => (
        <div key={side} style={{
          position:"absolute", [side]:0, top:0, bottom:0, width:"28px",
          background:`linear-gradient(${side==="left"?"90deg":"270deg"},rgba(160,120,60,0.9),rgba(110,80,35,0.5))`,
          borderRight: side==="left" ? "1px solid rgba(90,60,20,0.8)" : "none",
          borderLeft:  side==="right"? "1px solid rgba(90,60,20,0.8)" : "none",
          pointerEvents:"none",
        }}/>
      ))}
      <div style={{ position:"relative", zIndex:1 }}>{children}</div>
    </div>
  )
}

// ── Fret bar (bottom of screen) ──────────────────────────────────────────────
export function FretBar({
  bindings, litStates, profile, onProfileClick,
}: {
  bindings: string[]
  litStates: boolean[]
  profile: { displayName:string; level:number; totalXP:number } | null
  onProfileClick: () => void
}) {
  const fretColors = GH.frets
  return (
    <div style={{
      position:"relative", display:"flex", flexDirection:"column", alignItems:"center",
      paddingBottom:"8px", gap:"6px",
    }}>
      {/* Leather strap / belt */}
      <div style={{
        width:"min(380px,70vw)", height:"28px", borderRadius:"14px",
        background:"linear-gradient(180deg,#6b3d12 0%,#8b5020 40%,#7a4018 60%,#5a3010 100%)",
        border:"1px solid #3a1c08",
        boxShadow:"0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,180,80,0.2)",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 12px", position:"relative", overflow:"hidden",
      }}>
        {/* Stitching */}
        <div style={{
          position:"absolute", inset:"3px 8px",
          border:"1px dashed rgba(255,160,60,0.2)",
          borderRadius:"10px", pointerEvents:"none",
        }}/>
        {/* Buckle left */}
        <div style={{
          width:"18px", height:"14px", borderRadius:"3px",
          background:"linear-gradient(135deg,#bbb,#777,#444)",
          boxShadow:"inset 0 1px 0 rgba(255,255,255,0.3)",
        }}/>
        {/* Profile info center */}
        {profile ? (
          <button onClick={onProfileClick} style={{
            display:"flex", alignItems:"center", gap:"5px",
            background:"transparent", border:"none", cursor:"pointer",
          }}>
            <span style={{fontSize:"11px", fontFamily:"Impact,sans-serif", color:"rgba(240,200,120,0.9)", letterSpacing:"0.05em"}}>
              {profile.displayName}
            </span>
            <span style={{
              fontSize:"8px", padding:"1px 5px", borderRadius:"8px",
              background:"rgba(168,85,247,0.35)", color:"#c084fc", fontWeight:900, fontFamily:"Impact,sans-serif",
            }}>Nv.{profile.level}</span>
          </button>
        ) : (
          <span style={{fontSize:"11px", fontFamily:"Impact,sans-serif", color:"rgba(240,200,120,0.4)", letterSpacing:"0.08em"}}>ÍCONE</span>
        )}
        {/* Skull right */}
        <span style={{fontSize:"14px", filter:"drop-shadow(0 0 4px rgba(255,100,0,0.5))"}}>💀</span>
      </div>

      {/* Fret circles row */}
      <div style={{display:"flex", gap:"clamp(6px,1.6vw,16px)", alignItems:"center"}}>
        {fretColors.slice(0,5).map((col,i) => {
          const lit = litStates[i]
          return (
            <div key={i} style={{
              width:"clamp(22px,3vw,36px)", height:"clamp(22px,3vw,36px)",
              borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
              background: lit
                ? `radial-gradient(circle at 35% 30%, #fff, ${col}, ${col}88)`
                : `radial-gradient(circle at 35% 30%, ${col}ee, ${col}88, ${col}22)`,
              border: `2px solid ${col}`,
              boxShadow: lit
                ? `0 0 16px 4px ${col}, inset 0 2px 0 rgba(255,255,255,0.5)`
                : `0 0 8px ${col}55, inset 0 2px 0 rgba(255,255,255,0.35), 0 2px 0 rgba(0,0,0,0.8)`,
              transform: lit ? "scale(1.2)" : "scale(1)",
              transition: "all 0.08s ease",
            }}>
              <span style={{
                fontSize:"clamp(7px,0.9vw,10px)", fontWeight:900,
                color:"#fff", fontFamily:"Impact,sans-serif",
                textShadow:"0 1px 2px rgba(0,0,0,0.9)",
              }}>{bindings[i]?.toUpperCase()}</span>
            </div>
          )
        })}
      </div>

      {/* Control hints */}
      <div style={{display:"flex", gap:"16px", alignItems:"center"}}>
        {[
          {col:"#22c55e", label:"SELECT"},
          {col:"#ef4444", label:"BACK"},
          {col:"#888",    label:"UP/DOWN"},
        ].map(({col,label}) => (
          <div key={label} style={{display:"flex", alignItems:"center", gap:"4px"}}>
            <div style={{
              width:"12px", height:"12px", borderRadius:"2px",
              background:`radial-gradient(circle at 35% 30%,${col}ee,${col}66)`,
              border:`1px solid ${col}`,
              boxShadow:`0 0 5px ${col}55`,
            }}/>
            <span style={{
              fontSize:"clamp(7px,0.8vw,9px)", fontFamily:"Impact,sans-serif",
              color:"rgba(255,255,255,0.4)", letterSpacing:"0.08em",
            }}>{label}</span>
          </div>
        ))}
      </div>

      <p style={{
        fontSize:"clamp(9px,1.1vw,12px)", letterSpacing:"0.4em",
        fontFamily:"Impact,'Arial Black',sans-serif",
        color:"rgba(255,200,80,0.55)", textTransform:"uppercase",
        textShadow:"0 0 10px rgba(255,150,0,0.3)",
      }}>PRESSIONE PARA JOGAR</p>
    </div>
  )
}

// ── GH3 Logo (CSS only) ──────────────────────────────────────────────────────
export function GHLogo({ subtitle = "BATALHAS DE GUITARRA" }: { subtitle?: string }) {
  return (
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"center",
      fontFamily:"'Impact','Arial Black',sans-serif",
    }}>
      {/* Star divider */}
      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"2px"}}>
        <div style={{height:"1px",width:"32px",background:"linear-gradient(90deg,transparent,rgba(210,160,60,0.8))"}}/>
        <span style={{fontSize:"11px",color:"#d4a017",filter:"drop-shadow(0 0 5px #d4a017)",animation:"star-twinkle 2.5s ease-in-out infinite"}}>★</span>
        <div style={{height:"1px",width:"32px",background:"linear-gradient(90deg,rgba(210,160,60,0.8),transparent)"}}/>
      </div>

      {/* GUITAR */}
      <div style={{lineHeight:1, position:"relative"}}>
        <h1 style={{
          margin:0, fontSize:"clamp(2.8rem,7.5vw,5.2rem)", fontWeight:900, lineHeight:1,
          color:"#f0e2c0",
          WebkitTextStroke:"2px rgba(90,40,5,0.7)",
          textShadow:"0 0 25px rgba(200,140,30,0.5), 2px 3px 0 rgba(60,20,0,0.95), 5px 5px 0 rgba(30,10,0,0.6)",
          letterSpacing:"0.06em",
        }}>GUITAR</h1>
      </div>

      {/* DUELS */}
      <div style={{lineHeight:1, marginTop:"-6px", position:"relative"}}>
        <h1 style={{
          margin:0, fontSize:"clamp(3rem,8vw,5.6rem)", fontWeight:900, lineHeight:1,
          background:"linear-gradient(180deg,#ffe033 0%,#d47c05 40%,#7a2e00 100%)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          filter:"drop-shadow(0 0 16px rgba(210,120,5,0.65)) drop-shadow(2px 4px 0 rgba(40,10,0,0.95))",
          letterSpacing:"0.06em",
        }}>DUELS</h1>
        {/* Subtitle ribbon */}
        <div style={{
          position:"absolute", bottom:"-14px", left:"50%", transform:"translateX(-50%)",
          whiteSpace:"nowrap",
          background:"linear-gradient(90deg,transparent,rgba(180,100,5,0.5),rgba(180,100,5,0.5),transparent)",
          padding:"1px 16px",
        }}>
          <span style={{
            fontSize:"clamp(7px,1vw,10px)", letterSpacing:"0.5em",
            fontFamily:"'Arial',sans-serif", fontWeight:700,
            color:"rgba(210,165,90,0.7)", textTransform:"uppercase",
          }}>{subtitle}</span>
        </div>
      </div>
    </div>
  )
}

// ── Stage background canvas (drawn in SVG inline style) ──────────────────────
export function StageBackground({ children }: { children?: React.ReactNode }) {
  return (
    <div style={{
      position:"absolute", inset:0, overflow:"hidden",
      background:"linear-gradient(180deg,#0d0800 0%,#1a0d02 40%,#251408 70%,#1a0d04 100%)",
    }}>
      {/* Left poster — hand-drawn skull band poster */}
      <svg viewBox="0 0 300 500" style={{
        position:"absolute", left:"-3%", top:"5%", height:"90%", width:"auto",
        transform:"rotate(-6deg) skewY(2deg)",
        filter:"sepia(0.8) brightness(0.55) contrast(1.1)",
        opacity:0.85,
      }}>
        {/* Poster board */}
        <rect x="10" y="10" width="280" height="480" rx="4" fill="#c8a060" stroke="#7a5020" strokeWidth="3"/>
        <rect x="18" y="18" width="264" height="464" rx="2" fill="#b89050" stroke="#6a4018" strokeWidth="1"/>
        {/* Rough border scrawl */}
        <rect x="22" y="22" width="256" height="456" rx="2" fill="none" stroke="#3a1808" strokeWidth="2" strokeDasharray="8,3" opacity="0.5"/>
        {/* Big skull */}
        <ellipse cx="150" cy="160" rx="75" ry="80" fill="#2a1408" opacity="0.9"/>
        <ellipse cx="150" cy="145" rx="60" ry="65" fill="none" stroke="#1a0c04" strokeWidth="3"/>
        {/* Eye sockets */}
        <ellipse cx="125" cy="145" rx="18" ry="22" fill="#c8a060"/>
        <ellipse cx="175" cy="145" rx="18" ry="22" fill="#c8a060"/>
        {/* Nose */}
        <path d="M145,175 L155,175 L150,190 Z" fill="#c8a060"/>
        {/* Teeth */}
        {[0,1,2,3,4].map(i=><rect key={i} x={120+i*14} y="195" width="10" height="20" rx="2" fill="#c8a060" stroke="#1a0c04" strokeWidth="1"/>)}
        {/* Microphone */}
        <rect x="135" y="215" width="30" height="60" rx="5" fill="#1a0c04" stroke="#3a2010" strokeWidth="2"/>
        <ellipse cx="150" cy="215" rx="22" ry="18" fill="#2a1808" stroke="#3a2010" strokeWidth="2"/>
        {/* Stars */}
        {[[60,350],[100,390],[200,360],[240,400],[150,420]].map(([sx,sy],i)=>(
          <text key={i} x={sx} y={sy} fontSize="22" fill="#2a1408" textAnchor="middle">★</text>
        ))}
        {/* Band name text scrawl */}
        <text x="150" y="320" fontSize="28" fontWeight="bold" fontFamily="Impact" fill="#1a0c04" textAnchor="middle" transform="rotate(-3,150,320)">GLAMORA</text>
        <text x="150" y="348" fontSize="13" fontFamily="Arial" fill="#2a1408" textAnchor="middle">MAY 1ST @ THE MOOSE</text>
        {/* Flames at bottom */}
        <path d="M20,480 Q50,440 60,470 Q80,430 90,465 Q110,425 120,460 Q140,420 150,455 Q165,415 175,455 Q190,420 200,458 Q215,430 230,465 Q245,435 260,470 Q270,445 280,480Z" fill="#2a1408" opacity="0.7"/>
        {/* VLAD text */}
        <text x="50" y="450" fontSize="42" fontWeight="900" fontFamily="Impact" fill="#1a0c04" opacity="0.6">VLAD</text>
        {/* Bat decorations */}
        <path d="M60,80 Q70,65 80,70 Q75,58 85,62 Q80,75 90,80 Q80,82 60,80Z" fill="#1a0c04"/>
        <path d="M230,90 Q225,75 215,78 Q218,65 210,68 Q215,80 205,88 Q215,90 230,90Z" fill="#1a0c04"/>
      </svg>

      {/* Right poster — demon/devil poster */}
      <svg viewBox="0 0 300 500" style={{
        position:"absolute", right:"-3%", top:"3%", height:"88%", width:"auto",
        transform:"rotate(5deg) skewY(-2deg)",
        filter:"sepia(0.8) brightness(0.5) contrast(1.1)",
        opacity:0.82,
      }}>
        <rect x="10" y="10" width="280" height="480" rx="4" fill="#c8a060" stroke="#7a5020" strokeWidth="3"/>
        <rect x="18" y="18" width="264" height="464" rx="2" fill="#b89050" stroke="#6a4018" strokeWidth="1"/>
        <rect x="22" y="22" width="256" height="456" rx="2" fill="none" stroke="#3a1808" strokeWidth="2" strokeDasharray="8,3" opacity="0.5"/>
        {/* Demon head */}
        <ellipse cx="150" cy="160" rx="70" ry="75" fill="none" stroke="#1a0c04" strokeWidth="3"/>
        {/* Horns */}
        <path d="M115,100 Q105,60 95,40 Q110,65 120,90Z" fill="#1a0c04"/>
        <path d="M185,100 Q195,60 205,40 Q190,65 180,90Z" fill="#1a0c04"/>
        {/* Face */}
        <ellipse cx="130" cy="155" rx="15" ry="18" fill="#1a0c04"/>
        <ellipse cx="170" cy="155" rx="15" ry="18" fill="#1a0c04"/>
        {/* Star in eyes */}
        <text x="130" y="162" fontSize="16" fill="#c8a060" textAnchor="middle">★</text>
        <text x="170" y="162" fontSize="16" fill="#c8a060" textAnchor="middle">★</text>
        {/* Mouth */}
        <path d="M120,190 Q150,215 180,190" fill="none" stroke="#1a0c04" strokeWidth="3"/>
        {/* Fangs */}
        <path d="M135,190 L130,210 L140,190Z" fill="#c8a060"/>
        <path d="M165,190 L160,210 L170,190Z" fill="#c8a060"/>
        {/* Scythe */}
        <rect x="210" y="150" width="8" height="200" rx="3" fill="#1a0c04"/>
        <path d="M218,150 Q270,130 265,185 Q240,165 218,185Z" fill="#1a0c04"/>
        {/* Text */}
        <text x="150" y="310" fontSize="22" fontWeight="bold" fontFamily="Impact" fill="#1a0c04" textAnchor="middle">SHY DETH</text>
        <text x="150" y="335" fontSize="22" fontWeight="bold" fontFamily="Impact" fill="#1a0c04" textAnchor="middle">VITTEN</text>
        <text x="150" y="380" fontSize="13" fontFamily="Arial" fill="#2a1408" textAnchor="middle">call 2 Rock</text>
        {/* Phone numbers */}
        <text x="150" y="400" fontSize="11" fontFamily="Arial" fill="#2a1408" textAnchor="middle">555-666-1234</text>
        <text x="150" y="415" fontSize="11" fontFamily="Arial" fill="#2a1408" textAnchor="middle">555-666-5678</text>
        {/* Puzzle border pieces */}
        {[40,120,200,280].map((py,i)=>(
          <path key={i} d={`M280,${py} Q295,${py+10} 290,${py+20} Q295,${py+30} 280,${py+40}`} fill="none" stroke="#7a5020" strokeWidth="3"/>
        ))}
        {/* Lightning bolts */}
        <path d="M50,60 L40,90 L55,90 L45,120 L65,80 L50,80 L60,55Z" fill="#1a0c04" opacity="0.7"/>
        <path d="M235,250 L225,280 L240,280 L230,310 L250,270 L235,270 L245,245Z" fill="#1a0c04" opacity="0.7"/>
      </svg>

      {/* Floor planks */}
      <div style={{
        position:"absolute", bottom:0, left:0, right:0, height:"28%",
        background:"linear-gradient(180deg,transparent 0%,#1a0c04 20%,#251408 100%)",
      }}>
        {/* Wood planks */}
        {[0,1,2,3,4,5,6,7].map(i=>(
          <div key={i} style={{
            position:"absolute", bottom:0, left:`${i*14-2}%`, width:"13%", height:"100%",
            background:`linear-gradient(90deg,rgba(0,0,0,0.3),transparent,rgba(0,0,0,0.2))`,
            borderLeft:"1px solid rgba(100,60,20,0.3)",
          }}/>
        ))}
        {/* Fret rings on floor */}
        {[22,36,50,64,78].map((x,i)=>(
          <div key={i} style={{
            position:"absolute", bottom:"12%", left:`${x}%`, transform:"translateX(-50%)",
            width:"6%", aspectRatio:"1/0.4",
            borderRadius:"50%",
            border:`3px solid rgba(255,255,255,0.15)`,
            boxShadow:`0 0 10px rgba(255,255,255,0.08), inset 0 0 6px rgba(0,0,0,0.5)`,
          }}/>
        ))}
      </div>

      {/* Center tunnel vignette */}
      <div style={{
        position:"absolute", inset:0,
        background:"radial-gradient(ellipse 60% 70% at 50% 45%, transparent 30%, rgba(5,2,0,0.65) 100%)",
        pointerEvents:"none",
      }}/>

      {/* Spotlight cone from top */}
      <div style={{
        position:"absolute", top:0, left:"50%", transform:"translateX(-50%)",
        width:"40%", height:"60%",
        background:"radial-gradient(ellipse at 50% 0%, rgba(255,200,100,0.06) 0%, transparent 70%)",
        pointerEvents:"none",
      }}/>

      {children}
    </div>
  )
}
