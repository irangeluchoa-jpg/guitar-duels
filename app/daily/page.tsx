"use client"

import { useState, useEffect } from "react"
import { GHBackground, GHBackButton, GHLogo } from "@/components/ui/gh-layout"
import { GameCanvas } from "@/components/game/game-canvas"
import type { ChartData, SongMeta } from "@/lib/songs/types"
import { playClickSound } from "@/lib/game/sounds"
import { loadSettings } from "@/lib/settings"
import {
  getDailySong, getTodayKey, getDailyLeaderboard, submitDailyScore,
  type DailyScore
} from "@/lib/supabase"
import { getGrade, getAccuracy, isFullCombo } from "@/lib/game/engine"
import type { GameStats } from "@/lib/game/engine"

function getVol() {
  try { const s = loadSettings(); return (s.masterVolume / 100) * (s.sfxVolume / 100) } catch { return 0.5 }
}

const GRADE_COLORS: Record<string, string> = {
  "S+": "#ffd700", S: "#fbbf24", A: "#22c55e", B: "#3b82f6",
  C: "#a855f7", D: "#f97316", F: "#ef4444",
}
const MEDAL = ["🥇", "🥈", "🥉"]

export default function DailyPage() {
  const today = getTodayKey()

  // Tela
  const [screen, setScreen] = useState<"loading" | "lobby" | "playing" | "result">("loading")

  // Dados da música do dia
  const [trackId, setTrackId] = useState<string>("")
  const [chart, setChart] = useState<ChartData | null>(null)
  const [meta, setMeta] = useState<SongMeta | null>(null)
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({})
  const [albumArt, setAlbumArt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Estado do desafio
  const [attempts, setAttempts] = useState(0)          // tentativas já usadas hoje
  const [myBestScore, setMyBestScore] = useState(0)    // melhor score do jogador hoje
  const [alreadyPlayed, setAlreadyPlayed] = useState(false)

  // Resultado da última partida
  const [lastStats, setLastStats] = useState<GameStats | null>(null)

  // Leaderboard do dia
  const [leaderboard, setLeaderboard] = useState<DailyScore[]>([])
  const [loadingBoard, setLoadingBoard] = useState(false)

  const MAX_ATTEMPTS = 3

  // ── Carregar música do dia ─────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        // 1. Buscar lista de músicas disponíveis
        const res = await fetch("/api/songs")
        if (!res.ok) throw new Error("Falha ao carregar músicas")
        const songs: Array<{ id: string }> = await res.json()
        if (!songs.length) throw new Error("Sem músicas disponíveis")

        // 2. Sortear música do dia via seed de data
        const daily = getDailySong(songs.map(s => s.id))
        setTrackId(daily)

        // 3. Carregar chart da música sorteada
        const mRes = await fetch(`/api/songs/${encodeURIComponent(daily)}`)
        if (!mRes.ok) throw new Error("Música não encontrada")
        const data = await mRes.json()
        setMeta(data.meta)
        setChart(data.chart)
        setAudioUrls(data.audioUrls || {})
        setAlbumArt(data.albumArt || null)

        // 4. Verificar tentativas de hoje (localStorage)
        const dayKey = `gh-daily-${today}`
        const saved = JSON.parse(localStorage.getItem(dayKey) ?? "null")
        if (saved) {
          setAttempts(saved.attempts ?? 0)
          setMyBestScore(saved.bestScore ?? 0)
          if ((saved.attempts ?? 0) >= MAX_ATTEMPTS) setAlreadyPlayed(true)
        }

        setScreen("lobby")
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar")
        setScreen("lobby")
      }
    }
    init()
  }, [today])

  // ── Carregar leaderboard ───────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "lobby" && screen !== "result") return
    setLoadingBoard(true)
    getDailyLeaderboard(today, 20)
      .then(data => setLeaderboard(data))
      .finally(() => setLoadingBoard(false))
  }, [screen, today])

  // ── Ao terminar partida ────────────────────────────────────────────────────
  function handleSongEnd(stats: GameStats) {
    setLastStats(stats)

    const playerName = (typeof window !== "undefined" && sessionStorage.getItem("playerName")) || "Jogador"
    const accuracy = getAccuracy(stats)
    const fc = isFullCombo(stats)
    const grade = getGrade(accuracy, fc)

    // Atualizar tentativas locais
    const newAttempts = attempts + 1
    const newBest = Math.max(myBestScore, stats.score)
    const dayKey = `gh-daily-${today}`
    localStorage.setItem(dayKey, JSON.stringify({ attempts: newAttempts, bestScore: newBest }))
    setAttempts(newAttempts)
    setMyBestScore(newBest)
    if (newAttempts >= MAX_ATTEMPTS) setAlreadyPlayed(true)

    // Enviar para Supabase
    submitDailyScore({
      player_name: playerName,
      track_id: trackId,
      song_name: meta?.name ?? "",
      artist: meta?.artist ?? "",
      score: stats.score,
      accuracy,
      grade,
      max_combo: stats.maxCombo,
      is_fc: fc,
      day: today,
    }).catch(() => {})

    setScreen("result")
  }

  // ── Renderizar ─────────────────────────────────────────────────────────────

  if (screen === "loading") {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "#060608" }}>
        <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Tela de jogo
  if (screen === "playing" && chart && meta) {
    return (
      <GameCanvas
        chart={chart}
        meta={meta}
        audioUrls={audioUrls}
        backgroundUrl={albumArt}
        laneCount={4}   // Desafio diário sempre em 4 lanes (fácil)
        isDaily={true}
        onBack={() => setScreen("lobby")}
        onSongEnd={handleSongEnd}
      />
    )
  }

  // Lobby + resultado
  return (
    <GHBackground>
      <div className="flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <GHBackButton label="Menu" href="/" />
          <GHLogo size="sm" />
          <div style={{ width: 60 }} />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <div className="max-w-lg mx-auto flex flex-col gap-4">

            {/* Título */}
            <div className="text-center pt-2 pb-1">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-3"
                style={{ background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.3)" }}>
                <span className="text-sm font-black tracking-widest uppercase" style={{ color: "#eab308" }}>
                  ⚡ Desafio Diário
                </span>
              </div>
              <p className="text-white/30 text-xs tracking-widest">
                {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}
              </p>
            </div>

            {error ? (
              <div className="text-center py-8">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            ) : !meta ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Card da música */}
                <div className="rounded-2xl overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="flex items-center gap-4 p-4">
                    {/* Capa */}
                    <div className="w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {albumArt
                        ? <img src={albumArt} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-2xl">🎵</div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-base truncate">{meta.name}</p>
                      <p className="text-white/40 text-sm truncate">{meta.artist}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                          style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}>
                          4 LANES · FÁCIL
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tentativas */}
                  <div className="px-4 pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-white/30 uppercase tracking-widest">Tentativas hoje</span>
                      <span className="text-[11px] font-bold" style={{ color: attempts >= MAX_ATTEMPTS ? "#ef4444" : "#eab308" }}>
                        {attempts}/{MAX_ATTEMPTS}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                        <div key={i} className="flex-1 h-1.5 rounded-full"
                          style={{ background: i < attempts ? "#eab308" : "rgba(255,255,255,0.08)" }} />
                      ))}
                    </div>

                    {/* Melhor score hoje */}
                    {myBestScore > 0 && (
                      <div className="flex items-center justify-between mt-3 pt-3"
                        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <span className="text-[11px] text-white/30 uppercase tracking-widest">Meu melhor hoje</span>
                        <span className="text-sm font-black font-mono" style={{ color: "#fbbf24" }}>
                          {myBestScore.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Botão jogar */}
                  <div className="px-4 pb-4">
                    {alreadyPlayed ? (
                      <div className="w-full h-12 rounded-xl flex items-center justify-center text-sm font-bold"
                        style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        ✓ Tentativas esgotadas — volte amanhã!
                      </div>
                    ) : (
                      <button
                        onClick={() => { playClickSound(getVol()); setScreen("playing") }}
                        className="w-full h-12 rounded-xl text-sm font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98]"
                        style={{ background: "linear-gradient(135deg, #ca8a04, #eab308)", color: "#000", boxShadow: "0 0 30px rgba(234,179,8,0.3)" }}>
                        ⚡ {attempts === 0 ? "Jogar Agora" : `Tentar Novamente (${MAX_ATTEMPTS - attempts} restante${MAX_ATTEMPTS - attempts !== 1 ? "s" : ""})`}
                      </button>
                    )}
                  </div>
                </div>

                {/* Resultado da última partida */}
                {screen === "result" && lastStats && (
                  <LastResult stats={lastStats} />
                )}

                {/* Leaderboard do dia */}
                <div className="rounded-2xl overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Top do Dia</span>
                    {loadingBoard && <div className="w-3 h-3 border border-yellow-400 border-t-transparent rounded-full animate-spin" />}
                  </div>

                  {leaderboard.length === 0 && !loadingBoard ? (
                    <div className="py-8 text-center">
                      <p className="text-white/20 text-sm">Seja o primeiro a jogar hoje!</p>
                    </div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                      {leaderboard.map((entry, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="text-base w-6 text-center flex-shrink-0">
                            {i < 3 ? MEDAL[i] : <span className="text-white/20 text-xs font-bold">{i + 1}</span>}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{entry.player_name}</p>
                            <p className="text-[10px] text-white/30">
                              {entry.accuracy}% precisão · {entry.max_combo}x combo
                              {entry.is_fc && <span className="ml-1" style={{ color: "#ffd700" }}>✨ FC</span>}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-black font-mono" style={{ color: GRADE_COLORS[entry.grade] ?? "#fff" }}>
                              {entry.score.toLocaleString()}
                            </p>
                            <p className="text-[10px] font-bold" style={{ color: GRADE_COLORS[entry.grade] ?? "#fff" }}>
                              {entry.grade}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!leaderboard.length && !loadingBoard && (
                    <div className="px-4 py-3 text-center">
                      <p className="text-white/15 text-[10px]">
                        Conecte o Supabase para ver o ranking global
                      </p>
                    </div>
                  )}
                </div>

              </>
            )}
          </div>
        </div>
      </div>
    </GHBackground>
  )
}

function LastResult({ stats }: { stats: GameStats }) {
  const accuracy = getAccuracy(stats)
  const fc = isFullCombo(stats)
  const grade = getGrade(accuracy, fc)
  const color = GRADE_COLORS[grade] ?? "#fff"

  return (
    <div className="rounded-2xl p-4"
      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${color}25` }}>
      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Última partida</p>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-xl flex-shrink-0"
          style={{ border: `2px solid ${color}60`, background: `${color}15`, color }}>
          {grade}
        </div>
        <div className="flex-1">
          <p className="text-2xl font-black font-mono text-white">{stats.score.toLocaleString()}</p>
          <div className="flex gap-3 mt-0.5">
            <span className="text-[11px] text-white/40">{accuracy}% precisão</span>
            <span className="text-[11px] text-white/40">{stats.maxCombo}x combo</span>
            {fc && <span className="text-[11px]" style={{ color: "#ffd700" }}>✨ FC</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
