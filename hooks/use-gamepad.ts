"use client"

/**
 * use-gamepad.ts
 * Suporte a qualquer controle via Gamepad API.
 *
 * Mapeamento padrão (Xbox / PlayStation / genérico):
 *  Lane 0 (Verde)   → botão 2  (X no Xbox / □ no PS)
 *  Lane 1 (Vermelho) → botão 1  (B no Xbox / ○ no PS)
 *  Lane 2 (Amarelo)  → botão 3  (Y no Xbox / △ no PS)
 *  Lane 3 (Azul)     → botão 0  (A no Xbox / × no PS)
 *  Lane 4 (Laranja)  → botão 5  (RB no Xbox / R1 no PS)
 *  Pause             → botão 9  (Start / Options)
 *  Strum Up          → botão 12 (D-pad cima) ou eixo Y negativo
 *  Strum Down        → botão 13 (D-pad baixo) ou eixo Y positivo
 *
 * O usuário pode remapear via interface de configurações.
 */

import { useEffect, useRef, useCallback } from "react"
import { loadSettings, saveSettings } from "@/lib/settings"

// Índices de botão padrão por lane
export const DEFAULT_GAMEPAD_BINDINGS = [2, 1, 3, 0, 5, 4]  // Verde, Vermelho, Amarelo, Azul, Laranja, Roxo
export const GAMEPAD_PAUSE_BUTTON    = 9
export const GAMEPAD_STRUM_UP        = 12
export const GAMEPAD_STRUM_DOWN      = 13

export type GamepadProfile = {
  name: string
  laneButtons: number[]   // índice do botão por lane
  strumUp: number         // botão de strum para cima
  strumDown: number       // botão de strum para baixo
  pauseButton: number
}

// Perfis conhecidos de controles GH / Rock Band
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
  return GAMEPAD_PROFILES[2]  // Xbox / genérico
}

interface UseGamepadOptions {
  onLanePress:    (lane: number) => void
  onLaneRelease:  (lane: number) => void
  onPause:        () => void
  keysDownRef:    React.MutableRefObject<Set<number>>
  enabled:        boolean
}

export function useGamepad({
  onLanePress, onLaneRelease, onPause, keysDownRef, enabled, laneCount = 5
}: UseGamepadOptions & { laneCount?: number }) {
  const gamepadIndexRef    = useRef<number | null>(null)
  const profileRef         = useRef<GamepadProfile>(GAMEPAD_PROFILES[2])
  const prevButtonsRef     = useRef<boolean[]>([])
  const rafRef             = useRef<number | null>(null)
  const connectedRef       = useRef(false)
  const customBindingsRef  = useRef<number[]>([...DEFAULT_GAMEPAD_BINDINGS])

  // Carrega mapeamento customizado do localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("guitar-duels-gamepad")
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed.laneButtons) && (parsed.laneButtons.length === 5 || parsed.laneButtons.length === 6))
          customBindingsRef.current = parsed.laneButtons
      }
    } catch {}
  }, [])

  const pollGamepad = useCallback(() => {
    if (!enabled) { rafRef.current = requestAnimationFrame(pollGamepad); return }

    const gamepads = navigator.getGamepads?.() ?? []
    const gp = gamepadIndexRef.current !== null ? gamepads[gamepadIndexRef.current] : null

    if (gp && gp.connected) {
      const profile  = profileRef.current
      const bindings = customBindingsRef.current
      const buttons  = gp.buttons.map(b => b.pressed)

      // ── Lanes ────────────────────────────────────────────────────────────
      for (let lane = 0; lane < laneCount; lane++) {
        const btnIdx = bindings[lane]
        if (btnIdx >= buttons.length) continue
        const nowPressed  = buttons[btnIdx]
        const wasPressed  = prevButtonsRef.current[btnIdx] ?? false

        if (nowPressed && !wasPressed) {
          keysDownRef.current.add(lane)
          onLanePress(lane)
        } else if (!nowPressed && wasPressed) {
          keysDownRef.current.delete(lane)
          onLaneRelease(lane)
        }
      }

      // ── Pause ─────────────────────────────────────────────────────────────
      const pauseIdx = profile.pauseButton
      if (buttons[pauseIdx] && !(prevButtonsRef.current[pauseIdx] ?? false)) {
        onPause()
      }

      // ── Strum (D-pad) + analógico ─────────────────────────────────────────
      // Strum apenas registra o hit se pelo menos um botão de lane estiver pressionado
      const strumUp   = buttons[profile.strumUp]   ?? false
      const strumDown = buttons[profile.strumDown]  ?? false
      const axisY     = gp.axes[1] ?? 0
      const strumByAxis = axisY < -0.7 || axisY > 0.7

      const prevStrumU = prevButtonsRef.current[profile.strumUp]   ?? false
      const prevStrumD = prevButtonsRef.current[profile.strumDown]  ?? false
      const didStrum   = (strumUp && !prevStrumU) || (strumDown && !prevStrumD) || strumByAxis

      if (didStrum) {
        // Dispara hit para todas as lanes pressionadas no momento do strum
        for (let lane = 0; lane < laneCount; lane++) {
          if (keysDownRef.current.has(lane)) onLanePress(lane)
        }
      }

      prevButtonsRef.current = buttons
    }

    rafRef.current = requestAnimationFrame(pollGamepad)
  }, [enabled, onLanePress, onLaneRelease, onPause, keysDownRef])

  // Conexão / desconexão — usa polling ativo para suportar Bluetooth
  // (eventos gamepadconnected não são confiáveis em conexões BT)
  useEffect(() => {
    const onConnect = (e: GamepadEvent) => {
      if (gamepadIndexRef.current !== null) return // já tem um
      gamepadIndexRef.current = e.gamepad.index
      profileRef.current      = detectProfile(e.gamepad.id)
      connectedRef.current    = true
      prevButtonsRef.current  = []
    }

    const onDisconnect = (e: GamepadEvent) => {
      if (e.gamepad.index === gamepadIndexRef.current) {
        gamepadIndexRef.current = null
        connectedRef.current    = false
        prevButtonsRef.current  = []
        for (let i = 0; i < 5; i++) {
          keysDownRef.current.delete(i)
          onLaneRelease(i)
        }
      }
    }

    window.addEventListener("gamepadconnected",    onConnect)
    window.addEventListener("gamepaddisconnected", onDisconnect)

    // Polling a cada 300ms — detecta Bluetooth e controles sem evento
    const scanInterval = setInterval(() => {
      const gps = navigator.getGamepads?.() ?? []
      // Detecta novo gamepad
      if (gamepadIndexRef.current === null) {
        for (let i = 0; i < gps.length; i++) {
          if (gps[i]?.connected) {
            gamepadIndexRef.current = i
            profileRef.current      = detectProfile(gps[i]!.id)
            connectedRef.current    = true
            prevButtonsRef.current  = []
            break
          }
        }
      } else {
        // Verifica se o atual ainda está conectado
        const gp = gps[gamepadIndexRef.current]
        if (!gp?.connected) {
          gamepadIndexRef.current = null
          connectedRef.current    = false
          prevButtonsRef.current  = []
          for (let i = 0; i < 5; i++) {
            keysDownRef.current.delete(i)
            onLaneRelease(i)
          }
        }
      }
    }, 300)

    // Verifica imediatamente
    const existing = navigator.getGamepads?.() ?? []
    for (let i = 0; i < existing.length; i++) {
      if (existing[i]?.connected) {
        gamepadIndexRef.current = i
        profileRef.current      = detectProfile(existing[i]!.id)
        connectedRef.current    = true
        break
      }
    }

    rafRef.current = requestAnimationFrame(pollGamepad)

    return () => {
      clearInterval(scanInterval)
      window.removeEventListener("gamepadconnected",    onConnect)
      window.removeEventListener("gamepaddisconnected", onDisconnect)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [pollGamepad, keysDownRef, onLaneRelease])

  return {
    isConnected: connectedRef.current,
    gamepadName: gamepadIndexRef.current !== null
      ? (navigator.getGamepads?.()?.[gamepadIndexRef.current]?.id ?? null)
      : null,
    profile: profileRef.current,
  }
}

/** Salva mapeamento customizado de botões */
export function saveGamepadBindings(laneButtons: number[]) {
  try {
    localStorage.setItem("guitar-duels-gamepad", JSON.stringify({ laneButtons }))
  } catch {}
}

/** Lê mapeamento salvo */
export function loadGamepadBindings(): number[] {
  try {
    const stored = localStorage.getItem("guitar-duels-gamepad")
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed.laneButtons) && (parsed.laneButtons.length === 5 || parsed.laneButtons.length === 6))
        return parsed.laneButtons
    }
  } catch {}
  return [...DEFAULT_GAMEPAD_BINDINGS]
}
