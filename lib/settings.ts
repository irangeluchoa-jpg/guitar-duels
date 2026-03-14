/**
 * settings.ts — utilitário central de configurações
 */

export interface GameSettings {
  masterVolume: number
  musicVolume: number
  sfxVolume: number
  noteSpeed: number
  showGuide: boolean
  calibrationOffset: number
  keyBindings: string[]      // 6 teclas (modo 6 lanes)
  keyBindings4: string[]     // 4 teclas (modo fácil)
  keyBindings5: string[]     // 5 teclas (modo normal)
  keyboardEnabled: boolean
  gamepadEnabled: boolean
  highwayTheme: "default" | "neon" | "fire" | "space" | "wood" | "retro" | "ice"
  noteShape: "circle" | "square" | "diamond"
  cameraShake: boolean
  showArtist: boolean
  audioOutputDeviceId: string  // "" = default
}

export const DEFAULT_KEY_BINDINGS  = ["a", "s", "d", "j", "k", "l"]
export const DEFAULT_KEY_BINDINGS4 = ["a", "s", "d", "j"]
export const DEFAULT_KEY_BINDINGS5 = ["a", "s", "d", "j", "k"]

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 80,
  musicVolume: 100,
  sfxVolume: 100,
  noteSpeed: 1,
  showGuide: true,
  calibrationOffset: 0,
  keyBindings:  [...DEFAULT_KEY_BINDINGS],
  keyBindings4: [...DEFAULT_KEY_BINDINGS4],
  keyBindings5: [...DEFAULT_KEY_BINDINGS5],
  keyboardEnabled: true,
  gamepadEnabled: true,
  highwayTheme: "default",
  noteShape: "circle",
  cameraShake: true,
  showArtist: true,
  audioOutputDeviceId: "",
}

const KEY = "guitar-duels-settings"

export function loadSettings(): GameSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS }
  try {
    const stored = localStorage.getItem(KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        keyBindings:  Array.isArray(parsed.keyBindings)  && parsed.keyBindings.length  === 6 ? parsed.keyBindings  : [...DEFAULT_KEY_BINDINGS],
        keyBindings4: Array.isArray(parsed.keyBindings4) && parsed.keyBindings4.length === 4 ? parsed.keyBindings4 : [...DEFAULT_KEY_BINDINGS4],
        keyBindings5: Array.isArray(parsed.keyBindings5) && parsed.keyBindings5.length === 5 ? parsed.keyBindings5 : [...DEFAULT_KEY_BINDINGS5],
        keyboardEnabled: parsed.keyboardEnabled ?? true,
        gamepadEnabled:  parsed.gamepadEnabled  ?? true,
        highwayTheme:    (["default","neon","fire","space","wood","retro","ice"].includes(parsed.highwayTheme) ? parsed.highwayTheme : "default") as GameSettings["highwayTheme"],
        noteShape:       parsed.noteShape       ?? "circle",
        cameraShake:     parsed.cameraShake     ?? true,
        showArtist:      parsed.showArtist      ?? true,
        audioOutputDeviceId: parsed.audioOutputDeviceId ?? "",
      }
    }
  } catch {}
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(s: GameSettings): void {
  if (typeof window === "undefined") return
  localStorage.setItem(KEY, JSON.stringify(s))
}

/** Retorna as keybindings corretas para o número de lanes */
export function getKeyBindingsForLanes(s: GameSettings, laneCount: number): string[] {
  if (laneCount === 4) return s.keyBindings4
  if (laneCount === 5) return s.keyBindings5
  return s.keyBindings
}

export function toGain(master: number, channel: number): number {
  return (master / 100) * (channel / 100)
}
