"use client"

import { useEffect, useRef } from "react"

interface Props {
  combo: number
  starPower: boolean
  isPlaying: boolean
  albumArt?: string
}

// Keyframes de animação do guitarrista (posições do corpo)
// Cada frame: [headX, headY, bodyTilt, armAngle, legSpread]
const IDLE_FRAMES = [
  { headBob: 0,   bodyTilt: 0,    armUp: 0,    legSpread: 0   },
  { headBob: -2,  bodyTilt: 0.5,  armUp: 2,    legSpread: 0   },
  { headBob: -3,  bodyTilt: 1,    armUp: 4,    legSpread: 0   },
  { headBob: -2,  bodyTilt: 0.5,  armUp: 2,    legSpread: 0   },
  { headBob: 0,   bodyTilt: 0,    armUp: 0,    legSpread: 0   },
  { headBob: 2,   bodyTilt: -0.5, armUp: -2,   legSpread: 0   },
  { headBob: 3,   bodyTilt: -1,   armUp: -4,   legSpread: 0   },
  { headBob: 2,   bodyTilt: -0.5, armUp: -2,   legSpread: 0   },
]

const ROCK_FRAMES = [
  { headBob: -6,  bodyTilt: -8,   armUp: 15,   legSpread: 8   },
  { headBob: -4,  bodyTilt: -4,   armUp: 8,    legSpread: 4   },
  { headBob: 0,   bodyTilt: 4,    armUp: -5,   legSpread: 6   },
  { headBob: 4,   bodyTilt: 8,    armUp: -15,  legSpread: 10  },
  { headBob: 6,   bodyTilt: 4,    armUp: -8,   legSpread: 8   },
  { headBob: 2,   bodyTilt: -4,   armUp: 5,    legSpread: 4   },
  { headBob: -4,  bodyTilt: -8,   armUp: 12,   legSpread: 8   },
  { headBob: -6,  bodyTilt: -4,   armUp: 6,    legSpread: 6   },
]

export function ArtistSilhouette({ combo, starPower, isPlaying, albumArt }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef  = useRef(0)
  const rafRef    = useRef<number>(0)
  const lastTick  = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const W = canvas.width, H = canvas.height

    const isRocking = combo >= 20 || starPower
    const frames    = isRocking ? ROCK_FRAMES : IDLE_FRAMES
    const fps       = isRocking ? 10 : 6

    function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

    function drawGuitarist(frame: typeof IDLE_FRAMES[0], alpha: number) {
      ctx.clearRect(0, 0, W, H)

      // Fundo: brilho suave atrás da silhueta
      if (starPower) {
        const grd = ctx.createRadialGradient(W*0.5, H*0.6, 10, W*0.5, H*0.6, W*0.55)
        grd.addColorStop(0, "rgba(0,255,220,0.12)")
        grd.addColorStop(1, "rgba(0,255,220,0)")
        ctx.fillStyle = grd
        ctx.fillRect(0, 0, W, H)
      } else if (combo >= 20) {
        const grd = ctx.createRadialGradient(W*0.5, H*0.6, 10, W*0.5, H*0.6, W*0.4)
        grd.addColorStop(0, "rgba(255,100,0,0.08)")
        grd.addColorStop(1, "rgba(255,100,0,0)")
        ctx.fillStyle = grd
        ctx.fillRect(0, 0, W, H)
      }

      const cx = W * 0.5
      const groundY = H * 0.92
      const scale   = H * 0.0045

      ctx.save()
      ctx.translate(cx, groundY)

      // Silhueta color
      const silColor = starPower
        ? `rgba(0,255,220,${0.55 + Math.sin(Date.now()*0.006)*0.15})`
        : combo >= 50
        ? `rgba(255,200,0,${0.45 + Math.sin(Date.now()*0.005)*0.1})`
        : combo >= 20
        ? `rgba(255,120,0,${0.40 + Math.sin(Date.now()*0.004)*0.08})`
        : `rgba(255,255,255,${0.18 + Math.sin(Date.now()*0.002)*0.03})`

      ctx.fillStyle = silColor
      ctx.strokeStyle = silColor

      const tilt = frame.bodyTilt * Math.PI / 180
      const hb   = frame.headBob
      const au   = frame.armUp
      const ls   = frame.legSpread

      // ── PERNAS ───────────────────────────────────────────────────────
      // Perna esquerda
      ctx.beginPath()
      ctx.moveTo(-8*scale, -20*scale)
      ctx.lineTo((-8-ls)*scale, 0)
      ctx.lineTo((-6-ls)*scale, 0)
      ctx.lineTo(-6*scale, -20*scale)
      ctx.closePath(); ctx.fill()

      // Perna direita
      ctx.beginPath()
      ctx.moveTo(8*scale, -20*scale)
      ctx.lineTo((8+ls)*scale, 0)
      ctx.lineTo((6+ls)*scale, 0)
      ctx.lineTo(6*scale, -20*scale)
      ctx.closePath(); ctx.fill()

      // ── CORPO (tronco) ────────────────────────────────────────────────
      ctx.save()
      ctx.rotate(tilt)
      ctx.beginPath()
      ctx.roundRect(-9*scale, -70*scale, 18*scale, 52*scale, 3*scale)
      ctx.fill()

      // ── BRAÇO COM GUITARRA ────────────────────────────────────────────
      const armRad = (au - 30) * Math.PI / 180
      // Braço direito (tocando)
      ctx.save()
      ctx.translate(9*scale, -60*scale)
      ctx.rotate(armRad)
      ctx.beginPath()
      ctx.roundRect(0, 0, 6*scale, 30*scale, 2*scale)
      ctx.fill()

      // Guitarra
      ctx.save()
      ctx.translate(2*scale, 28*scale)
      ctx.rotate(-0.3)
      // Corpo da guitarra
      ctx.beginPath()
      ctx.ellipse(0, 0, 10*scale, 14*scale, 0, 0, Math.PI*2)
      ctx.fill()
      // Cintura
      ctx.beginPath()
      ctx.ellipse(0, 2*scale, 6*scale, 4*scale, 0, 0, Math.PI*2)
      ctx.fillStyle = "rgba(0,0,0,0.4)"
      ctx.fill()
      ctx.fillStyle = silColor
      // Braço da guitarra
      ctx.beginPath()
      ctx.roundRect(-2*scale, -26*scale, 4*scale, 28*scale, 1*scale)
      ctx.fill()
      ctx.restore()
      ctx.restore()

      // Braço esquerdo (sustentando)
      ctx.save()
      ctx.translate(-9*scale, -60*scale)
      ctx.rotate(-armRad * 0.6)
      ctx.beginPath()
      ctx.roundRect(-6*scale, 0, 6*scale, 28*scale, 2*scale)
      ctx.fill()
      ctx.restore()

      // ── CABEÇA ────────────────────────────────────────────────────────
      ctx.save()
      ctx.translate(0, (-72 + hb) * scale)
      ctx.beginPath()
      ctx.ellipse(0, 0, 10*scale, 12*scale, 0, 0, Math.PI*2)
      ctx.fill()

      // Cabelo (bate cabeça no rock)
      if (isRocking) {
        ctx.beginPath()
        ctx.moveTo(-10*scale, -4*scale)
        ctx.bezierCurveTo(
          (-10 + hb * 0.8)*scale, (-14 + Math.abs(hb)*0.5)*scale,
          (hb * 1.2)*scale, (-18 + hb)*scale,
          (10 + hb)*scale, (-8 + hb*0.3)*scale
        )
        ctx.lineTo(8*scale, -4*scale)
        ctx.bezierCurveTo(
          (4 + hb*0.4)*scale, (-10)*scale,
          (-4 + hb*0.6)*scale, (-12)*scale,
          -10*scale, -4*scale
        )
        ctx.fill()
      }
      ctx.restore()

      ctx.restore() // tilt
      ctx.restore() // translate
    }

    let currentFrame = IDLE_FRAMES[0]
    let targetFrame  = IDLE_FRAMES[0]

    function tick(now: number) {
      const interval = 1000 / fps
      if (now - lastTick.current >= interval) {
        lastTick.current = now
        frameRef.current = (frameRef.current + 1) % frames.length
        targetFrame = frames[frameRef.current]
      }
      // Lerp suave entre frames
      currentFrame = {
        headBob:   lerp(currentFrame.headBob,   targetFrame.headBob,   0.25),
        bodyTilt:  lerp(currentFrame.bodyTilt,  targetFrame.bodyTilt,  0.25),
        armUp:     lerp(currentFrame.armUp,     targetFrame.armUp,     0.25),
        legSpread: lerp(currentFrame.legSpread, targetFrame.legSpread, 0.25),
      }
      drawGuitarist(currentFrame, 1)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [combo, starPower, isPlaying])

  if (!isPlaying) return null

  return (
    <div className="absolute pointer-events-none select-none"
      style={{
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: 110,
        height: 200,
        zIndex: 2,
        // Posicionado atrás da track mas na frente do background
        mixBlendMode: starPower ? "screen" : "normal",
      }}>
      <canvas
        ref={canvasRef}
        width={110}
        height={200}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  )
}
