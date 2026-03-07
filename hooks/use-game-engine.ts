import { useCallback, useEffect, useRef, useState } from "react"
import type { ChartData as Chart, SongMeta } from "@/lib/songs/types"
import {
  type ActiveNote,
  type GameState,
  type GameStats,
  type HitEffect,
  type HitRating,
  TIMING_MISS,
  ALL_LANE_KEYS,
  applyHit,
  createInitialStats,
  getRating,
  prepareNotes,
  getAccuracy,
  getGrade,
} from "@/lib/game/engine"
import { renderFrame, getHitLineY } from "@/lib/game/renderer"
import { playComboSound, playPauseSound, playResumeSound, playGameOverSound } from "@/lib/game/sounds"
import { loadSettings, DEFAULT_KEY_BINDINGS } from "@/lib/settings"
import { useGamepad } from "@/hooks/use-gamepad"

interface UseGameEngineOptions {
  chart: Chart
  meta: SongMeta
  audioRef: React.RefObject<HTMLAudioElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  speed?: number
  showGuide?: boolean
  calibrationOffset?: number   // ← novo: deslocamento em ms para calibração
  onSongEnd?: (stats: GameStats) => void
  onScoreUpdate?: (stats: GameStats) => void
}

export function useGameEngine({
  chart,
  meta,
  audioRef,
  canvasRef,
  speed = 1,
  showGuide = true,
  calibrationOffset = 0,
  onSongEnd,
  onScoreUpdate,
}: UseGameEngineOptions) {
  const [gameState, setGameState] = useState<GameState>("idle")
  const [stats, setStats] = useState<GameStats>(() => createInitialStats(chart.notes.length))
  const [countdown, setCountdown] = useState(3)

  // Carrega volume de SFX das configurações
  const sfxVolRef = useRef(1)
  const keyBindingsRef    = useRef<string[]>([...DEFAULT_KEY_BINDINGS])
  const keyboardEnabledRef = useRef<boolean>(true)
  const gamepadEnabledRef  = useRef<boolean>(true)

  useEffect(() => {
    const s = loadSettings()
    sfxVolRef.current       = (s.masterVolume / 100) * (s.sfxVolume / 100)
    keyBindingsRef.current  = s.keyBindings ?? [...DEFAULT_KEY_BINDINGS]
    keyboardEnabledRef.current = s.keyboardEnabled ?? true
    gamepadEnabledRef.current  = s.gamepadEnabled  ?? true
  }, [])

  // Reload key bindings when settings change (e.g. user edits in settings page)
  useEffect(() => {
    const onStorage = () => {
      const s = loadSettings()
      keyBindingsRef.current     = s.keyBindings ?? [...DEFAULT_KEY_BINDINGS]
      keyboardEnabledRef.current = s.keyboardEnabled ?? true
      gamepadEnabledRef.current  = s.gamepadEnabled  ?? true
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const notesRef        = useRef<ActiveNote[]>([])
  const statsRef        = useRef<GameStats>(stats)
  const hitEffectsRef   = useRef<HitEffect[]>([])
  const keysDownRef     = useRef<Set<number>>(new Set())
  const gameStateRef    = useRef<GameState>("idle")
  const animFrameRef    = useRef<number>(0)
  const gameTimeRef     = useRef(0)
  const gameStartWallRef = useRef(0)

  // Mantém refs de speed/showGuide/calibration para o game loop sem re-criar callbacks
  const speedRef       = useRef(speed)
  const showGuideRef   = useRef(showGuide)
  const calibrationRef = useRef(calibrationOffset)
  useEffect(() => { speedRef.current = speed }, [speed])
  useEffect(() => { showGuideRef.current = showGuide }, [showGuide])
  useEffect(() => { calibrationRef.current = calibrationOffset }, [calibrationOffset])

  useEffect(() => { statsRef.current = stats }, [stats])
  useEffect(() => { gameStateRef.current = gameState }, [gameState])

  /**
   * Tempo atual da música em ms, com calibração aplicada.
   * Valor positivo = notas ficam mais "adiantadas" para o jogador (compensa áudio atrasado).
   */
  const getCurrentTime = useCallback((): number => {
    const audio = audioRef.current
    let t = 0
    if (audio && !audio.paused && !audio.ended && audio.readyState >= 2) {
      t = audio.currentTime * 1000
    } else if (gameStartWallRef.current > 0) {
      t = performance.now() - gameStartWallRef.current
    } else {
      t = gameTimeRef.current
    }
    // Aplica calibração: offset positivo = janela de hit avança, offset negativo = recua
    return t + calibrationRef.current
  }, [audioRef])

  const processHit = useCallback(
    (lane: number) => {
      if (gameStateRef.current !== "playing") return
      const currentTime = getCurrentTime()
      const notes = notesRef.current

      let bestNote: ActiveNote | null = null
      let bestDelta = Infinity

      for (const note of notes) {
        if (note.lane !== lane || note.hit || note.missed) continue
        const delta = Math.abs(note.time - currentTime)
        if (delta <= TIMING_MISS && delta < bestDelta) {
          bestNote = note
          bestDelta = delta
        }
      }

      if (bestNote) {
        const rating = getRating(bestNote.time - currentTime)
        if (rating) {
          bestNote.hit = true
          bestNote.hitRating = rating
          bestNote.hitTime = currentTime

          const newStats = applyHit(statsRef.current, rating)
          statsRef.current = newStats
          setStats(newStats)
          onScoreUpdate?.(newStats)
          // Milestone de combo
          if (newStats.combo > 0 && newStats.combo % 10 === 0) {
            playComboSound(newStats.combo, sfxVolRef.current)
          }

          hitEffectsRef.current.push({
            lane,
            rating,
            time: performance.now(),
            y: getHitLineY(canvasRef.current?.height ?? 600),
          })
        }
      }
    },
    [getCurrentTime, canvasRef, onScoreUpdate]
  )

  // Teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === "Escape" && gameStateRef.current === "playing") { pause(); return }
      if (!keyboardEnabledRef.current) return
      const laneIndex = keyBindingsRef.current.indexOf(e.key.toLowerCase())
      if (laneIndex !== -1) {
        e.preventDefault()
        keysDownRef.current.add(laneIndex)
        processHit(laneIndex)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!keyboardEnabledRef.current) return
      const laneIndex = keyBindingsRef.current.indexOf(e.key.toLowerCase())
      if (laneIndex !== -1) keysDownRef.current.delete(laneIndex)
    }
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [processHit])

  // Controle (gamepad) — suporta Xbox, PlayStation, guitarra GH e genéricos
  useGamepad({
    enabled: gamepadEnabledRef.current,
    keysDownRef,
    onLanePress:   (lane) => { processHit(lane) },
    onLaneRelease: (lane) => { keysDownRef.current.delete(lane) },
    onPause:       () => { if (gameStateRef.current === "playing") pause() },
  })

  const checkMisses = useCallback(
    (currentTime: number) => {
      for (const note of notesRef.current) {
        if (note.hit || note.missed) continue
        if (currentTime - note.time > TIMING_MISS) {
          note.missed = true
          const newStats = applyHit(statsRef.current, "miss")
          statsRef.current = newStats
          setStats(newStats)
          onScoreUpdate?.(newStats)

          hitEffectsRef.current.push({
            lane: note.lane,
            rating: "miss",
            time: performance.now(),
            y: getHitLineY(canvasRef.current?.height ?? 600),
          })
        }
      }
    },
    [canvasRef, onScoreUpdate]
  )

  const gameLoop = useCallback(() => {
    if (gameStateRef.current !== "playing") return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const currentTime = getCurrentTime()
    gameTimeRef.current = currentTime
    checkMisses(currentTime)

    const now = performance.now()
    hitEffectsRef.current = hitEffectsRef.current.filter(e => now - e.time < 400)

    const lastNote = notesRef.current[notesRef.current.length - 1]
    const audio = audioRef.current

    // Calcula o ponto de encerramento — o mais tarde entre: última nota + 2s OU duração do áudio
    const lastNoteMs  = lastNote ? lastNote.time + 2000 : 4000
    const audioDurMs  = audio && audio.duration > 0 ? audio.duration * 1000 : 0
    const endThreshold = Math.max(lastNoteMs, audioDurMs - 200)

    const audioActuallyEnded = !audio || audio.ended
    const audioNearEnd = audio && audio.duration > 0
      ? audio.currentTime >= audio.duration - 0.25
      : false
    const timeAfterLastNote = lastNote ? currentTime - (lastNote.time + 2000) : currentTime - 4000

    // Encerra se: (áudio terminou de verdade) OU (passou do endThreshold e não tem áudio ativo)
    const shouldEnd =
      audioActuallyEnded ||
      audioNearEnd ||
      (timeAfterLastNote > 0 && currentTime >= endThreshold)

    // Segurança extra: nunca encerra antes de 3s após a última nota
    const safeToEnd = lastNote ? currentTime > lastNote.time + 3000 : currentTime > 5000

    if (shouldEnd && safeToEnd) {
      if (audio && !audio.ended) audio.pause()
      setGameState("ended")
      gameStateRef.current = "ended"
      playGameOverSound(sfxVolRef.current)
      onSongEnd?.(statsRef.current)
      return
    }

    // Failsafe absoluto: 10s após última nota sem resolução
    if (lastNote && currentTime > lastNote.time + 10000) {
      if (audio) audio.pause()
      setGameState("ended")
      gameStateRef.current = "ended"
      playGameOverSound(sfxVolRef.current)
      onSongEnd?.(statsRef.current)
      return
    }

    renderFrame({
      canvas, ctx,
      notes: notesRef.current,
      currentTime,
      stats: statsRef.current,
      hitEffects: hitEffectsRef.current,
      keysDown: keysDownRef.current,
      speed: speedRef.current,
      showGuide: showGuideRef.current,
      keyLabels: keyBindingsRef.current,
      difficulty: meta.difficulty,
    })

    animFrameRef.current = requestAnimationFrame(gameLoop)
  }, [canvasRef, getCurrentTime, checkMisses, onSongEnd, audioRef])

  const startGame = useCallback(() => {
    notesRef.current = prepareNotes(chart)
    const initialStats = createInitialStats(chart.notes.length)
    statsRef.current = initialStats
    setStats(initialStats)
    hitEffectsRef.current = []
    keysDownRef.current.clear()
    gameTimeRef.current = 0
    gameStartWallRef.current = 0

    setGameState("countdown")
    gameStateRef.current = "countdown"
    setCountdown(3)

    let count = 3
    const interval = setInterval(() => {
      count -= 1
      setCountdown(count)
      if (count <= 0) {
        clearInterval(interval)
        setGameState("playing")
        gameStateRef.current = "playing"
        gameStartWallRef.current = performance.now()

        if (audioRef.current) {
          audioRef.current.currentTime = 0
          audioRef.current.play().catch(err => {
            console.warn("Áudio não pôde ser iniciado:", err)
          })
        }

        animFrameRef.current = requestAnimationFrame(gameLoop)
      }
    }, 1000)
  }, [chart, audioRef, gameLoop])

  const pause = useCallback(() => {
    if (gameStateRef.current !== "playing") return
    setGameState("paused")
    gameStateRef.current = "paused"
    cancelAnimationFrame(animFrameRef.current)
    audioRef.current?.pause()
    playPauseSound(sfxVolRef.current)
  }, [audioRef])

  const resume = useCallback(() => {
    if (gameStateRef.current !== "paused") return
    setGameState("playing")
    gameStateRef.current = "playing"
    if (gameStartWallRef.current > 0 && (!audioRef.current || audioRef.current.paused)) {
      const audioTime = (audioRef.current?.currentTime ?? 0) * 1000
      gameStartWallRef.current = performance.now() - audioTime
    }
    audioRef.current?.play().catch(() => {})
    playResumeSound(sfxVolRef.current)
    animFrameRef.current = requestAnimationFrame(gameLoop)
  }, [audioRef, gameLoop])

  const restart = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    startGame()
  }, [audioRef, startGame])

  useEffect(() => {
    return () => { cancelAnimationFrame(animFrameRef.current) }
  }, [])

  return {
    gameState, stats, countdown,
    startGame, pause, resume, restart,
    accuracy: getAccuracy(stats),
    grade: getGrade(getAccuracy(stats)),
  }
}
