"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { GHBackground, GHLogo, GHBackButton, GHCard, GHSectionTitle, GHInput, GHButton, GHBottomBar } from "@/components/ui/gh-layout"
import { getSocket } from "@/lib/multiplayer/socket-client"
import { playClickSound } from "@/lib/game/sounds"
import { loadSettings } from "@/lib/settings"

function getVol() { try { const s=loadSettings(); return (s.masterVolume/100)*(s.sfxVolume/100) } catch { return .5 } }

export default function LobbyPage() {
  const router = useRouter()
  const [playerName, setPlayerName] = useState(() => typeof window!=="undefined" ? sessionStorage.getItem("playerName")||"" : "")
  const [joinCode,   setJoinCode]   = useState("")
  const [maxPlayers, setMaxPlayers] = useState<2|3|4>(2)
  const [loading,    setLoading]    = useState<"create"|"join"|null>(null)
  const [error,      setError]      = useState("")

  function handleCreate() {
    if (!playerName.trim()) { setError("Digite seu nome"); return }
    setLoading("create"); setError("")
    const socket = getSocket()
    socket.emit("create-room", { playerName: playerName.trim(), maxPlayers }, (res: any) => {
      setLoading(null)
      if (!res?.success) { setError(res?.error || "Erro ao criar sala"); return }
      sessionStorage.setItem("playerId", res.playerId)
      sessionStorage.setItem("playerName", playerName.trim())
      router.push(`/room/${res.room.code}`)
    })
  }

  function handleJoin() {
    if (!playerName.trim()) { setError("Digite seu nome"); return }
    if (!joinCode.trim())   { setError("Digite o código da sala"); return }
    setLoading("join"); setError("")
    const socket = getSocket()
    socket.emit("join-room", { code: joinCode.trim().toUpperCase(), playerName: playerName.trim() }, (res: any) => {
      setLoading(null)
      if (!res?.success) { setError(res?.error || "Sala não encontrada"); return }
      sessionStorage.setItem("playerId", res.playerId)
      sessionStorage.setItem("playerName", playerName.trim())
      router.push(`/room/${res.room.code}`)
    })
  }

  return (
    <GHBackground>
      <div style={{padding:"12px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <GHBackButton label="Menu" href="/" />
        <GHLogo size="sm" />
        <div style={{width:"80px"}}/>
      </div>

      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}>
        <div style={{width:"min(400px,90vw)",animation:"gh3-in .4s cubic-bezier(.34,1.56,.64,1) .05s both"}}>
          <GHSectionTitle>⚔️ MULTIPLAYER</GHSectionTitle>
          <GHCard>
            <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
              <GHInput label="Seu Nome" value={playerName}
                onChange={e=>setPlayerName(e.target.value)}
                placeholder="Ex: RockStar99" maxLength={16}
                onKeyDown={e=>e.key==="Enter"&&handleCreate()} />

              <div>
                <label style={{display:"block",marginBottom:"6px",fontSize:"clamp(9px,1.1vw,11px)",
                  fontWeight:700,letterSpacing:".25em",textTransform:"uppercase",
                  color:"rgba(205,165,80,.7)",fontFamily:"Arial,sans-serif"}}>
                  Jogadores na Sala
                </label>
                <div style={{display:"flex",gap:"8px"}}>
                  {([2,3,4] as const).map(n=>(
                    <button key={n} onClick={()=>setMaxPlayers(n)}
                      style={{
                        flex:1,padding:"8px 0",borderRadius:"3px",cursor:"pointer",
                        background:maxPlayers===n?"linear-gradient(180deg,#cc1010,#8a0808)":"linear-gradient(180deg,#1e1610,#141008)",
                        border:maxPlayers===n?"1px solid #ff4444":"1px solid #3a2810",
                        fontFamily:"'Impact',sans-serif",fontWeight:900,
                        fontSize:"clamp(12px,1.8vw,16px)",letterSpacing:".06em",
                        color:maxPlayers===n?"#fff":"rgba(180,140,60,.6)",
                        boxShadow:maxPlayers===n?"0 0 12px rgba(180,0,0,.35),inset 0 1px 0 rgba(255,80,80,.2)":"none",
                        transition:"all .1s",
                      }}>{n}v{n}</button>
                  ))}
                </div>
              </div>

              <GHButton onClick={handleCreate} disabled={!!loading}>
                {loading==="create"?"Criando...":"+ Criar Sala"}
              </GHButton>

              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <div style={{flex:1,height:"1px",background:"rgba(120,80,20,.35)"}}/>
                <span style={{fontSize:"10px",color:"rgba(180,140,60,.5)",fontFamily:"Arial,sans-serif",letterSpacing:".15em"}}>OU</span>
                <div style={{flex:1,height:"1px",background:"rgba(120,80,20,.35)"}}/>
              </div>

              <div>
                <label style={{display:"block",marginBottom:"4px",fontSize:"clamp(9px,1.1vw,11px)",
                  fontWeight:700,letterSpacing:".25em",textTransform:"uppercase",
                  color:"rgba(205,165,80,.7)",fontFamily:"Arial,sans-serif"}}>
                  Código da Sala
                </label>
                <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())}
                  placeholder="EX. ROCK" maxLength={4}
                  onKeyDown={e=>e.key==="Enter"&&handleJoin()}
                  style={{
                    width:"100%",padding:"8px 12px",
                    background:"#0a0806",border:"1px solid #5a4020",borderRadius:"3px",
                    color:"#f0e0b0",fontFamily:"'Impact',sans-serif",
                    fontSize:"clamp(14px,2vw,18px)",letterSpacing:".3em",textTransform:"uppercase",
                    boxShadow:"inset 0 2px 6px rgba(0,0,0,.5)",outline:"none",textAlign:"center",
                  }}/>
              </div>

              <GHButton onClick={handleJoin} disabled={!!loading}>
                {loading==="join"?"Entrando...":"Entrar na Sala"}
              </GHButton>

              {error&&(
                <p style={{textAlign:"center",fontSize:"clamp(10px,1.3vw,13px)",
                  color:"#ff6060",fontFamily:"Arial,sans-serif",fontWeight:700,
                  textShadow:"0 0 8px rgba(255,50,50,.5)",margin:0}}>{error}</p>
              )}
            </div>
          </GHCard>
        </div>
      </div>
      <GHBottomBar />
    </GHBackground>
  )
}
