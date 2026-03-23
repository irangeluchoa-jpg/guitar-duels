/**
 * use-nav.ts — Hook universal de navegação por teclado + controle
 * Usado em todas as telas de menu para suporte a gamepad e setas
 */
import { useEffect, useCallback, useRef } from "react"
import { startGamepadNav, stopGamepadNav } from "./gamepad-nav"

type NavAction = "up" | "down" | "left" | "right" | "confirm" | "cancel"

interface UseNavOptions {
  onUp?:      () => void
  onDown?:    () => void
  onLeft?:    () => void
  onRight?:   () => void
  onConfirm?: () => void
  onCancel?:  () => void
  /** Se true, ignora eventos quando um input/textarea está focado */
  ignoreWhenInputFocused?: boolean
  enabled?: boolean
}

export function useNav(opts: UseNavOptions) {
  const optsRef = useRef(opts)
  optsRef.current = opts

  const handleAction = useCallback((action: NavAction) => {
    const o = optsRef.current
    if (o.enabled === false) return
    // Ignorar quando input está focado
    if (o.ignoreWhenInputFocused !== false) {
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase()
      if (tag === "input" || tag === "textarea" || tag === "select") return
    }
    if (action === "up")      o.onUp?.()
    if (action === "down")    o.onDown?.()
    if (action === "left")    o.onLeft?.()
    if (action === "right")   o.onRight?.()
    if (action === "confirm") o.onConfirm?.()
    if (action === "cancel")  o.onCancel?.()
  }, [])

  // Gamepad
  useEffect(() => {
    startGamepadNav(handleAction)
    return () => stopGamepadNav()
  }, [handleAction])

  // Teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase()
      const inInput = tag === "input" || tag === "textarea" || tag === "select"

      if (e.key === "ArrowUp"    || (e.key === "w" && !inInput)) { e.preventDefault(); handleAction("up") }
      if (e.key === "ArrowDown"  || (e.key === "s" && !inInput)) { e.preventDefault(); handleAction("down") }
      if (e.key === "ArrowLeft"  || (e.key === "a" && !inInput)) { e.preventDefault(); handleAction("left") }
      if (e.key === "ArrowRight" || (e.key === "d" && !inInput)) { e.preventDefault(); handleAction("right") }
      if (e.key === "Enter"      && !inInput) { e.preventDefault(); handleAction("confirm") }
      if (e.key === "Escape")                 { e.preventDefault(); handleAction("cancel") }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [handleAction])
}
