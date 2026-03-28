"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { GHBackground, GHLogo, GHBackButton, GHCard, GHSectionTitle, GHInput, GHButton, GHBottomBar } from "@/components/ui/gh-layout"
import { getSocket, waitForConnection, isSocketConnected, emitWithRetry } from "@/lib/multiplayer/socket-client"
import { useNav } from "@/lib/use-nav"
import { loadProfile, getActiveBorder, getActiveTitle } from "@/lib/progression"
import { PlayerAvatar } from "@/components/ui/player-avatar"

export default function LobbyPage() {
  const router = useRouter()
  const [roomName,   setRoomName]   = useState("")
  const [joinCode,   setJoinCode]   = useState("")
  const [maxPlayers, setMaxPlayers] = useState<2|3|4>(2)
  const [loading,    setLoading]    = useState<"create"|"join"|null>(null)
  const [error,      setError]      = useState("")
  const [profile,    setProfile]    = useState<{displayName:string;level:number;selectedTitle?:string;selectedBorder?:string}|null>(null)
  const [avatar,     setAvatar]     = useState("🎸")
  const [socketReady, setSocketReady] = useState(false)
  const [connecting,  setConnecting]  = useState(false)

  useEffect(() => {
    try {
      const p = loadProfile()
      setProfile(p)
      const savedPhoto = localStorage.getItem("guitar-duels-photo-url")
      setAvatar(savedPhoto || localStorage.getItem("guitar-duels-avatar") || "🎸")
    } catch {}

    // Iniciar conexão socket imediatamente ao entrar no lobby
    getSocket()
    if (isSocketConnected()) {
      setSocketReady(true)
    } else {
      setConnecting(true)
      waitForConnection(15000).then(ok => {
        setSocketReady(ok)
        setConnecting(false)
        if (!ok) setError("Servidor offline. Tente novamente em instantes.")
      })
    }
  }, [])

  useNav({
    onConfirm: () => { if (!loading) handleCreate() },
    onCancel:  () => router.push("/"),
  })

  const playerName = profile?.displayName ?? "Guitarrista"
  const activeBorder = profile ? getActiveBorder(profile as any) : null
  const activeTitle = profile ? getActiveTitle(profile as any) : null

  async function handleCreate() {
    setLoading("create"); setError("")

    // Aguardar conexão se ainda não conectou
    if (!isSocketConnected()) {
      setError("Conectando ao servidor...")
      const ok = await waitForConnection(15000)
      if (!ok) {
        setLoading(null)
        setError("Servidor não respondeu. O Railway pode estar acordando (aguarde 15s e tente novamente).")
        return
      }
    }

    const avatarUrl = localStorage.getItem("guitar-duels-photo-url") ?? ""
    try {
      const res = await emitWithRetry<any>("create-room", {
        playerName,
        maxPlayers,
        roomName: roomName.trim() || `Sala de ${playerName}`,
        playerTitle: activeTitle?.label ?? "",
        playerBorder: profile?.selectedBorder ?? "none",
        avatarUrl,
      }, 12000, 2)
      setLoading(null)
      if (!res?.success) { setError(res?.error || "Erro ao criar sala"); return }
      sessionStorage.setItem("playerId",     res.playerId)
      sessionStorage.setItem("playerName",   playerName)
      sessionStorage.setItem("playerTitle",  activeTitle?.label ?? "")
      sessionStorage.setItem("playerBorder", profile?.selectedBorder ?? "none")
      sessionStorage.setItem("playerAvatar", avatarUrl)
      router.push(`/room/${res.room.code}`)
    } catch (e: any) {
      setLoading(null)
      setError(e?.message || "Servidor não respondeu. Tente novamente.")
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) { setError("Digite o código da sala"); return }
    setLoading("join"); setError("")

    if (!isSocketConnected()) {
      setError("Conectando ao servidor...")
      const ok = await waitForConnection(15000)
      if (!ok) {
        setLoading(null)
        setError("Servidor não respondeu. Tente novamente em instantes.")
        return
      }
    }

    const avatarUrl = localStorage.getItem("guitar-duels-photo-url") ?? ""
    try {
      const res = await emitWithRetry<any>("join-room", {
        code: joinCode.trim().toUpperCase(),
        playerName,
        playerTitle: activeTitle?.label ?? "",
        playerBorder: profile?.selectedBorder ?? "none",
        avatarUrl,
      }, 12000, 2)
      setLoading(null)
      if (!res?.success) { setError(res?.error || "Sala não encontrada"); return }
      sessionStorage.setItem("playerId",     res.playerId)
      sessionStorage.setItem("playerName",   playerName)
      sessionStorage.setItem("playerTitle",  activeTitle?.label ?? "")
      sessionStorage.setItem("playerBorder", profile?.selectedBorder ?? "none")
      sessionStorage.setItem("playerAvatar", avatarUrl)
      router.push(`/room/${res.room.code}`)
    } catch (e: any) {
      setLoading(null)
      setError(e?.message || "Servidor não respondeu. Tente novamente.")
    }
  }

  return (
    <GHBackground>
      <div style={{padding:"12px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <GHBackButton label="Menu" href="/" />
        <GHLogo size="sm" />
        <div style={{width:"80px"}}/>
      </div>

      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}>
        <div style={{width:"min(420px,90vw)",animation:"gh3-in .4s cubic-bezier(.34,1.56,.64,1) .05s both"}}>

          <GHSectionTitle>⚔️ MULTIPLAYER</GHSectionTitle>

          {/* Status de conexão */}
          {connecting && !socketReady && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 12px", borderRadius: 10, marginBottom: 12,
              background: "rgba(251,191,36,0.10)",
              border: "1px solid rgba(251,191,36,0.25)",
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: "#fbbf24",
                boxShadow: "0 0 6px #fbbf24",
                animation: "pulse 1s ease-in-out infinite",
              }} />
              <span style={{ fontSize: 12, color: "rgba(251,191,36,0.9)", fontWeight: 600 }}>
                Conectando ao servidor... (Railway pode demorar até 15s para acordar)
              </span>
            </div>
          )}
          {socketReady && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 12px", borderRadius: 10, marginBottom: 10,
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.20)",
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: "#22c55e", boxShadow: "0 0 5px #22c55e",
              }} />
              <span style={{ fontSize: 11, color: "rgba(34,197,94,0.8)", fontWeight: 600 }}>
                Servidor online
              </span>
            </div>
          )}

          {/* Profile preview */}
          {profile && (
            <div style={{
              display:"flex",alignItems:"center",gap:"10px",
              padding:"10px 14px",marginBottom:"12px",borderRadius:"8px",
              background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
            }}>
              <PlayerAvatar
                avatar={avatar}
                size={46}
                borderId={profile?.selectedBorder ?? "none"}
                borderData={activeBorder}
                level={profile?.level}
                isPhoto={avatar?.startsWith("http")}
              />
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                  <span style={{fontSize:"14px",fontWeight:900,color:"#fff",fontFamily:"Arial,sans-serif"}}>{playerName}</span>
                  {activeTitle && (
                    <span style={{fontSize:"10px",fontWeight:700,padding:"1px 6px",borderRadius:"10px",
                      background:`${activeTitle.color}22`,color:activeTitle.color,border:`1px solid ${activeTitle.color}44`}}>
                      {activeTitle.icon} {activeTitle.label}
                    </span>
                  )}
                </div>
                <p style={{fontSize:"11px",color:"rgba(255,255,255,0.35)",fontFamily:"Arial,sans-serif",margin:0}}>
                  Nível {profile.level} · Jogando como este perfil
                </p>
              </div>
              <button onClick={()=>router.push("/profile")}
                style={{fontSize:"10px",color:"rgba(200,160,60,.6)",background:"none",border:"none",cursor:"pointer",fontFamily:"Arial,sans-serif",whiteSpace:"nowrap"}}>
                Editar ›
              </button>
            </div>
          )}

          <GHCard>
            <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>

              <GHInput label="Nome da Sala (opcional)"
                value={roomName} onChange={e=>setRoomName(e.target.value)}
                placeholder={`Sala de ${playerName}`} maxLength={24}
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
