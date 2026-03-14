"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import type { ChartData as Chart, SongMeta } from "@/lib/songs/types"
import { ArtistSilhouette } from "@/components/game/artist-silhouette"
import { useAudioOutput } from "@/hooks/use-audio-output"
import type { GameStats } from "@/lib/game/engine"
import { useGameEngine } from "@/hooks/use-game-engine"
import { GameCountdown } from "./game-countdown"
import { GameOverScreen } from "./game-over-screen"
import { PauseOverlay } from "./pause-overlay"
import { TouchLanes } from "./touch-lanes"
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
  onSongEnd?: (stats: GameStats) => void
  externalPaused?: boolean
  laneCount?: number
  isDaily?: boolean
  onNextSong?: () => void
  playlistCount?: number
  playlistPosition?: number
  hideTopBar?: boolean
}

export function GameCanvas({ chart, meta, audioUrls, backgroundUrl, speed, onBack, onScoreUpdate, onSongEnd, externalPaused, laneCount = 5, isDaily = false, onNextSong, playlistCount = 0, playlistPosition = 0, hideTopBar = false }: GameCanvasProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isLeavingRef = useRef(false)   // impede startGame após navegar para fora

  const primaryAudioRef = useRef<HTMLAudioElement>(null)
  const guitarAudioRef  = useRef<HTMLAudioElement>(null)
  const rhythmAudioRef  = useRef<HTMLAudioElement>(null)
  const vocalsAudioRef  = useRef<HTMLAudioElement>(null)
  const crowdAudioRef   = useRef<HTMLAudioElement>(null)
  const keysAudioRef    = useRef<HTMLAudioElement>(null)

  // Carrega configurações salvas — relê do localStorage a cada montagem
  // para garantir que mudanças feitas nas settings sejam aplicadas
  const [settings] = useState(() => loadSettings())

  // Aplicar dispositivo de saída de áudio em todos os elementos
  useAudioOutput(
    [primaryAudioRef, guitarAudioRef, rhythmAudioRef, vocalsAudioRef, crowdAudioRef, keysAudioRef],
    settings.audioOutputDeviceId ?? ""
  )

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

  const { gameState, stats, countdown, startGame, pause, resume, restart, accuracy, grade, isFC, failed, touchPress, touchRelease } =
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
      onSongEnd: (stats) => { onSongEnd?.(stats) },
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
    const dpr = window.devicePixelRatio || 1
    const w = container.clientWidth
    const h = container.clientHeight
    // Dimensão real em pixels físicos (resolve o blur em telas Retina/4K)
    canvas.width  = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    // Tamanho CSS continua igual
    canvas.style.width  = w + "px"
    canvas.style.height = h + "px"
    // Escalar o contexto para que o renderer continue usando coordenadas CSS
    const ctx = canvas.getContext("2d")
    if (ctx) ctx.scale(dpr, dpr)
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

  // Pegar duração de qualquer audio disponível (primaryAudio pode não existir)
  const allAudioRefs = [primaryAudioRef, guitarAudioRef, rhythmAudioRef, vocalsAudioRef, crowdAudioRef, keysAudioRef]

  function getBestAudioSource(): HTMLAudioElement | null {
    for (const ref of allAudioRefs) {
      const el = ref.current
      if (el && isFinite(el.duration) && el.duration > 0) return el
    }
    // Fallback: qualquer elemento com currentTime avançando
    for (const ref of allAudioRefs) {
      if (ref.current) return ref.current
    }
    return null
  }

  // Atualiza total assim que qualquer audio carregar metadados
  useEffect(() => {
    const totalFromMeta = meta.songLength ? meta.songLength / 1000 : 0
    const handlers: Array<{ el: HTMLAudioElement; fn: () => void }> = []
    for (const ref of allAudioRefs) {
      const el = ref.current
      if (!el) continue
      const fn = () => {
        if (isFinite(el.duration) && el.duration > 0) {
          setTimeInfo((t: {current:number;total:number}) => ({ ...t, total: el.duration }))
        }
      }
      el.addEventListener("loadedmetadata", fn)
      handlers.push({ el, fn })
      // Se já carregou
      if (isFinite(el.duration) && el.duration > 0) {
        setTimeInfo((t: {current:number;total:number}) => ({ ...t, total: el.duration }))
      }
    }
    if (totalFromMeta > 0) setTimeInfo((t: {current:number;total:number}) => ({ ...t, total: totalFromMeta }))
    return () => handlers.forEach(({ el, fn }) => el.removeEventListener("loadedmetadata", fn))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.songLength])

  useEffect(() => {
    if (gameState !== "playing" && gameState !== "paused") return
    const interval = setInterval(() => {
      const audio = getBestAudioSource()
      if (!audio) return
      const dur = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : timeInfo.total
      const cur = audio.currentTime || 0
      if (dur > 0) {
        setProgress(cur / dur)
        setTimeInfo({ current: cur, total: dur })
      } else {
        setTimeInfo((t: {current:number;total:number}) => ({ ...t, current: cur }))
      }
    }, 250)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState])

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2,"0")}`
  }

  const hasAudio = !!(realPrimary || realGuitar || realRhythm)

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden" style={{ background: "#060608", height: "100dvh" }}>
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

      {/* Silhueta animada do artista */}
      {settings.showArtist !== false && (
        <ArtistSilhouette
          combo={stats.combo}
          starPower={stats.combo >= 30}
          isPlaying={gameState === "playing"}
          albumArt={meta.albumArt}
        />
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

      {/* Top bar — oculto no modo multiplayer (o MultiplayerHUD já exibe as infos) */}
      {!hideTopBar && (() => {
        const isStarPower = stats.combo >= 30
        return (
        <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
          style={{ transition: "opacity 0.5s ease" }}>
          <div className="mx-1 sm:mx-3 mt-1 sm:mt-3 rounded-xl sm:rounded-2xl overflow-hidden"
            style={{
              background: isStarPower ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.55)",
              backdropFilter: "blur(16px)",
              border: isStarPower ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(255,255,255,0.07)",
              boxShadow: isStarPower ? "0 4px 24px rgba(0,0,0,0.3)" : "0 4px 24px rgba(0,0,0,0.5)",
              transition: "all 0.5s ease",
            }}>

            {/* Timer + velocidade (info da música está no painel lateral esquerdo do canvas) */}
            <div className="flex items-center justify-between px-2 sm:px-4 py-1 sm:py-1.5">
              <div style={{ width: "210px" }} />
              <div className="flex items-baseline gap-0.5 sm:gap-1">
                <span className="text-sm sm:text-lg font-black font-mono text-white leading-none">
                  {formatTime(timeInfo.current)}
                </span>
                <span className="text-[9px] sm:text-xs text-white/25 font-mono">/</span>
                <span className="text-[10px] sm:text-sm font-bold font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {timeInfo.total > 0 ? formatTime(timeInfo.total) : "--:--"}
                </span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                {!hasAudio && <span className="hidden sm:inline text-[9px] text-yellow-500/60 bg-yellow-500/10 px-2 py-0.5 rounded-full">sem áudio</span>}
                {gpConnected && <span className="text-indigo-400 text-sm">🎮</span>}
                <div className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <span className="text-[10px] sm:text-xs font-black text-white/50">{effectiveSpeed}x</span>
                </div>
              </div>
            </div>

            {/* Progress bar integrada */}
            <div className="h-0.5 sm:h-1 w-full" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="h-full transition-all duration-300"
                style={{
                  width: `${progress * 100}%`,
                  background: "linear-gradient(90deg,#be123c,#e11d48,#f97316)",
                  boxShadow: "0 0 8px rgba(225,29,72,0.8)",
                }} />
            </div>
          </div>
        </div>
        )
      })()}

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

      {/* Botões de toque para mobile */}
      {gameState === "playing" && (
        <TouchLanes
          laneCount={laneCount}
          onLanePress={touchPress}
          onLaneRelease={touchRelease}
        />
      )}

      {gameState === "countdown" && <GameCountdown count={countdown} />}
      {gameState === "paused" && externalPaused === undefined && <PauseOverlay onResume={resume} onRestart={handleRestart} onQuit={handleBack} />}
      {gameState === "ended"     && (
        <GameOverScreen stats={stats} accuracy={accuracy} grade={grade} isFC={isFC} meta={meta} onRestart={handleRestart} onBack={handleBack} failed={failed.current} isDaily={isDaily} onNextSong={onNextSong} playlistCount={playlistCount} playlistPosition={playlistPosition} />
      )}
    </div>
  )
}
