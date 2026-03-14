"use client"

import { useState, useEffect } from "react"
import { Trash2, RefreshCw } from "lucide-react"
import { GHBackground, GHLogo, GHBackButton, GHCard, GHSectionTitle } from "@/components/ui/gh-layout"
import { playClickSound } from "@/lib/game/sounds"
import { loadSettings } from "@/lib/settings"
import { getGlobalTop, getDailyLeaderboard, getTodayKey, type GlobalScore, type DailyScore } from "@/lib/supabase"

function getVol() { try { const s = loadSettings(); return (s.masterVolume / 100) * (s.sfxVolume / 100) } catch { return .5 } }

interface LocalScore {
  playerName: string; trackId: string; songName: string; artist: string
  score: number; accuracy: number; grade: string; maxCombo: number
  perfect: number; great: number; good: number; miss: number; date: string
}

const GRADE_COLORS: Record<string, string> = {
  "S+": "#ffd700", S: "#f59e0b", A: "#22c55e", B: "#3b82f6", C: "#a855f7", D: "#f97316", F: "#ef4444"
}
const MEDAL = ["🥇", "🥈", "🥉"]

type Tab = "local" | "global" | "daily"

export default function RankingPage() {
  const [tab, setTab] = useState<Tab>("local")
  const [localScores, setLocalScores] = useState<LocalScore[]>([])
  const [selectedSong, setSelectedSong] = useState<string | null>(null)
  const [globalScores, setGlobalScores] = useState<GlobalScore[]>([])
  const [globalLoading, setGlobalLoading] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [dailyScores, setDailyScores] = useState<DailyScore[]>([])
  const [dailyLoading, setDailyLoading] = useState(false)
  const today = getTodayKey()

  useEffect(() => {
    try {
      const s = localStorage.getItem("guitar-duels-scores")
      if (s) setLocalScores(JSON.parse(s).sort((a: LocalScore, b: LocalScore) => b.score - a.score))
    } catch {}
  }, [])

  useEffect(() => {
    if (tab === "global") loadGlobal()
    if (tab === "daily") loadDaily()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  async function loadGlobal() {
    setGlobalLoading(true); setGlobalError(null)
    try {
      const data = await getGlobalTop(10)
      setGlobalScores(data)
      if (!data.length) setGlobalError("Supabase não configurado ou sem scores ainda.")
    } catch { setGlobalError("Erro ao carregar. Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.") }
    finally { setGlobalLoading(false) }
  }

  async function loadDaily() {
    setDailyLoading(true)
    try { setDailyScores(await getDailyLeaderboard(today, 50)) }
    finally { setDailyLoading(false) }
  }

  function clearLocal() {
    if (confirm("Apagar todo o ranking local?")) { localStorage.removeItem("guitar-duels-scores"); setLocalScores([]) }
  }

  const uniqueSongs = Array.from(new Set(localScores.map(s => s.songName)))
  const filteredLocal = selectedSong ? localScores.filter(s => s.songName === selectedSong) : localScores

  return (
    <GHBackground>
      <div className="flex flex-col h-full">

        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <GHBackButton label="Menu" href="/" />
          <GHLogo size="sm" />
          <div className="flex items-center gap-2">
            {tab === "local" && localScores.length > 0 && (
              <button onClick={() => { playClickSound(getVol()); clearLocal() }}
                className="p-2 rounded transition-all hover:scale-110"
                style={{ color: "rgba(255,80,80,.5)", border: "1px solid rgba(255,80,80,.2)" }}>
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            {(tab === "global" || tab === "daily") && (
              <button onClick={() => { playClickSound(getVol()); tab === "global" ? loadGlobal() : loadDaily() }}
                className="p-2 rounded transition-all hover:scale-110"
                style={{ color: "rgba(255,255,255,.3)", border: "1px solid rgba(255,255,255,.1)" }}>
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="text-center mb-3">
          <GHSectionTitle>🏆 Ranking</GHSectionTitle>
        </div>

        {/* Abas */}
        <div className="flex gap-2 px-6 pb-3">
          {([
            { key: "local" as Tab,  label: "📱 Local",  sub: `${localScores.length} scores` },
            { key: "global" as Tab, label: "🌍 Global",  sub: "Top 10" },
            { key: "daily" as Tab,  label: "⚡ Diário",  sub: "Hoje" },
          ]).map(t => (
            <button key={t.key} onClick={() => { playClickSound(getVol()); setTab(t.key) }}
              className="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all"
              style={{
                background: tab === t.key ? "rgba(225,29,72,0.2)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${tab === t.key ? "rgba(225,29,72,0.5)" : "rgba(255,255,255,0.07)"}`,
                color: tab === t.key ? "#fff" : "rgba(255,255,255,0.35)",
              }}>
              <div>{t.label}</div>
              <div style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400, fontSize: "9px", marginTop: "1px" }}>{t.sub}</div>
            </button>
          ))}
        </div>

        {/* Local */}
        {tab === "local" && (
          <>
            {uniqueSongs.length > 1 && (
              <div className="flex gap-2 px-6 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {["Todas", ...uniqueSongs].map((song, i) => {
                  const active = song === "Todas" ? !selectedSong : selectedSong === song
                  return (
                    <button key={i} onClick={() => setSelectedSong(song === "Todas" ? null : song)}
                      className="px-3 py-1 flex-shrink-0 text-xs font-bold tracking-wider transition-all"
                      style={{ fontFamily: "'Impact',sans-serif", borderRadius: "3px",
                        background: active ? "rgba(200,0,20,.3)" : "rgba(255,255,255,.05)",
                        border: `1px solid ${active ? "rgba(255,80,80,.5)" : "rgba(255,255,255,.08)"}`,
                        color: active ? "#ff6060" : "rgba(255,255,255,.4)" }}>
                      {song}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ scrollbarWidth: "none" }}>
              {filteredLocal.length === 0
                ? <EmptyState text="NENHUM SCORE AINDA" sub="Jogue uma música para aparecer aqui!" />
                : <div className="max-w-2xl mx-auto flex flex-col gap-2">
                    {filteredLocal.map((e, i) => (
                      <ScoreRow key={i} rank={i} grade={e.grade} title={e.songName}
                        sub={`${e.artist} · ${e.playerName}`} score={e.score}
                        accuracy={e.accuracy} maxCombo={e.maxCombo} highlight={i === 0 && !selectedSong} />
                    ))}
                  </div>
              }
            </div>
          </>
        )}

        {/* Global */}
        {tab === "global" && (
          <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ scrollbarWidth: "none" }}>
            {globalLoading
              ? <Spinner color="#e11d48" />
              : globalError
              ? <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                  <p className="text-4xl">🌐</p>
                  <p className="text-white/40 text-sm">{globalError}</p>
                  <p className="text-white/20 text-[10px]">
                    Crie a tabela <code className="text-white/30">global_scores</code> no Supabase com os campos:<br/>
                    player_name, track_id, song_name, artist, score, accuracy, grade, max_combo, perfect, great, good, miss, is_fc
                  </p>
                </div>
              : globalScores.length === 0
              ? <EmptyState text="SEM SCORES GLOBAIS" sub="Seja o primeiro!" />
              : <div className="max-w-2xl mx-auto flex flex-col gap-2">
                  {globalScores.map((e, i) => (
                    <ScoreRow key={i} rank={i} grade={e.grade} title={e.song_name}
                      sub={`${e.artist} · ${e.player_name}`} score={e.score}
                      accuracy={e.accuracy} maxCombo={e.max_combo} isFC={e.is_fc} highlight={i === 0} />
                  ))}
                </div>
            }
          </div>
        )}

        {/* Diário */}
        {tab === "daily" && (
          <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ scrollbarWidth: "none" }}>
            <div className="text-center mb-3">
              <p className="text-[10px] text-white/25 uppercase tracking-widest">
                {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
            {dailyLoading
              ? <Spinner color="#eab308" />
              : dailyScores.length === 0
              ? <EmptyState text="SEM SCORES HOJE" sub="Jogue o Desafio Diário para aparecer aqui!" />
              : <div className="max-w-2xl mx-auto flex flex-col gap-2">
                  {dailyScores.map((e, i) => (
                    <ScoreRow key={i} rank={i} grade={e.grade} title={e.song_name}
                      sub={`${e.artist} · ${e.player_name}`} score={e.score}
                      accuracy={e.accuracy} maxCombo={e.max_combo} isFC={e.is_fc}
                      highlight={i === 0} accentColor="#eab308" />
                  ))}
                </div>
            }
          </div>
        )}

      </div>
    </GHBackground>
  )
}

function ScoreRow({ rank, grade, title, sub, score, accuracy, maxCombo, isFC, highlight, accentColor }:
  { rank: number; grade: string; title: string; sub: string; score: number
    accuracy: number; maxCombo: number; isFC?: boolean; highlight?: boolean; accentColor?: string }) {
  const color = GRADE_COLORS[grade] ?? "#888"
  const ac = accentColor ?? "#e11d48"
  return (
    <GHCard className="flex items-center gap-4 px-4 py-3"
      style={{ background: highlight ? "linear-gradient(135deg,rgba(30,15,5,.95),rgba(20,8,3,.98))" : undefined,
        borderColor: highlight ? `${ac}55` : undefined }}>
      <div className="text-xl w-8 text-center flex-shrink-0">
        {rank < 3 ? MEDAL[rank] : <span className="text-sm font-black" style={{ color: "rgba(255,255,255,.3)", fontFamily: "'Impact',sans-serif" }}>{rank + 1}</span>}
      </div>
      <div className="w-10 h-10 flex items-center justify-center rounded flex-shrink-0"
        style={{ background: `${color}22`, border: `1px solid ${color}55` }}>
        <span className="text-xl font-black" style={{ color, fontFamily: "'Impact',sans-serif" }}>{grade}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate text-white" style={{ fontFamily: "'Arial Black',sans-serif" }}>
          {title}{isFC && <span className="ml-1" style={{ color: "#ffd700" }}>✨</span>}
        </p>
        <p className="text-xs truncate" style={{ color: "rgba(255,255,255,.4)" }}>{sub}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-black text-white font-mono text-base">{score.toLocaleString()}</p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,.4)" }}>{accuracy}% · {maxCombo}x</p>
      </div>
    </GHCard>
  )
}

function EmptyState({ text, sub }: { text: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 pt-16">
      <div className="text-6xl">🎸</div>
      <p className="text-sm tracking-widest text-center" style={{ color: "rgba(255,255,255,.25)", fontFamily: "'Impact',sans-serif" }}>{text}</p>
      <p className="text-xs text-center" style={{ color: "rgba(255,255,255,.15)" }}>{sub}</p>
    </div>
  )
}

function Spinner({ color }: { color: string }) {
  return (
    <div className="flex justify-center pt-16">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${color} transparent transparent transparent` }} />
    </div>
  )
}
