"use client"

import { useEffect, useRef } from "react"
import { LANE_COLORS } from "@/lib/game/engine"

interface TouchLanesProps {
  laneCount: number
  onLanePress: (lane: number) => void
  onLaneRelease: (lane: number) => void
}

// Detecta se é dispositivo touch
function isTouchDevice() {
  return (typeof window !== "undefined") && ("ontouchstart" in window || navigator.maxTouchPoints > 0)
}

export function TouchLanes({ laneCount, onLanePress, onLaneRelease }: TouchLanesProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Mapa de touch.identifier → lane para multi-touch
  const activeTouches = useRef<Map<number, number>>(new Map())

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function getLaneFromX(x: number): number {
      const rect = el!.getBoundingClientRect()
      const relX = x - rect.left
      const lane = Math.floor((relX / rect.width) * laneCount)
      return Math.max(0, Math.min(laneCount - 1, lane))
    }

    function onTouchStart(e: TouchEvent) {
      e.preventDefault()
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i]
        const lane = getLaneFromX(t.clientX)
        activeTouches.current.set(t.identifier, lane)
        onLanePress(lane)
      }
    }

    function onTouchEnd(e: TouchEvent) {
      e.preventDefault()
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i]
        const lane = activeTouches.current.get(t.identifier)
        if (lane !== undefined) {
          onLaneRelease(lane)
          activeTouches.current.delete(t.identifier)
        }
      }
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault()
      // Atualiza lane se dedo deslizou para outra lane
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i]
        const prevLane = activeTouches.current.get(t.identifier)
        const newLane = getLaneFromX(t.clientX)
        if (prevLane !== undefined && prevLane !== newLane) {
          onLaneRelease(prevLane)
          activeTouches.current.set(t.identifier, newLane)
          onLanePress(newLane)
        }
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: false })
    el.addEventListener("touchend",   onTouchEnd,   { passive: false })
    el.addEventListener("touchcancel",onTouchEnd,   { passive: false })
    el.addEventListener("touchmove",  onTouchMove,  { passive: false })
    return () => {
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchend",   onTouchEnd)
      el.removeEventListener("touchcancel",onTouchEnd)
      el.removeEventListener("touchmove",  onTouchMove)
    }
  }, [laneCount, onLanePress, onLaneRelease])

  if (!isTouchDevice()) return null

  return (
    <div
      ref={containerRef}
      className="absolute bottom-0 left-0 right-0 z-20 flex select-none"
      style={{ height: "22%", touchAction: "none" }}
    >
      {Array.from({ length: laneCount }).map((_, i) => (
        <div
          key={i}
          className="flex-1 flex items-center justify-center relative"
          style={{
            borderTop: `2px solid ${LANE_COLORS[i]}55`,
            borderRight: i < laneCount - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
            background: `linear-gradient(180deg, ${LANE_COLORS[i]}08 0%, ${LANE_COLORS[i]}18 100%)`,
          }}
        >
          {/* Indicador visual da lane */}
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              background: `radial-gradient(circle, ${LANE_COLORS[i]}40, ${LANE_COLORS[i]}10)`,
              border: `1.5px solid ${LANE_COLORS[i]}60`,
              boxShadow: `0 0 16px ${LANE_COLORS[i]}30`,
            }}
          >
            <div
              className="w-5 h-5 rounded-full"
              style={{ background: LANE_COLORS[i], opacity: 0.7 }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
