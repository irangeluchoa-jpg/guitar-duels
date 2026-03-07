"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Copy, Check, Play, Loader2, Crown, ChevronRight, Music2, Clock } from "lucide-react"
import type { SongListItem } from "@/lib/songs/types"
import { playClickSound, playHoverSound } from "@/lib/game/sounds"
import { loadSettings } from "@/lib/settings"

function getVol() { try { const s=loadSettings(); return (s.masterVolume/100)*(s.sfxVolume/100) } catch { return .5 } }
function fmt(ms: number) { const s=Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}` }

interface Player { id:string; name:string; score:number; combo:number; rockMeter:number; ready:boolean }
interface RoomData {
  code:string; hostId:string; songId:string|null
  state:"waiting"|"playing"|"paused"|"ended"; pausedBy:string|null
  startTime:number|null; maxPlayers:number; players:Player[]
}

const PC = ["#e11d48","#3b82f6","#22c55e","#f97316"]
const DIFF_COLORS = ["#22c55e","#22c55e","#fbbf24","#f97316","#ef4444","#a855f7"]
const DIFF_LABELS = ["","★","★★","★★★","★★★★","★★★★★"]

export default function RoomPage() {
  const params  = useParams()
  const router  = useRouter()
  const code    = (params.code as string).toUpperCase()

  const [room, setRoom]         = useState<RoomData|null>(null)
  const [playerId, setPlayerId] = useState<string|null>(null)
  const [songs, setSongs]       = useState<SongListItem[]>([])
  const [search, setSearch]     = useState("")
  const [copied, setCopied]     = useState(false)
  const [error, setError]       = useState("")
  const [selIdx, setSelIdx]     = useState(0)
  const pollRef                 = useRef<ReturnType<typeof setInterval>|null>(null)
  const startedRef              = useRef(false)
  const listRef                 = useRef<HTMLDivElement>(null)

  useEffect(() => { const id=sessionStorage.getItem("playerId"); if(!id){router.push("/lobby");return}; setPlayerId(id) }, [router])
  useEffect(() => { fetch("/api/songs").then(r=>r.json()).then(setSongs).catch(()=>{}) }, [])

  const fetchRoom = useCallback(async () => {
    try {
      const res=await fetch(`/api/rooms/${code}`); if(!res.ok){setError("Sala não encontrada");return}
      const data:RoomData=await res.json(); setRoom(data)
      if (data.state==="playing" && !startedRef.current) {
        startedRef.current=true
        const pid=sessionStorage.getItem("playerId")
        router.push(`/play/${encodeURIComponent(data.songId!)}?room=${code}&player=${pid}`)
      }
      if (data.state==="ended"||data.state==="waiting") startedRef.current=false
    } catch { setError("Erro de conexão") }
  }, [code, router])

  useEffect(() => {
    fetchRoom()
    pollRef.current=setInterval(fetchRoom,1500)
    return () => { if(pollRef.current) clearInterval(pollRef.current) }
  }, [fetchRoom])

  // Keyboard navigation
  useEffect(() => {
    const filtered = songs.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.artist.toLowerCase().includes(search.toLowerCase()))
    const onKey = (e: KeyboardEvent) => {
      if (e.key==="ArrowDown") { e.preventDefault(); setSelIdx(i => Math.min(i+1, filtered.length-1)) }
      if (e.key==="ArrowUp")   { e.preventDefault(); setSelIdx(i => Math.max(i-1, 0)) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [songs, search])

  const filtered = songs.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.artist.toLowerCase().includes(search.toLowerCase()))
  const selectedSong = songs.find(s => s.id===room?.songId) ?? filtered[selIdx]

  async function handleSetSong(songId: string) {
    await fetch(`/api/rooms/${code}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action:"setSong",songId}) })
    fetchRoom()
  }
  async function handleStart() {
    if (!room?.songId) return
    await fetch(`/api/rooms/${code}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action:"setState",state:"playing"}) })
    router.push(`/play/${encodeURIComponent(room.songId)}?room=${code}&player=${playerId}`)
  }
  function copyCode() { navigator.clipboard.writeText(code); setCopied(true); setTimeout(()=>setCopied(false),2000) }

  if (error) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4" style={{background:"#060608"}}>
      <p className="text-rose-500 text-lg font-black">{error}</p>
      <button onClick={()=>router.push("/lobby")} className="text-white/40 underline text-sm">Voltar ao Lobby</button>
    </div>
  )
  if (!room||!playerId) return (
    <div className="flex items-center justify-center h-screen" style={{background:"#060608"}}>
      <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const isHost    = room.hostId===playerId
  const canStart  = isHost && room.players.length>=2 && !!room.songId
  const spotsLeft = room.maxPlayers-room.players.length

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{background:"#060608", fontFamily:"'Inter',sans-serif"}}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
        <button onClick={()=>router.push("/lobby")}
          className="flex items-center gap-2 text-xs font-semibold transition-all hover:scale-105"
          style={{color:"rgba(255,255,255,0.35)", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", padding:"6px 12px", borderRadius:"8px"}}>
          ← Lobby
        </button>

        {/* Logo */}
        <div className="text-center">
          <p className="text-[10px] tracking-[0.4em] uppercase" style={{color:"rgba(255,180,60,0.5)"}}>⚔️ Sala de Batalha</p>
        </div>

        {/* Código */}
        <button onClick={()=>{playClickSound(getVol());copyCode()}}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:scale-105"
          style={{background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)"}}>
          <span className="font-mono font-black tracking-[0.25em] text-white text-sm">{code}</span>
          {copied ? <Check className="w-3.5 h-3.5 text-green-400"/> : <Copy className="w-3.5 h-3.5 text-white/40"/>}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Lista de músicas (esquerda) ── */}
        <div className="flex flex-col w-64 flex-shrink-0" style={{borderRight:"1px solid rgba(255,255,255,0.05)"}}>
          {/* Search */}
          <div className="px-3 py-2 flex-shrink-0" style={{borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
            <input
              value={search} onChange={e=>{setSearch(e.target.value);setSelIdx(0)}}
              placeholder="Buscar música..."
              className="w-full text-xs rounded-lg px-3 py-2 outline-none"
              style={{background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff", placeholder:"rgba(255,255,255,0.3)"}}
            />
          </div>
          {/* Songs list */}
          <div ref={listRef} className="flex-1 overflow-y-auto" style={{scrollbarWidth:"none"}}>
            {filtered.map((song, i) => {
              const isSelected = room.songId===song.id || (!room.songId && i===selIdx)
              return (
                <button key={song.id}
                  onClick={() => { playClickSound(getVol()); setSelIdx(i); if(isHost) handleSetSong(song.id) }}
                  onMouseEnter={() => playHoverSound(getVol())}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all hover:bg-white/[0.04]"
                  style={{
                    background: isSelected ? "rgba(225,29,72,0.15)" : "transparent",
                    borderLeft: isSelected ? "2px solid #e11d48" : "2px solid transparent",
                  }}>
                  {/* Diff bars */}
                  <div className="flex gap-px flex-shrink-0">
                    {[1,2,3,4].map(b => (
                      <div key={b} className="w-1 rounded-sm"
                        style={{height:`${6+b*3}px`, background: b <= Math.ceil((song.difficulty??3)/5*4) ? DIFF_COLORS[song.difficulty??3] : "rgba(255,255,255,0.1)"}} />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{song.name}</p>
                    <p className="text-[10px] truncate" style={{color:"rgba(255,255,255,0.4)"}}>{song.artist}</p>
                  </div>
                  {isSelected && room.songId===song.id && <Check className="w-3.5 h-3.5 flex-shrink-0" style={{color:"#e11d48"}}/>}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Painel direito ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Detalhes da música selecionada */}
          {selectedSong ? (
            <div className="flex items-start gap-5 p-5 flex-shrink-0"
              style={{borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
              {/* Album art */}
              <div className="w-24 h-24 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden"
                style={{background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)"}}>
                {selectedSong.albumArt
                  ? <img src={selectedSong.albumArt} alt="" className="w-full h-full object-cover" />
                  : <Music2 className="w-8 h-8" style={{color:"rgba(255,255,255,0.15)"}}/>}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-black text-white truncate leading-tight">{selectedSong.name}</h2>
                <p className="text-sm mt-0.5 truncate" style={{color:"rgba(255,255,255,0.5)"}}>{selectedSong.artist}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {selectedSong.genre && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{background:"rgba(255,150,60,0.15)", color:"rgba(255,150,60,0.8)", border:"1px solid rgba(255,150,60,0.2)"}}>{selectedSong.genre}</span>
                  )}
                  {selectedSong.year && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.4)", border:"1px solid rgba(255,255,255,0.08)"}}>{selectedSong.year}</span>
                  )}
                  {selectedSong.songLength > 0 && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.4)", border:"1px solid rgba(255,255,255,0.08)"}}>
                      <Clock className="w-2.5 h-2.5"/>{fmt(selectedSong.songLength)}
                    </span>
                  )}
                  {selectedSong.difficulty > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{background:`${DIFF_COLORS[selectedSong.difficulty]}22`, color:DIFF_COLORS[selectedSong.difficulty], border:`1px solid ${DIFF_COLORS[selectedSong.difficulty]}44`}}>
                      {DIFF_LABELS[selectedSong.difficulty]}
                    </span>
                  )}
                </div>
                {/* Barra de dificuldade */}
                <div className="mt-2 w-48 h-1.5 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.07)"}}>
                  <div className="h-full rounded-full transition-all"
                    style={{width:`${((selectedSong.difficulty??3)/5)*100}%`, background:DIFF_COLORS[selectedSong.difficulty??3]}}/>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center flex-col gap-3" style={{color:"rgba(255,255,255,0.1)"}}>
              <Music2 className="w-16 h-16"/>
              <p className="text-xs tracking-widest uppercase">
                {isHost ? "Selecione uma música" : "Aguardando o anfitrião..."}
              </p>
            </div>
          )}

          {/* Jogadores */}
          <div className="px-5 py-3 flex-shrink-0" style={{borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
            <p className="text-[9px] uppercase tracking-[0.3em] mb-2" style={{color:"rgba(255,180,60,0.5)"}}>
              Jogadores {room.players.length}/{room.maxPlayers}
            </p>
            <div className="flex gap-2 flex-wrap">
              {room.players.map((p,idx) => (
                <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                  style={{background:`${PC[idx%4]}15`, border:`1px solid ${PC[idx%4]}30`}}>
                  {p.id===room.hostId
                    ? <Crown className="w-3 h-3" style={{color:PC[idx%4]}}/>
                    : <div className="w-2 h-2 rounded-full" style={{background:PC[idx%4]}}/>}
                  <span className="text-xs font-bold text-white">{p.name}{p.id===playerId?" (você)":""}</span>
                </div>
              ))}
              {Array.from({length:spotsLeft}).map((_,i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                  style={{border:"1px dashed rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.2)"}}>
                  <Loader2 className="w-3 h-3 animate-spin"/>
                  <span className="text-xs">Aguardando...</span>
                </div>
              ))}
            </div>
          </div>

          {/* Botão iniciar */}
          <div className="px-5 pb-5 pt-4 mt-auto">
            {isHost ? (
              <button onClick={()=>{playClickSound(getVol()); handleStart()}}
                disabled={!canStart}
                className="w-full h-14 rounded-2xl font-black text-lg tracking-wide flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  background: canStart ? "linear-gradient(135deg,#991b1b,#dc2626,#ef4444)" : "rgba(255,255,255,0.05)",
                  color: canStart ? "#fff" : "rgba(255,255,255,0.2)",
                  border: canStart ? "1px solid rgba(255,120,120,0.3)" : "1px solid rgba(255,255,255,0.06)",
                  boxShadow: canStart ? "0 0 40px rgba(220,38,38,0.4)" : "none",
                  cursor: canStart ? "pointer" : "not-allowed",
                }}>
                <Play className="w-5 h-5 fill-current"/>
                {!room.songId ? "Escolha uma música"
                  : room.players.length<2 ? "Aguardando oponente..."
                  : `Iniciar Batalha — ${room.players.length} jogadores`}
                {canStart && <ChevronRight className="w-5 h-5 opacity-60"/>}
              </button>
            ) : (
              <div className="w-full h-14 rounded-2xl flex items-center justify-center text-sm"
                style={{background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", color:"rgba(255,255,255,0.3)"}}>
                {room.songId
                  ? <><span className="font-bold text-white/60">{selectedSong?.name}</span>&nbsp;— Aguardando o anfitrião iniciar</>
                  : "Aguardando o anfitrião escolher uma música..."}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`input::placeholder { color: rgba(255,255,255,0.25); }`}</style>
    </div>
  )
}
