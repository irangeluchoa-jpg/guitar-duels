"use client"

/**
 * use-gamepad.ts
 * Suporte a qualquer controle via Gamepad API, incluindo Bluetooth.
 */

import { useEffect, useRef, useCallback } from "react"

export const DEFAULT_GAMEPAD_BINDINGS = [2, 1, 3, 0, 5, 4]
export const GAMEPAD_PAUSE_BUTTON     = 9
export const GAMEPAD_STRUM_UP         = 12
export const GAMEPAD_STRUM_DOWN       = 13

export type GamepadProfile = {
  name: string
  laneButtons: number[]
  strumUp: number
  strumDown: number
  pauseButton: number
}

export const GAMEPAD_PROFILES: GamepadProfile[] = [
  {
    name: "Guitar Hero (Xbox 360)",
    laneButtons: [2, 1, 3, 0, 4],
    strumUp: 12, strumDown: 13, pauseButton: 9,
  },
  {
    name: "Guitar Hero (PS2/PS3)",
    laneButtons: [2, 1, 3, 0, 4],
    strumUp: 12, strumDown: 13, pauseButton: 9,
  },
  {
    name: "Xbox / Genérico",
    laneButtons: [2, 1, 3, 0, 5],
    strumUp: 12, strumDown: 13, pauseButton: 9,
  },
  {
    name: "PlayStation",
    laneButtons: [2, 1, 3, 0, 5],
    strumUp: 12, strumDown: 13, pauseButton: 9,
  },
]

export function detectProfile(gamepadId: string): GamepadProfile {
  const id = gamepadId.toLowerCase()
  if (id.includes("guitar") || id.includes("gh ") || id.includes("gh_"))
    return GAMEPAD_PROFILES[0]
  if (id.includes("playstation") || id.includes("dualshock") || id.includes("dualsense") || id.includes("054c"))
    return GAMEPAD_PROFILES[3]
  return GAMEPAD_PROFILES[2]
}

interface UseGamepadOptions {
  onLanePress:   (lane: number) => void
  onLaneRelease: (lane: number) => void
  onPause:       () => void
  keysDownRef:   React.MutableRefObject<Set<number>>
  enabled:       boolean
  laneCount?:    number
}

export function useGamepad({
  onLanePress, onLaneRelease, onPause, keysDownRef, enabled, laneCount = 5
}: UseGamepadOptions) {
  const gamepadIndexRef   = useRef<number | null>(null)
  const profileRef        = useRef<GamepadProfile>(GAMEPAD_PROFILES[2])
  const prevButtonsRef    = useRef<boolean[]>([])
  const rafRef            = useRef<number | null>(null)
  // null = não customizado pelo usuário → usa profileRef.current.laneButtons
  const customBindingsRef = useRef<number[] | null>(null)
  const enabledRef        = useRef(enabled)

  useEffect(() => { enabledRef.current = enabled }, [enabled])

  // Carrega mapeamento customizado do localStorage (só se o usuário editou)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("guitar-duels-gamepad")
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed.laneButtons) &&
           (parsed.laneButtons.length === 5 || parsed.laneButtons.length === 6))
          customBindingsRef.current = parsed.laneButtons
      }
    } catch {}
  }, [])

  // Retorna bindings ativos: custom (se configurado) OU perfil detectado automaticamente
  const getBindings = useCallback((): number[] => {
    if (customBindingsRef.current) return customBindingsRef.current
    return profileRef.current.laneButtons
  }, [])

  // ── Scan: encontra o primeiro gamepad conectado ──────────────────────────
  const scanGamepads = useCallback(() => {
    const gps = Array.from(navigator.getGamepads?.() ?? [])

    if (gamepadIndexRef.current !== null) {
      const current = gps[gamepadIndexRef.current]
      if (current?.connected) return true
      gamepadIndexRef.current = null
      prevButtonsRef.current  = []
      for (let i = 0; i < laneCount; i++) {
        keysDownRef.current.delete(i)
        onLaneRelease(i)
      }
    }

    for (let i = 0; i < gps.length; i++) {
      const gp = gps[i]
      if (gp && gp.connected) {
        gamepadIndexRef.current = i
        profileRef.current      = detectProfile(gp.id)
        prevButtonsRef.current  = []
        return true
      }
    }
    return false
  }, [keysDownRef, onLaneRelease, laneCount])

  // ── Poll principal (rAF) ────────────────────────────────────────────────
  const pollGamepad = useCallback(() => {
    if (enabledRef.current && gamepadIndexRef.current !== null) {
      const gps = navigator.getGamepads?.() ?? []
      const gp  = gps[gamepadIndexRef.current]

      if (gp?.connected) {
        const bindings = getBindings()
        const buttons  = Array.from(gp.buttons).map(b =>
          typeof b === "object" ? b.pressed : Boolean(b)
        )

        // Lanes
        for (let lane = 0; lane < laneCount; lane++) {
          const btnIdx = bindings[lane]
          if (btnIdx === undefined || btnIdx < 0 || btnIdx >= buttons.length) continue
          const now = buttons[btnIdx]
          const was = prevButtonsRef.current[btnIdx] ?? false
          if (now && !was) { keysDownRef.current.add(lane); onLanePress(lane) }
          if (!now && was) { keysDownRef.current.delete(lane); onLaneRelease(lane) }
        }

        // Pause
        const pauseIdx = profileRef.current.pauseButton
        if (pauseIdx < buttons.length && buttons[pauseIdx] && !(prevButtonsRef.current[pauseIdx] ?? false))
          onPause()

        // Strum (D-pad + eixo analógico)
        const axisY        = gp.axes[1] ?? 0
        const strumUpIdx   = profileRef.current.strumUp
        const strumDownIdx = profileRef.current.strumDown
        const strumUp      = strumUpIdx   < buttons.length ? (buttons[strumUpIdx]   ?? false) : false
        const strumDown    = strumDownIdx < buttons.length ? (buttons[strumDownIdx] ?? false) : false
        const axisTrig     = Math.abs(axisY) > 0.7
        const prevUp       = prevButtonsRef.current[strumUpIdx]   ?? false
        const prevDown     = prevButtonsRef.current[strumDownIdx] ?? false

        if ((strumUp && !prevUp) || (strumDown && !prevDown) || axisTrig) {
          for (let lane = 0; lane < laneCount; lane++) {
            if (keysDownRef.current.has(lane)) onLanePress(lane)
          }
        }

        prevButtonsRef.current = buttons
      } else {
        scanGamepads()
      }
    }

    rafRef.current = requestAnimationFrame(pollGamepad)
  }, [onLanePress, onLaneRelease, onPause, keysDownRef, laneCount, scanGamepads, getBindings])

  // ── Setup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onConnect = (e: GamepadEvent) => {
      if (gamepadIndexRef.current !== null) return
      gamepadIndexRef.current = e.gamepad.index
      profileRef.current      = detectProfile(e.gamepad.id)
      prevButtonsRef.current  = []
    }
    const onDisconnect = (e: GamepadEvent) => {
      if (e.gamepad.index !== gamepadIndexRef.current) return
      gamepadIndexRef.current = null
      prevButtonsRef.current  = []
      for (let i = 0; i < laneCount; i++) {
        keysDownRef.current.delete(i)
        onLaneRelease(i)
      }
    }

    window.addEventListener("gamepadconnected",    onConnect)
    window.addEventListener("gamepaddisconnected", onDisconnect)

    scanGamepads()

    // Polling BT — Chrome só expõe gamepad BT após primeiro input do usuário
    const scanTimer = setInterval(scanGamepads, 200)

    // Scan em pointer (toque/clique) — NÃO keydown para não interferir no jogo
    const onPointer = () => scanGamepads()
    window.addEventListener("pointerdown", onPointer)

    const onFocus      = () => scanGamepads()
    const onVisibility = () => { if (document.visibilityState === "visible") scanGamepads() }
    window.addEventListener("focus",              onFocus)
    document.addEventListener("visibilitychange", onVisibility)

    rafRef.current = requestAnimationFrame(pollGamepad)

    return () => {
      clearInterval(scanTimer)
      window.removeEventListener("gamepadconnected",    onConnect)
      window.removeEventListener("gamepaddisconnected", onDisconnect)
      window.removeEventListener("pointerdown",         onPointer)
      window.removeEventListener("focus",               onFocus)
      document.removeEventListener("visibilitychange",  onVisibility)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [pollGamepad, scanGamepads, keysDownRef, onLaneRelease, laneCount])

  return {
    isConnected: gamepadIndexRef.current !== null,
    gamepadName: gamepadIndexRef.current !== null
      ? (navigator.getGamepads?.()?.[gamepadIndexRef.current]?.id ?? null)
      : null,
    profile: profileRef.current,
  }
}

export function saveGamepadBindings(laneButtons: number[]) {
  try { localStorage.setItem("guitar-duels-gamepad", JSON.stringify({ laneButtons })) } catch {}
}

export function loadGamepadBindings(): number[] {
  try {
    const stored = localStorage.getItem("guitar-duels-gamepad")
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed.laneButtons) &&
         (parsed.laneButtons.length === 5 || parsed.laneButtons.length === 6))
        return parsed.laneButtons
    }
  } catch {}
  return [...DEFAULT_GAMEPAD_BINDINGS]
}
