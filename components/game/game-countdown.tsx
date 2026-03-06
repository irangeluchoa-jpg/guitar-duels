"use client"

import { useEffect, useState, useRef } from "react"
import { playCountdownBeep, playGoSound } from "@/lib/game/sounds"
import { loadSettings } from "@/lib/settings"

export function GameCountdown({ count }: { count: number }) {
  const [animKey, setAnimKey] = useState(0)
  const [phase, setPhase]     = useState<"enter" | "hold" | "exit">("enter")
  const [shockwave, setShockwave] = useState(false)
  const prevCount = useRef(-1)

  useEffect(() => {
    if (count === prevCount.current) return
    prevCount.current = count

    const settings = loadSettings()
    const vol = (settings.masterVolume / 100) * (settings.sfxVolume / 100)

    setPhase("enter")
    setShockwave(false)
    setAnimKey(k => k + 1)

    if (count > 0) {
      playCountdownBeep(count, vol)
    } else {
      playGoSound(vol)
    }

    // Micro delay para shockwave
    const t1 = setTimeout(() => setShockwave(true), 30)
    const t2 = setTimeout(() => setPhase("hold"), 80)
    const t3 = setTimeout(() => setPhase("exit"), 700)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [count])

  const isGo = count === 0
  const color = isGo
    ? { main: "#f97316", sub: "#e11d48", glow: "rgba(249,115,22,0.9)" }
    : count === 1
    ? { main: "#e11d48", sub: "#f97316", glow: "rgba(225,29,72,0.9)" }
    : { main: "#ffffff", sub: "#e11d48", glow: "rgba(255,255,255,0.7)" }

  const subtitles: Record<number, string> = {
    3: "PREPARE-SE",
    2: "ATENÇÃO",
    1: "AGORA!",
    0: "BOA SORTE!",
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">

      {/* Overlay escurecido que pisca ao entrar */}
      <div
        key={`overlay-${animKey}`}
        className="absolute inset-0"
        style={{
          background: "rgba(0,0,0,0.55)",
          opacity: phase === "exit" ? 0 : 0.6,
          transition: phase === "exit" ? "opacity 0.3s ease-out" : "opacity 0.1s",
        }}
      />

      {/* Shockwave ring */}
      {shockwave && (
        <div
          key={`shock-${animKey}`}
          className="absolute rounded-full"
          style={{
            width: "8px",
            height: "8px",
            border: `3px solid ${color.main}`,
            boxShadow: `0 0 20px ${color.glow}, inset 0 0 10px ${color.glow}`,
            animation: "shockwave 0.55s ease-out forwards",
          }}
        />
      )}

      {/* Segundo shockwave (delay) */}
      {shockwave && (
        <div
          key={`shock2-${animKey}`}
          className="absolute rounded-full"
          style={{
            width: "8px",
            height: "8px",
            border: `1px solid ${color.main}60`,
            animation: "shockwave 0.7s ease-out 0.1s forwards",
          }}
        />
      )}

      {/* Container principal */}
      <div
        key={`main-${animKey}`}
        className="relative flex flex-col items-center gap-4"
        style={{
          transform: phase === "enter"
            ? "scale(1.6)"
            : phase === "hold"
            ? "scale(1)"
            : "scale(0.85)",
          opacity: phase === "exit" ? 0 : 1,
          transition: phase === "enter"
            ? "transform 0.12s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.08s"
            : phase === "hold"
            ? "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)"
            : "transform 0.25s ease-in, opacity 0.25s ease-in",
        }}
      >
        {isGo ? (
          <>
            {/* GO! */}
            <div className="relative">
              {/* Glow atrás */}
              <div
                className="absolute inset-0 blur-3xl rounded-full"
                style={{
                  background: `radial-gradient(circle, ${color.glow}, transparent 60%)`,
                  transform: "scale(2.5)",
                  opacity: 0.6,
                }}
              />
              <span
                className="relative text-8xl font-black tracking-tighter"
                style={{
                  background: `linear-gradient(135deg, #fbbf24, #f97316, #e11d48)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: `drop-shadow(0 0 40px rgba(249,115,22,0.9)) drop-shadow(0 4px 8px rgba(0,0,0,0.8))`,
                  fontFamily: "var(--font-mono, monospace)",
                  letterSpacing: "-0.05em",
                }}
              >
                GO!
              </span>
            </div>
            <span
              className="text-xs tracking-[0.6em] uppercase font-bold"
              style={{ color: "rgba(255,255,255,0.5)", letterSpacing: "0.6em" }}
            >
              {subtitles[0]}
            </span>
          </>
        ) : (
          <>
            {/* Número com anel */}
            <div className="relative flex items-center justify-center">
              {/* Anel SVG animado */}
              <svg
                width="160"
                height="160"
                className="absolute"
                style={{ transform: "rotate(-90deg)" }}
              >
                <circle
                  cx="80" cy="80" r="70"
                  fill="none"
                  stroke={`${color.main}15`}
                  strokeWidth="5"
                />
                <circle
                  cx="80" cy="80" r="70"
                  fill="none"
                  stroke={color.main}
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 70}`}
                  strokeDashoffset={`${2 * Math.PI * 70 * (1 - count / 3)}`}
                  style={{
                    transition: "stroke-dashoffset 0.9s linear",
                    filter: `drop-shadow(0 0 12px ${color.glow})`,
                  }}
                />
              </svg>

              {/* Número */}
              <div className="relative z-10 flex items-center justify-center">
                {/* Halo atrás do número */}
                <div
                  className="absolute rounded-full"
                  style={{
                    width: "100px",
                    height: "100px",
                    background: `radial-gradient(circle, ${color.main}20, transparent 70%)`,
                    filter: "blur(12px)",
                  }}
                />
                <span
                  className="text-9xl font-black relative"
                  style={{
                    color: color.main,
                    textShadow: `0 0 80px ${color.glow}, 0 0 30px ${color.glow}, 0 4px 16px rgba(0,0,0,0.8)`,
                    fontFamily: "var(--font-mono, monospace)",
                    lineHeight: 1,
                  }}
                >
                  {count}
                </span>
              </div>
            </div>

            {/* Subtítulo */}
            <span
              className="text-xs font-bold tracking-[0.6em] uppercase"
              style={{
                color: count === 1 ? color.main : "rgba(255,255,255,0.35)",
                textShadow: count === 1 ? `0 0 20px ${color.glow}` : "none",
                transition: "color 0.2s",
              }}
            >
              {subtitles[count] ?? ""}
            </span>
          </>
        )}
      </div>

      <style>{`
        @keyframes shockwave {
          0%   { transform: scale(1); opacity: 1; }
          100% { transform: scale(25); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
