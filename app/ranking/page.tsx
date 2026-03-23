"use client"

import { useState, useEffect, useCallback } from "react"
import { Trash2, RefreshCw, Trophy, Globe, Zap, Star, Crown, Flame } from "lucide-react"
import { GHBackground, GHBackButton } from "@/components/ui/gh-layout"
import { playClickSound } from "@/lib/game/sounds"
import { loadSettings } from "@/lib/settings"
import { getGlobalTop, getDailyLeaderboard, getTodayKey, type GlobalScore, type DailyScore } from "@/lib/supabase"
import { useNav } from "@/lib/use-nav"
import { useRouter } from "next/navigation"

function getVol() { try { const s = loadSettings(); return (s.masterVolume / 100) * (s.sfxVolume / 100) } catch { return .5 } }

interface LocalScore {
  playerName: string; trackId: string; songName: string; artist: string
  score: number; accuracy: number; grade: string; maxCombo: number
  perfect: number; great: number; good: number; miss: number; date: string
  isFC?: boolean
}

const GRADE_COLORS: Record<string, string> = {
  "S+": "#ffd700", S: "#f59e0b", A: "#22c55e", B: "#3b82f6", C: "#a855f7", D: "#f97316", F: "#ef4444"
}
const GRADE_BG: Record<string, string> = {
  "S+": "#ffd70018", S: "#f59e0b14", A: "#22c55e12", B: "#3b82f614", C: "#a855f714", D: "#f9731610", F: "#ef444410"
}

type Tab = "local" | "global" | "daily"
const TABS: Tab[] = ["local", "global", "daily"]

export default function RankingPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("local")
  const [tabIdx, setTabIdx] = useState(0)
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
      if (s) {
        const all: LocalScore[] = JSON.parse(s)
        const bestMap = new Map<string, LocalScore>()
        for (const r of all) {
          const existing = bestMap.get(r.trackId)
          if (!existing || r.score > existing.score) bestMap.set(r.trackId, r)
        }
        setLocalScores(Array.from(bestMap.values()).sort((a, b) => b.score - a.score))
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (tab === "global") loadGlobal()
    if (tab === "daily") loadDaily()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useNav({
    onLeft:   () => { const i = Math.max(0, tabIdx - 1); setTabIdx(i); setTab(TABS[i]) },
    onRight:  () => { const i = Math.min(TABS.length - 1, tabIdx + 1); setTabIdx(i); setTab(TABS[i]) },
    onCancel: () => router.push("/"),
  })

  async function loadGlobal() {
    setGlobalLoading(true); setGlobalError(null)
    try {
      const data = await getGlobalTop(10)
      setGlobalScores(data)
      if (!data.length) setGlobalError("Nenhum score global ainda. Seja o primeiro!")
    } catch { setGlobalError("Erro ao carregar. Verifique as configurações do Supabase.") }
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

  const TAB_CONFIG = [
    { key: "local" as Tab,  label: "Local",  icon: Trophy, color: "#e11d48", desc: "Seus recordes" },
    { key: "global" as Tab, label: "Global", icon: Globe,  color: "#3b82f6", desc: "Top mundial" },
    { key: "daily" as Tab,  label: "Diário", icon: Zap,    color: "#f59e0b", desc: "Hoje" },
  ]

  return (
    <GHBackground>
      <style>{`
        @keyframes rank-in { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:none } }
        @keyframes gold-shimmer { 0%,100% { opacity:0.4 } 50% { opacity:1 } }
        @keyframes float { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-8px) } }
        @keyframes shine { 0% { transform:translateX(-200%) skewX(-20deg) } 100% { transform:translateX(400%) skewX(-20deg) } }
        @keyframes tab-in { from { opacity:0; transform:scale(0.95) } to { opacity:1; transform:none } }
      `}</style>

      <div style={{ display:"flex", flexDirection:"column", height:"100%", maxWidth:820, margin:"0 auto", width:"100%", padding:"0 8px" }}>

        {/* ── HEADER ── */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 16px 0" }}>
          <GHBackButton label="Menu" href="/" />

          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.35em", color:"rgba(255,180,60,0.45)", textTransform:"uppercase", marginBottom:2 }}>
              Hall da Fama
            </div>
            <div style={{
              fontSize:32, fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif",
              background:"linear-gradient(135deg, #ffd700 0%, #ff8c00 50%, #dc2626 100%)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
              filter:"drop-shadow(0 0 24px rgba(255,180,0,0.35))",
              letterSpacing:"0.05em",
            }}>🏆 RANKING</div>
          </div>

          <div style={{ display:"flex", gap:6 }}>
            {tab === "local" && localScores.length > 0 && (
              <button onClick={() => { playClickSound(getVol()); clearLocal() }}
                style={{ padding:"8px 10px", borderRadius:10, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", color:"rgba(239,68,68,0.55)", cursor:"pointer", transition:"all 0.2s" }}
                title="Apagar ranking local">
                <Trash2 size={15} />
              </button>
            )}
            {(tab === "global" || tab === "daily") && (
              <button onClick={() => { playClickSound(getVol()); tab === "global" ? loadGlobal() : loadDaily() }}
                style={{ padding:"8px 10px", borderRadius:10, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.35)", cursor:"pointer" }}
                title="Recarregar">
                <RefreshCw size={15} />
              </button>
            )}
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{ display:"flex", gap:10, padding:"14px 16px 0" }}>
          {TAB_CONFIG.map((t, i) => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button key={t.key}
                onClick={() => { playClickSound(getVol()); setTab(t.key); setTabIdx(i) }}
                style={{
                  flex:1, padding:"12px 8px", borderRadius:16, cursor:"pointer",
                  background: active
                    ? `linear-gradient(145deg, ${t.color}22, ${t.color}10)`
                    : "rgba(255,255,255,0.025)",
                  border: `1.5px solid ${active ? t.color + "60" : "rgba(255,255,255,0.06)"}`,
                  color: active ? "#fff" : "rgba(255,255,255,0.25)",
                  transition:"all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
                  boxShadow: active ? `0 4px 20px ${t.color}20, inset 0 1px 0 ${t.color}30` : "none",
                  transform: active ? "translateY(-2px)" : "none",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:5, position:"relative", overflow:"hidden",
                }}>
                {/* Shine on active */}
                {active && (
                  <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none" }}>
                    <div style={{ position:"absolute", top:0, height:"100%", width:"40%",
                      background:`linear-gradient(90deg,transparent,${t.color}18,transparent)`,
                      animation:"shine 3s ease-in-out infinite" }} />
                  </div>
                )}
                <Icon size={18} style={{ color: active ? t.color : "rgba(255,255,255,0.25)", filter: active ? `drop-shadow(0 0 6px ${t.color})` : "none" }} />
                <span style={{ fontSize:12, fontWeight:900, letterSpacing:"0.08em", fontFamily:"'Arial Black',Arial" }}>{t.label}</span>
                <span style={{ fontSize:9, color: active ? t.color + "bb" : "rgba(255,255,255,0.18)", letterSpacing:"0.05em" }}>{t.desc}</span>
              </button>
            )
          })}
        </div>

        {/* ── DIVIDER ── */}
        <div style={{ margin:"14px 16px 0", height:1, background:`linear-gradient(90deg,transparent,${TAB_CONFIG[tabIdx].color}50,transparent)`, position:"relative" }}>
          <div style={{ position:"absolute", inset:0, overflow:"hidden" }}>
            <div style={{ position:"absolute", height:"100%", width:"30%",
              background:`linear-gradient(90deg,transparent,${TAB_CONFIG[tabIdx].color},transparent)`,
              animation:"shine 2.5s ease-in-out infinite" }} />
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div style={{ flex:1, overflowY:"auto", padding:"14px 16px 24px", scrollbarWidth:"none" }}>

          {/* LOCAL */}
          {tab === "local" && (
            <div style={{ animation:"tab-in 0.3s ease both" }}>
              {uniqueSongs.length > 1 && (
                <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto", scrollbarWidth:"none", paddingBottom:4 }}>
                  {["Todas", ...uniqueSongs].map((song, i) => {
                    const active = song === "Todas" ? !selectedSong : selectedSong === song
                    return (
                      <button key={i} onClick={() => setSelectedSong(song === "Todas" ? null : song)}
                        style={{
                          padding:"5px 14px", borderRadius:20, flexShrink:0, cursor:"pointer",
                          fontSize:10, fontWeight:700, letterSpacing:"0.08em", whiteSpace:"nowrap",
                          background: active ? "rgba(225,29,72,0.18)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${active ? "rgba(225,29,72,0.45)" : "rgba(255,255,255,0.08)"}`,
                          color: active ? "#ff8099" : "rgba(255,255,255,0.3)",
                          transition:"all 0.15s",
                        }}>
                        {song}
                      </button>
                    )
                  })}
                </div>
              )}
              {filteredLocal.length === 0
                ? <EmptyState icon="🎸" text="NENHUM SCORE AINDA" sub="Jogue uma música para aparecer aqui!" />
                : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {filteredLocal.map((e, i) => (
                      <ScoreCard key={i} rank={i} grade={e.grade} title={e.songName}
                        sub={`${e.artist} · ${e.playerName}`} score={e.score}
                        accuracy={e.accuracy} maxCombo={e.maxCombo} isFC={e.isFC}
                        accentColor="#e11d48" />
                    ))}
                  </div>
              }
            </div>
          )}

          {/* GLOBAL */}
          {tab === "global" && (
            <div style={{ animation:"tab-in 0.3s ease both" }}>
              {globalLoading ? <Spinner color="#3b82f6" /> :
               globalError ? <EmptyState icon="🌐" text="SEM CONEXÃO" sub={globalError} /> :
               globalScores.length === 0 ? <EmptyState icon="🌍" text="SEM SCORES GLOBAIS" sub="Seja o primeiro a entrar no hall da fama!" /> :
               <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                 {globalScores.map((e, i) => (
                   <ScoreCard key={i} rank={i} grade={e.grade} title={e.song_name}
                     sub={`${e.artist} · ${e.player_name}`} score={e.score}
                     accuracy={e.accuracy} maxCombo={e.max_combo} isFC={e.is_fc}
                     accentColor="#3b82f6" />
                 ))}
               </div>
              }
            </div>
          )}

          {/* DIÁRIO */}
          {tab === "daily" && (
            <div style={{ animation:"tab-in 0.3s ease both" }}>
              <div style={{ textAlign:"center", marginBottom:14,
                background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.15)",
                borderRadius:12, padding:"8px 16px" }}>
                <div style={{ fontSize:10, color:"rgba(245,158,11,0.8)", letterSpacing:"0.2em", textTransform:"uppercase", fontWeight:700 }}>
                  ⚡ {new Date().toLocaleDateString("pt-BR", { weekday:"long", day:"numeric", month:"long" })}
                </div>
              </div>
              {dailyLoading ? <Spinner color="#f59e0b" /> :
               dailyScores.length === 0 ? <EmptyState icon="⚡" text="SEM SCORES HOJE" sub="Jogue o Desafio Diário para aparecer aqui!" /> :
               <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                 {dailyScores.map((e, i) => (
                   <ScoreCard key={i} rank={i} grade={e.grade} title={e.song_name}
                     sub={`${e.artist} · ${e.player_name}`} score={e.score}
                     accuracy={e.accuracy} maxCombo={e.max_combo} isFC={e.is_fc}
                     accentColor="#f59e0b" />
                 ))}
               </div>
              }
            </div>
          )}
        </div>
      </div>
    </GHBackground>
  )
}

function ScoreCard({ rank, grade, title, sub, score, accuracy, maxCombo, isFC, accentColor }:
  { rank: number; grade: string; title: string; sub: string; score: number
    accuracy: number; maxCombo: number; isFC?: boolean; highlight?: boolean; accentColor?: string }) {
  const gc   = GRADE_COLORS[grade] ?? "#888"
  const gbg  = GRADE_BG[grade] ?? "transparent"
  const ac   = accentColor ?? "#e11d48"
  const delay = `${rank * 0.05}s`

  const topThree = rank < 3
  const medals   = ["👑", "🥈", "🥉"]
  const medalColors = ["#ffd700", "#c0c0c0", "#cd7f32"]
  const medalBg     = [
    "linear-gradient(135deg,rgba(255,215,0,0.15),rgba(255,180,0,0.05))",
    "linear-gradient(135deg,rgba(192,192,192,0.12),rgba(150,150,150,0.04))",
    "linear-gradient(135deg,rgba(205,127,50,0.12),rgba(170,100,30,0.04))",
  ]

  return (
    <div style={{
      display:"flex", alignItems:"center", gap:12,
      padding: topThree ? "14px 18px" : "11px 16px",
      borderRadius:16,
      background: topThree ? medalBg[rank] : "rgba(255,255,255,0.025)",
      border: `1.5px solid ${topThree ? medalColors[rank] + "45" : "rgba(255,255,255,0.06)"}`,
      animation:`rank-in 0.4s ease ${delay} both`,
      position:"relative", overflow:"hidden",
      boxShadow: topThree ? `0 4px 24px ${medalColors[rank]}18` : "none",
      transition:"transform 0.2s",
    }}>
      {/* Shine strip for top 3 */}
      {topThree && (
        <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none" }}>
          <div style={{ position:"absolute", top:0, height:"100%", width:"20%",
            background:`linear-gradient(90deg,transparent,${medalColors[rank]}15,transparent)`,
            animation:`shine 4s ease-in-out ${delay} infinite` }} />
        </div>
      )}

      {/* Left accent bar */}
      {topThree && (
        <div style={{
          position:"absolute", left:0, top:0, bottom:0, width:3,
          background:medalColors[rank],
          boxShadow:`0 0 8px ${medalColors[rank]}`,
        }} />
      )}

      {/* Rank badge */}
      <div style={{
        width:42, height:42, borderRadius:12, flexShrink:0,
        display:"flex", alignItems:"center", justifyContent:"center",
        background: topThree ? `${medalColors[rank]}18` : "rgba(255,255,255,0.04)",
        border:`1.5px solid ${topThree ? medalColors[rank] + "40" : "rgba(255,255,255,0.08)"}`,
      }}>
        {topThree ? (
          <span style={{ fontSize:22 }}>{medals[rank]}</span>
        ) : (
          <span style={{ fontSize:14, fontWeight:900, color:"rgba(255,255,255,0.25)", fontFamily:"'Arial Black',Arial" }}>
            #{rank + 1}
          </span>
        )}
      </div>

      {/* Grade badge */}
      <div style={{
        width:48, height:48, borderRadius:12, flexShrink:0,
        display:"flex", alignItems:"center", justifyContent:"center",
        background:gbg,
        border:`2px solid ${gc}55`,
        boxShadow:`0 0 12px ${gc}30, inset 0 1px 0 ${gc}20`,
      }}>
        <span style={{ fontSize:22, fontWeight:900, color:gc, fontFamily:"'Arial Black',Arial", lineHeight:1 }}>
          {grade}
        </span>
      </div>

      {/* Info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
          <span style={{
            fontSize: topThree ? 15 : 13, fontWeight:900, color:"#fff",
            fontFamily:"'Arial Black',Arial",
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:220,
          }}>{title}</span>
          {isFC && (
            <span style={{
              fontSize:8, fontWeight:700, padding:"2px 6px", borderRadius:6, flexShrink:0,
              background:"rgba(255,215,0,0.12)", border:"1px solid rgba(255,215,0,0.3)", color:"#ffd700",
              letterSpacing:"0.05em",
            }}>✨ FC</span>
          )}
        </div>
        <div style={{ fontSize:10, color:"rgba(255,255,255,0.28)", marginBottom:5,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {sub}
        </div>
        {/* Mini stats bar */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <div style={{ width:28, height:2, borderRadius:1, background:"rgba(255,255,255,0.08)", overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${accuracy}%`, background:gc, borderRadius:1, boxShadow:`0 0 4px ${gc}` }} />
            </div>
            <span style={{ fontSize:9, color:gc, fontWeight:700 }}>{accuracy}%</span>
          </div>
          <span style={{ fontSize:9, color:"rgba(255,255,255,0.15)" }}>•</span>
          <span style={{ fontSize:9, color:"rgba(255,255,255,0.25)" }}>
            <span style={{ color:`${ac}cc`, fontWeight:700 }}>{maxCombo}x</span> combo
          </span>
        </div>
      </div>

      {/* Score */}
      <div style={{ textAlign:"right", flexShrink:0 }}>
        <div style={{
          fontSize: topThree ? 24 : 19, fontWeight:900, lineHeight:1,
          fontFamily:"'Arial Black',Arial", letterSpacing:"-0.5px",
          background: topThree
            ? `linear-gradient(135deg,${medalColors[rank]},#fff)`
            : `linear-gradient(135deg,#fff,rgba(255,255,255,0.7))`,
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          filter: topThree ? `drop-shadow(0 0 8px ${medalColors[rank]}60)` : "none",
        }}>
          {score.toLocaleString()}
        </div>
        {/* Stars */}
        <div style={{ display:"flex", justifyContent:"flex-end", gap:2, marginTop:4 }}>
          {[1,2,3,4,5].map(i => (
            <Star key={i} size={7} style={{
              color: i <= Math.ceil(accuracy / 20) ? gc : "rgba(255,255,255,0.1)",
              fill:  i <= Math.ceil(accuracy / 20) ? gc : "transparent",
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ icon, text, sub }: { icon: string; text: string; sub: string }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", paddingTop:60, gap:14 }}>
      <div style={{ fontSize:72, animation:"float 3s ease-in-out infinite", filter:"drop-shadow(0 8px 20px rgba(0,0,0,0.5))" }}>{icon}</div>
      <p style={{ fontSize:13, fontWeight:900, letterSpacing:"0.3em", color:"rgba(255,255,255,0.18)",
        fontFamily:"'Arial Black',Arial", textAlign:"center", margin:0 }}>{text}</p>
      <p style={{ fontSize:11, color:"rgba(255,255,255,0.12)", textAlign:"center", maxWidth:280, lineHeight:1.6, margin:0 }}>{sub}</p>
    </div>
  )
}

function Spinner({ color }: { color: string }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", paddingTop:60, gap:16 }}>
      <div style={{ width:36, height:36, borderRadius:"50%", border:`3px solid ${color}25`,
        borderTopColor:color, animation:"spin 0.8s linear infinite" }} />
      <span style={{ fontSize:11, color:"rgba(255,255,255,0.2)", letterSpacing:"0.1em" }}>Carregando...</span>
    </div>
  )
}
