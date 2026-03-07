"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Copy, Check, Play, Loader2, Crown, ChevronRight, Music, Clock, Zap, Signal } from "lucide-react"
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

const PC     = ["#e11d48","#3b82f6","#22c55e","#f97316"]
const LANE_OPTS = [
  { n: 4 as 4|5|6, label:"Fácil",   sub:"4 lanes", keys:"A S D J",     color:"#3b82f6", grad:"linear-gradient(135deg,#1d4ed8,#3b82f6)" },
  { n: 5 as 4|5|6, label:"Normal",  sub:"5 lanes", keys:"A S D J K",   color:"#22c55e", grad:"linear-gradient(135deg,#15803d,#22c55e)" },
  { n: 6 as 4|5|6, label:"Difícil", sub:"6 lanes", keys:"A S D J K L", color:"#e11d48", grad:"linear-gradient(135deg,#991b1b,#e11d48)" },
]
const DCOLS  = ["#22c55e","#22c55e","#86efac","#eab308","#f97316","#ef4444","#a855f7"]
const DLBLS  = ["—","Easy","Medium","Hard","Expert","Expert+","Extreme"]

// Animated waveform (mesmo do song-select solo)
function Waveform({ color }: { color: string }) {
  return (
    <div className="flex items-end gap-[2px] h-4">
      {[0,1,2,3,4].map(i => (
        <div key={i} className="w-[3px] rounded-full" style={{
          background: color,
          height: `${40 + Math.sin(i * 1.3) * 30}%`,
          animation: `wave-bar ${0.6 + i * 0.12}s ease-in-out infinite alternate`,
          animationDelay: `${i * 0.1}s`,
        }}/>
      ))}
    </div>
  )
}

// Player avatar
function PlayerSlot({ p, idx, hostId, playerId }: { p: Player|null; idx: number; hostId: string; playerId: string }) {
  const color = PC[idx % 4]
  const isMe  = p?.id === playerId
  const isHost = p?.id === hostId
  if (!p) return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ border: "1px dashed rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "rgba(255,255,255,0.1)" }}/>
      </div>
      <p className="text-[9px] tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.15)" }}>Slot {idx+1}</p>
    </div>
  )
  return (
    <div className="flex flex-col items-center gap-2" style={{ animation: "fade-up 0.3s ease both" }}>
      <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg"
        style={{
          background: `linear-gradient(135deg, ${color}33, ${color}11)`,
          border: `1px solid ${color}55`,
          boxShadow: isMe ? `0 0 20px ${color}44` : "none",
          color,
          fontFamily: "'Impact', sans-serif",
        }}>
        {isHost && <Crown className="absolute -top-2 -right-2 w-3.5 h-3.5 drop-shadow-sm" style={{ color: "#fbbf24" }}/>}
        {p.name.charAt(0).toUpperCase()}
      </div>
      <div className="text-center">
        <p className="text-[10px] font-bold text-white truncate max-w-[72px]">{isMe ? "Você" : p.name}</p>
        <p className="text-[9px]" style={{ color: `${color}88` }}>{isHost ? "host" : `p${idx+1}`}</p>
      </div>
    </div>
  )
}

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
  const [laneCount, setLaneCount] = useState<4|5|6>(5)
  const laneCountRef = useRef<4|5|6>(5)
  const pollRef                 = useRef<ReturnType<typeof setInterval>|null>(null)
  const startedRef              = useRef(false)
  const listRef                 = useRef<HTMLDivElement>(null)

  useEffect(() => { laneCountRef.current = laneCount }, [laneCount])
  useEffect(() => { const id=sessionStorage.getItem("playerId"); if(!id){router.push("/lobby");return}; setPlayerId(id) }, [router])
  useEffect(() => { fetch("/api/songs").then(r=>r.json()).then(setSongs).catch(()=>{}) }, [])

  const fetchRoom = useCallback(async () => {
    try {
      const res=await fetch(`/api/rooms/${code}`); if(!res.ok){setError("Sala não encontrada");return}
      const data:RoomData=await res.json(); setRoom(data)
      if (data.state==="playing" && !startedRef.current) {
        startedRef.current=true
        const pid=sessionStorage.getItem("playerId")
        router.push(`/play/${encodeURIComponent(data.songId!)}?room=${code}&player=${pid}&lanes=${laneCountRef.current}`)
      }
      if (data.state==="ended"||data.state==="waiting") startedRef.current=false
    } catch { setError("Erro de conexão") }
  }, [code, router])

  useEffect(() => {
    fetchRoom()
    pollRef.current=setInterval(fetchRoom,1500)
    return () => { if(pollRef.current) clearInterval(pollRef.current) }
  }, [fetchRoom])

  useEffect(() => {
    const filtered = songs.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.artist.toLowerCase().includes(search.toLowerCase()))
    const onKey = (e: KeyboardEvent) => {
      if (e.key==="ArrowDown") { e.preventDefault(); setSelIdx(i => Math.min(i+1, filtered.length-1)) }
      if (e.key==="ArrowUp")   { e.preventDefault(); setSelIdx(i => Math.max(i-1, 0)) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [songs, search])

  const filtered   = songs.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.artist.toLowerCase().includes(search.toLowerCase()))
  const selectedSong = songs.find(s => s.id===room?.songId) ?? filtered[selIdx]
  const dc = DCOLS[selectedSong?.difficulty ?? 0]

  async function handleSetSong(songId: string) {
    await fetch(`/api/rooms/${code}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action:"setSong",songId}) })
    fetchRoom()
  }
  async function handleStart() {
    if (!room?.songId) return
    await fetch(`/api/rooms/${code}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action:"setState",state:"playing"}) })
    router.push(`/play/${encodeURIComponent(room.songId)}?room=${code}&player=${playerId}&lanes=${laneCount}`)
  }
  function copyCode() { navigator.clipboard.writeText(code); setCopied(true); setTimeout(()=>setCopied(false),2000) }

  const isHost   = room?.hostId===playerId
  const canStart = isHost && (room?.players.length??0)>=2 && !!room?.songId

  if (error) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4" style={{background:"#060608"}}>
      <p className="text-xl font-black" style={{color:"#e11d48", fontFamily:"'Impact',sans-serif"}}>{error}</p>
      <button onClick={()=>router.push("/lobby")} className="text-white/30 text-sm hover:text-white/60 transition-colors">← Voltar ao Lobby</button>
    </div>
  )
  if (!room||!playerId) return (
    <div className="flex items-center justify-center h-screen" style={{background:"#060608"}}>
      <div className="w-8 h-8 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const slots = Array.from({length: room.maxPlayers}, (_, i) => room.players[i] ?? null)

  return (
    <div className="flex h-screen overflow-hidden" style={{background:"#060608", fontFamily:"'Inter',sans-serif"}}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800;900&display=swap');
        .bebas { font-family: 'Bebas Neue','Impact',sans-serif !important; }
        @keyframes wave-bar { from { transform: scaleY(0.4); } to { transform: scaleY(1); } }
        @keyframes fade-up { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slide-right { from { opacity:0; transform:translateX(-6px); } to { opacity:1; transform:translateX(0); } }
        @keyframes glow-pulse { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:2px; }
        input::placeholder { color:rgba(255,255,255,0.2); }
        .song-btn { border-left: 2px solid transparent; transition: all 0.12s; }
        .song-btn:hover { background: rgba(255,255,255,0.04) !important; }
        .song-btn.active { border-left-color: var(--dc); }
      `}</style>

      {/* ── LEFT: Song list ── */}
      <div className="w-60 flex flex-col flex-shrink-0"
        style={{ borderRight:"1px solid rgba(255,255,255,0.05)", background:"rgba(0,0,0,0.25)" }}>

        {/* Back + search */}
        <div className="px-3 pt-3 pb-2 flex-shrink-0 space-y-2"
          style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={()=>router.push("/lobby")}
            className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest opacity-35 hover:opacity-70 transition-opacity"
            style={{ color:"#fff" }}>
            ← Lobby
          </button>
          <input value={search} onChange={e=>{setSearch(e.target.value);setSelIdx(0)}}
            placeholder="Buscar música..."
            className="w-full text-xs rounded-xl px-3 py-2 outline-none"
            style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.09)", color:"#fff" }}/>
        </div>

        {/* List */}
        <div ref={listRef} className="flex-1 overflow-y-auto py-1">
          {filtered.map((song, i) => {
            const isActive = room.songId===song.id || (!room.songId && i===selIdx)
            const songDc   = DCOLS[song.difficulty??0]
            return (
              <button key={song.id}
                onMouseEnter={() => playHoverSound(getVol())}
                onClick={() => { playClickSound(getVol()); setSelIdx(i); if(isHost) handleSetSong(song.id) }}
                className={`song-btn w-full flex items-center gap-2.5 px-3 py-2.5 text-left`}
                style={{
                  '--dc': songDc,
                  borderLeftColor: isActive ? songDc : "transparent",
                  background: isActive ? `${songDc}10` : "transparent",
                } as React.CSSProperties}>
                {/* Diff mini bars */}
                <div className="flex items-end gap-[2px] flex-shrink-0">
                  {[1,2,3,4].map(b => (
                    <div key={b} className="w-[3px] rounded-sm"
                      style={{ height:`${4+b*3}px`, background: b<=Math.ceil((song.difficulty??1)/6*4) ? songDc : "rgba(255,255,255,0.08)" }}/>
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.6)" }}>{song.name}</p>
                  <p className="text-[10px] truncate" style={{ color:"rgba(255,255,255,0.28)" }}>{song.artist}</p>
                </div>
                {isActive && room.songId===song.id && (
                  <div className="flex-shrink-0"><Waveform color={songDc}/></div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT: Detail panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Blurred album art background */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          {selectedSong?.albumArt
            ? <img src={selectedSong.albumArt} alt="" className="absolute inset-0 w-full h-full object-cover"
                style={{ filter:"blur(80px) saturate(2) brightness(0.18)", transform:"scale(1.2)", transition:"all 0.8s" }}/>
            : <div className="absolute inset-0 transition-all duration-1000"
                style={{ background:`radial-gradient(ellipse 70% 60% at 50% 20%, ${dc}18, transparent 70%)` }}/>}
          <div className="absolute inset-0" style={{ background:"linear-gradient(180deg, rgba(6,6,8,0.4) 0%, rgba(6,6,8,0.7) 50%, rgba(6,6,8,0.95) 100%)" }}/>
          {/* Top accent line */}
          <div className="absolute top-0 inset-x-0 h-px transition-all duration-700"
            style={{ background:`linear-gradient(90deg, transparent, ${dc}99, ${dc}99, transparent)`, opacity:0.6 }}/>
        </div>

        {/* ── Top bar ── */}
        <div className="relative z-10 flex items-center justify-between px-6 py-3.5 flex-shrink-0"
          style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:"#e11d48" }}/>
            <p className="bebas text-sm tracking-[0.35em]" style={{ color:"rgba(255,120,60,0.7)" }}>SALA DE BATALHA</p>
          </div>
          {/* Room code */}
          <button onClick={()=>{playClickSound(getVol());copyCode()}}
            className="group flex items-center gap-2.5 px-4 py-2 rounded-xl transition-all hover:scale-105 active:scale-95"
            style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)" }}>
            <Signal className="w-3 h-3" style={{ color:"rgba(255,255,255,0.3)" }}/>
            <span className="bebas tracking-[0.45em] text-base text-white">{code}</span>
            {copied
              ? <Check className="w-3.5 h-3.5 text-green-400"/>
              : <Copy className="w-3 h-3 group-hover:opacity-70 opacity-30 text-white transition-opacity"/>}
          </button>
        </div>

        {/* ── Song hero ── */}
        <div className="relative z-10 flex items-start gap-6 px-6 py-5 flex-shrink-0"
          style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
          {selectedSong ? (
            <>
              {/* Album art + vinyl */}
              <div className="relative flex-shrink-0" style={{ animation:"fade-up 0.35s ease both" }}>
                {/* Vinyl peek */}
                <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-32 h-32 rounded-full -z-10"
                  style={{ background:"radial-gradient(circle, #1c1c1c, #0a0a0a)", border:"1px solid rgba(255,255,255,0.06)", boxShadow:"inset 0 0 20px rgba(0,0,0,0.8)" }}>
                  <div className="absolute inset-[44%] rounded-full" style={{ background:dc, opacity:0.7 }}/>
                </div>
                <div className="w-36 h-36 rounded-2xl overflow-hidden"
                  style={{ border:`2px solid ${dc}55`, boxShadow:`0 0 0 1px rgba(0,0,0,0.5), 0 0 40px ${dc}40, 0 16px 48px rgba(0,0,0,0.8)` }}>
                  {selectedSong.albumArt
                    ? <img src={selectedSong.albumArt} alt="" className="w-full h-full object-cover"/>
                    : <div className="w-full h-full flex items-center justify-center"
                        style={{ background:`linear-gradient(135deg,${dc}22,rgba(0,0,0,0.7))` }}>
                        <Music className="w-12 h-12" style={{ color:`${dc}44` }}/>
                      </div>}
                </div>
                {/* "preview" badge — waveform */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full whitespace-nowrap"
                  style={{ background:"rgba(0,0,0,0.85)", border:`1px solid ${dc}44`, backdropFilter:"blur(8px)" }}>
                  <Waveform color={dc}/>
                  <span className="text-[9px] font-bold bebas tracking-widest" style={{ color:dc }}>AO VIVO</span>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 pt-1" style={{ animation:"slide-right 0.35s ease both" }}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] mb-1" style={{ color:"rgba(255,255,255,0.3)" }}>
                  {selectedSong.artist}
                </p>
                <h1 className="bebas text-4xl leading-none text-white mb-3"
                  style={{ letterSpacing:"0.02em", textShadow:`0 0 40px ${dc}66` }}>
                  {selectedSong.name}
                </h1>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedSong.genre && (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide"
                      style={{ background:"rgba(255,150,60,0.12)", color:"rgba(255,150,60,0.8)", border:"1px solid rgba(255,150,60,0.2)" }}>
                      {selectedSong.genre}
                    </span>
                  )}
                  {selectedSong.year && (
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.35)", border:"1px solid rgba(255,255,255,0.08)" }}>
                      {selectedSong.year}
                    </span>
                  )}
                  {selectedSong.songLength > 0 && (
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.35)", border:"1px solid rgba(255,255,255,0.08)" }}>
                      <Clock className="w-3 h-3"/>{fmt(selectedSong.songLength)}
                    </span>
                  )}
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background:`${dc}18`, color:dc, border:`1px solid ${dc}44` }}>
                    {DLBLS[selectedSong.difficulty??0]}
                  </span>
                </div>

                {/* Diff bar */}
                <div className="flex items-center gap-3 max-w-xs">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.07)" }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width:`${((selectedSong.difficulty??1)/6)*100}%`, background:`linear-gradient(90deg,${DCOLS[Math.max(0,(selectedSong.difficulty??1)-1)]},${dc})` }}/>
                  </div>
                  <span className="text-xs" style={{ color:`${dc}99` }}>
                    {["","★","★★","★★★","★★★★","★★★★★","★★★★★★"][selectedSong.difficulty??0]}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-5 py-6">
              <div className="w-36 h-36 rounded-2xl flex items-center justify-center"
                style={{ border:"1px dashed rgba(255,255,255,0.07)", background:"rgba(255,255,255,0.02)" }}>
                <Music className="w-12 h-12" style={{ color:"rgba(255,255,255,0.08)" }}/>
              </div>
              <p className="text-sm" style={{ color:"rgba(255,255,255,0.2)" }}>
                {isHost ? "↑ Escolha uma música na lista" : "Aguardando o anfitrião escolher..."}
              </p>
            </div>
          )}
        </div>

        {/* ── Seletor de dificuldade ── */}
        <div className="relative z-10 px-6 py-3 flex-shrink-0 flex items-center gap-3"
          style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
          <p className="bebas text-xs tracking-[0.3em] flex-shrink-0" style={{ color:"rgba(255,180,60,0.4)" }}>DIFICULDADE</p>
          <div className="flex gap-2 flex-1">
            {LANE_OPTS.map(opt => (
              <button key={opt.n} onClick={()=>setLaneCount(opt.n)}
                className="flex-1 flex flex-col items-center py-2 rounded-xl transition-all hover:scale-[1.03] active:scale-[0.97]"
                style={{
                  background: laneCount===opt.n ? opt.grad : "rgba(255,255,255,0.04)",
                  border: laneCount===opt.n ? `1px solid ${opt.color}55` : "1px solid rgba(255,255,255,0.07)",
                  boxShadow: laneCount===opt.n ? `0 0 16px ${opt.color}33` : "none",
                }}>
                <span className="text-xs font-black" style={{ color: laneCount===opt.n ? "#fff" : "rgba(255,255,255,0.4)", fontFamily:"'Bebas Neue','Impact',sans-serif", letterSpacing:"0.05em" }}>{opt.label}</span>
                <span className="text-[9px] mt-0.5" style={{ color: laneCount===opt.n ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)" }}>{opt.keys}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Jogadores ── */}
        <div className="relative z-10 px-6 py-4 flex-shrink-0"
          style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
          <p className="bebas text-xs tracking-[0.35em] mb-4" style={{ color:"rgba(255,180,60,0.4)" }}>
            JOGADORES — {room.players.length} / {room.maxPlayers}
          </p>
          <div className="flex gap-6">
            {slots.map((p, idx) => (
              <PlayerSlot key={idx} p={p} idx={idx} hostId={room.hostId} playerId={playerId!}/>
            ))}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1"/>

        {/* ── Seletor de dificuldade (lanes) ── */}
        <div className="relative z-10 px-6 py-3 flex-shrink-0"
          style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
          <p className="bebas text-xs tracking-[0.35em] mb-3" style={{ color:"rgba(255,180,60,0.4)" }}>DIFICULDADE — NÚMERO DE LANES</p>
          <div className="flex gap-2">
            {LANE_OPTS.map(opt => (
              <button key={opt.n} onClick={()=>setLaneCount(opt.n)}
                className="flex-1 flex flex-col items-center py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: laneCount===opt.n ? opt.grad : "rgba(255,255,255,0.04)",
                  border: laneCount===opt.n ? `1px solid ${opt.color}55` : "1px solid rgba(255,255,255,0.07)",
                  boxShadow: laneCount===opt.n ? `0 0 16px ${opt.color}33` : "none",
                }}>
                <span className="text-xs font-black" style={{ color: laneCount===opt.n ? "#fff" : "rgba(255,255,255,0.4)", fontFamily:"'Bebas Neue','Impact',sans-serif", letterSpacing:"0.05em" }}>{opt.label}</span>
                <span className="text-[9px] mt-0.5" style={{ color: laneCount===opt.n ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)" }}>{opt.keys}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Botão iniciar ── */}
        <div className="relative z-10 px-6 pb-6 flex-shrink-0">
          {isHost ? (
            <button onClick={()=>{playClickSound(getVol()); handleStart()}}
              disabled={!canStart}
              className="w-full h-16 rounded-2xl flex items-center justify-center gap-3 transition-all duration-200"
              style={{
                background: canStart
                  ? `linear-gradient(135deg, #7f1d1d, #dc2626 35%, #ef4444 65%, #b91c1c)`
                  : "rgba(255,255,255,0.04)",
                color: canStart ? "#fff" : "rgba(255,255,255,0.18)",
                border: canStart ? "1px solid rgba(255,120,120,0.25)" : "1px solid rgba(255,255,255,0.06)",
                boxShadow: canStart ? "0 0 50px rgba(220,38,38,0.3), 0 2px 0 rgba(255,255,255,0.06) inset, 0 8px 32px rgba(0,0,0,0.5)" : "none",
                cursor: canStart ? "pointer" : "not-allowed",
                transform: canStart ? undefined : "scale(0.99)",
                fontFamily:"'Bebas Neue','Impact',sans-serif",
                letterSpacing:"0.2em",
                fontSize:"1.25rem",
              }}>
              {canStart && <Zap className="w-5 h-5 fill-current opacity-70"/>}
              {!room.songId ? "ESCOLHA UMA MÚSICA"
                : room.players.length<2 ? "AGUARDANDO OPONENTE..."
                : `INICIAR BATALHA — ${room.players.length} JOGADORES`}
              {canStart && <ChevronRight className="w-5 h-5 opacity-40"/>}
            </button>
          ) : (
            <div className="w-full h-16 rounded-2xl flex items-center justify-center gap-2"
              style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:"rgba(255,255,255,0.2)" }}/>
              <span className="text-sm" style={{ color:"rgba(255,255,255,0.3)" }}>
                {room.songId
                  ? <>Aguardando <span className="font-bold" style={{ color:"rgba(255,255,255,0.55)" }}>anfitrião</span> iniciar...</>
                  : "Aguardando o anfitrião escolher uma música..."}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
