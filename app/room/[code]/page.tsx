"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Copy, Check, Music, Play, Loader2, Crown } from "lucide-react"
import type { SongListItem } from "@/lib/songs/types"
import { playClickSound, playHoverSound } from "@/lib/game/sounds"
import { loadSettings } from "@/lib/settings"
import { GHBackground, GHLogo, GHBackButton, GHCard, GHSectionTitle, GHButton } from "@/components/ui/gh-layout"

function getVol() { try { const s=loadSettings(); return (s.masterVolume/100)*(s.sfxVolume/100) } catch { return .5 } }

interface Player { id:string;name:string;score:number;combo:number;rockMeter:number;ready:boolean }
interface RoomData {
  code:string;hostId:string;songId:string|null
  state:"waiting"|"playing"|"paused"|"ended";pausedBy:string|null
  startTime:number|null;maxPlayers:number;players:Player[]
}

const PC = ["#e11d48","#3b82f6","#22c55e","#f97316"]
const PI = ["🎸","🥁","🎹","🎺"]

export default function RoomPage() {
  const params  = useParams()
  const router  = useRouter()
  const code    = (params.code as string).toUpperCase()

  const [room,setRoom]         = useState<RoomData|null>(null)
  const [playerId,setPlayerId] = useState<string|null>(null)
  const [songs,setSongs]       = useState<SongListItem[]>([])
  const [copied,setCopied]     = useState(false)
  const [error,setError]       = useState("")
  const pollRef                = useRef<ReturnType<typeof setInterval>|null>(null)
  const startedRef             = useRef(false)

  useEffect(() => { const id=sessionStorage.getItem("playerId"); if(!id){router.push("/lobby");return}; setPlayerId(id) },[router])
  useEffect(() => { fetch("/api/songs").then(r=>r.json()).then(setSongs).catch(()=>{}) },[])

  const fetchRoom = useCallback(async()=>{
    try {
      const res=await fetch(`/api/rooms/${code}`); if(!res.ok){setError("Sala não encontrada");return}
      const data:RoomData=await res.json(); setRoom(data)
      if(data.state==="playing"&&!startedRef.current){
        startedRef.current=true; const pid=sessionStorage.getItem("playerId")
        router.push(`/play/${data.songId}?room=${code}&player=${pid}`)
      }
      // Resetar flag quando a sala volta a waiting ou ended (nova rodada ou encerramento)
      if(data.state==="ended"||data.state==="waiting"){
        startedRef.current=false
      }
    } catch { setError("Erro de conexão") }
  },[code,router])

  useEffect(() => { fetchRoom(); pollRef.current=setInterval(fetchRoom,1500); return ()=>{if(pollRef.current)clearInterval(pollRef.current)} },[fetchRoom])

  async function handleSetSong(songId:string){
    await fetch(`/api/rooms/${code}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"setSong",songId})})
    fetchRoom()
  }
  async function handleStart(){
    if(!room?.songId) return
    await fetch(`/api/rooms/${code}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"setState",state:"playing"})})
    router.push(`/play/${room.songId}?room=${code}&player=${playerId}`)
  }
  function copyCode(){ navigator.clipboard.writeText(code); setCopied(true); setTimeout(()=>setCopied(false),2000) }

  if(error) return (
    <GHBackground>
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-lg font-black" style={{color:"#ff6060",fontFamily:"'Impact',sans-serif"}}>{error}</p>
        <GHButton variant="ghost" onClick={()=>router.push("/lobby")}>Voltar ao Lobby</GHButton>
      </div>
    </GHBackground>
  )

  if(!room||!playerId) return (
    <GHBackground>
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin" style={{color:"#e11d48"}} />
      </div>
    </GHBackground>
  )

  const isHost       = room.hostId===playerId
  const selectedSong = songs.find(s=>s.id===room.songId)
  const canStart     = isHost&&room.players.length>=2&&!!room.songId
  const spotsLeft    = room.maxPlayers-room.players.length

  return (
    <GHBackground>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <GHBackButton label="Lobby" />
          <GHLogo size="sm" />
          {/* Código da sala */}
          <button onClick={()=>{playClickSound(getVol());copyCode()}}
            className="flex items-center gap-2 px-3 py-1.5 transition-all hover:scale-105"
            style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:"4px"}}>
            <span className="font-mono font-black tracking-[.25em] text-white text-sm">{code}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-green-400"/> : <Copy className="w-3.5 h-3.5" style={{color:"rgba(255,255,255,.4)"}}/>}
          </button>
        </div>

        <GHSectionTitle>⚔️ Sala de Batalha</GHSectionTitle>

        <div className="flex flex-1 overflow-hidden gap-4 px-4 pb-4">
          {/* Players */}
          <GHCard className="w-64 flex flex-col p-3 gap-2 overflow-y-auto flex-shrink-0" style={{scrollbarWidth:"none"}}>
            <p className="text-[10px] uppercase tracking-[.3em] mb-1"
              style={{color:"rgba(255,180,100,.6)",fontFamily:"'Arial Black',sans-serif"}}>
              Jogadores {room.players.length}/{room.maxPlayers}
            </p>
            {room.players.map((p,idx)=>(
              <div key={p.id} className="flex items-center gap-2.5 px-3 py-2 rounded"
                style={{background:`${PC[idx%4]}12`,border:`1px solid ${PC[idx%4]}30`}}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm"
                  style={{background:`${PC[idx%4]}22`}}>
                  {p.id===room.hostId ? <Crown className="w-3.5 h-3.5" style={{color:PC[idx%4]}}/> : <span>{PI[idx]}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate" style={{fontFamily:"'Impact',sans-serif"}}>{p.name}</p>
                  <p className="text-[10px]" style={{color:PC[idx%4]+"99",fontFamily:"'Arial',sans-serif"}}>
                    {p.id===room.hostId?"Anfitrião":`Jogador ${idx+1}`}
                    {p.id===playerId?" (você)":""}
                  </p>
                </div>
              </div>
            ))}
            {Array.from({length:spotsLeft}).map((_,i)=>(
              <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded border border-dashed"
                style={{borderColor:"rgba(255,255,255,.08)"}}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{background:"rgba(255,255,255,.04)"}}>
                  <Loader2 className="w-3 h-3 animate-spin" style={{color:"rgba(255,255,255,.2)"}}/>
                </div>
                <p className="text-xs" style={{color:"rgba(255,255,255,.2)",fontFamily:"'Arial',sans-serif"}}>Aguardando...</p>
              </div>
            ))}
            <div className="mt-auto pt-2">
              <p className="text-[10px] text-center" style={{color:"rgba(255,255,255,.2)",fontFamily:"'Arial',sans-serif"}}>
                Convide: <span className="font-mono font-bold" style={{color:"rgba(255,255,255,.45)"}}>{code}</span>
              </p>
            </div>
          </GHCard>

          {/* Song selection */}
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            <p className="text-[10px] uppercase tracking-[.3em] flex-shrink-0"
              style={{color:"rgba(255,180,100,.6)",fontFamily:"'Arial Black',sans-serif"}}>
              {isHost?"Escolha a música":"Música do anfitrião"}
              {selectedSong&&<span className="ml-2 normal-case" style={{color:"#ff9060"}}>{selectedSong.name}</span>}
            </p>
            {isHost ? (
              <div className="flex-1 overflow-y-auto flex flex-col gap-1" style={{scrollbarWidth:"none"}}>
                {songs.map(song=>(
                  <button key={song.id} onClick={()=>{playClickSound(getVol());handleSetSong(song.id)}}
                    onMouseEnter={()=>playHoverSound(getVol())}
                    className="flex items-center gap-3 px-4 py-2.5 text-left transition-all flex-shrink-0 hover:scale-[1.01]"
                    style={{borderRadius:"4px",
                      background:room.songId===song.id?"rgba(200,0,20,.2)":"rgba(255,255,255,.04)",
                      border:`1px solid ${room.songId===song.id?"rgba(255,80,80,.4)":"rgba(255,255,255,.06)"}` }}>
                    <Music className="w-4 h-4 flex-shrink-0" style={{color:room.songId===song.id?"#ff6060":"#444"}}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate" style={{fontFamily:"'Arial Black',sans-serif"}}>{song.name}</p>
                      <p className="text-xs truncate" style={{color:"rgba(255,255,255,.4)",fontFamily:"'Arial',sans-serif"}}>{song.artist}</p>
                    </div>
                    {room.songId===song.id&&<Check className="w-4 h-4 flex-shrink-0" style={{color:"#ff6060"}}/>}
                  </button>
                ))}
              </div>
            ) : (
              <GHCard className="flex-1 flex flex-col items-center justify-center gap-3">
                <Music className="w-10 h-10" style={{color:"rgba(255,255,255,.2)"}}/>
                <p className="text-sm text-center" style={{color:"rgba(255,255,255,.4)",fontFamily:"'Arial',sans-serif"}}>
                  {room.songId ? <><span className="font-bold text-white">{selectedSong?.name||room.songId}</span><br/><span className="text-xs">aguardando início</span></>
                    : "Aguardando o anfitrião escolher..."}
                </p>
              </GHCard>
            )}

            {isHost ? (
              <GHButton variant={canStart?"primary":"secondary"} onClick={handleStart}
                disabled={!canStart} className="w-full">
                <Play className="w-4 h-4 fill-current"/>
                {!room.songId?"Escolha uma música"
                  :room.players.length<2?"Aguardando oponente..."
                  :`Iniciar batalha — ${room.players.length} jogadores`}
              </GHButton>
            ) : (
              <div className="flex items-center justify-center h-12 rounded text-sm"
                style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",
                  color:"rgba(255,255,255,.3)",fontFamily:"'Arial',sans-serif"}}>
                Aguardando o anfitrião iniciar...
              </div>
            )}
          </div>
        </div>
      </div>
    </GHBackground>
  )
}
