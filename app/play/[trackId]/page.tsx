"use client"

import { useEffect, useState, useRef, useCallback, Suspense } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { GameCanvas } from "@/components/game/game-canvas"
import { InstrumentSelect } from "@/components/game/instrument-select"
import type { ChartData, SongMeta } from "@/lib/songs/types"
import type { GameStats } from "@/lib/game/engine"
import { playPauseSound, playResumeSound } from "@/lib/game/sounds"
import { loadSettings } from "@/lib/settings"

function getVol() {
  try { const s = loadSettings(); return (s.masterVolume / 100) * (s.sfxVolume / 100) } catch { return 0.5 }
}

const PLAYER_COLORS = ["#e11d48", "#3b82f6", "#22c55e", "#f97316"]

interface RoomPlayer {
  id: string; name: string; score: number; combo: number; rockMeter: number
}

interface RoomSnapshot {
  state: "waiting" | "playing" | "paused" | "ended"
  pausedBy: string | null
  players: RoomPlayer[]
}

function MultiplayerHUD({
  players, myId, isPaused, pausedByName,
  onPause, onResume, canResume,
}: {
  players: RoomPlayer[]
  myId: string
  isPaused: boolean
  pausedByName: string
  onPause: () => void
  onResume: () => void
  canResume: boolean
}) {
  return (
    <>
      {/* Top bar com todos os placares */}
      <div className="fixed top-0 left-0 right-0 z-30 pointer-events-none">
        <div className="flex items-stretch gap-0 mx-3 mt-3 rounded-2xl overflow-hidden"
          style={{
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          }}>
          {players.map((p, i) => {
            const color = PLAYER_COLORS[i % 4]
            const isMe = p.id === myId
            return (
              <div key={p.id} className="flex-1 flex flex-col items-center py-2.5 px-2 relative"
                style={{
                  borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  background: isMe ? `${color}10` : "transparent",
                }}>
                {/* Indicador "você" */}
                {isMe && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-sm"
                    style={{ background: color }} />
                )}
                {/* Nome */}
                <div className="flex items-center gap-1 mb-0.5">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
                  <span className="text-[10px] font-semibold truncate max-w-[80px]"
                    style={{ color: isMe ? color : "rgba(255,255,255,0.4)" }}>
                    {isMe ? "Você" : p.name}
                  </span>
                </div>
                {/* Score */}
                <span className="text-base font-black font-mono leading-none"
                  style={{ color: isMe ? "#fff" : "rgba(255,255,255,0.65)" }}>
                  {p.score.toLocaleString()}
                </span>
                {/* Combo + Rock meter */}
                <div className="flex items-center gap-2 mt-1 w-full">
                  {p.combo > 1 && (
                    <span className="text-[9px] font-bold" style={{ color: color + "cc" }}>
                      {p.combo}x
                    </span>
                  )}
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${p.rockMeter}%`,
                        background: p.rockMeter > 60 ? "#22c55e" : p.rockMeter > 30 ? "#fbbf24" : "#ef4444",
                      }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Botão Pausar — canto inferior direito, pointer-events ativo */}
      {!isPaused && (
        <div className="fixed bottom-6 right-6 z-30">
          <button
            onClick={onPause}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95"
            style={{
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.45)",
            }}>
            <span>⏸</span> Pausar para todos
          </button>
        </div>
      )}

      {/* Overlay de pause */}
      {isPaused && (
        <div className="fixed inset-0 z-40 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)" }}>
          <div className="flex flex-col items-center gap-6 w-64"
            style={{ animation: "pause-in 0.25s cubic-bezier(0.34,1.56,0.64,1) both" }}>

            {/* Ícone + título */}
            <div className="text-center">
              <div className="flex items-center gap-3 justify-center mb-2">
                <div className="h-px w-10" style={{ background: "linear-gradient(90deg, transparent, rgba(225,29,72,0.6))" }} />
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
                  style={{ background: "rgba(225,29,72,0.15)", border: "1px solid rgba(225,29,72,0.3)" }}>
                  ⏸
                </div>
                <div className="h-px w-10" style={{ background: "linear-gradient(90deg, rgba(225,29,72,0.6), transparent)" }} />
              </div>
              <h2 className="text-xl font-black tracking-[0.2em] uppercase text-white">Pausado</h2>
              <p className="text-xs text-white/35 mt-1">por {pausedByName}</p>
            </div>

            {/* Placar rápido no pause */}
            <div className="w-full rounded-2xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {players
                .slice()
                .sort((a, b) => b.score - a.score)
                .map((p, rank) => {
                  const color = PLAYER_COLORS[players.indexOf(p) % 4]
                  const isMe = p.id === myId
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-2.5"
                      style={{ borderBottom: rank < players.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                      <span className="text-sm font-black w-5 text-center"
                        style={{ color: rank === 0 ? "#fbbf24" : "rgba(255,255,255,0.25)" }}>
                        {rank + 1}
                      </span>
                      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <span className="flex-1 text-sm font-semibold truncate"
                        style={{ color: isMe ? "#fff" : "rgba(255,255,255,0.55)" }}>
                        {isMe ? "Você" : p.name}
                      </span>
                      <span className="text-sm font-black font-mono" style={{ color: isMe ? color : "rgba(255,255,255,0.5)" }}>
                        {p.score.toLocaleString()}
                      </span>
                    </div>
                  )
                })}
            </div>

            {/* Botão retomar */}
            {canResume ? (
              <button onClick={onResume}
                className="flex items-center justify-center gap-2 w-full h-12 rounded-xl font-bold text-sm transition-all hover:scale-[1.03] active:scale-[0.97]"
                style={{ background: "linear-gradient(135deg, #e11d48, #be123c)", color: "#fff", boxShadow: "0 0 24px rgba(225,29,72,0.4)" }}>
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

      <style>{`
        @keyframes pause-in {
          from { opacity: 0; transform: scale(0.88) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </>
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

  const [playerId] = useState(() => {
    if (playerIdParam) return playerIdParam
    if (typeof window !== "undefined") return sessionStorage.getItem("playerId") || null
    return null
  })

  const [chart, setChart]     = useState<ChartData | null>(null)
  const [meta, setMeta]       = useState<SongMeta | null>(null)
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({})
  const [availableInstruments, setAvailableInstruments] = useState<{key:string;label:string;icon:string;url:string}[]>([])
  const [chosenInstrument, setChosenInstrument] = useState<{key:string;label:string;icon:string;url:string}|null>(null)
  const [waitingForPlayers, setWaitingForPlayers] = useState(false)
  const [roomPlayersReady, setRoomPlayersReady] = useState<{id:string;name:string;instrument?:string;ready:boolean}[]>([])
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)
  const [albumArt, setAlbumArt] = useState<string | null>(null)
  const isLeavingRef = useRef(false)   // previne startGame após onBack
  const [error, setError]     = useState<string | null>(null)

  // Estado multiplayer
  const [roomSnapshot, setRoomSnapshot] = useState<RoomSnapshot | null>(null)
  const [gamePaused, setGamePaused]     = useState(false)
  const latestStatsRef  = useRef<GameStats | null>(null)
  const gameEndedRef    = useRef(false)   // local game já terminou

  // Carrega música
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/songs/${encodeURIComponent(trackId)}`)
        if (!res.ok) throw new Error("Música não encontrada")
        const data = await res.json()
        setMeta(data.meta); setChart(data.chart); setAudioUrls(data.audioUrls || {})
        setAlbumArt(data.albumArt || null)
        setAvailableInstruments(data.availableInstruments || [])
        setBackgroundUrl(data.backgroundUrl || null)
      } catch (err) { setError(err instanceof Error ? err.message : "Erro ao carregar") }
    }
    load()
  }, [trackId])

  // Multiplayer: push score + poll room state
  useEffect(() => {
    if (!roomCode || !playerId) return

    const pushScore = setInterval(async () => {
      const s = latestStatsRef.current
      if (!s) return
      try {
        await fetch(`/api/rooms/${roomCode}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "score", playerId, score: s.score, combo: s.combo, rockMeter: s.rockMeter }),
        })
      } catch {}
    }, 1500)

    const pollRoom = setInterval(async () => {
      if (gameEndedRef.current || isLeavingRef.current) return
      try {
        const res = await fetch(`/api/rooms/${roomCode}`)
        if (!res.ok) return
        const room: RoomSnapshot = await res.json()
        setRoomSnapshot(room)
        setGamePaused(room.state === "paused")
        // Atualizar lista de jogadores prontos (para tela de espera de instrumento)
        setRoomPlayersReady(room.players || [])
        // Se todos escolheram instrumento (ready=true), liberar o jogo
        if (room.players && room.players.length > 0) {
          const allReady = room.players.every((p: {ready: boolean}) => p.ready)
          if (allReady) setWaitingForPlayers(false)
        }
      } catch {}
    }, 1000)

    return () => { clearInterval(pushScore); clearInterval(pollRoom) }
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

  const handleScoreUpdate = useCallback((stats: GameStats) => {
    latestStatsRef.current = stats
  }, [])

  const handleSongEnd = useCallback(() => {
    gameEndedRef.current = true
  }, [])

  const handleBack = useCallback(async () => {
    if (isLeavingRef.current) return
    isLeavingRef.current = true
    // No multiplayer: marca a sala como ended no servidor antes de sair
    if (roomCode && playerId) {
      try {
        await fetch(`/api/rooms/${roomCode}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "setState", state: "ended" }),
        })
      } catch {}
    }
    router.push(roomCode ? `/room/${roomCode}` : "/songs")
  }, [roomCode, playerId, router])

  // Tela de seleção de instrumento
  // Tela de aguardando outros jogadores escolherem instrumento
  if (waitingForPlayers && roomCode && chosenInstrument) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center flex-col gap-6"
        style={{ background: "rgba(0,0,0,0.97)" }}>
        <div className="text-center">
          <p className="text-4xl mb-2">{chosenInstrument.icon}</p>
          <p className="text-lg font-black text-white">{chosenInstrument.label}</p>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>instrumento escolhido</p>
        </div>
        <div className="flex flex-col gap-2 w-64">
          {roomPlayersReady.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-2 rounded-xl"
              style={{ background: p.ready ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)",
                border: p.ready ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.08)" }}>
              <span className="text-sm text-white font-bold">{p.name}{p.id === playerId ? " (você)" : ""}</span>
              {p.ready
                ? <span className="text-xs" style={{ color: "#4ade80" }}>✓ pronto</span>
                : <span className="text-xs animate-pulse" style={{ color: "rgba(255,255,255,0.3)" }}>escolhendo...</span>}
            </div>
          ))}
        </div>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Aguardando todos escolherem o instrumento...</p>
      </div>
    )
  }

  if (chart && meta && availableInstruments.length > 1 && !chosenInstrument) {
    return (
      <InstrumentSelect
        songName={meta.name}
        artist={meta.artist}
        instruments={availableInstruments}
        onSelect={async (instr) => {
          setChosenInstrument(instr)
          if (roomCode && playerId) {
            setWaitingForPlayers(true)
            try {
              await fetch(`/api/rooms/${roomCode}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "instrument", playerId, instrument: instr.key }),
              })
            } catch {}
          }
        }}
        onBack={handleBack}
      />
    )
  }

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
  const pausedByName  = roomSnapshot
    ? roomSnapshot.players.find(p => p.id === roomSnapshot.pausedBy)?.name ?? "alguém"
    : ""
  const canResume = roomSnapshot?.pausedBy === playerId

  return (
    <>
      <GameCanvas
        chart={chart}
        meta={meta}
        audioUrls={chosenInstrument
          ? { ...audioUrls, guitar: chosenInstrument.url,
              // Remove a faixa original do instrumento escolhido da posição dela
              // para não tocar duplicado
              [chosenInstrument.key]: chosenInstrument.url }
          : audioUrls}
        backgroundUrl={backgroundUrl || albumArt}
        onBack={handleBack}
        onScoreUpdate={handleScoreUpdate}
        onSongEnd={handleSongEnd}
        externalPaused={isMultiplayer ? isPaused : undefined}
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
