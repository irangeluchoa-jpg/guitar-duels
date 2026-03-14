"use client"

import React, { useEffect, useState, useRef, useCallback, Suspense } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { GameCanvas } from "@/components/game/game-canvas"
import type { ChartData, SongMeta } from "@/lib/songs/types"
import type { GameStats } from "@/lib/game/engine"
import { getGrade, getAccuracy, isFullCombo } from "@/lib/game/engine"
import { playPauseSound, playResumeSound } from "@/lib/game/sounds"
import { loadSettings } from "@/lib/settings"
import { saveRecord } from "@/lib/history"
import { processGameSession } from "@/lib/progression"
import { showAchievementToast, showLevelUpToast, showXPToast, ToastContainer } from "@/components/ui/achievement-toast"

function getVol() {
  try { const s = loadSettings(); return (s.masterVolume / 100) * (s.sfxVolume / 100) } catch { return 0.5 }
}

const PLAYER_COLORS = ["#e11d48", "#3b82f6", "#22c55e", "#f97316"]
const LANE_OPTIONS = [
  { count: 4 as const, label: "Fácil",   desc: "4 lanes", keys: "A S D J",       color: "#3b82f6" },
  { count: 5 as const, label: "Normal",  desc: "5 lanes", keys: "A S D J K",     color: "#22c55e" },
  { count: 6 as const, label: "Difícil", desc: "6 lanes", keys: "A S D J K L",   color: "#e11d48" },
]

interface RoomPlayer {
  id: string; name: string; score: number; combo: number; rockMeter: number
  ready?: boolean; instrument?: string; laneCount?: number
}
interface RoomSnapshot {
  code: string; hostId: string
  state: "waiting" | "playing" | "paused" | "ended"
  pausedBy: string | null
  players: RoomPlayer[]
}

// ── PlayerCard (estilo Fortnite Festival) ────────────────────────────────────
function PlayerCard(props: { key?: React.Key; p: RoomPlayer; color: string; isMe: boolean }) {
  const { p, color, isMe } = props
  const totalStars = 5
  const filledStars = Math.min(5, Math.floor(p.score / 20000))
  return (
    <div className="flex flex-col gap-1.5" style={{ width: 200, animation: "fade-in 0.3s ease" }}>
      <div style={{ height: 3, background: color, borderRadius: 2 }} />
      <div style={{
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(16px)",
        border: `1px solid ${isMe ? color + "55" : "rgba(255,255,255,0.10)"}`,
        borderRadius: 14, padding: "10px 12px 8px",
        boxShadow: isMe ? `0 0 18px ${color}33` : "none",
      }}>
        <div className="flex items-center justify-between mb-1">
          <span style={{
            fontSize: 11, fontWeight: 900, color: isMe ? "#fff" : "rgba(255,255,255,0.65)",
            fontFamily: "'Arial Black',Arial,sans-serif",
            maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {isMe ? "Você" : p.name}
          </span>
          {p.combo > 1 && (
            <span style={{ fontSize: 10, fontWeight: 900, color: color, fontFamily: "'Arial Black',Arial" }}>
              {p.combo}x
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mb-1.5">
          {Array.from({ length: totalStars }).map((_, i) => (
            <svg key={i} width={12} height={12} viewBox="0 0 24 24">
              <path d="M12 2l2.9 6.2L22 9.2l-5.2 5 1.3 7.2L12 18l-6.1 3.4 1.3-7.2L2 9.2l7.1-1z"
                fill={i < filledStars ? color : "rgba(255,255,255,0.15)"}
                style={{ filter: i < filledStars ? `drop-shadow(0 0 3px ${color})` : "none" }} />
            </svg>
          ))}
        </div>
        <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.32)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>
          PONTUAÇÃO
        </div>
        <div style={{
          fontSize: 22, fontWeight: 900, color: "#ffffff",
          fontFamily: "'Arial Black',Arial,sans-serif",
          textShadow: isMe ? `0 0 12px ${color}` : "none", lineHeight: 1,
        }}>
          {p.score.toLocaleString()}
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${p.rockMeter}%`,
            background: p.rockMeter > 60 ? "linear-gradient(90deg,#22c55e,#4ade80)" : p.rockMeter > 30 ? "#f59e0b" : "#ef4444",
            transition: "width 0.3s", borderRadius: 2,
            boxShadow: `0 0 4px ${p.rockMeter > 60 ? "#22c55e" : p.rockMeter > 30 ? "#f59e0b" : "#ef4444"}`,
          }} />
        </div>
      </div>
    </div>
  )
}

// ── MultiplayerHUD ────────────────────────────────────────────────────────────
function MultiplayerHUD({ players, myId, isPaused, pausedByName, onPause, onResume, canResume, leftPlayers = [] }:
  { players: RoomPlayer[]; myId: string; isPaused: boolean; pausedByName: string
    onPause: () => void; onResume: () => void; canResume: boolean; leftPlayers?: string[] }) {

  // Ordenado por score decrescente — maior pontuação no topo
  const sorted = [...players].sort((a, b) => b.score - a.score)

  return (
    <>
      {/* Coluna de jogadores — lado esquerdo, ordenados por pontuação */}
      <div className="fixed left-0 top-0 bottom-0 z-30 pointer-events-none flex flex-col justify-center px-3 py-16 gap-2"
        style={{ maxHeight: "100vh", overflowY: "auto" }}>
        {sorted.map((p, rank) => {
          const color = PLAYER_COLORS[players.indexOf(p) % 4]
          const isMe  = p.id === myId
          return (
            <div key={p.id} className="flex flex-col gap-0.5" style={{ width: 190 }}>
              {/* Rank indicator */}
              <div className="flex items-center gap-1.5 px-1 mb-0.5">
                <span style={{
                  fontSize: 9, fontWeight: 900, color: rank === 0 ? "#fbbf24" : "rgba(255,255,255,0.25)",
                  fontFamily: "'Arial Black',Arial,sans-serif",
                  textTransform: "uppercase", letterSpacing: "0.1em",
                }}>
                  #{rank + 1}
                </span>
                {isMe && <span style={{ fontSize: 8, color: color, fontWeight: 700 }}>VOCÊ</span>}
              </div>
              {/* Card */}
              <div style={{
                background: isMe ? "rgba(0,0,0,0.80)" : "rgba(0,0,0,0.62)",
                backdropFilter: "blur(16px)",
                border: `1px solid ${isMe ? color + "60" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 12,
                padding: "8px 10px",
                boxShadow: isMe ? `0 0 16px ${color}28` : "none",
                borderLeft: `3px solid ${color}`,
              }}>
                {/* Nome + combo */}
                <div className="flex items-center justify-between mb-1">
                  <span style={{
                    fontSize: 11, fontWeight: 900,
                    color: isMe ? "#fff" : "rgba(255,255,255,0.70)",
                    fontFamily: "'Arial Black',Arial,sans-serif",
                    maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {p.name || (isMe ? "Você" : "Jogador")}
                  </span>
                  {p.combo > 1 && (
                    <span style={{ fontSize: 10, fontWeight: 900, color: color }}>
                      {p.combo}x
                    </span>
                  )}
                </div>
                {/* Score */}
                <div style={{
                  fontSize: 20, fontWeight: 900, color: "#ffffff",
                  fontFamily: "'Arial Black',Arial,sans-serif",
                  lineHeight: 1,
                  textShadow: isMe ? `0 0 10px ${color}` : "none",
                }}>
                  {p.score.toLocaleString()}
                </div>
                {/* Rock meter */}
                <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${p.rockMeter}%`,
                    background: p.rockMeter > 60 ? "#22c55e" : p.rockMeter > 30 ? "#f59e0b" : "#ef4444",
                    transition: "width 0.3s", borderRadius: 2,
                  }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Notificação de jogador que saiu */}
      {leftPlayers.length > 0 && (
        <div className="fixed top-16 left-0 right-0 z-30 flex justify-center pointer-events-none">
          <div className="px-4 py-1.5 rounded-full text-xs font-bold"
            style={{
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.4)",
              color: "#fca5a5",
              backdropFilter: "blur(8px)",
              animation: "fade-in 0.3s ease",
            }}>
            👋 {leftPlayers.join(", ")} saiu da sala
          </div>
        </div>
      )}

      {/* Pausa multiplayer */}
      {isPaused && (
        <div className="fixed inset-0 z-40 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)" }}>
          <div className="flex flex-col items-center gap-6 w-64">
            <div className="text-center">
              <h2 className="text-xl font-black tracking-[0.2em] uppercase text-white">Pausado</h2>
              <p className="text-xs text-white/35 mt-1">por {pausedByName}</p>
            </div>
            <div className="w-full rounded-2xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {players.slice().sort((a, b) => b.score - a.score).map((p, rank) => {
                const color = PLAYER_COLORS[players.indexOf(p) % 4]
                const isMe = p.id === myId
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-2.5"
                    style={{ borderBottom: rank < players.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <span className="text-sm font-black w-5 text-center"
                      style={{ color: rank === 0 ? "#fbbf24" : "rgba(255,255,255,0.25)" }}>{rank + 1}</span>
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="flex-1 text-sm font-semibold truncate"
                      style={{ color: isMe ? "#fff" : "rgba(255,255,255,0.55)" }}>
                      {isMe ? "Você" : p.name}
                    </span>
                    <span className="text-sm font-black font-mono"
                      style={{ color: isMe ? color : "rgba(255,255,255,0.5)" }}>
                      {p.score.toLocaleString()}
                    </span>
                  </div>
                )
              })}
            </div>
            {canResume ? (
              <button onClick={onResume}
                className="flex items-center justify-center gap-2 w-full h-12 rounded-xl font-bold text-sm transition-all hover:scale-[1.03] active:scale-[0.97]"
                style={{ background: "linear-gradient(135deg,#e11d48,#be123c)", color: "#fff", boxShadow: "0 0 24px rgba(225,29,72,0.4)" }}>
                ▶ Retomar jogo
              </button>
            ) : (
              <div className="w-full py-3 rounded-xl text-center text-sm text-white/30"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                Aguardando {pausedByName} retomar...
              </div>
            )}
          </div>
        </div>
      )}
      <style>{`@keyframes fade-in { from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)} }`}</style>
    </>
  )
}

// ── Tela de espera multiplayer ────────────────────────────────────────────────
function WaitingRoom({ players, myId, hostId, myLaneCount, iAmReady, onReady, onStart, onBack, onLaneChange }:
  { players: RoomPlayer[]; myId: string; hostId: string; myLaneCount: 4|5|6
    iAmReady: boolean; onReady: () => void; onStart: () => void; onBack: () => void
    onLaneChange: (n: 4|5|6) => void }) {

  const isHost   = myId === hostId
  const allReady = players.length > 0 && players.every(p => p.ready)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center flex-col gap-4" style={{ background: "#060608" }}>
      <p className="text-2xl font-black text-white tracking-wider">SALA DE ESPERA</p>

      {/* Seletor de lanes */}
      <div className="flex flex-col gap-2 w-80">
        <p className="text-xs text-center mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Escolha sua dificuldade</p>
        <div className="flex gap-2">
          {LANE_OPTIONS.map(opt => (
            <button key={opt.count} onClick={() => !iAmReady && onLaneChange(opt.count)}
              disabled={iAmReady}
              className="flex-1 flex flex-col items-center py-3 px-2 rounded-xl transition-all"
              style={{
                background: myLaneCount === opt.count ? `${opt.color}22` : "rgba(255,255,255,0.04)",
                border: myLaneCount === opt.count ? `1px solid ${opt.color}66` : "1px solid rgba(255,255,255,0.08)",
                opacity: iAmReady ? 0.5 : 1,
                cursor: iAmReady ? "default" : "pointer",
              }}>
              <span className="text-sm font-black" style={{ color: myLaneCount === opt.count ? opt.color : "rgba(255,255,255,0.5)" }}>{opt.label}</span>
              <span className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{opt.keys}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Lista de jogadores */}
      <div className="flex flex-col gap-2 w-80">
        {players.map((p) => {
          const laneOpt = LANE_OPTIONS.find(o => o.count === (p.laneCount ?? 5))
          return (
            <div key={p.id} className="flex items-center justify-between px-4 py-3 rounded-xl"
              style={{ background: p.ready ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)",
                border: p.ready ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.08)" }}>
              <div>
                <p className="text-sm font-bold text-white">{p.name}{p.id === myId ? " (você)" : ""}</p>
                <p className="text-[10px]" style={{ color: laneOpt ? laneOpt.color + "aa" : "rgba(255,255,255,0.3)" }}>
                  {p.id === hostId ? "👑 " : ""}{laneOpt?.label ?? "Normal"} — {laneOpt?.desc ?? "5 lanes"}
                </p>
              </div>
              {p.ready
                ? <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.2)", color: "#4ade80" }}>✓ Pronto</span>
                : <span className="text-xs animate-pulse" style={{ color: "rgba(255,255,255,0.3)" }}>aguardando...</span>}
            </div>
          )
        })}
      </div>

      {!iAmReady && (
        <button onClick={onReady} className="w-80 h-12 rounded-2xl font-black text-sm tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", boxShadow: "0 0 24px rgba(34,197,94,0.3)" }}>
          ✓ Estou Pronto
        </button>
      )}

      {isHost && allReady && (
        <button onClick={onStart} className="w-80 h-14 rounded-2xl font-black text-lg tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg,#e11d48,#be123c)", color: "#fff", boxShadow: "0 0 30px rgba(225,29,72,0.4)" }}>
          🎸 Iniciar Batalha!
        </button>
      )}
      {isHost && !allReady && iAmReady && (
        <p className="text-xs animate-pulse" style={{ color: "rgba(255,255,255,0.25)" }}>Aguardando outros jogadores...</p>
      )}
      {!isHost && iAmReady && (
        <p className="text-xs animate-pulse" style={{ color: "rgba(255,255,255,0.25)" }}>Aguardando o anfitrião iniciar...</p>
      )}

      <button onClick={onBack} className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>← Voltar</button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
function PlayInner() {
  const params       = useParams()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const trackId      = params.trackId as string

  const roomCode      = searchParams.get("room")
  const playerIdParam = searchParams.get("player")
  const lanesParam    = parseInt(searchParams.get("lanes") || "5")
  const initLanes     = ([4,5,6].includes(lanesParam) ? lanesParam : 5) as 4|5|6
  // Playlist: array de IDs passado via URL
  const playlistParam = searchParams.get("playlist")
  const playlist      = playlistParam ? (() => { try { return JSON.parse(decodeURIComponent(playlistParam)) as string[] } catch { return [] } })() : []

  const [playerId] = useState(() => {
    if (playerIdParam) return playerIdParam
    if (typeof window !== "undefined") return sessionStorage.getItem("playerId") || null
    return null
  })

  const [chart, setChart]       = useState<ChartData | null>(null)
  const [meta, setMeta]         = useState<SongMeta | null>(null)
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({})
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)
  const [albumArt, setAlbumArt] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [laneCount, setLaneCount] = useState<4|5|6>(initLanes)

  // Multiplayer
  const [roomSnapshot, setRoomSnapshot] = useState<RoomSnapshot | null>(null)
  const [gamePaused, setGamePaused]     = useState(false)
  const [gameStarted, setGameStarted]   = useState(false)
  const [iAmReady, setIAmReady]         = useState(false)
  const [leftPlayers, setLeftPlayers]   = useState<string[]>([])  // nomes de jogadores que saíram
  const prevPlayersRef = useRef<string[]>([])  // IDs dos jogadores no último poll
  const latestStatsRef = useRef<GameStats | null>(null)
  const gameEndedRef   = useRef(false)
  const isLeavingRef   = useRef(false)

  // Carrega música
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/songs/${encodeURIComponent(trackId)}`)
        if (!res.ok) throw new Error("Música não encontrada")
        const data = await res.json()
        setMeta(data.meta); setChart(data.chart); setAudioUrls(data.audioUrls || {})
        setAlbumArt(data.albumArt || null); setBackgroundUrl(data.backgroundUrl || null)
        if (!roomCode) setGameStarted(true)
        // Salvar nas músicas recentes
        try {
          const prev: string[] = JSON.parse(localStorage.getItem("gh-recent") ?? "[]")
          const next = [trackId, ...prev.filter((id: string) => id !== trackId)].slice(0, 8)
          localStorage.setItem("gh-recent", JSON.stringify(next))
        } catch {}
      } catch (err) { setError(err instanceof Error ? err.message : "Erro ao carregar") }
    }
    load()
  }, [trackId, roomCode])

  // Busca sala ao montar
  useEffect(() => {
    if (!roomCode) return
    fetch(`/api/rooms/${roomCode}`).then(r => r.json()).then(room => {
      setRoomSnapshot(room)
      if (room.state === "playing") setGameStarted(true)
    }).catch(() => {})
  }, [roomCode])

  // Polling multiplayer
  useEffect(() => {
    if (!roomCode || !playerId) return

    // Inicializar lista de jogadores conhecidos
    if (roomSnapshot) {
      prevPlayersRef.current = roomSnapshot.players.map((p: RoomPlayer) => p.id)
    }

    const pushScore = setInterval(async () => {
      if (!gameStarted) return
      const s = latestStatsRef.current; if (!s) return
      try {
        // Envia score + heartbeat junto para economizar requests
        await fetch(`/api/rooms/${roomCode}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "score", playerId, score: s.score, combo: s.combo, rockMeter: s.rockMeter }),
        })
      } catch {}
    }, 1500)

    // Heartbeat separado a cada 3s para detectar desconexão
    const heartbeatInterval = setInterval(async () => {
      if (gameEndedRef.current || isLeavingRef.current) return
      try {
        await fetch(`/api/rooms/${roomCode}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "heartbeat", playerId }),
        })
      } catch {}
    }, 3000)

    const pollRoom = setInterval(async () => {
      if (gameEndedRef.current || isLeavingRef.current) return
      try {
        const res = await fetch(`/api/rooms/${roomCode}`)
        if (!res.ok) return
        const room: RoomSnapshot = await res.json()

        // Detectar jogadores que saíram
        const currentIds = room.players.map((p: RoomPlayer) => p.id)
        const prev = prevPlayersRef.current
        if (prev.length > 0) {
          const saíram = prev.filter(id => id !== playerId && !currentIds.includes(id))
          if (saíram.length > 0) {
            // Buscar nomes dos que saíram pelo snapshot anterior
            const prevSnap = roomSnapshot
            const names = saíram.map(id => {
              const p = prevSnap?.players.find((pl: RoomPlayer) => pl.id === id)
              return p?.name ?? "Jogador"
            })
            setLeftPlayers(prev2 => [...prev2, ...names])
            // Auto-limpar notificação após 4s
            setTimeout(() => setLeftPlayers([]), 4000)
          }
        }
        prevPlayersRef.current = currentIds

        setRoomSnapshot(room)
        setGamePaused(room.state === "paused")
        if (room.state === "playing" && !gameStarted) setGameStarted(true)
      } catch {}
    }, 800)

    return () => {
      clearInterval(pushScore)
      clearInterval(heartbeatInterval)
      clearInterval(pollRoom)
    }
  }, [roomCode, playerId, gameStarted])

  // ESC pausa para todos no multiplayer
  useEffect(() => {
    if (!roomCode || !gameStarted) return
    const onKey = async (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault()
      const room = roomSnapshot
      if (!room) return
      if (room.state === "paused" && room.pausedBy === playerId) {
        // ESC de novo retoma
        playResumeSound(getVol())
        await fetch(`/api/rooms/${roomCode}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "resume", playerId }),
        }).catch(() => {})
      } else if (room.state === "playing") {
        playPauseSound(getVol())
        await fetch(`/api/rooms/${roomCode}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "pause", playerId }),
        }).catch(() => {})
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [roomCode, playerId, gameStarted, roomSnapshot])

  const handleLaneChange = useCallback((n: 4|5|6) => setLaneCount(n), [])

  const handleReady = useCallback(async () => {
    if (!roomCode || !playerId) return
    setIAmReady(true)
    setRoomSnapshot(prev => prev ? {
      ...prev,
      players: prev.players.map(p => p.id === playerId ? { ...p, ready: true } : p)
    } : prev)
    try {
      // Marca jogador como pronto no servidor (ação "ready")
      await fetch(`/api/rooms/${roomCode}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ready", playerId, ready: true, laneCount }),
      })
    } catch {}
  }, [roomCode, playerId, laneCount])

  const handleStart = useCallback(async () => {
    if (!roomCode || !playerId) return
    // Inicia localmente imediatamente (não espera o poll detectar)
    setGameStarted(true)
    try {
      await fetch(`/api/rooms/${roomCode}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setState", state: "playing" }),
      })
    } catch {}
  }, [roomCode, playerId])

  const handlePause = useCallback(async () => {
    if (!roomCode || !playerId) return
    playPauseSound(getVol())
    try {
      await fetch(`/api/rooms/${roomCode}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause", playerId }),
      })
    } catch {}
  }, [roomCode, playerId])

  const handleResume = useCallback(async () => {
    if (!roomCode || !playerId) return
    playResumeSound(getVol())
    try {
      await fetch(`/api/rooms/${roomCode}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume", playerId }),
      })
    } catch {}
  }, [roomCode, playerId])

  const handleScoreUpdate = useCallback((stats: GameStats) => { latestStatsRef.current = stats }, [])
  const handleSongEnd = useCallback((_stats?: GameStats) => {
    gameEndedRef.current = true
    const stats = latestStatsRef.current
    if (stats && meta) {
      const settings = loadSettings()
      const accuracy = Math.round(getAccuracy(stats))
      const fc       = isFullCombo(stats)
      const grade    = getGrade(getAccuracy(stats), fc)

      saveRecord({
        songId:    meta.id ?? "",
        songName:  meta.name ?? "",
        artist:    meta.artist ?? "",
        albumArt:  meta.albumArt,
        score:     stats.score,
        accuracy,
        combo:     stats.maxCombo,
        grade,
        laneCount: (laneCount as 4|5|6),
        noteSpeed: settings.noteSpeed,
        perfect:   stats.perfect ?? 0,
        great:     stats.great ?? 0,
        good:      stats.good ?? 0,
        miss:      stats.miss ?? 0,
        timestamp: Date.now(),
      })

      // Processar XP e conquistas (pequeno delay para não sobrepor a tela de fim)
      setTimeout(() => {
        const snap = {
          score:     stats.score,
          accuracy,
          combo:     stats.maxCombo,
          grade,
          laneCount: laneCount as 4|5|6,
          noteSpeed: settings.noteSpeed,
          perfect:   stats.perfect ?? 0,
          great:     stats.great ?? 0,
          good:      stats.good ?? 0,
          miss:      stats.miss ?? 0,
          songId:    meta.id ?? "",
          songName:  meta.name ?? "",
        }
        const result = processGameSession(snap, meta.songLength ?? 0)

        // Mostrar XP ganho
        showXPToast(result.xpGain.total, `+${result.xpGain.bonuses.length} bônus`)

        // Mostrar level up
        if (result.levelUp) {
          setTimeout(() => showLevelUpToast(result.levelUp!), 800)
        }

        // Mostrar conquistas (com delay escalonado)
        result.newAchievements.forEach((ach, i) => {
          setTimeout(() => showAchievementToast(ach), 1200 + i * 900)
        })
      }, 1500)
    }
  }, [meta, laneCount])

  const handleBack = useCallback(async () => {
    if (isLeavingRef.current) return
    isLeavingRef.current = true
    if (roomCode && playerId) {
      try {
        // Notifica o servidor que este jogador saiu voluntariamente
        await fetch(`/api/rooms/${roomCode}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "leave", playerId }),
        })
      } catch {}
    }
    router.push(roomCode ? `/room/${roomCode}` : "/songs")
  }, [roomCode, playerId, router])

  // ── Renders ──────────────────────────────────────────────────────────────

  if (error) return (
    <div className="flex items-center justify-center h-screen flex-col gap-4" style={{ background: "#060608" }}>
      <p className="text-rose-500 text-lg">{error}</p>
      <button onClick={handleBack} className="text-white/40 hover:text-white underline text-sm">Voltar</button>
    </div>
  )

  if (!chart || !meta) return (
    <div className="flex items-center justify-center h-screen" style={{ background: "#060608" }}>
      <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // Multiplayer: aguardar roomSnapshot
  if (roomCode && !gameStarted && !roomSnapshot) return (
    <div className="flex items-center justify-center h-screen flex-col gap-3" style={{ background: "#060608" }}>
      <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-white/40 text-sm">Conectando à sala...</p>
    </div>
  )

  // Multiplayer: tela de espera
  if (roomCode && !gameStarted && roomSnapshot) return (
    <WaitingRoom
      players={roomSnapshot.players ?? []}
      myId={playerId ?? ""}
      hostId={roomSnapshot.hostId ?? ""}
      myLaneCount={laneCount}
      iAmReady={iAmReady}
      onReady={handleReady}
      onStart={handleStart}
      onBack={handleBack}
      onLaneChange={handleLaneChange}
    />
  )

  const isMultiplayer = !!roomCode
  const isPaused      = gamePaused
  const pausedByName  = roomSnapshot?.players.find(p => p.id === roomSnapshot.pausedBy)?.name ?? "alguém"
  const canResume     = roomSnapshot?.pausedBy === playerId

  // Próxima música da playlist
  const handleNextSong = playlist.length > 1 ? () => {
    const currentIdx = playlist.indexOf(trackId)
    const next = playlist[currentIdx + 1] ?? playlist[0]
    const remaining = playlist.slice(playlist.indexOf(next))
    router.push(`/play/${encodeURIComponent(next)}?lanes=${laneCount}&playlist=${encodeURIComponent(JSON.stringify(remaining))}`)
  } : undefined

  return (
    <>
      <GameCanvas
        chart={chart}
        meta={meta}
        audioUrls={audioUrls}
        backgroundUrl={backgroundUrl || albumArt}
        onBack={handleBack}
        onScoreUpdate={handleScoreUpdate}
        onSongEnd={handleSongEnd}
        externalPaused={isMultiplayer ? isPaused : undefined}
        laneCount={laneCount}
        onNextSong={handleNextSong}
        playlistCount={playlist.length}
        playlistPosition={playlist.indexOf(trackId) + 1}
        hideTopBar={isMultiplayer}
      />
      {isMultiplayer && roomSnapshot && (
        <MultiplayerHUD
          players={roomSnapshot.players}
          myId={playerId ?? ""}
          isPaused={isPaused}
          pausedByName={pausedByName}
          onPause={handlePause}
          onResume={handleResume}
          canResume={canResume}
          leftPlayers={leftPlayers}
        />
      )}
    </>
  )
}

export default function PlayPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen" style={{ background: "#060608" }}>
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PlayInner />
    </Suspense>
  )
}
