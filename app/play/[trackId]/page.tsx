"use client"

import React, { useEffect, useState, useRef, useCallback, Suspense } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { GameCanvas } from "@/components/game/game-canvas"
import type { ChartData, SongMeta } from "@/lib/songs/types"
import type { GameStats } from "@/lib/game/engine"
import { getGrade, getAccuracy, isFullCombo } from "@/lib/game/engine"
import { playPauseSound, playResumeSound } from "@/lib/game/sounds"
import { loadSettings } from "@/lib/settings"
import { saveRecord } from "@/app/history/page"
import { processGameSession } from "@/lib/progression"
import { showAchievementToast, showLevelUpToast, showXPToast, ToastContainer } from "@/components/ui/achievement-toast"
import { getSocket } from "@/lib/multiplayer/socket-client"

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
  ready?: boolean; instrument?: string; laneCount?: number; avatarUrl?: string
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
  const hasPhoto = !isMe && p.avatarUrl && p.avatarUrl.startsWith("http")
  const myPhoto = isMe && typeof window !== "undefined" ? localStorage.getItem("guitar-duels-photo-url") : null
  const showPhoto = hasPhoto || (isMe && !!myPhoto)
  const photoSrc = isMe ? myPhoto : p.avatarUrl

  return (
    <div className="flex flex-col gap-1.5" style={{ width: 200, animation: "fade-in 0.3s ease" }}>
      <div style={{ height: 3, background: color, borderRadius: 2 }} />
      <div style={{
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(16px)",
        border: `1px solid ${isMe ? color + "55" : "rgba(255,255,255,0.10)"}`,
        borderRadius: 14, padding: "10px 12px 8px",
        boxShadow: isMe ? `0 0 18px ${color}33` : "none",
      }}>
        {/* Nome + mini avatar + combo */}
        <div className="flex items-center gap-2 mb-2">
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            border: `2px solid ${color}66`, overflow: "hidden",
            background: "rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {showPhoto && photoSrc ? (
              <img src={photoSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 12, lineHeight: 1 }}>
                {isMe ? "🎸" : p.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span style={{
            fontSize: 11, fontWeight: 900, color: isMe ? "#fff" : "rgba(255,255,255,0.75)",
            fontFamily: "'Arial Black',Arial,sans-serif",
            flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {isMe ? "Você" : p.name}
          </span>
          {p.combo > 1 && (
            <span style={{ fontSize: 10, fontWeight: 900, color, fontFamily: "'Arial Black',Arial", flexShrink: 0 }}>
              {p.combo}x
            </span>
          )}
        </div>
        {/* Estrelas */}
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
            borderRadius: 2,
            boxShadow: `0 0 4px ${p.rockMeter > 60 ? "#22c55e" : p.rockMeter > 30 ? "#f59e0b" : "#ef4444"}`,
          }} />
        </div>
      </div>
    </div>
  )
}

// ── MultiplayerHUD ────────────────────────────────────────────────────────────
const MultiplayerHUD = React.memo(function MultiplayerHUD({ players, myId, isPaused, pausedByName, onPause, onResume, canResume, leftPlayers = [] }:
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
                    borderRadius: 2,
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
}) // React.memo MultiplayerHUD

// ── Tela de espera multiplayer ────────────────────────────────────────────────
function WaitingRoom({ players, myId, hostId, myLaneCount, iAmReady, onReady, onBack, onLaneChange }:
  { players: RoomPlayer[]; myId: string; hostId: string; myLaneCount: 4|5|6
    iAmReady: boolean; onReady: () => void; onBack: () => void
    onLaneChange: (n: 4|5|6) => void }) {

  const readyCount = players.filter(p => p.ready).length
  const totalCount = players.length
  const allReady   = totalCount >= 2 && readyCount === totalCount

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center flex-col gap-4"
      style={{ background: "#060608", fontFamily: "'Impact','Arial Black',sans-serif" }}>

      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: "4px" }}>
        <p style={{ fontSize: "clamp(1.4rem,4vw,2.2rem)", fontWeight: 900, color: "#e8c060",
          textShadow: "0 0 20px rgba(220,160,20,0.5)", letterSpacing: "0.15em" }}>
          SALA DE ESPERA
        </p>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", fontFamily: "Arial,sans-serif", marginTop: "2px" }}>
          O jogo começa quando todos estiverem prontos
        </p>
      </div>

      {/* Difficulty selector */}
      <div style={{ width: "min(340px,85vw)" }}>
        <p style={{ fontSize: "10px", textAlign: "center", marginBottom: "8px", letterSpacing: "0.3em",
          color: "rgba(255,180,60,0.5)", fontFamily: "Arial,sans-serif" }}>ESCOLHA SUA DIFICULDADE</p>
        <div style={{ display: "flex", gap: "8px" }}>
          {LANE_OPTIONS.map(opt => (
            <button key={opt.count}
              onClick={() => !iAmReady && onLaneChange(opt.count)}
              disabled={iAmReady}
              style={{
                flex: 1, padding: "10px 4px", borderRadius: "10px", cursor: iAmReady ? "default" : "pointer",
                background: myLaneCount === opt.count ? `${opt.color}22` : "rgba(255,255,255,0.04)",
                border: myLaneCount === opt.count ? `2px solid ${opt.color}88` : "1px solid rgba(255,255,255,0.08)",
                boxShadow: myLaneCount === opt.count ? `0 0 12px ${opt.color}44` : "none",
                opacity: iAmReady ? 0.6 : 1, transition: "all 0.1s",
              }}>
              <div style={{ fontSize: "14px", fontWeight: 900, color: myLaneCount === opt.count ? opt.color : "rgba(255,255,255,0.5)" }}>{opt.label}</div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontFamily: "Arial,sans-serif", marginTop: "2px" }}>{opt.keys}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Players list */}
      <div style={{ width: "min(340px,85vw)", display: "flex", flexDirection: "column", gap: "6px" }}>
        {players.map((p) => {
          const laneOpt = LANE_OPTIONS.find(o => o.count === ((p as any).laneCount ?? 5))
          const isMe = p.id === myId
          return (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", borderRadius: "10px",
              background: p.ready ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)",
              border: p.ready ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(255,255,255,0.07)",
              transition: "all 0.2s",
            }}>
              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: isMe ? "#fff" : "rgba(255,255,255,0.75)",
                  fontFamily: "Arial,sans-serif" }}>
                  {p.id === hostId ? "👑 " : ""}{isMe ? `${p.name} (você)` : p.name}
                </p>
                <p style={{ margin: 0, fontSize: "10px", color: laneOpt ? laneOpt.color + "99" : "rgba(255,255,255,0.3)",
                  fontFamily: "Arial,sans-serif" }}>
                  {laneOpt?.label ?? "Normal"} — {laneOpt?.desc ?? "5 lanes"}
                </p>
              </div>
              {p.ready
                ? <span style={{ fontSize: "11px", fontWeight: 900, padding: "3px 10px", borderRadius: "20px",
                    background: "rgba(34,197,94,0.2)", color: "#4ade80", fontFamily: "Impact,sans-serif", letterSpacing: "0.05em" }}>
                    ✓ PRONTO
                  </span>
                : <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", fontFamily: "Arial,sans-serif",
                    animation: "pulse 1.5s ease-in-out infinite" }}>
                    aguardando...
                  </span>}
            </div>
          )
        })}
      </div>

      {/* Ready progress bar */}
      <div style={{ width: "min(340px,85vw)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontFamily: "Arial,sans-serif" }}>
            Prontos
          </span>
          <span style={{ fontSize: "10px", color: allReady ? "#4ade80" : "rgba(255,255,255,0.3)", fontFamily: "Arial,sans-serif", fontWeight: 700 }}>
            {readyCount}/{totalCount}
          </span>
        </div>
        <div style={{ height: "4px", background: "rgba(255,255,255,0.07)", borderRadius: "2px", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: "2px", transition: "width 0.3s ease",
            width: totalCount > 0 ? `${(readyCount/totalCount)*100}%` : "0%",
            background: allReady ? "linear-gradient(90deg,#22c55e,#4ade80)" : "linear-gradient(90deg,#e8b840,#f97316)",
            boxShadow: allReady ? "0 0 8px #22c55e" : "none",
          }}/>
        </div>
      </div>

      {/* Ready / waiting buttons */}
      {!iAmReady ? (
        <button onClick={onReady}
          style={{
            width: "min(340px,85vw)", height: "52px", borderRadius: "12px", cursor: "pointer",
            background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", border: "none",
            fontFamily: "Impact,sans-serif", fontSize: "18px", fontWeight: 900, letterSpacing: "0.1em",
            boxShadow: "0 0 24px rgba(34,197,94,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
            transition: "transform 0.1s",
          }}
          onMouseEnter={e => (e.currentTarget.style.transform="scale(1.02)")}
          onMouseLeave={e => (e.currentTarget.style.transform="scale(1)")}>
          ✓ Estou Pronto
        </button>
      ) : allReady ? (
        <div style={{ textAlign: "center", animation: "pulse 0.5s ease-in-out infinite alternate" }}>
          <p style={{ fontSize: "16px", fontWeight: 900, color: "#4ade80", fontFamily: "Impact,sans-serif",
            letterSpacing: "0.1em", textShadow: "0 0 20px rgba(74,222,128,0.8)" }}>
            🎸 INICIANDO...
          </p>
        </div>
      ) : (
        <div style={{
          width: "min(340px,85vw)", height: "52px", borderRadius: "12px",
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
        }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#e8c060",
            animation: "pulse 1s ease-in-out infinite" }}/>
          <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.4)", fontFamily: "Arial,sans-serif" }}>
            Aguardando outros jogadores...
          </p>
        </div>
      )}

      <button onClick={onBack} style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)",
        background: "none", border: "none", cursor: "pointer", fontFamily: "Arial,sans-serif", marginTop: "4px" }}>
        ← Voltar
      </button>

      <style>{`@keyframes pulse { 0%,100%{opacity:0.6} 50%{opacity:1} }`}</style>
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
  const gamePausedRef                   = useRef(false)
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

  // Busca sala via WebSocket ao montar
  useEffect(() => {
    if (!roomCode) return
    const socket = getSocket()
    socket.emit("get-room", { code: roomCode }, (room: RoomSnapshot | null) => {
      if (!room) return
      setRoomSnapshot(room)
      if (room.state === "playing") setGameStarted(true)
    })
    // Listen for game-start from host
    const onGameStart = (room: RoomSnapshot) => {
      setRoomSnapshot(room)
      setGameStarted(true)
    }
    socket.on("game-start", onGameStart)
    return () => { socket.off("game-start", onGameStart) }
  }, [roomCode])

  // WebSocket multiplayer sync
  useEffect(() => {
    if (!roomCode || !playerId) return
    const socket = getSocket()

    // Score push every 500ms via WebSocket (much faster than HTTP polling)
    const pushScore = setInterval(() => {
      if (!gameStarted || gameEndedRef.current || isLeavingRef.current) return
      const s = latestStatsRef.current; if (!s) return
      socket.emit("score-update", { code: roomCode, playerId, score: s.score, combo: s.combo, rockMeter: s.rockMeter })
    }, 500)

    // Listen for real-time score updates from other players
    const onScoresUpdate = ({ players }: { players: RoomPlayer[] }) => {
      setRoomSnapshot(prev => prev ? { ...prev, players } : prev)
    }

    // Listen for pause/resume
    const onPaused = ({ pausedBy, players }: { pausedBy: string; players: RoomPlayer[] }) => {
      gamePausedRef.current = true
      setGamePaused(true)
      setRoomSnapshot(prev => prev ? { ...prev, state: "paused", pausedBy, players } : prev)
    }
    const onResumed = () => {
      gamePausedRef.current = false
      setGamePaused(false)
      setRoomSnapshot(prev => prev ? { ...prev, state: "playing", pausedBy: null } : prev)
    }

    // Player left notification
    const onPlayerLeft = ({ playerId: leftId, room }: { playerId: string; room: RoomSnapshot }) => {
      const name = roomSnapshot?.players.find(p => p.id === leftId)?.name ?? "Jogador"
      setLeftPlayers(prev => [...prev, name])
      setTimeout(() => setLeftPlayers([]), 4000)
      setRoomSnapshot(room)
    }

    const onRoomUpdate = (room: RoomSnapshot) => {
      setRoomSnapshot(room)
    }

    socket.on("scores-update", onScoresUpdate)
    socket.on("game-paused",   onPaused)
    socket.on("game-resumed",  onResumed)
    socket.on("player-left",   onPlayerLeft)
    socket.on("room-update",   onRoomUpdate)

    return () => {
      clearInterval(pushScore)
      socket.off("scores-update", onScoresUpdate)
      socket.off("game-paused",   onPaused)
      socket.off("game-resumed",  onResumed)
      socket.off("player-left",   onPlayerLeft)
      socket.off("room-update",   onRoomUpdate)
    }
  }, [roomCode, playerId, gameStarted])

  // ESC pausa para todos no multiplayer (via WebSocket)
  useEffect(() => {
    if (!roomCode || !gameStarted) return
    const socket = getSocket()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault()
      const room = roomSnapshot
      if (!room) return
      if (room.state === "paused" && room.pausedBy === playerId) {
        playResumeSound(getVol())
        socket.emit("resume-game", { code: roomCode, playerId })
      } else if (room.state === "playing") {
        playPauseSound(getVol())
        socket.emit("pause-game", { code: roomCode, playerId })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [roomCode, playerId, gameStarted, roomSnapshot])

  const handleLaneChange = useCallback((n: 4|5|6) => setLaneCount(n), [])

  const handleReady = useCallback(() => {
    if (!roomCode || !playerId) return
    setIAmReady(true)
    // Update local state optimistically
    setRoomSnapshot(prev => prev ? {
      ...prev,
      players: prev.players.map(p => p.id === playerId ? { ...p, ready: true, laneCount } : p)
    } : prev)
    // Tell server via WebSocket
    getSocket().emit("player-ready", { code: roomCode, playerId, laneCount })
  }, [roomCode, playerId, laneCount])

  const handleStart = useCallback(() => {
    if (!roomCode || !playerId) return
    getSocket().emit("start-game", { code: roomCode })
  }, [roomCode, playerId])

  const handlePause = useCallback(() => {
    if (!roomCode || !playerId) return
    playPauseSound(getVol())
    getSocket().emit("pause-game", { code: roomCode, playerId })
  }, [roomCode, playerId])

  const handleResume = useCallback(() => {
    if (!roomCode || !playerId) return
    playResumeSound(getVol())
    getSocket().emit("resume-game", { code: roomCode, playerId })
  }, [roomCode, playerId])

  const handleScoreUpdate = useCallback((stats: GameStats) => { latestStatsRef.current = stats }, [])
  const handleSongEnd = useCallback((_stats?: GameStats) => {
    gameEndedRef.current = true
    // Notifica sala via WebSocket
    if (roomCode) {
      getSocket().emit("end-game", { code: roomCode })
    }
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

  const handleBack = useCallback(() => {
    if (isLeavingRef.current) return
    isLeavingRef.current = true
    if (roomCode && playerId) {
      getSocket().emit("leave-room", { code: roomCode, playerId })
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

  const isMultiplayer = !!roomCode
  const isPaused      = gamePaused
  const pausedByName  = (roomSnapshot?.players ?? []).find(p => p.id === roomSnapshot?.pausedBy)?.name ?? "alguém"
  const canResume     = roomSnapshot?.pausedBy === playerId

  // Próxima música da playlist
  const handleNextSong = playlist.length > 1 ? () => {
    const currentIdx = playlist.indexOf(trackId)
    const next = playlist[currentIdx + 1] ?? playlist[0]
    const remaining = playlist.slice(playlist.indexOf(next))
    router.push(`/play/${encodeURIComponent(next)}?lanes=${laneCount}&playlist=${encodeURIComponent(JSON.stringify(remaining))}`)
  } : undefined

  // Multiplayer: aguardar roomSnapshot (GameCanvas já monta invisível para precarregar áudio)
  const showWaitingRoom = roomCode && !gameStarted

  return (
    <>
      {/* GameCanvas sempre montado em multiplayer para precarregar o áudio enquanto espera */}
      {(!roomCode || (roomCode && chart && meta)) && (
        <div style={{ visibility: showWaitingRoom ? "hidden" : "visible", position: "absolute", inset: 0 }}>
          <GameCanvas
            chart={chart!}
            meta={meta!}
            audioUrls={audioUrls}
            backgroundUrl={backgroundUrl || albumArt}
            onBack={handleBack}
            onScoreUpdate={handleScoreUpdate}
            onSongEnd={handleSongEnd}
            externalPaused={isMultiplayer ? isPaused : undefined}
            frozen={showWaitingRoom}
            laneCount={laneCount}
            onNextSong={handleNextSong}
            playlistCount={playlist.length}
            playlistPosition={playlist.indexOf(trackId) + 1}
            hideTopBar={isMultiplayer}
          />
        </div>
      )}

      {/* Tela de espera por cima — some quando gameStarted */}
      {showWaitingRoom && (
        <div style={{ position: "absolute", inset: 0, zIndex: 50 }}>
          {!roomSnapshot ? (
            <div className="flex items-center justify-center h-screen flex-col gap-3" style={{ background: "#060608" }}>
              <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-white/40 text-sm">Conectando à sala...</p>
            </div>
          ) : (
            <WaitingRoom
              players={roomSnapshot.players ?? []}
              myId={playerId ?? ""}
              hostId={roomSnapshot.hostId ?? ""}
              myLaneCount={laneCount}
              iAmReady={iAmReady}
              onReady={handleReady}
              onBack={handleBack}
              onLaneChange={handleLaneChange}
            />
          )}
        </div>
      )}

      {isMultiplayer && roomSnapshot && gameStarted && (
        <MultiplayerHUD
          players={roomSnapshot.players ?? []}
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
