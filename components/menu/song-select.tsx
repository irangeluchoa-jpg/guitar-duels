"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Play, Music } from "lucide-react"
import type { SongListItem } from "@/lib/songs/types"
import { playClickSound, playHoverSound } from "@/lib/game/sounds"
import { loadSettings, DEFAULT_KEY_BINDINGS } from "@/lib/settings"
import { GHBackground, GHLogo, GHBackButton, GHCard, GHSectionTitle, GHButton } from "@/components/ui/gh-layout"

function getVol() { try { const s=loadSettings(); return (s.masterVolume/100)*(s.sfxVolume/100) } catch { return .5 } }

const DIFF_LABELS = ["Beginner","Easy","Medium","Hard","Expert","Expert+","Extreme"]
const DIFF_COLORS = ["#22c55e","#86efac","#eab308","#f97316","#ef4444","#a855f7","#ec4899"]
const LANE_COLORS = ["#22c55e","#ef4444","#eab308","#3b82f6","#f97316"]

export function SongSelect() {
  const router = useRouter()
  const [keyBindings, setKeyBindings] = useState([...DEFAULT_KEY_BINDINGS])
  const [songs, setSongs]             = useState<SongListItem[]>([])
  const [sel, setSel]                 = useState(0)
  const [loading, setLoading]         = useState(true)
  const [previewAudio]                = useState(() => typeof Audio!=="undefined" ? new Audio() : null)
  const prevTimeout                   = useRef<ReturnType<typeof setTimeout>|null>(null)
  const listRef                       = useRef<HTMLDivElement>(null)

  useEffect(() => { const s=loadSettings(); setKeyBindings(s.keyBindings??[...DEFAULT_KEY_BINDINGS]) },[])

  useEffect(() => {
    fetch("/api/songs").then(r=>r.json()).then(d=>{setSongs(d);setLoading(false)}).catch(()=>setLoading(false))
  },[])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${sel}"]`)?.scrollIntoView({block:"nearest",behavior:"smooth"})
  },[sel])

  useEffect(() => {
    if(!previewAudio) return
    const song=songs[sel]
    if(prevTimeout.current) clearTimeout(prevTimeout.current)
    previewAudio.pause()
    if(song?.previewUrl){
      prevTimeout.current=setTimeout(()=>{
        if(previewAudio){previewAudio.src=song.previewUrl!;previewAudio.volume=.4;previewAudio.play().catch(()=>{})}
      },600)
    }
    return ()=>{if(prevTimeout.current)clearTimeout(prevTimeout.current)}
  },[sel,songs,previewAudio])

  useEffect(() => ()=>{ previewAudio?.pause() },[previewAudio])

  useEffect(() => {
    const h=(e:KeyboardEvent)=>{
      if(e.key==="ArrowUp"||e.key==="w"){e.preventDefault();setSel(p=>Math.max(0,p-1))}
      else if(e.key==="ArrowDown"||e.key==="s"){e.preventDefault();setSel(p=>Math.min(songs.length-1,p+1))}
      else if(e.key==="Enter"&&songs[sel]){previewAudio?.pause();router.push(`/play/${songs[sel].id}`)}
      else if(e.key==="Escape"){previewAudio?.pause();router.push("/")}
    }
    window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h)
  },[songs,sel,router,previewAudio])

  const selected   = songs[sel]
  const diffColor  = selected ? DIFF_COLORS[Math.min(selected.difficulty, DIFF_COLORS.length-1)] : "#888"
  const diffLabel  = selected ? DIFF_LABELS[Math.min(selected.difficulty, DIFF_LABELS.length-1)] : ""

  return (
    <GHBackground>
      <div className="flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <GHBackButton label="Menu" />
          <GHLogo size="sm" />
          <div className="flex items-center gap-3 text-[10px]" style={{color:"rgba(255,255,255,.2)",fontFamily:"'Arial',sans-serif"}}>
            <span>↑↓ navegar</span><span style={{color:"rgba(255,255,255,.1)"}}>|</span>
            <span>Enter jogar</span><span style={{color:"rgba(255,255,255,.1)"}}>|</span>
            <span>Esc voltar</span>
          </div>
        </div>

        <GHSectionTitle>🎸 Selecionar Música</GHSectionTitle>

        <div className="flex flex-1 overflow-hidden gap-4 px-4 pb-4">
          {/* Song list */}
          <div ref={listRef} className="w-[360px] overflow-y-auto flex flex-col gap-1 flex-shrink-0" style={{scrollbarWidth:"none"}}>
            {loading ? (
              <div className="flex items-center justify-center h-24">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{borderColor:"#e11d48 transparent transparent transparent"}}/>
              </div>
            ) : songs.length===0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3" style={{color:"rgba(255,255,255,.25)"}}>
                <Music className="w-10 h-10"/>
                <p className="text-xs tracking-widest" style={{fontFamily:"'Impact',sans-serif"}}>NENHUMA MÚSICA</p>
                <p className="text-[10px] text-center" style={{fontFamily:"'Arial',sans-serif"}}>
                  Adicione em <code style={{color:"#ff6060"}}>public/songs/</code>
                </p>
              </div>
            ) : songs.map((song,i)=>{
              const isS = i===sel
              const dc  = DIFF_COLORS[Math.min(song.difficulty, DIFF_COLORS.length-1)]
              return (
                <button key={song.id} data-index={i}
                  onClick={()=>setSel(i)}
                  onDoubleClick={()=>{previewAudio?.pause();router.push(`/play/${song.id}`)}}
                  className="flex items-center gap-3 px-4 py-3 text-left transition-all relative overflow-hidden hover:scale-[1.01]"
                  style={{borderRadius:"4px",
                    background:isS?"rgba(200,0,20,.2)":"rgba(255,255,255,.03)",
                    border:`1px solid ${isS?"rgba(255,80,80,.4)":"rgba(255,255,255,.05)"}`}}>
                  {/* Barra lateral colorida quando selecionado */}
                  {isS&&<div className="absolute left-0 top-0 bottom-0 w-1" style={{background:"linear-gradient(180deg,#ff6060,#cc0020)"}}/>}
                  <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                    style={{background:isS?`${dc}20`:"rgba(255,255,255,.04)"}}>
                    <Music className="w-4 h-4" style={{color:isS?dc:"#444"}}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{color:isS?"#fff":"#aaa",fontFamily:"'Arial Black',sans-serif"}}>{song.name}</p>
                    <p className="text-xs truncate" style={{color:isS?"rgba(255,255,255,.5)":"#444",fontFamily:"'Arial',sans-serif"}}>{song.artist}</p>
                  </div>
                  {/* Barras de dificuldade */}
                  <div className="flex gap-0.5 flex-shrink-0">
                    {Array.from({length:5}).map((_,si)=>(
                      <div key={si} className="w-1.5 h-3 rounded-sm"
                        style={{background:si<Math.round((song.difficulty/6)*5)?dc:"rgba(255,255,255,.08)"}}/>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Detail panel */}
          <GHCard className="flex-1 flex flex-col overflow-hidden relative">
            {selected ? (
              <>
                {/* BG art */}
                {selected.albumArt ? (
                  <div className="absolute inset-0 opacity-8"
                    style={{backgroundImage:`url(${selected.albumArt})`,backgroundSize:"cover",backgroundPosition:"center",filter:"blur(40px) saturate(2)"}}/>
                ) : (
                  <div className="absolute inset-0" style={{background:`radial-gradient(ellipse at 50% 30%,${diffColor}18,transparent 70%)`}}/>
                )}

                <div className="relative z-10 flex flex-col h-full p-6 gap-4">
                  {/* Album + info */}
                  <div className="flex gap-5">
                    <div className="w-28 h-28 rounded flex-shrink-0 flex items-center justify-center overflow-hidden"
                      style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)"}}>
                      {selected.albumArt ? <img src={selected.albumArt} alt="Album" className="w-full h-full object-cover"/> : <Music className="w-12 h-12" style={{color:"rgba(255,255,255,.2)"}}/>}
                    </div>
                    <div className="flex flex-col justify-center gap-1">
                      <h2 className="text-2xl font-black text-white leading-tight" style={{fontFamily:"'Impact',sans-serif"}}>{selected.name}</h2>
                      <p className="text-base" style={{color:"rgba(255,255,255,.55)",fontFamily:"'Arial',sans-serif"}}>{selected.artist}</p>
                      {selected.album&&<p className="text-xs" style={{color:"rgba(255,255,255,.3)",fontFamily:"'Arial',sans-serif"}}>{selected.album}{selected.year?` · ${selected.year}`:""}</p>}
                      {selected.genre&&<span className="mt-1 text-xs px-2 py-0.5 rounded-full" style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",color:"rgba(255,255,255,.5)",fontFamily:"'Arial',sans-serif"}}>{selected.genre}</span>}
                    </div>
                  </div>

                  {/* Difficulty bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] uppercase tracking-[.3em]" style={{color:"rgba(255,255,255,.3)",fontFamily:"'Arial Black',sans-serif"}}>Dificuldade</span>
                      <span className="text-xs font-black" style={{color:diffColor,fontFamily:"'Impact',sans-serif"}}>{diffLabel}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,.06)"}}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{width:`${((selected.difficulty+1)/7)*100}%`,background:diffColor,boxShadow:`0 0 8px ${diffColor}80`}}/>
                    </div>
                  </div>

                  {/* Key guide */}
                  <div className="p-3 rounded" style={{background:"rgba(0,0,0,.3)",border:"1px solid rgba(255,255,255,.07)"}}>
                    <p className="text-[9px] uppercase tracking-[.3em] mb-2" style={{color:"rgba(255,255,255,.3)",fontFamily:"'Arial Black',sans-serif"}}>Controles</p>
                    <div className="flex gap-2">
                      {keyBindings.map((key,i)=>{
                        const c=LANE_COLORS[i]
                        return (
                          <div key={i} className="flex flex-col items-center gap-1">
                            {/* GH3-style fret button */}
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black relative"
                              style={{background:`radial-gradient(circle at 35% 30%,${c}ee,${c}88,${c}22)`,
                                border:`2px solid ${c}`,boxShadow:`0 0 10px ${c}55,inset 0 2px 0 rgba(255,255,255,.4),0 3px 0 rgba(0,0,0,.8)`}}>
                              <div className="absolute top-1 left-1.5 w-2 h-1 rounded-full" style={{background:"rgba(255,255,255,.45)",filter:"blur(1px)"}}/>
                              <span className="relative z-10 text-[10px]" style={{color:"#fff",textShadow:"0 1px 2px rgba(0,0,0,.8)",fontFamily:"'Impact',sans-serif"}}>{key.toUpperCase()}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Play button */}
                  <GHButton variant="primary" onClick={()=>{previewAudio?.pause();router.push(`/play/${selected.id}`)}}
                    className="w-full mt-auto">
                    <Play className="w-5 h-5 fill-current"/> JOGAR AGORA
                  </GHButton>
                </div>
              </>
            ) : !loading&&songs.length===0 ? null : (
              <div className="flex items-center justify-center h-full" style={{color:"rgba(255,255,255,.15)"}}>
                <Music className="w-16 h-16"/>
              </div>
            )}
          </GHCard>
        </div>
      </div>
    </GHBackground>
  )
}
