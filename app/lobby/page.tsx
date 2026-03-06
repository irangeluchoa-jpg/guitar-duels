"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, LogIn } from "lucide-react"
import { GHBackground, GHLogo, GHBackButton, GHCard, GHSectionTitle, GHInput, GHButton } from "@/components/ui/gh-layout"

export default function LobbyPage() {
  const router = useRouter()
  const [playerName, setPlayerName] = useState(() => typeof window!=="undefined" ? sessionStorage.getItem("playerName")||"" : "")
  const [joinCode, setJoinCode] = useState("")
  const [maxPlayers, setMaxPlayers] = useState<2|3|4>(4)
  const [loading, setLoading] = useState<"create"|"join"|null>(null)
  const [error, setError] = useState("")

  async function handleCreate() {
    if (!playerName.trim()) { setError("Digite seu nome"); return }
    setLoading("create"); setError("")
    try {
      const res = await fetch("/api/rooms",{ method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ action:"create", playerName:playerName.trim(), maxPlayers }) })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      sessionStorage.setItem("playerId",data.playerId); sessionStorage.setItem("playerName",playerName.trim())
      router.push(`/room/${data.room.code}`)
    } catch(e) { setError(e instanceof Error ? e.message : "Erro ao criar sala") }
    finally { setLoading(null) }
  }

  async function handleJoin() {
    if (!playerName.trim()) { setError("Digite seu nome"); return }
    if (!joinCode.trim()) { setError("Digite o código da sala"); return }
    setLoading("join"); setError("")
    try {
      const res = await fetch("/api/rooms",{ method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ action:"join", code:joinCode.trim().toUpperCase(), playerName:playerName.trim() }) })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      sessionStorage.setItem("playerId",data.playerId); sessionStorage.setItem("playerName",playerName.trim())
      router.push(`/room/${data.room.code}`)
    } catch(e) { setError(e instanceof Error ? e.message : "Sala não encontrada ou cheia") }
    finally { setLoading(null) }
  }

  return (
    <GHBackground>
      <div className="flex flex-col h-full items-center justify-center px-4">

        {/* Logo + back */}
        <div className="absolute top-5 left-6"><GHBackButton label="Menu" /></div>
        <GHLogo size="sm" />

        <div className="mt-6 w-full max-w-sm">
          <GHSectionTitle>⚔️ Multiplayer</GHSectionTitle>

          <GHCard className="p-5 flex flex-col gap-4">
            {/* Nome */}
            <GHInput label="Seu nome" value={playerName} onChange={e=>setPlayerName(e.target.value)}
              placeholder="Ex: RockStar99" maxLength={16} onKeyDown={e=>e.key==="Enter"&&handleCreate()} />

            {/* Nº jogadores */}
            <div>
              <label className="block mb-2 text-[10px] uppercase tracking-[.3em]"
                style={{ color:"rgba(255,180,100,.6)", fontFamily:"'Arial Black',sans-serif" }}>
                Jogadores na sala
              </label>
              <div className="flex gap-2">
                {([2,3,4] as const).map(n=>(
                  <button key={n} onClick={()=>setMaxPlayers(n)}
                    className="flex-1 h-10 font-black text-sm transition-all hover:scale-105 active:scale-95"
                    style={{ borderRadius:"4px", fontFamily:"'Impact',sans-serif",
                      background:maxPlayers===n?"rgba(200,0,20,.35)":"rgba(255,255,255,.05)",
                      border:`1px solid ${maxPlayers===n?"rgba(255,80,80,.55)":"rgba(255,255,255,.1)"}`,
                      color:maxPlayers===n?"#ff6060":"rgba(255,255,255,.45)" }}>
                    {n}v{n}
                  </button>
                ))}
              </div>
            </div>

            {/* Criar sala */}
            <GHButton variant="primary" onClick={handleCreate} loading={loading==="create"} disabled={loading!==null}
              className="w-full">
              <Plus className="w-4 h-4" /> Criar Sala
            </GHButton>

            {/* Separador */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background:"rgba(255,255,255,.08)" }} />
              <span className="text-xs" style={{ color:"rgba(255,255,255,.25)", fontFamily:"'Arial',sans-serif" }}>ou</span>
              <div className="flex-1 h-px" style={{ background:"rgba(255,255,255,.08)" }} />
            </div>

            {/* Entrar em sala */}
            <GHInput label="Código da sala" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())}
              placeholder="Ex: ROCK" maxLength={8} onKeyDown={e=>e.key==="Enter"&&handleJoin()} />

            <GHButton variant="secondary" onClick={handleJoin} loading={loading==="join"} disabled={loading!==null}
              className="w-full">
              <LogIn className="w-4 h-4" /> Entrar na Sala
            </GHButton>

            {error && (
              <p className="text-xs text-center py-2 px-3 rounded"
                style={{ color:"#ff6060", background:"rgba(255,0,0,.1)", border:"1px solid rgba(255,0,0,.2)", fontFamily:"'Arial',sans-serif" }}>
                ⚠ {error}
              </p>
            )}
          </GHCard>
        </div>
      </div>
    </GHBackground>
  )
}
