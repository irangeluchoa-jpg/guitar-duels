"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Play, Music, Clock, Star, Zap, ChevronRight } from "lucide-react"
import type { SongListItem } from "@/lib/songs/types"
import { playClickSound, playHoverSound } from "@/lib/game/sounds"
import { loadSettings, DEFAULT_KEY_BINDINGS } from "@/lib/settings"
import { GHBackground, GHLogo, GHBackButton, GHCard, GHSectionTitle, GHButton } from "@/components/ui/gh-layout"

function getVol() { try { const s=loadSettings(); return (s.masterVolume/100)*(s.sfxVolume/100) } catch { return .5 } }

const DIFF_LABELS = ["Beginner","Easy","Medium","Hard","Expert","Expert+","Extreme"]
const DIFF_COLORS = ["#22c55e","#86efac","#eab308","#f97316","#ef4444","#a855f7","#ec4899"]
const LANE_COLORS = ["#00E14F","#FF2828","#FFFD4B","#55ADFF","#FF9537"]
const LANE_NAMES  = ["Verde","Verm.","Amar.","Azul","Lar."]

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`
}

// Mini fret button component
function FretBtn({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-11 h-11 rounded-full flex items-center justify-center"
        style={{
          background: `radial-gradient(circle at 35% 28%, ${color}ff, ${color}99, ${color}33)`,
          border: `2.5px solid ${color}`,
          boxShadow: `0 0 14px ${color}66, 0 0 28px ${color}22, inset 0 2px 0 rgba(255,255,255,.45), 0 4px 0 rgba(0,0,0,.9)`,
        }}>
        {/* Shine */}
        <div className="absolute top-1.5 left-2 w-3 h-1.5 rounded-full"
          style={{ background: "rgba(255,255,255,.55)", filter: "blur(1px)" }} />
        {/* Inner ring */}
        <div className="absolute inset-1.5 rounded-full"
          style={{ border: `1px solid ${color}88` }} />
        <span className="relative z-10 text-xs font-black"
          style={{ color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,.9)", fontFamily: "'Impact',sans-serif" }}>
          {label.toUpperCase()}
        </span>
      </div>
    </div>
  )
}

// Animated waveform bars
function Waveform({ color, playing }: { color: string; playing: boolean }) {
  return (
    <div className="flex items-end gap-0.5 h-6">
      {[3,5,4,6,3,5,7,4,6,5,3,4,6,5,4].map((h, i) => (
        <div key={i} className="w-0.5 rounded-full"
          style={{
            height: playing ? `${h * 3}px` : "4px",
            background: color,
            opacity: playing ? 0.8 : 0.3,
            transition: `height ${0.15 + i * 0.02}s ease-in-out`,
            animation: playing ? `wave-${i % 4} ${0.4 + i * 0.05}s ease-in-out infinite alternate` : "none",
          }} />
      ))}
    </div>
  )
}

// Difficulty stars
function DiffStars({ diff, color }: { diff: number; color: string }) {
  const filled = Math.round(((diff + 1) / 7) * 5)
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="w-3.5 h-3.5"
          style={{ color: i < filled ? color : "rgba(255,255,255,.12)", fill: i < filled ? color : "transparent" }} />
      ))}
    </div>
  )
}

export function SongSelect() {
  const router = useRouter()
  const [keyBindings, setKeyBindings] = useState([...DEFAULT_KEY_BINDINGS])
  const [songs, setSongs]             = useState<SongListItem[]>([])
  const [sel, setSel]                 = useState(0)
  const [loading, setLoading]         = useState(true)
  const [isPlaying, setIsPlaying]     = useState(false)
  const [previewAudio]                = useState(() => typeof Audio !== "undefined" ? new Audio() : null)
  const [laneCount, setLaneCount]      = useState<4|5|6>(5)
  const prevTimeout                   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listRef                       = useRef<HTMLDivElement>(null)

  useEffect(() => { const s = loadSettings(); setKeyBindings(s.keyBindings ?? [...DEFAULT_KEY_BINDINGS]) }, [])
  useEffect(() => {
    fetch("/api/songs").then(r => r.json()).then(d => { setSongs(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${sel}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [sel])

  useEffect(() => {
    if (!previewAudio) return
    const song = songs[sel]
    if (prevTimeout.current) clearTimeout(prevTimeout.current)
    previewAudio.pause(); setIsPlaying(false)
    if (song?.previewUrl) {
      prevTimeout.current = setTimeout(() => {
        if (previewAudio) {
          previewAudio.src = song.previewUrl!
          previewAudio.volume = 0.4
          previewAudio.play().then(() => setIsPlaying(true)).catch(() => {})
          previewAudio.onended = () => setIsPlaying(false)
        }
      }, 600)
    }
    return () => { if (prevTimeout.current) clearTimeout(prevTimeout.current) }
  }, [sel, songs, previewAudio])

  useEffect(() => () => { previewAudio?.pause() }, [previewAudio])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "w") { e.preventDefault(); setSel(p => Math.max(0, p - 1)) }
      else if (e.key === "ArrowDown" || e.key === "s") { e.preventDefault(); setSel(p => Math.min(songs.length - 1, p + 1)) }
      else if (e.key === "Enter" && songs[sel]) { previewAudio?.pause(); router.push(`/play/${encodeURIComponent(songs[sel].id)}?lanes=${laneCount}`) }
      else if (e.key === "Escape") { previewAudio?.pause(); router.push("/") }
    }
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h)
  }, [songs, sel, router, previewAudio])

  const selected  = songs[sel]
  const diffIdx   = Math.min(selected?.difficulty ?? 0, DIFF_COLORS.length - 1)
  const diffColor = DIFF_COLORS[diffIdx]
  const diffLabel = DIFF_LABELS[diffIdx]

  return (
    <GHBackground>
      <div className="flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <GHBackButton label="Menu" />
          <GHLogo size="sm" />
          <div className="flex items-center gap-3 text-[10px]" style={{ color: "rgba(255,255,255,.2)", fontFamily: "'Arial',sans-serif" }}>
            <span>↑↓ navegar</span><span style={{ color: "rgba(255,255,255,.1)" }}>|</span>
            <span>Enter jogar</span><span style={{ color: "rgba(255,255,255,.1)" }}>|</span>
            <span>Esc voltar</span>
          </div>
        </div>

        <GHSectionTitle>🎸 Selecionar Música</GHSectionTitle>

        <div className="flex flex-1 overflow-hidden gap-4 px-4 pb-4">

          {/* ── Song list ── */}
          <div ref={listRef} className="w-[300px] overflow-y-auto flex flex-col gap-1 flex-shrink-0" style={{ scrollbarWidth: "none" }}>
            {loading ? (
              <div className="flex items-center justify-center h-24">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: "#e11d48 transparent transparent transparent" }} />
              </div>
            ) : songs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3" style={{ color: "rgba(255,255,255,.25)" }}>
                <Music className="w-10 h-10" />
                <p className="text-xs tracking-widest" style={{ fontFamily: "'Impact',sans-serif" }}>NENHUMA MÚSICA</p>
                <p className="text-[10px] text-center" style={{ fontFamily: "'Arial',sans-serif" }}>
                  Adicione em <code style={{ color: "#ff6060" }}>public/songs/</code>
                </p>
              </div>
            ) : songs.map((song, i) => {
              const isS = i === sel
              const dc  = DIFF_COLORS[Math.min(song.difficulty, DIFF_COLORS.length - 1)]
              return (
                <button key={song.id} data-index={i}
                  onClick={() => { playHoverSound(getVol()); setSel(i) }}
                  onDoubleClick={() => { previewAudio?.pause(); router.push(`/play/${encodeURIComponent(song.id)}?lanes=${laneCount}`) }}
                  className="flex items-center gap-3 px-3 py-2.5 text-left transition-all relative overflow-hidden"
                  style={{
                    borderRadius: "6px",
                    background: isS ? `linear-gradient(90deg, ${dc}22, rgba(200,0,20,.15))` : "rgba(255,255,255,.025)",
                    border: `1px solid ${isS ? dc + "55" : "rgba(255,255,255,.05)"}`,
                    transform: isS ? "translateX(3px)" : "none",
                  }}>
                  {isS && <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l" style={{ background: dc }} />}
                  <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: isS ? `${dc}22` : "rgba(255,255,255,.04)" }}>
                    <Music className="w-3.5 h-3.5" style={{ color: isS ? dc : "#555" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs truncate" style={{ color: isS ? "#fff" : "#888", fontFamily: "'Arial Black',sans-serif" }}>{song.name}</p>
                    <p className="text-[10px] truncate" style={{ color: isS ? "rgba(255,255,255,.45)" : "#444", fontFamily: "'Arial',sans-serif" }}>{song.artist}</p>
                  </div>
                  <div className="flex gap-0.5 flex-shrink-0">
                    {Array.from({ length: 5 }).map((_, si) => (
                      <div key={si} className="w-1 h-3 rounded-sm"
                        style={{ background: si < Math.round(((song.difficulty + 1) / 7) * 5) ? dc : "rgba(255,255,255,.07)" }} />
                    ))}
                  </div>
                  {isS && <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: dc }} />}
                </button>
              )
            })}
          </div>

          {/* ── Detail panel ── */}
          <div className="flex-1 overflow-hidden relative rounded-2xl"
            style={{ border: "1px solid rgba(255,255,255,.07)", background: "rgba(0,0,0,.5)" }}>
            {selected ? (
              <>
                {/* ── Full blurred background ── */}
                <div className="absolute inset-0 rounded-2xl overflow-hidden">
                  {selected.albumArt
                    ? <img src={selected.albumArt} alt="" className="absolute inset-0 w-full h-full object-cover"
                        style={{ filter: "blur(80px) saturate(2.2) brightness(0.28)", transform: "scale(1.15)" }} />
                    : <div className="absolute inset-0" style={{
                        background: `radial-gradient(ellipse at 20% 10%, ${diffColor}30, transparent 55%),
                                     radial-gradient(ellipse at 80% 90%, ${diffColor}18, transparent 55%),
                                     radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0), rgba(0,0,0,.5))`
                      }} />
                  }
                  <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.4) 0%, rgba(0,0,0,.15) 40%, rgba(0,0,0,.6) 100%)" }} />
                  {/* Top color line */}
                  <div className="absolute top-0 inset-x-0 h-0.5" style={{ background: `linear-gradient(90deg, transparent 0%, ${diffColor} 40%, ${diffColor} 60%, transparent 100%)`, opacity: 0.7 }} />
                </div>

                <div className="relative z-10 flex flex-col h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>

                  {/* ── HERO SECTION ── */}
                  <div className="relative flex gap-6 p-6 pb-5">
                    {/* Album art — large */}
                    <div className="relative flex-shrink-0">
                      <div className="w-44 h-44 rounded-2xl overflow-hidden"
                        style={{
                          border: `2px solid ${diffColor}60`,
                          boxShadow: `0 0 0 1px rgba(0,0,0,.5), 0 0 40px ${diffColor}50, 0 12px 48px rgba(0,0,0,.9)`,
                        }}>
                        {selected.albumArt
                          ? <img src={selected.albumArt} alt="Album" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${diffColor}22 0%, rgba(0,0,0,.7) 100%)` }}>
                              <Music className="w-16 h-16" style={{ color: `${diffColor}55` }} />
                            </div>
                        }
                      </div>
                      {/* Vinyl record peek effect */}
                      <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-40 h-40 rounded-full -z-10"
                        style={{ background: "radial-gradient(circle at 50%, #1a1a1a, #0a0a0a)", border: "1px solid rgba(255,255,255,.06)", boxShadow: "inset 0 0 20px rgba(0,0,0,.8)" }}>
                        <div className="absolute inset-[42%] rounded-full" style={{ background: diffColor, opacity: 0.7 }} />
                      </div>
                      {/* Now playing badge */}
                      {isPlaying && (
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full whitespace-nowrap"
                          style={{ background: "rgba(0,0,0,.85)", border: `1px solid ${diffColor}55`, backdropFilter: "blur(8px)" }}>
                          <Waveform color={diffColor} playing />
                          <span className="text-[10px] font-bold" style={{ color: diffColor }}>PREVIEW</span>
                        </div>
                      )}
                    </div>

                    {/* Song metadata */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                      {/* Title */}
                      <div>
                        <h2 className="font-black leading-none mb-2"
                          style={{
                            fontFamily: "'Impact',sans-serif",
                            fontSize: selected.name.length > 22 ? "1.6rem" : "2.1rem",
                            color: "#fff",
                            textShadow: `0 0 50px ${diffColor}88, 0 2px 10px rgba(0,0,0,.95)`,
                          }}>
                          {selected.name}
                        </h2>
                        <p className="text-lg font-bold mb-3" style={{ color: "rgba(255,255,255,.65)", fontFamily: "'Arial Black',sans-serif" }}>
                          {selected.artist}
                        </p>
                        {/* Tags row */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {selected.genre && (
                            <span className="text-xs px-3 py-1 rounded-full font-black"
                              style={{ background: `${diffColor}20`, border: `1px solid ${diffColor}50`, color: diffColor, fontFamily: "'Arial Black',sans-serif" }}>
                              {selected.genre}
                            </span>
                          )}
                          {selected.year && (
                            <span className="text-xs px-3 py-1 rounded-full"
                              style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.5)" }}>
                              {selected.year}
                            </span>
                          )}
                          {selected.album && (
                            <span className="text-xs px-3 py-1 rounded-full truncate max-w-[180px]"
                              style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", color: "rgba(255,255,255,.35)" }}>
                              {selected.album}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Diff + duration row */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <DiffStars diff={selected.difficulty} color={diffColor} />
                            <span className="text-base font-black" style={{ color: diffColor, fontFamily: "'Impact',sans-serif", textShadow: `0 0 16px ${diffColor}` }}>
                              {diffLabel.toUpperCase()}
                            </span>
                          </div>
                          {selected.songLength > 0 && (
                            <span className="flex items-center gap-1 text-sm font-bold" style={{ color: "rgba(255,255,255,.4)" }}>
                              <Clock className="w-3.5 h-3.5" />{formatDuration(selected.songLength)}
                            </span>
                          )}
                        </div>
                        {/* Difficulty bar */}
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.07)" }}>
                          <div className="h-full rounded-full relative overflow-hidden transition-all duration-700"
                            style={{ width: `${((selected.difficulty + 1) / 7) * 100}%`, background: `linear-gradient(90deg, ${diffColor}99, ${diffColor})`, boxShadow: `0 0 12px ${diffColor}` }}>
                            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent)", animation: "shimmer 2.5s infinite" }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── DIVIDER ── */}
                  <div className="mx-6 h-px" style={{ background: `linear-gradient(90deg, transparent, ${diffColor}40, rgba(255,255,255,.08), transparent)` }} />

                  {/* ── BOTTOM SECTION: controls + play ── */}
                  <div className="px-6 pt-4 pb-6 flex flex-col gap-4">

                    {/* Fret buttons */}
                    <div className="rounded-xl p-4 flex items-center gap-6"
                      style={{ background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.06)" }}>
                      <div>
                        <p className="text-[10px] uppercase tracking-[.25em] mb-1" style={{ color: "rgba(255,255,255,.25)", fontFamily: "'Arial Black',sans-serif" }}>Controles</p>
                        <p className="text-[9px]" style={{ color: "rgba(255,255,255,.15)" }}>teclas configuradas</p>
                      </div>
                      <div className="flex gap-2.5 flex-1 justify-center">
                        {keyBindings.slice(0, 5).map((key, i) => (
                          <FretBtn key={i} color={LANE_COLORS[i]} label={key} />
                        ))}
                      </div>
                      {selected.charter && (
                        <div className="text-right">
                          <p className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,.2)" }}>Charter</p>
                          <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,.4)" }}>{selected.charter}</p>
                        </div>
                      )}
                    </div>

                    {/* Seletor de dificuldade de lanes */}
                    <div className="flex gap-1.5 w-full">
                      {([
                        { n: 4 as 4|5|6, label: "Fácil",   sub: "4 lanes", color: "#3b82f6", grad: "linear-gradient(135deg,#1d4ed8,#2563eb)" },
                        { n: 5 as 4|5|6, label: "Normal",  sub: "5 lanes", color: "#22c55e", grad: "linear-gradient(135deg,#15803d,#16a34a)" },
                        { n: 6 as 4|5|6, label: "Difícil", sub: "6 lanes", color: "#e11d48", grad: "linear-gradient(135deg,#991b1b,#dc2626)" },
                      ]).map(({ n, label, sub, color, grad }) => (
                        <button key={n} onClick={() => setLaneCount(n)}
                          className="flex-1 flex flex-col items-center py-2 rounded-xl font-black text-xs tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98]"
                          style={{
                            background: laneCount === n ? grad : "rgba(255,255,255,0.05)",
                            border: laneCount === n ? `1px solid ${color}66` : "1px solid rgba(255,255,255,0.07)",
                            color: laneCount === n ? "#fff" : "rgba(255,255,255,0.3)",
                            boxShadow: laneCount === n ? `0 0 16px ${color}44` : "none",
                          }}>
                          <span>{label}</span>
                          <span className="font-normal opacity-60 text-[10px]">{sub}</span>
                        </button>
                      ))}
                    </div>

                    {/* Play button */}
                    <button
                      onClick={() => { playClickSound(getVol()); previewAudio?.pause(); router.push(`/play/${encodeURIComponent(selected.id)}?lanes=${laneCount}`) }}
                      className="w-full py-5 rounded-xl font-black text-xl tracking-[.15em] flex items-center justify-center gap-3 transition-all duration-150 hover:scale-[1.015] active:scale-[0.985] relative overflow-hidden select-none"
                      style={{
                        background: "linear-gradient(135deg, #991b1b 0%, #dc2626 45%, #ef4444 55%, #b91c1c 100%)",
                        border: "1px solid rgba(255,120,120,.35)",
                        color: "#fff",
                        fontFamily: "'Impact',sans-serif",
                        boxShadow: "0 0 40px rgba(220,38,38,.5), 0 2px 0 rgba(255,255,255,.1) inset, 0 6px 24px rgba(0,0,0,.7)",
                        textShadow: "0 2px 6px rgba(0,0,0,.9)",
                      }}>
                      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg,transparent 0%,rgba(255,255,255,.07) 50%,transparent 100%)", animation: "shimmer 3s infinite" }} />
                      <div className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)" }}>
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>
                      <span className="relative z-10">JOGAR AGORA</span>
                      <ChevronRight className="w-6 h-6 relative z-10 opacity-60" />
                    </button>

                  </div>
                </div>
              </>
            ) : !loading && songs.length === 0 ? null : (
              <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: "rgba(255,255,255,.08)" }}>
                <Music className="w-24 h-24" />
                <p className="text-xs tracking-widest uppercase" style={{ fontFamily: "'Impact',sans-serif" }}>Selecione uma música</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmer { 0% { transform: translateX(-100%) } 100% { transform: translateX(200%) } }
        @keyframes wave-0 { from { height: 4px } to { height: 18px } }
        @keyframes wave-1 { from { height: 6px } to { height: 14px } }
        @keyframes wave-2 { from { height: 8px } to { height: 20px } }
        @keyframes wave-3 { from { height: 5px } to { height: 16px } }
      `}</style>
    </GHBackground>
  )
}
