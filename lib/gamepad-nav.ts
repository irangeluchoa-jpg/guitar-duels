/**
 * gamepad-nav.ts — Navegação universal por controle e teclado
 * Botão verde (A/Cross) = confirmar, Vermelho (B/Circle) = cancelar/voltar
 * D-Pad / analógico esquerdo = navegar
 */

type NavCallback = (action: "up" | "down" | "left" | "right" | "confirm" | "cancel") => void

let _cb: NavCallback | null = null
let _rafId = 0
let _lastAxes = [0, 0]
let _lastButtons: boolean[] = []
let _axisThrottle = 0

const AXIS_DEAD = 0.4
const AXIS_THROTTLE_MS = 180

// Índices dos botões no padrão Xbox/PlayStation
const BTN_A = 0      // Verde / Cross — confirmar
const BTN_B = 1      // Vermelho / Circle — cancelar
const BTN_DPAD_UP = 12
const BTN_DPAD_DOWN = 13
const BTN_DPAD_LEFT = 14
const BTN_DPAD_RIGHT = 15

export function startGamepadNav(cb: NavCallback) {
  _cb = cb
  if (_rafId) return
  loop()
}

export function stopGamepadNav() {
  _cb = null
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = 0 }
}

function loop() {
  _rafId = requestAnimationFrame(loop)
  const gps = navigator.getGamepads?.()
  if (!gps) return
  const gp = Array.from(gps).find(g => g && g.connected)
  if (!gp || !_cb) return

  const now = performance.now()
  const btns = gp.buttons.map(b => b.pressed)

  // Botões digitais — dispara só na borda de subida
  const fire = (idx: number, action: Parameters<NavCallback>[0]) => {
    if (btns[idx] && !_lastButtons[idx]) _cb!(action)
  }
  fire(BTN_A, "confirm")
  fire(BTN_B, "cancel")
  fire(BTN_DPAD_UP, "up")
  fire(BTN_DPAD_DOWN, "down")
  fire(BTN_DPAD_LEFT, "left")
  fire(BTN_DPAD_RIGHT, "right")

  // Analógico esquerdo — throttle para não disparar muito rápido
  const ax = gp.axes[0] ?? 0
  const ay = gp.axes[1] ?? 0
  if (now - _axisThrottle > AXIS_THROTTLE_MS) {
    if (ay < -AXIS_DEAD && _lastAxes[1] >= -AXIS_DEAD) { _cb!("up");    _axisThrottle = now }
    if (ay >  AXIS_DEAD && _lastAxes[1] <=  AXIS_DEAD) { _cb!("down");  _axisThrottle = now }
    if (ax < -AXIS_DEAD && _lastAxes[0] >= -AXIS_DEAD) { _cb!("left");  _axisThrottle = now }
    if (ax >  AXIS_DEAD && _lastAxes[0] <=  AXIS_DEAD) { _cb!("right"); _axisThrottle = now }
  }

  _lastAxes = [ax, ay]
  _lastButtons = btns
}

/** Hook React simples para usar em qualquer componente */
export function useGamepadNav(cb: NavCallback | null) {
  if (typeof window === "undefined") return
  // Chamado a cada render — o caller deve memoizar o cb com useCallback
  if (cb) startGamepadNav(cb)
  else stopGamepadNav()
}
