"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Trophy, Star, Music2, Target } from "lucide-react"
import { loadSettings } from "@/lib/settings"
import { loadHistory, clearHistory, type GameRecord, HISTORY_KEY } from "@/lib/history"

function fmtDate(ts: number) {
  const d = new Date(ts)
  return d.toLocaleDateString("pt-BR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })
}

export function saveRecord(record: Omit<GameRecord, "id">) {
  if (typeof window === "undefined") return
  try {
    const history: GameRecord[] = loadHistory()
    history.unshift({ ...record, id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}` })
    if (history.length > 50) history.splice(50)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch {}
}

const GRADE_COLORS: Record<string, string> = {
  "S+":"#ffd700","S":"#ffd700","A":"#22c55e","B":"#3b82f6","C":"#f97316","D":"#ef4444","F":"#6b7280"
}
const LANE_LABELS: Record<number, string> = { 4:"Fácil", 5:"Normal", 6:"Difícil" }
const LANE_COLORS: Record<number, string> = { 4:"#3b82f6", 5:"#22c55e", 6:"#e11d48" }

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 rounded-2xl" style={{ background:`${color}10`, border:`1px solid ${color}25` }}>
      <div className="flex items-center gap-2" style={{ color:`${color}99` }}>
        {icon}<span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-xl font-black" style={{ color }}>{value}</span>
    </div>
  )
}

export default function HistoryPage() {
  const router = useRouter()
  const [history, setHistory] = useState<GameRecord[]>([])
  const [filter, setFilter] = useState<"all"|"s"|"fc">("all")

  useEffect(() => {
    try { setHistory(loadHistory()) } catch {}
  }, [])

  const filtered = history.filter((r: GameRecord) => {
    if (filter === "s")  return r.grade.startsWith("S")
    if (filter === "fc") return r.miss === 0
    return true
  })

  const bestScore   = history.reduce((m,r) => Math.max(m, r.score), 0)
  const avgAccuracy = history.length ? Math.round(history.reduce((s,r) => s+r.accuracy, 0) / history.length) : 0
  const fcCount     = history.filter((r: GameRecord) => r.miss === 0).length

  return (
    <div className="min-h-screen overflow-y-auto" style={{ background:"#060608", fontFamily:"'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800;900&display=swap');
        .bebas { font-family:'Bebas Neue','Impact',sans-serif !important; }
        @keyframes fade-up { from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);} }
      `}</style>

      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-4 px-6 py-4"
        style={{ background:"rgba(6,6,8,0.92)", backdropFilter:"blur(16px)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={() => router.push("/")}
          className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl transition-all hover:scale-105"
          style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.5)" }}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <h1 className="bebas text-2xl tracking-[0.2em]" style={{ color:"rgba(255,180,60,0.8)" }}>HISTÓRICO DE PARTIDAS</h1>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.3)" }}>
          {history.length} partidas
        </span>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {history.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            <StatCard icon={<Music2 className="w-3.5 h-3.5"/>}  label="Jogadas"    value={String(history.length)} color="#3b82f6" />
            <StatCard icon={<Trophy className="w-3.5 h-3.5"/>}  label="Melhor"     value={bestScore.toLocaleString()} color="#fbbf24" />
            <StatCard icon={<Target className="w-3.5 h-3.5"/>}  label="Precisão"   value={`${avgAccuracy}%`}      color="#22c55e" />
            <StatCard icon={<Star   className="w-3.5 h-3.5"/>}  label="Full Combo" value={String(fcCount)}        color="#a855f7" />
          </div>
        )}

        {history.length > 0 && (
          <div className="flex gap-2">
            {([["all","Todas"], ["s","Rank S"], ["fc","Full Combo"]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)}
                className="text-xs font-bold px-3 py-1.5 rounded-full transition-all hover:scale-105"
                style={{
                  background: filter===key ? "rgba(225,29,72,0.2)" : "rgba(255,255,255,0.05)",
                  color:      filter===key ? "#e11d48"             : "rgba(255,255,255,0.4)",
                  border:     filter===key ? "1px solid rgba(225,29,72,0.4)" : "1px solid rgba(255,255,255,0.08)",
                }}>
                {label}
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Music2 className="w-16 h-16" style={{ color:"rgba(255,255,255,0.08)" }}/>
            <p className="bebas text-xl tracking-widest" style={{ color:"rgba(255,255,255,0.15)" }}>
              {history.length === 0 ? "NENHUMA PARTIDA REGISTRADA" : "NENHUMA PARTIDA AQUI"}
            </p>
            <p className="text-sm" style={{ color:"rgba(255,255,255,0.15)" }}>
              {history.length === 0 ? "Jogue uma música para aparecer aqui" : "Tente outro filtro"}
            </p>
            {history.length === 0 && (
              <button onClick={() => router.push("/songs")}
                className="mt-4 px-6 py-3 rounded-2xl font-black text-sm transition-all hover:scale-105"
                style={{ background:"linear-gradient(135deg,#991b1b,#dc2626)", color:"#fff", boxShadow:"0 0 24px rgba(220,38,38,0.3)" }}>
                🎸 Jogar agora
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r: GameRecord, i: number) => {
              const gc = GRADE_COLORS[r.grade] ?? "#fff"
              const lc = LANE_COLORS[r.laneCount] ?? "#fff"
              return (
                <div key={r.id}
                  className="flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all hover:scale-[1.003]"
                  style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", animation:`fade-up 0.25s ${i*0.025}s ease both`, opacity:0 }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bebas text-xl"
                    style={{ background:`${gc}18`, border:`1px solid ${gc}44`, color:gc, textShadow:`0 0 10px ${gc}` }}>
                    {r.grade}
                  </div>
                  <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0" style={{ border:"1px solid rgba(255,255,255,0.08)" }}>
                    {r.albumArt
                      ? <img src={r.albumArt} alt="" className="w-full h-full object-cover"/>
                      : <div className="w-full h-full flex items-center justify-center" style={{ background:"rgba(255,255,255,0.05)" }}>
                          <Music2 className="w-4 h-4 text-white/20"/>
                        </div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-white truncate">{r.songName}</p>
                      {r.miss === 0 && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background:"rgba(168,85,247,0.2)", color:"#a855f7", border:"1px solid rgba(168,85,247,0.3)" }}>FC</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-[10px] truncate" style={{ color:"rgba(255,255,255,0.35)" }}>{r.artist}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background:`${lc}18`, color:lc, border:`1px solid ${lc}33` }}>
                        {LANE_LABELS[r.laneCount]}
                      </span>
                      <span className="text-[9px] flex-shrink-0" style={{ color:"rgba(255,255,255,0.2)" }}>{r.noteSpeed}x</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-black font-mono text-white">{r.score.toLocaleString()}</p>
                    <div className="flex items-center gap-2 justify-end mt-0.5">
                      <span className="text-[10px]" style={{ color:"#22c55e" }}>{r.accuracy}%</span>
                      <span className="text-[10px]" style={{ color:"rgba(255,255,255,0.2)" }}>·</span>
                      <span className="text-[10px]" style={{ color:"rgba(255,255,255,0.3)" }}>{r.combo}x combo</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 hidden sm:block">
                    <p className="text-[10px]" style={{ color:"rgba(255,255,255,0.2)" }}>{fmtDate(r.timestamp)}</p>
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      <span className="text-[9px]" style={{ color:"rgba(255,255,255,0.2)" }}>P:{r.perfect}</span>
                      <span className="text-[9px]" style={{ color:"rgba(255,255,255,0.2)" }}>G:{r.great}</span>
                      <span className="text-[9px]" style={{ color:r.miss>0?"rgba(239,68,68,0.6)":"rgba(255,255,255,0.2)" }}>M:{r.miss}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
