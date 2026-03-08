"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import type { ChartData as Chart, SongMeta } from "@/lib/songs/types"
import type { GameStats } from "@/lib/game/engine"
import { useGameEngine } from "@/hooks/use-game-engine"
import { GameCountdown } from "./game-countdown"
import { GameOverScreen } from "./game-over-screen"
import { PauseOverlay } from "./pause-overlay"
import { loadSettings, toGain } from "@/lib/settings"
import { useGamepad } from "@/hooks/use-gamepad"

function getMimeType(src: string): string {
  if (src.endsWith(".mp3"))  return "audio/mpeg"
  if (src.endsWith(".opus")) return "audio/ogg; codecs=opus"
  if (src.endsWith(".wav"))  return "audio/wav"
  return "audio/ogg"
}



interface GameCanvasProps {
  chart: Chart
  meta: SongMeta
  audioUrls?: Record<string, string>
  backgroundUrl?: string | null
  speed?: number
  onBack?: () => void
  onScoreUpdate?: (stats: GameStats) => void
  onSongEnd?: () => void
  externalPaused?: boolean
  laneCount?: number
}

export function GameCanvas({ chart, meta, audioUrls, backgroundUrl, speed, onBack, onScoreUpdate, onSongEnd, externalPaused, laneCount = 5 }: GameCanvasProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isLeavingRef = useRef(false)   // impede startGame após navegar para fora

  const primaryAudioRef = useRef<HTMLAudioElement>(null)
  const guitarAudioRef  = useRef<HTMLAudioElement>(null)
  const rhythmAudioRef  = useRef<HTMLAudioElement>(null)
  const vocalsAudioRef  = useRef<HTMLAudioElement>(null)
  const crowdAudioRef   = useRef<HTMLAudioElement>(null)
  const keysAudioRef    = useRef<HTMLAudioElement>(null)

  // Carrega configurações salvas
  const [settings] = useState(() => loadSettings())

  // Se speed não foi passado via prop, usa o das configurações
  const effectiveSpeed = speed ?? settings.noteSpeed

  // Faixa principal: song > backing > guitar > rhythm (para sincronizar o tempo)
  const primarySrc = audioUrls?.song || audioUrls?.backing || audioUrls?.guitar || audioUrls?.rhythm || null
  // Faixas secundárias: tocam junto, mesmo nível de volume
  const guitarSrc  = (primarySrc !== audioUrls?.guitar)  ? (audioUrls?.guitar  || null) : null
  const rhythmSrc  = (primarySrc !== audioUrls?.rhythm)  ? (audioUrls?.rhythm  || null) : null
  const vocalsSrc  = audioUrls?.vocals || null
  const crowdSrc   = audioUrls?.crowd  || null
  const keysSrc    = audioUrls?.keys   || null

  const realPrimary = primarySrc
  const realGuitar  = guitarSrc
  const realRhythm  = rhythmSrc
  const realVocals  = vocalsSrc
  const realCrowd   = crowdSrc
  const realKeys    = keysSrc

  // Aplica volumes assim que os elementos de áudio estiverem disponíveis
  const applyVolumes = useCallback(() => {
    const musicGain = toGain(settings.masterVolume, settings.musicVolume)
    for (const ref of [primaryAudioRef, guitarAudioRef, rhythmAudioRef, vocalsAudioRef, crowdAudioRef, keysAudioRef]) {
      if (ref.current) ref.current.volume = musicGain
    }
  }, [settings])


  const [gpConnected, setGpConnected] = useState(false)

  const { gameState, stats, countdown, startGame, pause, resume, restart, accuracy, grade } =
    useGameEngine({
      chart, meta,
      audioRef: primaryAudioRef,
      canvasRef,
      speed: effectiveSpeed,
      showGuide: settings.showGuide,
      calibrationOffset: settings.calibrationOffset,
      laneCount,
      noteShape: settings.noteShape,
      highwayTheme: settings.highwayTheme,
      cameraShake: settings.cameraShake,
      onSongEnd: () => { onSongEnd?.() },
      onScoreUpdate,
    })

  // Indicador de gamepad conectado
  useEffect(() => {
    const onConnect = () => setGpConnected(true)
    const onDisconnect = () => setGpConnected(false)
    window.addEventListener("gamepadconnected", onConnect)
    window.addEventListener("gamepaddisconnected", onDisconnect)
    return () => {
      window.removeEventListener("gamepadconnected", onConnect)
      window.removeEventListener("gamepaddisconnected", onDisconnect)
    }
  }, [])

  // ── Volume fixo para todas as faixas durante o jogo ─────────────────────
  useEffect(() => {
    if (gameState !== "playing") return
    const musicGain = toGain(settings.masterVolume, settings.musicVolume)
    for (const ref of [primaryAudioRef, guitarAudioRef, rhythmAudioRef, vocalsAudioRef, crowdAudioRef, keysAudioRef]) {
      if (ref.current) ref.current.volume = Math.max(0, Math.min(1, musicGain))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, settings])

  // Sincroniza áudios secundários com o primário
  const syncSecondary = useCallback((action: "play" | "pause" | "seek", time?: number) => {
    for (const ref of [guitarAudioRef, rhythmAudioRef, vocalsAudioRef, crowdAudioRef, keysAudioRef]) {
      const el = ref.current
      if (!el) continue
      if (action === "play") {
        if (time !== undefined) el.currentTime = time
        el.play().catch(() => {})
      } else if (action === "pause") {
        el.pause()
      } else if (action === "seek" && time !== undefined) {
        el.currentTime = time
      }
    }
  }, [])

  useEffect(() => {
    const primary = primaryAudioRef.current
    if (!primary) return
    const onPlay   = () => { applyVolumes(); syncSecondary("play", primary.currentTime) }
    const onPause  = () => syncSecondary("pause")
    const onSeeked = () => syncSecondary("seek", primary.currentTime)
    primary.addEventListener("play",   onPlay)
    primary.addEventListener("pause",  onPause)
    primary.addEventListener("seeked", onSeeked)
    return () => {
      primary.removeEventListener("play",   onPlay)
      primary.removeEventListener("pause",  onPause)
      primary.removeEventListener("seeked", onSeeked)
    }
  }, [syncSecondary, applyVolumes])

  const handleBack = useCallback(() => {
    isLeavingRef.current = true
    for (const ref of [primaryAudioRef, guitarAudioRef, rhythmAudioRef, vocalsAudioRef, crowdAudioRef, keysAudioRef]) {
      if (ref.current) { ref.current.pause(); ref.current.currentTime = 0 }
    }
    onBack?.()
  }, [onBack])

  const handleRestart = useCallback(() => {
    isLeavingRef.current = false  // vai jogar de novo, não sair
    restart()
  }, [restart])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    canvas.width  = container.clientWidth
    canvas.height = container.clientHeight
  }, [])

  useEffect(() => {
    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)
    return () => window.removeEventListener("resize", resizeCanvas)
  }, [resizeCanvas])

  useEffect(() => {
    if (gameState === "idle" && !isLeavingRef.current) {
      const t = setTimeout(startGame, 500)
      return () => clearTimeout(t)
    }
    if (gameState === "ended") {
      for (const ref of [primaryAudioRef, guitarAudioRef, rhythmAudioRef, vocalsAudioRef, crowdAudioRef, keysAudioRef]) {
        if (ref.current) { ref.current.pause(); ref.current.currentTime = 0 }
      }
    }
  }, [gameState, startGame])

  // Pause externo (multiplayer): quando externalPaused muda, pausa/retoma o jogo
  useEffect(() => {
    if (externalPaused === undefined) return
    if (externalPaused && gameState === "playing") {
      pause()
      for (const ref of [primaryAudioRef, guitarAudioRef, rhythmAudioRef, vocalsAudioRef, crowdAudioRef, keysAudioRef]) {
        if (ref.current) ref.current.pause()
      }
    } else if (!externalPaused && gameState === "paused") {
      resume()
      for (const ref of [primaryAudioRef, guitarAudioRef, rhythmAudioRef, vocalsAudioRef, crowdAudioRef, keysAudioRef]) {
        if (ref.current) ref.current.play().catch(() => {})
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPaused])

  // Aplica volume quando os elementos carregam
  useEffect(() => { applyVolumes() }, [applyVolumes])

  const [progress, setProgress] = useState(0)
  const [timeInfo, setTimeInfo] = useState(() => ({ current: 0, total: meta.songLength ? meta.songLength / 1000 : 0 }))
  useEffect(() => {
    if (gameState !== "playing" && gameState !== "paused") return
    const interval = setInterval(() => {
      const audio = primaryAudioRef.current
      const totalFromMeta = meta.songLength ? meta.songLength / 1000 : 0
      if (audio) {
        const dur = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : totalFromMeta
        const cur = audio.currentTime || 0
        setProgress(dur > 0 ? cur / dur : 0)
        setTimeInfo({ current: cur, total: dur })
      } else if (totalFromMeta > 0) {
        setTimeInfo(t => ({ ...t, total: totalFromMeta }))
      }
    }, 250)
    return () => clearInterval(interval)
  }, [gameState, meta.songLength])

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2,"0")}`
  }

  const hasAudio = !!(realPrimary || realGuitar || realRhythm)

  return (
    <div ref={containerRef} className="relative w-full h-screen overflow-hidden" style={{ background: "#060608" }}>
      {/* Background da música — imagem ou vídeo */}
      {backgroundUrl && (
        backgroundUrl.endsWith(".mp4") || backgroundUrl.endsWith(".webm") ? (
          <video
            key={backgroundUrl}
            src={backgroundUrl}
            autoPlay loop muted playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0.35, zIndex: 0 }}
          />
        ) : (
          <img
            key={backgroundUrl}
            src={backgroundUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0.35, zIndex: 0 }}
          />
        )
      )}

      {realPrimary && (
        <audio ref={primaryAudioRef} preload="auto">
          <source src={realPrimary} type={getMimeType(realPrimary)} />
        </audio>
      )}
      {realGuitar && (
        <audio ref={guitarAudioRef} preload="auto">
          <source src={realGuitar} type={getMimeType(realGuitar)} />
        </audio>
      )}
      {realRhythm && (
        <audio ref={rhythmAudioRef} preload="auto">
          <source src={realRhythm} type={getMimeType(realRhythm)} />
        </audio>
      )}
      {realVocals && (
        <audio ref={vocalsAudioRef} preload="auto">
          <source src={realVocals} type={getMimeType(realVocals)} />
        </audio>
      )}
      {realCrowd && (
        <audio ref={crowdAudioRef} preload="auto">
          <source src={realCrowd} type={getMimeType(realCrowd)} />
        </audio>
      )}
      {realKeys && (
        <audio ref={keysAudioRef} preload="auto">
          <source src={realKeys} type={getMimeType(realKeys)} />
        </audio>
      )}

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }} />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
        <div className="mx-3 mt-3 rounded-2xl overflow-hidden"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>

          {/* Conteúdo principal */}
          <div className="flex items-center gap-3 px-4 py-2.5">
            {/* Info da música */}
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.3em] truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
                {meta.artist}{gpConnected && <span className="ml-2 text-indigo-400">🎮</span>}
              </p>
              <h2 className="text-sm font-black text-white truncate leading-tight">{meta.name}</h2>
            </div>

            {/* Timer central */}
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black font-mono text-white leading-none">
                  {formatTime(timeInfo.current)}
                </span>
                <span className="text-xs text-white/25 font-mono">/</span>
                <span className="text-sm font-bold font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {timeInfo.total > 0 ? formatTime(timeInfo.total) : "--:--"}
                </span>
              </div>
            </div>

            {/* Velocidade */}
            <div className="shrink-0 flex items-center gap-2">
              {!hasAudio && (
                <span className="text-[9px] text-yellow-500/60 bg-yellow-500/10 px-2 py-0.5 rounded-full">sem áudio</span>
              )}
              <div className="px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <span className="text-xs font-black text-white/50">{effectiveSpeed}x</span>
              </div>
            </div>
          </div>

          {/* Progress bar integrada */}
          <div className="h-1 w-full" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="h-full transition-all duration-300"
              style={{
                width: `${progress * 100}%`,
                background: "linear-gradient(90deg,#be123c,#e11d48,#f97316)",
                boxShadow: "0 0 8px rgba(225,29,72,0.8)",
              }} />
          </div>
        </div>
      </div>

      {gameState === "playing" && (
        <div className="absolute top-[72px] right-4 z-10 pointer-events-none">
          <span
            className="text-[10px] tracking-widest uppercase"
            style={{ color: "rgba(255,255,255,0.12)" }}
          >
            ESC pausar
          </span>
        </div>
      )}

      {gameState === "countdown" && <GameCountdown count={countdown} />}
      {gameState === "paused" && externalPaused === undefined && <PauseOverlay onResume={resume} onRestart={handleRestart} onQuit={handleBack} />}
      {gameState === "ended"     && (
        <GameOverScreen stats={stats} accuracy={accuracy} grade={grade} meta={meta} onRestart={handleRestart} onBack={handleBack} />
      )}
    </div>
  )
}
