"use client"

/**
 * use-gamepad.ts
 * Suporte a qualquer controle via Gamepad API, incluindo Bluetooth.
 *
 * Mapeamento padrão (Xbox / PlayStation / genérico):
 *  Lane 0 (Vermelho) → botão 2  (X no Xbox / □ no PS)
 *  Lane 1 (Laranja)  → botão 1  (B no Xbox / ○ no PS)
 *  Lane 2 (Amarelo)  → botão 3  (Y no Xbox / △ no PS)
 *  Lane 3 (Azul)     → botão 0  (A no Xbox / × no PS)
 *  Lane 4 (Verde)    → botão 5  (RB no Xbox / R1 no PS)
 *  Pause             → botão 9  (Start / Options)
 *  Strum Up          → botão 12 (D-pad cima)
 *  Strum Down        → botão 13 (D-pad baixo)
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
  const customBindingsRef = useRef<number[]>([...DEFAULT_GAMEPAD_BINDINGS])

  // Carrega mapeamento customizado
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

  // ── Scan: encontra o primeiro gamepad conectado ────────────────────────────
  const scanGamepads = useCallback(() => {
    // navigator.getGamepads() pode retornar null em alguns browsers
    const gps = Array.from(navigator.getGamepads?.() ?? [])

    // Se o gamepad atual ainda está conectado, mantém
    if (gamepadIndexRef.current !== null) {
      const current = gps[gamepadIndexRef.current]
      if (current?.connected) return true   // ainda ok
      // Caiu — limpa
      gamepadIndexRef.current = null
      prevButtonsRef.current  = []
      for (let i = 0; i < laneCount; i++) {
        keysDownRef.current.delete(i)
        onLaneRelease(i)
      }
    }

    // Procura qualquer gamepad conectado
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

  // ── Poll principal (rAF) ───────────────────────────────────────────────────
  const pollGamepad = useCallback(() => {
    if (enabled && gamepadIndexRef.current !== null) {
      const gps = navigator.getGamepads?.() ?? []
      const gp  = gps[gamepadIndexRef.current]

      if (gp?.connected) {
        const bindings = customBindingsRef.current
        const buttons  = Array.from(gp.buttons).map(b => (typeof b === "object" ? b.pressed : Boolean(b)))

        // Lanes
        for (let lane = 0; lane < laneCount; lane++) {
          const btnIdx = bindings[lane]
          if (btnIdx === undefined || btnIdx >= buttons.length) continue
          const now = buttons[btnIdx]
          const was = prevButtonsRef.current[btnIdx] ?? false
          if (now && !was) { keysDownRef.current.add(lane); onLanePress(lane) }
          if (!now && was) { keysDownRef.current.delete(lane); onLaneRelease(lane) }
        }

        // Pause
        const pauseIdx = profileRef.current.pauseButton
        if (buttons[pauseIdx] && !(prevButtonsRef.current[pauseIdx] ?? false)) onPause()

        // Strum (D-pad + analógico)
        const axisY     = gp.axes[1] ?? 0
        const strumUp   = buttons[profileRef.current.strumUp]   ?? false
        const strumDown = buttons[profileRef.current.strumDown]  ?? false
        const axisTrig  = Math.abs(axisY) > 0.7
        const prevUp    = prevButtonsRef.current[profileRef.current.strumUp]   ?? false
        const prevDown  = prevButtonsRef.current[profileRef.current.strumDown]  ?? false
        if ((strumUp && !prevUp) || (strumDown && !prevDown) || axisTrig) {
          for (let lane = 0; lane < laneCount; lane++) {
            if (keysDownRef.current.has(lane)) onLanePress(lane)
          }
        }

        prevButtonsRef.current = buttons
      } else {
        // Gamepad desconectou silenciosamente
        scanGamepads()
      }
    }

    rafRef.current = requestAnimationFrame(pollGamepad)
  }, [enabled, onLanePress, onLaneRelease, onPause, keysDownRef, laneCount, scanGamepads])

  // ── Setup: eventos + polling de fallback para Bluetooth ───────────────────
  useEffect(() => {
    // Eventos nativos (USB / quando BT já estava pareado antes da página abrir)
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

    // Scan imediato — pega controles já conectados antes do mount
    scanGamepads()

    // Polling de fallback a 100ms — essencial para Bluetooth em Chrome/Android
    // O browser só "vê" o gamepad BT após a primeira interação do usuário,
    // então precisamos fazer re-scan frequentemente.
    const scanTimer = setInterval(scanGamepads, 100)

    // Re-scan quando a aba volta ao foco (usuário alt+tab ou desbloqueia tela)
    const onFocus      = () => scanGamepads()
    const onVisibility = () => { if (document.visibilityState === "visible") scanGamepads() }
    window.addEventListener("focus",                onFocus)
    document.addEventListener("visibilitychange",   onVisibility)

    // Inicia o loop de rAF
    rafRef.current = requestAnimationFrame(pollGamepad)

    return () => {
      clearInterval(scanTimer)
      window.removeEventListener("gamepadconnected",    onConnect)
      window.removeEventListener("gamepaddisconnected", onDisconnect)
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
