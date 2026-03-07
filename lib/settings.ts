/**
 * settings.ts — utilitário central de configurações
 */

export interface GameSettings {
  masterVolume: number      // 0–100
  musicVolume: number       // 0–100
  sfxVolume: number         // 0–100
  noteSpeed: number         // 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2
  showGuide: boolean
  calibrationOffset: number // -100 a +100 ms
  keyBindings: string[]     // 6 teclas max, uma por lane
  keyboardEnabled: boolean  // ativa/desativa teclado
  gamepadEnabled: boolean   // ativa/desativa controle
}

export const DEFAULT_KEY_BINDINGS = ["a", "s", "d", "j", "k", "l"]

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 80,
  musicVolume: 100,
  sfxVolume: 100,
  noteSpeed: 1,
  showGuide: true,
  calibrationOffset: 0,
  keyBindings: [...DEFAULT_KEY_BINDINGS],
  keyboardEnabled: true,
  gamepadEnabled: true,
}

const KEY = "guitar-duels-settings"

export function loadSettings(): GameSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS, keyBindings: [...DEFAULT_KEY_BINDINGS] }
  try {
    const stored = localStorage.getItem(KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        // Garante que keyBindings sempre tem 5 teclas válidas
        keyBindings: Array.isArray(parsed.keyBindings) && (parsed.keyBindings.length === 5 || parsed.keyBindings.length === 6)
          ? parsed.keyBindings
          : [...DEFAULT_KEY_BINDINGS],
        keyboardEnabled: parsed.keyboardEnabled ?? true,
        gamepadEnabled:  parsed.gamepadEnabled  ?? true,
      }
    }
  } catch {}
  return { ...DEFAULT_SETTINGS, keyBindings: [...DEFAULT_KEY_BINDINGS] }
}

export function saveSettings(s: GameSettings): void {
  if (typeof window === "undefined") return
  localStorage.setItem(KEY, JSON.stringify(s))
}

/** Converte volume 0-100 para ganho 0.0-1.0 */
export function toGain(master: number, channel: number): number {
  return (master / 100) * (channel / 100)
}
