"use client"

import { useEffect, useState, useRef } from "react"
import type { GameStats } from "@/lib/game/engine"
import { getAccuracy, getGrade } from "@/lib/game/engine"
import { submitGlobalScore, submitDailyScore, getTodayKey } from "@/lib/supabase"

const GRADE_COLORS: Record<string,string> = {
  "S+":"#ffd700","S":"#ffd700","A":"#22c55e","B":"#3b82f6","C":"#f97316","D":"#ef4444","F":"#6b7280"
}

interface Props {
  stats: GameStats
  meta: { id?:string; name:string; artist:string; albumArt?:string; songLength?:number }
  laneCount: 4|5|6
  onRestart?: () => void
  onBack?: () => void
  onNext?: () => void
  isMultiplayer?: boolean
  allPlayers?: Array<{id:string;name:string;score:number}>
  myId?: string
}

export function GameOverScreen({ stats, meta, laneCount, onRestart, onBack, onNext, isMultiplayer, allPlayers, myId }: Props) {
  const accuracy = Math.round(getAccuracy(stats))
  const isFC     = stats.miss === 0
  const grade    = getGrade(getAccuracy(stats), isFC)
  const gradeColor = GRADE_COLORS[grade] ?? "#fff"

  const [phase,       setPhase]       = useState<"grade"|"stats"|"buttons">("grade")
  const [scoreDisplay, setScoreDisplay] = useState(0)
  const [starsShown,  setStarsShown]  = useState(0)
  const [newRecord,   setNewRecord]   = useState(false)
  const [prevBest,    setPrevBest]    = useState<number|null>(null)
  const [particles,   setParticles]   = useState<Array<{id:number;x:number;y:number;color:string;size:number;vx:number;vy:number;life:number}>>([])
  const animRef = useRef<ReturnType<typeof setInterval>|null>(null)
  const partId  = useRef(0)

  useEffect(() => {
    try {
      const profileRaw = localStorage.getItem("guitar-duels-profile")
      const profileName = profileRaw ? (JSON.parse(profileRaw).displayName||"") : ""
      const playerName = sessionStorage.getItem("playerName")||profileName||"Guitarrista"
      const scoresRaw = localStorage.getItem("guitar-duels-scores")
      const scores: Array<{trackId:string;score:number;[k:string]:unknown}> = scoresRaw?JSON.parse(scoresRaw):[]
      const personal = scores.filter(s=>s.trackId===(meta.id||"unknown")).sort((a,b)=>b.score-a.score)
      const oldBest = personal[0]?.score??null
      setPrevBest(oldBest)
      if (oldBest!==null&&stats.score>oldBest) setNewRecord(true)
      else if (oldBest===null&&stats.score>0) setNewRecord(true)

      const entry = {
        playerName, trackId:meta.id||"unknown", songName:meta.name, artist:meta.artist,
        score:stats.score, accuracy, grade, maxCombo:stats.maxCombo,
        perfect:stats.perfect, great:stats.great, good:stats.good, miss:stats.miss,
        isFC, date:new Date().toISOString(),
      }
      const existingIdx = scores.findIndex(s=>s.trackId===(meta.id||"unknown"))
      if (existingIdx===-1) scores.push(entry)
      else if (stats.score>(scores[existingIdx].score as number)) { scores.splice(existingIdx,1); scores.push(entry) }
      scores.sort((a,b)=>b.score-a.score)
      localStorage.setItem("guitar-duels-scores", JSON.stringify(scores.slice(0,200)))
      const bestPerSong: Record<string,{score:number;grade:string}> = {}
      for (const s of scores as any[]) {
        if (!bestPerSong[s.trackId]||s.score>bestPerSong[s.trackId].score) bestPerSong[s.trackId]={score:s.score,grade:s.grade}
      }
      localStorage.setItem("gh-best-scores", JSON.stringify(bestPerSong))
      submitGlobalScore({ player_name:playerName, track_id:meta.id||"unknown", song_name:meta.name, artist:meta.artist,
        score:stats.score, accuracy, grade, max_combo:stats.maxCombo, perfect:stats.perfect,
        great:stats.great, good:stats.good, miss:stats.miss, is_fc:isFC }).catch(()=>{})
    } catch {}
  }, [])

  useEffect(() => {
    const t1 = setTimeout(()=>setPhase("grade"), 0)
    const t2 = setTimeout(()=>setPhase("stats"), 250)
    const t3 = setTimeout(()=>setPhase("buttons"), 500)
    return ()=>{clearTimeout(t1);clearTimeout(t2);clearTimeout(t3)}
  }, [])

  useEffect(() => {
    if (phase!=="stats") return
    const target=stats.score, steps=60, dur=400
    const step=target/steps; let cur=0
    animRef.current=setInterval(()=>{
      cur=Math.min(cur+step,target)
      setScoreDisplay(Math.round(cur))
      if(cur>=target)clearInterval(animRef.current!)
    },dur/steps)
    return()=>{if(animRef.current)clearInterval(animRef.current)}
  },[phase,stats.score])

  useEffect(() => {
    if(phase!=="stats")return
    const stars=accuracy>=95?5:accuracy>=85?4:accuracy>=70?3:accuracy>=55?2:1
    let i=0
    const iv=setInterval(()=>{i++;setStarsShown(i);if(i>=stars)clearInterval(iv)},80)
    return()=>clearInterval(iv)
  },[phase,accuracy])

  // Spawn confetti on S/S+ grade
  useEffect(()=>{
    if(grade!=="S"&&grade!=="S+")return
    const colors=["#ffd700","#ff6060","#60ff60","#6060ff","#ff60ff","#60ffff"]
    const ps = Array.from({length:60},(_,i)=>({
      id:i, x:Math.random()*100, y:-10,
      color:colors[Math.floor(Math.random()*colors.length)],
      size:3+Math.random()*6,
      vx:(Math.random()-0.5)*3, vy:2+Math.random()*3,
      life:1,
    }))
    setParticles(ps)
  },[grade])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:"rgba(0,0,0,0.92)",backdropFilter:"blur(12px)"}}>
      {/* Confetti */}
      {particles.map(p=>(
        <div key={p.id} style={{
          position:"absolute",
          left:`${p.x}%`,top:`${p.y}%`,
          width:p.size,height:p.size*2,
          background:p.color,borderRadius:"2px",
          transform:`rotate(${p.vx*20}deg)`,
          animation:`confetti-fall ${2+Math.random()*1.5}s ease-in ${Math.random()*0.5}s forwards`,
          opacity:0,
        }}/>
      ))}

      <div className="flex flex-col items-center gap-5 w-full max-w-sm px-4">
        {/* Grade */}
        <div style={{
          opacity:phase==="grade"||phase==="stats"||phase==="buttons"?1:0,
          transform:phase==="grade"?"scale(1)":"scale(1)",
          transition:"all 0.3s ease",
          textAlign:"center",
        }}>
          {newRecord&&(
            <div style={{
              fontSize:"clamp(9px,1.2vw,11px)",fontWeight:900,
              letterSpacing:".35em",textTransform:"uppercase",
              color:"#ffd700",fontFamily:"Impact,sans-serif",
              textShadow:"0 0 12px #ffd700",marginBottom:"6px",
              animation:"record-pulse 0.6s ease-in-out infinite alternate",
            }}>🏆 NOVO RECORDE!</div>
          )}
          <div style={{
            fontSize:"clamp(5rem,18vw,9rem)",fontWeight:900,lineHeight:1,
            fontFamily:"'Impact','Arial Black',sans-serif",
            color:gradeColor,
            textShadow:`0 0 60px ${gradeColor}, 0 0 120px ${gradeColor}66, 4px 6px 0 rgba(0,0,0,0.8)`,
            filter:`drop-shadow(0 0 30px ${gradeColor}88)`,
            animation:"grade-bounce 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
          }}>{grade}</div>
          {isFC&&(
            <div style={{
              fontSize:"clamp(10px,1.5vw,14px)",fontWeight:900,letterSpacing:".3em",
              color:"#a855f7",textShadow:"0 0 15px #a855f7",fontFamily:"Impact,sans-serif",
              animation:"fc-shine 1s ease infinite alternate",
            }}>⭐ FULL COMBO ⭐</div>
          )}
        </div>

        {/* Stats */}
        <div style={{
          width:"100%",opacity:phase==="stats"||phase==="buttons"?1:0,
          transform:phase==="stats"||phase==="buttons"?"translateY(0)":"translateY(20px)",
          transition:"all 0.3s ease",
        }}>
          {/* Song info */}
          <div style={{textAlign:"center",marginBottom:"12px"}}>
            <p style={{margin:0,fontSize:"clamp(10px,1.4vw,13px)",color:"rgba(255,255,255,0.4)",fontFamily:"Arial,sans-serif"}}>{meta.artist}</p>
            <p style={{margin:0,fontSize:"clamp(14px,2vw,18px)",fontWeight:900,color:"#fff",fontFamily:"Impact,sans-serif"}}>{meta.name}</p>
          </div>

          {/* Score big */}
          <div style={{
            textAlign:"center",marginBottom:"12px",
            fontSize:"clamp(2.5rem,7vw,4rem)",fontWeight:900,
            fontFamily:"'Impact',sans-serif",color:"#fff",
            textShadow:`0 0 20px ${gradeColor}66`,
            fontVariantNumeric:"tabular-nums",
          }}>{scoreDisplay.toLocaleString()}</div>

          {/* Stars */}
          <div style={{display:"flex",justifyContent:"center",gap:"6px",marginBottom:"12px"}}>
            {Array.from({length:5}).map((_,i)=>(
              <svg key={i} width="clamp(16px,2.5vw,22px)" height="clamp(16px,2.5vw,22px)" viewBox="0 0 24 24">
                <path d="M12 2l2.9 6.2L22 9.2l-5.2 5 1.3 7.2L12 18l-6.1 3.4 1.3-7.2L2 9.2l7.1-1z"
                  fill={i<starsShown?gradeColor:"rgba(255,255,255,0.12)"}
                  style={{filter:i<starsShown?`drop-shadow(0 0 4px ${gradeColor})`:"none",
                    transition:`all 0.2s ${i*0.05}s`,transform:i<starsShown?"scale(1.2)":"scale(1)",transformOrigin:"center"}}/>
              </svg>
            ))}
          </div>

          {/* Stats row */}
          <div style={{
            display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"6px",marginBottom:"10px",
          }}>
            {[
              {label:"Precisão",value:`${accuracy}%`,color:"#22c55e"},
              {label:"Combo",   value:`${stats.maxCombo}x`,color:"#3b82f6"},
              {label:"Perfect", value:stats.perfect,color:"#fbbf24"},
              {label:"Miss",    value:stats.miss,color:stats.miss>0?"#ef4444":"rgba(255,255,255,0.3)"},
            ].map(s=>(
              <div key={s.label} style={{
                textAlign:"center",padding:"8px 4px",borderRadius:"8px",
                background:"rgba(255,255,255,0.04)",border:`1px solid ${s.color}22`,
              }}>
                <div style={{fontSize:"clamp(11px,1.8vw,16px)",fontWeight:900,color:s.color,fontFamily:"Impact,sans-serif"}}>{s.value}</div>
                <div style={{fontSize:"clamp(7px,1vw,9px)",color:"rgba(255,255,255,0.3)",fontFamily:"Arial,sans-serif",letterSpacing:".1em",textTransform:"uppercase"}}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Accuracy bar */}
          <div style={{height:"4px",background:"rgba(255,255,255,0.07)",borderRadius:"2px",overflow:"hidden",marginBottom:"16px"}}>
            <div style={{height:"100%",borderRadius:"2px",transition:"width 1s ease",
              width:`${accuracy}%`,background:`linear-gradient(90deg,#ef4444,#f97316,#eab308,${gradeColor})`,
              boxShadow:`0 0 8px ${gradeColor}`}}/>
          </div>

          {/* Multiplayer leaderboard */}
          {isMultiplayer&&allPlayers&&allPlayers.length>0&&(
            <div style={{marginBottom:"12px",background:"rgba(255,255,255,0.03)",borderRadius:"8px",
              border:"1px solid rgba(255,255,255,0.07)",overflow:"hidden"}}>
              {allPlayers.sort((a,b)=>b.score-a.score).map((p,rank)=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:"10px",
                  padding:"8px 12px",borderBottom:rank<allPlayers.length-1?"1px solid rgba(255,255,255,0.05)":"none",
                  background:p.id===myId?"rgba(225,29,72,0.08)":"transparent"}}>
                  <span style={{fontSize:"14px",fontWeight:900,color:rank===0?"#ffd700":"rgba(255,255,255,0.3)",
                    fontFamily:"Impact,sans-serif",width:"20px"}}>{rank+1}</span>
                  <span style={{flex:1,fontSize:"13px",fontWeight:700,
                    color:p.id===myId?"#fff":"rgba(255,255,255,0.6)",fontFamily:"Arial,sans-serif"}}>
                    {p.id===myId?"Você":p.name}
                  </span>
                  <span style={{fontSize:"14px",fontWeight:900,fontFamily:"Impact,sans-serif",
                    color:p.id===myId?"#e11d48":"rgba(255,255,255,0.5)"}}>{p.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div style={{
          display:"flex",gap:"10px",width:"100%",
          opacity:phase==="buttons"?1:0,
          transform:phase==="buttons"?"translateY(0)":"translateY(10px)",
          transition:"all 0.3s ease",
        }}>
          {onBack&&(
            <button onClick={onBack}
              style={{flex:1,padding:"12px",borderRadius:"10px",cursor:"pointer",
                background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",
                color:"rgba(255,255,255,0.7)",fontFamily:"Impact,sans-serif",
                fontSize:"clamp(12px,1.8vw,16px)",letterSpacing:".08em",transition:"all .1s"}}
              onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.1)")}
              onMouseLeave={e=>(e.currentTarget.style.background="rgba(255,255,255,0.06)")}>
              ← VOLTAR
            </button>
          )}
          {onRestart&&!isMultiplayer&&(
            <button onClick={onRestart}
              style={{flex:2,padding:"12px",borderRadius:"10px",cursor:"pointer",position:"relative",overflow:"hidden",
                background:"linear-gradient(180deg,#cc1010,#8a0808)",border:"1px solid #ff4444",
                color:"#fff",fontFamily:"Impact,sans-serif",
                fontSize:"clamp(13px,2vw,18px)",letterSpacing:".1em",
                boxShadow:"0 0 20px rgba(200,0,0,0.4),inset 0 1px 0 rgba(255,100,100,0.3)",transition:"all .1s"}}
              onMouseEnter={e=>(e.currentTarget.style.transform="scale(1.02)")}
              onMouseLeave={e=>(e.currentTarget.style.transform="scale(1)")}>
              🔄 JOGAR NOVAMENTE
            </button>
          )}
          {onNext&&(
            <button onClick={onNext}
              style={{flex:2,padding:"12px",borderRadius:"10px",cursor:"pointer",
                background:"linear-gradient(180deg,#22c55e,#15803d)",border:"1px solid #4ade80",
                color:"#fff",fontFamily:"Impact,sans-serif",
                fontSize:"clamp(13px,2vw,18px)",letterSpacing:".1em",
                boxShadow:"0 0 20px rgba(34,197,94,0.3)",transition:"all .1s"}}
              onMouseEnter={e=>(e.currentTarget.style.transform="scale(1.02)")}
              onMouseLeave={e=>(e.currentTarget.style.transform="scale(1)")}>
              PRÓXIMA ▶
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes grade-bounce { from{transform:scale(0) rotate(-10deg);opacity:0} to{transform:scale(1) rotate(0deg);opacity:1} }
        @keyframes record-pulse { from{opacity:0.7;transform:scale(0.97)} to{opacity:1;transform:scale(1.03)} }
        @keyframes fc-shine     { from{text-shadow:0 0 10px #a855f7} to{text-shadow:0 0 25px #a855f7,0 0 50px #7c3aed} }
        @keyframes confetti-fall { 0%{opacity:1;transform:translateY(0) rotate(0deg)} 100%{opacity:0;transform:translateY(100vh) rotate(720deg)} }
      `}</style>
    </div>
  )
}
