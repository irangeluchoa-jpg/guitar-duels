"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { GHBackground, GHLogo, GHBackButton, GHCard, GHSectionTitle } from "@/components/ui/gh-layout"
import { playClickSound } from "@/lib/game/sounds"
import { loadSettings } from "@/lib/settings"

function getVol() { try { const s=loadSettings(); return (s.masterVolume/100)*(s.sfxVolume/100) } catch { return .5 } }

interface ScoreEntry {
  playerName:string; trackId:string; songName:string; artist:string
  score:number; accuracy:number; grade:string; maxCombo:number
  perfect:number; great:number; good:number; miss:number; date:string
}

const GRADE_COLORS: Record<string,string> = { S:"#f59e0b",A:"#22c55e",B:"#3b82f6",C:"#a855f7",D:"#f97316",F:"#ef4444" }
const MEDAL = ["🥇","🥈","🥉"]

export default function RankingPage() {
  const router = useRouter()
  const [scores, setScores] = useState<ScoreEntry[]>([])
  const [selectedSong, setSelectedSong] = useState<string|null>(null)

  useEffect(() => {
    try {
      const s = localStorage.getItem("guitar-duels-scores")
      if (s) setScores(JSON.parse(s).sort((a:ScoreEntry,b:ScoreEntry)=>b.score-a.score))
    } catch {}
  },[])

  function clearScores() {
    if (confirm("Apagar todo o ranking?")) { localStorage.removeItem("guitar-duels-scores"); setScores([]) }
  }

  const uniqueSongs = Array.from(new Set(scores.map(s=>s.songName)))
  const filtered = selectedSong ? scores.filter(s=>s.songName===selectedSong) : scores

  return (
    <GHBackground>
      <div className="flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <GHBackButton label="Menu" />
          <GHLogo size="sm" />
          <div className="flex items-center gap-2">
            {scores.length > 0 && (
              <button onClick={() => { playClickSound(getVol()); clearScores() }}
                className="p-2 rounded transition-all hover:scale-110"
                style={{ color:"rgba(255,80,80,.5)", border:"1px solid rgba(255,80,80,.2)" }}
                title="Limpar ranking">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-4">
          <GHSectionTitle>🏆 Ranking</GHSectionTitle>
          <p className="text-xs" style={{ color:"rgba(255,255,255,.25)", fontFamily:"'Arial',sans-serif" }}>
            {scores.length} partidas registradas
          </p>
        </div>

        {/* Filter por música */}
        {uniqueSongs.length > 1 && (
          <div className="flex gap-2 px-6 pb-3 overflow-x-auto" style={{ scrollbarWidth:"none" }}>
            {["Todas", ...uniqueSongs].map((song,i) => {
              const isAll = song === "Todas"
              const active = isAll ? !selectedSong : selectedSong===song
              return (
                <button key={i} onClick={() => setSelectedSong(isAll ? null : song)}
                  className="px-3 py-1 flex-shrink-0 text-xs font-bold tracking-wider transition-all hover:scale-105"
                  style={{ fontFamily:"'Impact',sans-serif", borderRadius:"3px",
                    background:active?"rgba(200,0,20,.3)":"rgba(255,255,255,.05)",
                    border:`1px solid ${active?"rgba(255,80,80,.5)":"rgba(255,255,255,.08)"}`,
                    color:active?"#ff6060":"rgba(255,255,255,.4)" }}>
                  {song}
                </button>
              )
            })}
          </div>
        )}

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ scrollbarWidth:"none" }}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="text-6xl">🎸</div>
              <p className="text-sm tracking-widest" style={{ color:"rgba(255,255,255,.25)", fontFamily:"'Impact',sans-serif" }}>
                NENHUM SCORE AINDA
              </p>
              <p className="text-xs" style={{ color:"rgba(255,255,255,.15)", fontFamily:"'Arial',sans-serif" }}>
                Jogue uma música para aparecer aqui!
              </p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto flex flex-col gap-2">
              {filtered.map((entry,i) => (
                <GHCard key={`${entry.trackId}-${entry.date}-${i}`}
                  className="flex items-center gap-4 px-4 py-3"
                  style={{ background: i===0&&!selectedSong ? "linear-gradient(135deg,rgba(30,15,5,.95),rgba(20,8,3,.98))" : undefined,
                    borderColor: i===0&&!selectedSong ? "rgba(245,158,11,.35)" : undefined }}>

                  {/* Rank */}
                  <div className="text-xl w-8 text-center flex-shrink-0">
                    {i < 3 ? MEDAL[i] : (
                      <span className="text-sm font-black" style={{ color:"rgba(255,255,255,.3)", fontFamily:"'Impact',sans-serif" }}>
                        {i+1}
                      </span>
                    )}
                  </div>

                  {/* Grade */}
                  <div className="w-10 h-10 flex items-center justify-center rounded flex-shrink-0"
                    style={{ background:`${GRADE_COLORS[entry.grade]||"#888"}22`, border:`1px solid ${GRADE_COLORS[entry.grade]||"#888"}55` }}>
                    <span className="text-xl font-black" style={{ color:GRADE_COLORS[entry.grade]||"#888", fontFamily:"'Impact',sans-serif" }}>
                      {entry.grade}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate text-white" style={{ fontFamily:"'Arial Black',sans-serif" }}>
                      {entry.songName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs truncate" style={{ color:"rgba(255,255,255,.4)", fontFamily:"'Arial',sans-serif" }}>{entry.artist}</span>
                      <span style={{ color:"rgba(255,255,255,.2)" }}>·</span>
                      <span className="text-xs font-bold" style={{ color:"#e11d48", fontFamily:"'Impact',sans-serif" }}>{entry.playerName}</span>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-white font-mono text-base">{entry.score.toLocaleString()}</p>
                    <p className="text-xs" style={{ color:"rgba(255,255,255,.4)" }}>{entry.accuracy}% · {entry.maxCombo}x</p>
                  </div>
                </GHCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </GHBackground>
  )
}
