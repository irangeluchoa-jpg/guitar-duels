import {
  LANE_COUNT, LANE_COLORS, LANE_LABELS, TIMING_MISS,
  type ActiveNote, type HitEffect, type GameStats,
} from "./engine"

// ── Layout ───────────────────────────────────────────────────────────────────
const VANISHING_Y_RATIO = 0.13
const HIT_LINE_Y_RATIO  = 0.83
const TRACK_WIDTH_RATIO = 0.62
const TRACK_WIDTH_TOP   = 0.13
const GLOW_DURATION     = 520
const NOTE_SPEED_BASE   = 0.55
const NOTE_RX_BASE      = 33
const NOTE_RY_BASE      = 11   // notas achatadas tipo GH:WT / GHL
const SUSTAIN_WIDTH     = 16
const STAR_POWER_COMBO  = 30

// ── Cache ──────────────────────────────────────────────────────────────────
let _fretNormal: OffscreenCanvas | null = null
let _fretStar:   OffscreenCanvas | null = null
let _fretW = 0, _fretH = 0

interface RenderState {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  notes: ActiveNote[]
  currentTime: number
  stats: GameStats
  hitEffects: HitEffect[]
  keysDown: Set<number>
  speed: number
  showGuide: boolean
  keyLabels?: string[]
  difficulty?: number
}

export function getHitLineY(h: number) { return h * HIT_LINE_Y_RATIO }

function project(lane: number, timeAhead: number, canvas: HTMLCanvasElement, noteSpeed: number) {
  const w = canvas.width, h = canvas.height
  const vanishY = h * VANISHING_Y_RATIO, hitY = h * HIT_LINE_Y_RATIO
  const maxMs = 2200 / noteSpeed
  const t = Math.min(timeAhead / maxMs, 1)
  const y = hitY - (hitY - vanishY) * Math.pow(t, 0.74)
  const progress = (hitY - y) / (hitY - vanishY)
  const trackW = w * TRACK_WIDTH_RATIO + (w * TRACK_WIDTH_TOP - w * TRACK_WIDTH_RATIO) * progress
  const laneW  = trackW / LANE_COUNT
  const x = (w - trackW) / 2 + lane * laneW + laneW / 2
  const scale = 1 - progress * 0.78
  return { x, y, scale }
}

function laneWidthAt(w: number, progress: number) {
  return (w * TRACK_WIDTH_RATIO + (w * TRACK_WIDTH_TOP - w * TRACK_WIDTH_RATIO) * progress) / LANE_COUNT
}

export function getLaneX(lane: number, cw: number) {
  const tw = cw * TRACK_WIDTH_RATIO
  return (cw - tw) / 2 + lane * (tw / LANE_COUNT) + (tw / LANE_COUNT) / 2
}
export function getLaneWidth(cw: number) { return (cw * TRACK_WIDTH_RATIO) / LANE_COUNT }

function shade(hex: string, amt: number) {
  const n = parseInt(hex.replace("#",""), 16)
  return `rgb(${Math.max(0,Math.min(255,(n>>16)+amt))},${Math.max(0,Math.min(255,((n>>8)&0xff)+amt))},${Math.max(0,Math.min(255,(n&0xff)+amt))})`
}

// ── Aranha vetorial no centro do fretboard ────────────────────────────────────
function drawSpider(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, alpha: number) {
  ctx.save(); ctx.globalAlpha = alpha
  const s = size

  // Corpo
  ctx.fillStyle = "#0a1a12"
  ctx.beginPath(); ctx.ellipse(cx, cy, s*0.18, s*0.24, 0, 0, Math.PI*2); ctx.fill()
  // Cabeça
  ctx.beginPath(); ctx.ellipse(cx, cy-s*0.30, s*0.13, s*0.13, 0, 0, Math.PI*2); ctx.fill()

  // 8 pernas
  const legDefs = [
    // [ângulo base, segmento 1 X, segmento 1 Y, segmento 2 X, segmento 2 Y]
    [-0.45, -0.45, -0.25, -0.75, -0.10],
    [-0.65, -0.50, -0.05, -0.85,  0.15],
    [-0.80, -0.48,  0.15, -0.78,  0.40],
    [-0.95, -0.42,  0.30, -0.65,  0.58],
    [ 0.45,  0.45, -0.25,  0.75, -0.10],
    [ 0.65,  0.50, -0.05,  0.85,  0.15],
    [ 0.80,  0.48,  0.15,  0.78,  0.40],
    [ 0.95,  0.42,  0.30,  0.65,  0.58],
  ]
  ctx.strokeStyle = "#0a1a12"; ctx.lineWidth = s * 0.025; ctx.lineCap = "round"
  for (const [, x1, y1, x2, y2] of legDefs) {
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + x1*s, cy + y1*s)
    ctx.lineTo(cx + x2*s, cy + y2*s)
    ctx.stroke()
  }

  // Padrão na barriga (teia simplificada)
  ctx.strokeStyle = "#0d2218"; ctx.lineWidth = s * 0.012
  ctx.beginPath(); ctx.ellipse(cx, cy, s*0.10, s*0.16, 0, 0, Math.PI*2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx, cy-s*0.16); ctx.lineTo(cx, cy+s*0.16); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx-s*0.10, cy); ctx.lineTo(cx+s*0.10, cy); ctx.stroke()

  ctx.restore()
}

// ── Fretboard: versão NORMAL (escuro com aranha) ───────────────────────────
function buildFretboard(w: number, h: number, starPower: boolean): OffscreenCanvas {
  const oc = new OffscreenCanvas(w, h)
  const ctx = oc.getContext("2d")!
  const vanishY = h * VANISHING_Y_RATIO, hitY = h * HIT_LINE_Y_RATIO
  const trackBot = w * TRACK_WIDTH_RATIO, trackTop = w * TRACK_WIDTH_TOP
  const tLB = (w-trackBot)/2, tRB = tLB+trackBot
  const tLT = (w-trackTop)/2, tRT = tLT+trackTop

  // Fundo preto
  ctx.fillStyle = "#000"; ctx.fillRect(0,0,w,h)

  // Recorte do fretboard
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(tLB,hitY); ctx.lineTo(tRB,hitY); ctx.lineTo(tRT,vanishY); ctx.lineTo(tLT,vanishY)
  ctx.closePath(); ctx.clip()

  if (starPower) {
    // ── STAR POWER: fundo cyano escuro com glow
    const bg = ctx.createLinearGradient(0,vanishY,0,hitY)
    bg.addColorStop(0, "rgba(0,20,30,0.98)")
    bg.addColorStop(0.4, "rgba(0,28,38,0.98)")
    bg.addColorStop(1, "rgba(0,35,45,0.99)")
    ctx.fillStyle = bg; ctx.fillRect(0,0,w,h)

    // Brilho cyano central
    const glow = ctx.createRadialGradient(w/2,(vanishY+hitY)/2,0,w/2,(vanishY+hitY)/2,trackBot*0.6)
    glow.addColorStop(0,"rgba(0,200,220,0.12)"); glow.addColorStop(1,"transparent")
    ctx.fillStyle=glow; ctx.fillRect(0,0,w,h)
  } else {
    // ── NORMAL: fundo escuro esverdeado/preto
    const bg = ctx.createLinearGradient(0,vanishY,0,hitY)
    bg.addColorStop(0, "rgba(5,10,8,0.98)")
    bg.addColorStop(0.4, "rgba(8,14,10,0.98)")
    bg.addColorStop(1, "rgba(12,18,14,0.99)")
    ctx.fillStyle = bg; ctx.fillRect(0,0,w,h)
  }

  // ── Textura de aranha — múltiplas repetindo em perspectiva ──────────────
  const spiderCount = 5
  for (let si = 0; si < spiderCount; si++) {
    const t = (si + 0.5) / spiderCount
    const y = vanishY + (hitY - vanishY) * t
    const progress = (hitY - y) / (hitY - vanishY)
    const tw = trackBot + (trackTop - trackBot) * progress
    const cx = w / 2
    const spiderSize = (tw * 0.55) * (1 - progress * 0.5)
    const spiderAlpha = starPower ? 0.30 : 0.22
    drawSpider(ctx, cx, y, spiderSize, spiderAlpha * (0.6 + (1-t)*0.4))
  }

  // ── Linhas horizontais da grade ─────────────────────────────────────────
  function edgeX(frac: number, y: number) {
    const prog = (hitY-y)/(hitY-vanishY), tw = trackBot+(trackTop-trackBot)*prog
    return (w-tw)/2+tw*frac
  }
  const gridColor = starPower ? "0,220,255" : "150,220,170"
  for (let r = 1; r < 9; r++) {
    const t = r/9
    const y = hitY-(hitY-vanishY)*Math.pow(t,0.74)
    const al = (1-t) * (starPower ? 0.35 : 0.22)
    ctx.beginPath(); ctx.moveTo(edgeX(0,y),y); ctx.lineTo(edgeX(1,y),y)
    ctx.strokeStyle=`rgba(${gridColor},${al})`; ctx.lineWidth=1; ctx.stroke()
  }

  // ── Divisores de lane ──────────────────────────────────────────────────
  const divColor = starPower ? "rgba(0,200,255,0.30)" : "rgba(80,160,100,0.22)"
  const borderColor = starPower ? "rgba(0,220,255,0.70)" : "rgba(0,200,80,0.55)"
  for (let i = 0; i <= LANE_COUNT; i++) {
    const bx = tLB+(trackBot/LANE_COUNT)*i, tx = tLT+(trackTop/LANE_COUNT)*i
    const border = i===0||i===LANE_COUNT
    ctx.beginPath(); ctx.moveTo(bx,hitY); ctx.lineTo(tx,vanishY)
    ctx.strokeStyle = border ? borderColor : divColor
    ctx.lineWidth = border?2:1; ctx.stroke()
  }

  // ── Bordas com glow ────────────────────────────────────────────────────
  ctx.save()
  ctx.shadowColor = starPower ? "rgba(0,220,255,0.90)" : "rgba(0,200,100,0.70)"
  ctx.shadowBlur = 18
  for (const [bx,tx] of [[tLB,tLT],[tRB,tRT]] as [number,number][]) {
    ctx.beginPath(); ctx.moveTo(bx,hitY); ctx.lineTo(tx,vanishY)
    ctx.strokeStyle = starPower ? "rgba(0,220,255,0.85)" : "rgba(0,220,110,0.72)"
    ctx.lineWidth=2; ctx.stroke()
  }
  ctx.shadowBlur=0; ctx.restore()

  ctx.restore() // unclip

  // ── Névoa no horizonte ─────────────────────────────────────────────────
  const fog = ctx.createLinearGradient(0,vanishY-8,0,vanishY+60)
  fog.addColorStop(0,"rgba(0,0,0,0.97)"); fog.addColorStop(1,"rgba(0,0,0,0)")
  ctx.fillStyle=fog; ctx.fillRect(0,vanishY-8,w,68)

  return oc
}

function getFretboard(w: number, h: number, starPower: boolean): OffscreenCanvas {
  if (starPower) {
    if (_fretStar && _fretW===w && _fretH===h) return _fretStar
    _fretStar = buildFretboard(w,h,true); _fretW=w; _fretH=h; return _fretStar
  } else {
    if (_fretNormal && _fretW===w && _fretH===h) return _fretNormal
    _fretNormal = buildFretboard(w,h,false); _fretW=w; _fretH=h; return _fretNormal
  }
}

// ── Star Power: raios na hit line + bordas laterais da TELA ─────────────────
function drawStarPowerLightning(ctx: CanvasRenderingContext2D, w: number, h: number, now: number, combo: number) {
  if (combo < STAR_POWER_COMBO) return
  const intensity = Math.min(1, (combo-STAR_POWER_COMBO)/25)
  const hitY = h*HIT_LINE_Y_RATIO
  const tBot = w*TRACK_WIDTH_RATIO, tL=(w-tBot)/2, tR=tL+tBot
  const t = now*0.001
  ctx.save()

  // ── Glow cyano na hit line ─────────────────────────────────────────────
  const hGlow=ctx.createLinearGradient(tL,0,tR,0)
  hGlow.addColorStop(0,"transparent")
  hGlow.addColorStop(0.08,`rgba(0,220,255,${0.25*intensity})`)
  hGlow.addColorStop(0.5,`rgba(0,255,255,${0.65*intensity})`)
  hGlow.addColorStop(0.92,`rgba(0,220,255,${0.25*intensity})`)
  hGlow.addColorStop(1,"transparent")
  ctx.fillStyle=hGlow; ctx.fillRect(tL,hitY-6,tBot,12)

  ctx.beginPath(); ctx.moveTo(tL,hitY); ctx.lineTo(tR,hitY)
  ctx.strokeStyle=`rgba(0,255,255,${0.75*intensity})`; ctx.lineWidth=2.5
  ctx.shadowColor="rgba(0,220,255,0.95)"; ctx.shadowBlur=16*intensity
  ctx.stroke(); ctx.shadowBlur=0

  // ── Raios pequenos nas bordas do fretboard (hit line) ─────────────────
  const numBolts = 3+Math.floor(intensity*5)
  for (let b=0; b<numBolts; b++) {
    const side=b%2===0, phase=t*2.8+b*1.7
    const boltH=50+Math.sin(phase)*20+b*6
    const startX=side?tL-2:tR+2, sDir=side?-1:1
    ctx.beginPath(); let bx=startX, by=hitY; ctx.moveTo(bx,by)
    for (let s=0; s<7; s++) {
      const frac=(s+1)/7
      bx=startX+sDir*(8+frac*18)*intensity+Math.sin(phase+s*3.7)*10*intensity
      by=hitY-frac*boltH+Math.cos(phase*0.7+s*2.1)*7
      ctx.lineTo(bx,by)
      if (s===3&&Math.sin(phase+b)>0.3) {
        ctx.moveTo(bx,by); ctx.lineTo(bx+sDir*7+Math.sin(phase)*5,by-10); ctx.moveTo(bx,by)
      }
    }
    const bc=side?"0,200,255":"120,80,255"
    ctx.strokeStyle=`rgba(${bc},${0.75*intensity})`
    ctx.lineWidth=0.8+Math.abs(Math.sin(phase))*1.5
    ctx.shadowColor=`rgba(${bc},0.9)`; ctx.shadowBlur=10*intensity; ctx.stroke(); ctx.shadowBlur=0
  }

  // ── Partículas na hit line ─────────────────────────────────────────────
  for (let p=0; p<8; p++) {
    const px=tL+(tBot/8)*(p+0.5)+Math.sin(t*1.5+p*0.8)*6
    const py=hitY+Math.cos(t*2+p*1.1)*4-2
    const pr=(1+Math.abs(Math.sin(t*3+p))*2)*intensity
    ctx.beginPath(); ctx.arc(px,py,pr,0,Math.PI*2)
    ctx.fillStyle=`rgba(0,220,255,${(0.5+Math.abs(Math.sin(t*2+p*0.7))*0.4)*intensity})`
    ctx.shadowColor="rgba(0,220,255,0.9)"; ctx.shadowBlur=8; ctx.fill(); ctx.shadowBlur=0
  }

  // ── RAIOS VERTICAIS NAS BORDAS DA TELA (direita e esquerda) ───────────
  const sideCount = 2+Math.floor(intensity*3)
  for (let side=0; side<2; side++) {
    const isLeft=side===0, edgeX=isLeft?0:w
    for (let b=0; b<sideCount; b++) {
      const phase=t*1.8+b*2.1+side*3.7
      const startY=h+20, endY=h*(0.04+Math.sin(phase*0.4+b)*0.08)
      const xDir=isLeft?1:-1
      ctx.beginPath(); let bx=edgeX, by=startY; ctx.moveTo(bx,by)
      for (let s=0; s<14; s++) {
        const frac=(s+1)/14
        const spread=xDir*(10+frac*30)*intensity
        const noise=Math.sin(phase*1.3+s*2.7)*14*intensity
        const noiseY=Math.cos(phase*0.9+s*1.8)*6
        bx=edgeX+spread+noise; by=startY-frac*(startY-endY)+noiseY
        ctx.lineTo(bx,by)
        if (s%4===2&&Math.sin(phase*2+s)>0.4) {
          ctx.moveTo(bx,by)
          ctx.lineTo(bx+xDir*(8+Math.abs(Math.sin(phase+s))*18),by+(Math.sin(phase+s)>0?-16:10))
          ctx.moveTo(bx,by)
        }
      }
      const bc=(b+side)%2===0?"0,220,255":"100,60,255"
      ctx.strokeStyle=`rgba(${bc},${(0.55+Math.abs(Math.sin(phase))*0.35)*intensity})`
      ctx.lineWidth=0.7+Math.abs(Math.sin(phase+b))*1.8
      ctx.shadowColor=`rgba(${bc},0.95)`; ctx.shadowBlur=14*intensity; ctx.stroke(); ctx.shadowBlur=0
    }
  }

  // Faíscas nas bordas laterais
  for (let side=0; side<2; side++) {
    const isLeft=side===0
    for (let p=0; p<5; p++) {
      const phase=t*2.2+p*1.4+side*2.9
      const px=isLeft?Math.abs(Math.sin(phase))*40*intensity:w-Math.abs(Math.sin(phase))*40*intensity
      const py=h*(0.10+((p*0.19+Math.sin(phase*0.6))%0.85))
      const pr=(1.5+Math.abs(Math.sin(phase*1.8))*3)*intensity
      ctx.beginPath(); ctx.arc(px,py,pr,0,Math.PI*2)
      ctx.fillStyle=`rgba(0,230,255,${(0.5+Math.abs(Math.sin(phase*2.5))*0.45)*intensity})`
      ctx.shadowColor="rgba(0,200,255,0.9)"; ctx.shadowBlur=10*intensity; ctx.fill(); ctx.shadowBlur=0
    }
  }

  // Glow ambiente lateral
  const lG=ctx.createLinearGradient(0,0,w*0.18,0)
  lG.addColorStop(0,`rgba(0,180,255,${0.14*intensity})`); lG.addColorStop(1,"transparent")
  ctx.fillStyle=lG; ctx.fillRect(0,0,w*0.18,h)
  const rG=ctx.createLinearGradient(w*0.82,0,w,0)
  rG.addColorStop(0,"transparent"); rG.addColorStop(1,`rgba(0,180,255,${0.14*intensity})`)
  ctx.fillStyle=rG; ctx.fillRect(w*0.82,0,w*0.18,h)

  ctx.restore()
}

// ── Nota estilo GH:WT — disco achatado com aro metálico + chama embaixo ──────
function drawNoteGH(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  rx: number, ry: number,
  color: string,
  starPower: boolean,
  now: number
) {
  const sp = starPower
  const c  = sp ? "#00ddff" : color

  ctx.save()

  // ── Sombra/reflexo projetado no fretboard ────────────────────────────
  ctx.save(); ctx.globalAlpha=0.22
  ctx.beginPath(); ctx.ellipse(x, y+ry*0.4, rx*0.85, ry*0.3, 0, 0, Math.PI*2)
  ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fill(); ctx.restore()

  // ── Glow externo ──────────────────────────────────────────────────────
  ctx.shadowColor = sp ? "#00ffff" : c
  ctx.shadowBlur  = sp ? 22 : 16

  // ── Base escura (profundidade do disco) ───────────────────────────────
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI*2)
  ctx.fillStyle = shade(c, -70); ctx.fill()

  // ── Corpo principal — gradiente radial plano tipo GH:WT ───────────────
  const bodyG = ctx.createRadialGradient(x-rx*0.22, y-ry*0.40, ry*0.02, x, y, rx*1.05)
  bodyG.addColorStop(0, sp ? "#aaffff" : "#ffffff")
  bodyG.addColorStop(0.15, c)
  bodyG.addColorStop(0.6,  sp ? "#006688" : shade(c, -25))
  bodyG.addColorStop(1,    shade(c, -60))
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI*2)
  ctx.fillStyle = bodyG; ctx.fill()
  ctx.shadowBlur = 0

  // ── Aro metálico externo (característico do GH:WT) ────────────────────
  ctx.beginPath(); ctx.ellipse(x, y, rx+1.5, ry+1.5, 0, 0, Math.PI*2)
  ctx.strokeStyle = sp ? "rgba(0,255,255,0.95)" : "rgba(200,200,200,0.85)"
  ctx.lineWidth = 2.5; ctx.stroke()

  // ── Aro interno fino ──────────────────────────────────────────────────
  ctx.beginPath(); ctx.ellipse(x, y, rx*0.72, ry*0.72, 0, 0, Math.PI*2)
  ctx.strokeStyle = sp ? "rgba(0,220,255,0.50)" : "rgba(255,255,255,0.35)"
  ctx.lineWidth = 1; ctx.stroke()

  // ── Reflexo oval branco no topo (shine) ───────────────────────────────
  ctx.save()
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI*2); ctx.clip()
  const shineG = ctx.createRadialGradient(x-rx*0.20, y-ry*0.42, 0, x-rx*0.05, y-ry*0.10, rx*0.70)
  shineG.addColorStop(0, "rgba(255,255,255,0.92)")
  shineG.addColorStop(0.30, "rgba(255,255,255,0.25)")
  shineG.addColorStop(1, "transparent")
  ctx.fillStyle=shineG; ctx.fill(); ctx.restore()

  // ── Chama/glow embaixo da nota (igual às imagens GH:WT) ───────────────
  const flameY = y + ry + 2
  const flameH = ry * 2.8
  const t = now * 0.003
  const flicker = 0.7 + Math.sin(t + x*0.05) * 0.3

  const flameG = ctx.createRadialGradient(x, flameY, 0, x, flameY, rx*flicker)
  flameG.addColorStop(0, sp ? `rgba(0,255,255,0.85)` : `rgba(255,255,255,0.90)`)
  flameG.addColorStop(0.3, sp ? `rgba(0,200,255,0.55)` : c + "88")
  flameG.addColorStop(1, "transparent")
  ctx.fillStyle = flameG
  ctx.beginPath(); ctx.ellipse(x, flameY, rx*0.55*flicker, flameH*0.45, 0, 0, Math.PI*2); ctx.fill()

  // Pingo central de luz
  ctx.beginPath(); ctx.arc(x, y+ry+1, rx*0.15, 0, Math.PI*2)
  ctx.fillStyle = sp ? "rgba(0,255,255,0.95)" : "rgba(255,255,255,0.95)"
  ctx.shadowColor = sp ? "#00ffff" : c; ctx.shadowBlur = 12
  ctx.fill(); ctx.shadowBlur=0

  ctx.restore()
}

// ── Hit target estilo GH:WT (anel duplo + chama ao pressionar) ───────────────
function drawHitTarget(
  ctx: CanvasRenderingContext2D,
  x: number, hitY: number,
  color: string, pressed: boolean,
  starPower: boolean, now: number
) {
  const sp = starPower
  const c  = sp ? "#00ccff" : color
  const rx = NOTE_RX_BASE + 5, ry = NOTE_RY_BASE + 5
  const t  = now * 0.003
  ctx.save()

  if (pressed) {
    // ── Glow forte ao pressionar ─────────────────────────────────────
    ctx.shadowColor = c; ctx.shadowBlur = sp ? 45 : 35
    const grd = ctx.createRadialGradient(x, hitY, 0, x, hitY, rx*3)
    grd.addColorStop(0, c+"44"); grd.addColorStop(1, "transparent")
    ctx.fillStyle=grd; ctx.beginPath(); ctx.ellipse(x,hitY,rx*3,ry*3,0,0,Math.PI*2); ctx.fill()
    ctx.shadowBlur=0
  }

  // ── Aro externo grande (característico GH:WT) ─────────────────────────
  ctx.beginPath(); ctx.ellipse(x, hitY, rx+8, ry+8, 0, 0, Math.PI*2)
  ctx.strokeStyle = pressed ? c : (sp ? "rgba(0,180,255,0.55)" : "rgba(255,255,255,0.20)")
  ctx.lineWidth = pressed ? 2.5 : 1.5; ctx.stroke()

  // ── Aro médio ──────────────────────────────────────────────────────────
  ctx.beginPath(); ctx.ellipse(x, hitY, rx+2, ry+2, 0, 0, Math.PI*2)
  ctx.strokeStyle = pressed ? c : (sp ? "rgba(0,200,255,0.65)" : "rgba(255,255,255,0.30)")
  ctx.lineWidth = pressed ? 3 : 2; ctx.stroke()

  // ── Corpo central ──────────────────────────────────────────────────────
  ctx.beginPath(); ctx.ellipse(x, hitY, rx, ry, 0, 0, Math.PI*2)
  if (pressed) {
    const fillG = ctx.createRadialGradient(x-rx*0.2, hitY-ry*0.4, 0, x, hitY, rx)
    fillG.addColorStop(0, "#ffffff"); fillG.addColorStop(0.3, c); fillG.addColorStop(1, shade(c,-40))
    ctx.fillStyle = fillG
  } else {
    ctx.fillStyle = sp ? "rgba(0,15,25,0.95)" : "rgba(5,5,5,0.95)"
  }
  ctx.fill()

  // ── Aro colorido interno ────────────────────────────────────────────────
  ctx.beginPath(); ctx.ellipse(x, hitY, rx, ry, 0, 0, Math.PI*2)
  ctx.strokeStyle = c + (pressed ? "ee" : "55")
  ctx.lineWidth = pressed ? 3 : 1.5; ctx.stroke()

  // ── Shine ao pressionar ─────────────────────────────────────────────────
  if (pressed) {
    ctx.save(); ctx.beginPath(); ctx.ellipse(x,hitY,rx,ry,0,0,Math.PI*2); ctx.clip()
    const sh = ctx.createRadialGradient(x-rx*0.22,hitY-ry*0.44,0,x,hitY,rx*0.85)
    sh.addColorStop(0,"rgba(255,255,255,0.90)"); sh.addColorStop(0.4,"rgba(255,255,255,0.15)"); sh.addColorStop(1,"transparent")
    ctx.fillStyle=sh; ctx.fill(); ctx.restore()
  }

  // ── Chamas saindo dos targets (como nas imagens) ───────────────────────
  if (pressed || sp) {
    const flameAlpha = pressed ? 0.9 : (0.4 + Math.sin(t+x*0.01)*0.2)
    const flameColor = sp ? "0,220,255" : (
      color==="#22c55e" ? "50,255,100" :
      color==="#ef4444" ? "255,80,50" :
      color==="#eab308" ? "255,220,0" :
      color==="#3b82f6" ? "80,150,255" : "255,140,30"
    )
    const flicker = 0.7 + Math.sin(t*2.5+x*0.02)*0.3

    for (let f=0; f<2; f++) {
      const fh = (ry*3 + Math.sin(t*3+f*2)*ry) * flicker
      const fw = rx * (0.4-f*0.15) * flicker
      const fy = hitY + ry + 2
      const flG = ctx.createLinearGradient(x, fy+fh, x, fy)
      flG.addColorStop(0, `rgba(${flameColor},0)`)
      flG.addColorStop(0.4, `rgba(${flameColor},${flameAlpha*0.6})`)
      flG.addColorStop(1, `rgba(255,255,255,${flameAlpha*0.9})`)
      ctx.fillStyle=flG
      ctx.beginPath()
      ctx.moveTo(x-fw, fy)
      ctx.quadraticCurveTo(x-fw*0.5+Math.sin(t+f)*fw*0.3, fy+fh*0.5, x+Math.sin(t*1.2+f)*fw*0.2, fy+fh)
      ctx.quadraticCurveTo(x+fw*0.5+Math.sin(t+f+1)*fw*0.3, fy+fh*0.5, x+fw, fy)
      ctx.closePath(); ctx.fill()
    }
  }

  // Label tecla
  return { rx, ry }
}

// ── Feixe de luz vertical ao acertar (imagem 3) ──────────────────────────────
function drawLightBeam(ctx: CanvasRenderingContext2D, x: number, hitY: number, h: number, color: string, progress: number, alpha: number) {
  ctx.save()
  const beamH = hitY * 0.95
  const bw    = 18 * (1-progress*0.5)

  const beamG = ctx.createLinearGradient(x, hitY, x, hitY-beamH)
  beamG.addColorStop(0, color + Math.round(alpha*220).toString(16).padStart(2,"0"))
  beamG.addColorStop(0.3, color + Math.round(alpha*180).toString(16).padStart(2,"0"))
  beamG.addColorStop(0.7, color + Math.round(alpha*80).toString(16).padStart(2,"0"))
  beamG.addColorStop(1, "transparent")

  ctx.shadowColor = color; ctx.shadowBlur = 24*(1-progress)
  ctx.fillStyle = beamG
  ctx.beginPath()
  ctx.moveTo(x-bw, hitY)
  ctx.lineTo(x-bw*0.2, hitY-beamH)
  ctx.lineTo(x+bw*0.2, hitY-beamH)
  ctx.lineTo(x+bw, hitY)
  ctx.closePath(); ctx.fill()
  ctx.shadowBlur=0; ctx.restore()
}

// ── Explosão ao acertar ───────────────────────────────────────────────────────
function drawHitExplosion(
  ctx: CanvasRenderingContext2D, x: number, hitY: number,
  color: string, progress: number, alpha: number, rating: string,
  rx: number, ry: number
) {
  const isPerfect=rating==="perfect", isGreat=rating==="great", isGood=rating==="good"
  ctx.save()

  if (progress<0.18) {
    const fp=progress/0.18, fR=rx*4.5*fp
    const flash=ctx.createRadialGradient(x,hitY,0,x,hitY,fR)
    flash.addColorStop(0,`rgba(255,255,255,${(1-fp)*0.95})`)
    flash.addColorStop(0.35,color+Math.round((1-fp)*200).toString(16).padStart(2,"0"))
    flash.addColorStop(1,"transparent"); ctx.fillStyle=flash
    ctx.beginPath(); ctx.ellipse(x,hitY,fR,fR*0.55,0,0,Math.PI*2); ctx.fill()
  }

  const ringCount=isPerfect?5:isGreat?4:3
  for (let ring=0; ring<ringCount; ring++) {
    const rp=Math.min(progress+ring*0.09,1), ra=Math.max(0,(1-rp)*alpha*0.90)
    const hexA=Math.round(ra*235).toString(16).padStart(2,"0")
    ctx.beginPath(); ctx.ellipse(x,hitY,rx*(1.2+rp*3.6),ry*(1.2+rp*3.2),0,0,Math.PI*2)
    ctx.strokeStyle=(isPerfect?"#fbbf24":isGreat?"#22c55e":color)+hexA
    ctx.lineWidth=Math.max(0.3,(4-ring*0.6)*(1-rp)); ctx.stroke()
  }

  const numSparks=isPerfect?20:isGreat?15:isGood?10:7
  const sparkSpeed=isPerfect?4.5:isGreat?3.5:2.8
  for (let p=0; p<numSparks; p++) {
    const angle=(p/numSparks)*Math.PI*2+progress*0.3
    const dist=rx*(1.2+progress*sparkSpeed)
    const px=x+Math.cos(angle)*dist, py=hitY+Math.sin(angle)*dist*0.52
    if (progress>0.05) {
      const pd=rx*(1.2+(progress-0.05)*sparkSpeed)
      const ppx=x+Math.cos(angle)*pd, ppy=hitY+Math.sin(angle)*pd*0.52
      ctx.beginPath(); ctx.moveTo(ppx,ppy); ctx.lineTo(px,py)
      ctx.strokeStyle=(isPerfect?"#fbbf24":color)+Math.round(alpha*130).toString(16).padStart(2,"0")
      ctx.lineWidth=2; ctx.stroke()
    }
    const pr=Math.max(0,(isPerfect?6.5:isGreat?5:4)*(1-progress)*alpha)
    ctx.beginPath(); ctx.arc(px,py,pr,0,Math.PI*2)
    ctx.fillStyle=isPerfect?"#fbbf24":isGreat?"#22c55e":color
    ctx.shadowColor=isPerfect?"#fbbf24":color; ctx.shadowBlur=7; ctx.fill(); ctx.shadowBlur=0
  }

  if (isPerfect&&progress<0.72) {
    const t=performance.now()*0.003
    for (let s=0; s<6; s++) {
      const ang=(s/6)*Math.PI*2+t*1.8, dist=rx*(2.0+progress*5.2)
      const sx=x+Math.cos(ang)*dist, sy=hitY+Math.sin(ang)*dist*0.58
      const sr=Math.max(0,7*(1-progress/0.72)); if (sr<0.5) continue
      ctx.save(); ctx.translate(sx,sy); ctx.rotate(t*2.5+s*1.04)
      ctx.beginPath()
      for (let pt=0; pt<4; pt++) {
        const a=(pt/4)*Math.PI*2
        pt===0?ctx.moveTo(Math.cos(a)*sr*2.2,Math.sin(a)*sr*2.2):ctx.lineTo(Math.cos(a)*sr*2.2,Math.sin(a)*sr*2.2)
        ctx.lineTo(Math.cos(a+Math.PI/4)*sr*0.5,Math.sin(a+Math.PI/4)*sr*0.5)
      }
      ctx.closePath()
      ctx.fillStyle="#fbbf24"+Math.round(alpha*225).toString(16).padStart(2,"0")
      ctx.shadowColor="#fbbf24"; ctx.shadowBlur=12; ctx.fill(); ctx.shadowBlur=0; ctx.restore()
    }
  }
  ctx.restore()
}


// ── Guitarra decorativa por dificuldade (canto superior esquerdo) ─────────────
// diff 0-1 = Explorer (fácil), 2-3 = SG (médio), 4-5 = Les Paul (difícil), 6 = Flying V (expert)
function drawGuitarSilhouette(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, diff: number, now: number) {
  ctx.save()
  const s = size
  const t = now * 0.001
  // Cor da guitarra muda com dificuldade
  const colors = ["#22c55e","#22c55e","#eab308","#eab308","#f97316","#f97316","#ef4444"]
  const glows  = ["rgba(34,197,94,0.7)","rgba(34,197,94,0.7)","rgba(234,179,8,0.7)","rgba(234,179,8,0.7)","rgba(249,115,22,0.7)","rgba(249,115,22,0.7)","rgba(239,68,68,0.7)"]
  const col   = colors[Math.min(diff, 6)]
  const glow  = glows[Math.min(diff, 6)]
  const pulse = 0.85 + Math.sin(t * 2.2) * 0.15

  ctx.shadowColor = glow; ctx.shadowBlur = 10 * pulse
  ctx.fillStyle   = col
  ctx.strokeStyle = "rgba(255,255,255,0.55)"
  ctx.lineWidth   = 1

  if (diff <= 1) {
    // Explorer (angular, fácil)
    ctx.beginPath()
    ctx.moveTo(x,        y + s*0.00)
    ctx.lineTo(x + s*0.30, y + s*0.18)
    ctx.lineTo(x + s*0.55, y + s*0.10)
    ctx.lineTo(x + s*0.60, y + s*0.30)
    ctx.lineTo(x + s*0.38, y + s*0.45)
    ctx.lineTo(x + s*0.35, y + s*0.95)
    ctx.lineTo(x + s*0.25, y + s*0.95)
    ctx.lineTo(x + s*0.22, y + s*0.48)
    ctx.lineTo(x,        y + s*0.38)
    ctx.closePath()
    ctx.fill(); ctx.stroke()
    // Cordas
    for (let i = 0; i < 4; i++) {
      const cx2 = x + s*0.27 + i*s*0.025
      ctx.beginPath(); ctx.moveTo(cx2, y+s*0.48); ctx.lineTo(cx2, y+s*0.90)
      ctx.strokeStyle=`rgba(255,255,255,0.35)`; ctx.lineWidth=0.5; ctx.stroke()
    }
  } else if (diff <= 3) {
    // SG (cornos duplos, médio)
    ctx.beginPath()
    ctx.moveTo(x + s*0.10, y + s*0.00)
    ctx.lineTo(x + s*0.45, y + s*0.20)
    ctx.lineTo(x + s*0.65, y + s*0.08)
    ctx.lineTo(x + s*0.70, y + s*0.28)
    ctx.lineTo(x + s*0.50, y + s*0.42)
    ctx.lineTo(x + s*0.48, y + s*0.95)
    ctx.lineTo(x + s*0.28, y + s*0.95)
    ctx.lineTo(x + s*0.25, y + s*0.42)
    ctx.lineTo(x + s*0.00, y + s*0.30)
    ctx.lineTo(x + s*0.05, y + s*0.12)
    ctx.closePath()
    ctx.fill(); ctx.stroke()
    for (let i = 0; i < 4; i++) {
      const cx2 = x + s*0.30 + i*s*0.028
      ctx.beginPath(); ctx.moveTo(cx2, y+s*0.46); ctx.lineTo(cx2, y+s*0.90)
      ctx.strokeStyle=`rgba(255,255,255,0.35)`; ctx.lineWidth=0.5; ctx.stroke()
    }
  } else if (diff <= 5) {
    // Les Paul (curvas suaves, difícil)
    ctx.beginPath()
    ctx.moveTo(x + s*0.30, y + s*0.00)
    ctx.bezierCurveTo(x+s*0.60, y+s*0.00, x+s*0.72, y+s*0.18, x+s*0.68, y+s*0.35)
    ctx.bezierCurveTo(x+s*0.65, y+s*0.48, x+s*0.55, y+s*0.50, x+s*0.50, y+s*0.50)
    ctx.lineTo(x + s*0.48, y + s*0.95)
    ctx.lineTo(x + s*0.28, y + s*0.95)
    ctx.lineTo(x + s*0.26, y + s*0.50)
    ctx.bezierCurveTo(x+s*0.20, y+s*0.50, x+s*0.10, y+s*0.48, x+s*0.06, y+s*0.35)
    ctx.bezierCurveTo(x-s*0.02, y+s*0.18, x+s*0.10, y+s*0.00, x+s*0.30, y+s*0.00)
    ctx.closePath()
    ctx.fill(); ctx.stroke()
    for (let i = 0; i < 4; i++) {
      const cx2 = x + s*0.30 + i*s*0.028
      ctx.beginPath(); ctx.moveTo(cx2, y+s*0.52); ctx.lineTo(cx2, y+s*0.90)
      ctx.strokeStyle=`rgba(255,255,255,0.35)`; ctx.lineWidth=0.5; ctx.stroke()
    }
  } else {
    // Flying V (expert — bico em V)
    ctx.beginPath()
    ctx.moveTo(x + s*0.38, y + s*0.00)
    ctx.lineTo(x + s*0.70, y + s*0.50)
    ctx.lineTo(x + s*0.55, y + s*0.50)
    ctx.lineTo(x + s*0.45, y + s*0.95)
    ctx.lineTo(x + s*0.32, y + s*0.95)
    ctx.lineTo(x + s*0.22, y + s*0.50)
    ctx.lineTo(x + s*0.05, y + s*0.50)
    ctx.closePath()
    ctx.fill(); ctx.stroke()
    for (let i = 0; i < 4; i++) {
      const cx2 = x + s*0.32 + i*s*0.030
      ctx.beginPath(); ctx.moveTo(cx2, y+s*0.54); ctx.lineTo(cx2, y+s*0.90)
      ctx.strokeStyle=`rgba(255,255,255,0.35)`; ctx.lineWidth=0.5; ctx.stroke()
    }
  }

  // Pestana do braço
  ctx.beginPath()
  ctx.moveTo(x+s*0.22, y+s*0.94); ctx.lineTo(x+s*0.50, y+s*0.94)
  ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke()

  ctx.shadowBlur = 0; ctx.restore()
}

// Label de dificuldade
function drawDiffLabel(ctx: CanvasRenderingContext2D, x: number, y: number, diff: number) {
  const labels = ["FÁCIL","FÁCIL","MÉDIO","MÉDIO","DIFÍCIL","DIFÍCIL","EXPERT"]
  const colors = ["#22c55e","#22c55e","#eab308","#eab308","#f97316","#f97316","#ef4444"]
  const label = labels[Math.min(diff, 6)]
  const color = colors[Math.min(diff, 6)]
  ctx.save()
  ctx.fillStyle = color; ctx.font = "bold 8px monospace"
  ctx.textAlign = "center"; ctx.textBaseline = "top"
  ctx.shadowColor = color; ctx.shadowBlur = 6
  ctx.fillText(label, x, y)
  ctx.shadowBlur = 0; ctx.restore()
}

// ── RENDER PRINCIPAL ──────────────────────────────────────────────────────────
export function renderFrame(state: RenderState): void {
  const { canvas, ctx, notes, currentTime, stats, hitEffects, keysDown, speed, showGuide, keyLabels, difficulty = 2 } = state
  const w=canvas.width, h=canvas.height
  const ns=NOTE_SPEED_BASE*speed
  const hitY=h*HIT_LINE_Y_RATIO, vanishY=h*VANISHING_Y_RATIO
  const trackBot=w*TRACK_WIDTH_RATIO
  const tLB=(w-trackBot)/2, tRB=tLB+trackBot
  const now=performance.now()
  const starPower=stats.combo>=STAR_POWER_COMBO

  // 1 – Fretboard (muda visual conforme star power)
  ctx.drawImage(getFretboard(w,h,starPower),0,0)

  // 2 – Beat lines dinâmicas
  const visMs=2200/ns
  ctx.save()
  for (let ms=500; ms<visMs; ms+=500) {
    const p0=project(0,ms,canvas,ns), p4=project(4,ms,canvas,ns)
    const hw0=laneWidthAt(w,1-p0.scale)*0.5, hw4=laneWidthAt(w,1-p4.scale)*0.5
    const al=(1-ms/visMs)*(starPower?0.32:0.18)
    ctx.beginPath(); ctx.moveTo(p0.x-hw0,p0.y); ctx.lineTo(p4.x+hw4,p4.y)
    ctx.strokeStyle=starPower?`rgba(0,220,255,${al})`:`rgba(150,220,170,${al})`
    ctx.lineWidth=Math.max(0.4,p0.scale*1.2); ctx.stroke()
  }
  ctx.restore()

  // 3 – Star Power lightning (hit line + bordas da tela)
  drawStarPowerLightning(ctx,w,h,now,stats.combo)

  // 4 – Sustain tails
  for (const note of notes) {
    if (note.missed||note.type!=="sustain"||note.duration<=0||note.lane>=LANE_COUNT) continue
    const nA=note.time-currentTime, tE=note.time+note.duration-currentTime
    if (tE<-TIMING_MISS) continue
    const ca=Math.max(nA,0), cb=Math.max(tE,0)
    const color=starPower?"#00ccff":LANE_COLORS[note.lane]
    for (let s=0; s<14; s++) {
      const a0=ca+(cb-ca)*(s/14), a1=ca+(cb-ca)*((s+1)/14)
      const pp0=project(note.lane,a0,canvas,ns), pp1=project(note.lane,a1,canvas,ns)
      const hw0=SUSTAIN_WIDTH*pp0.scale*0.5, hw1=SUSTAIN_WIDTH*pp1.scale*0.5
      ctx.beginPath()
      ctx.moveTo(pp0.x-hw0,pp0.y); ctx.lineTo(pp0.x+hw0,pp0.y)
      ctx.lineTo(pp1.x+hw1,pp1.y); ctx.lineTo(pp1.x-hw1,pp1.y); ctx.closePath()
      ctx.fillStyle=color+(note.hit?"40":"88"); ctx.fill()
    }
    const ps=project(note.lane,ca,canvas,ns), pe=project(note.lane,cb,canvas,ns)
    ctx.beginPath(); ctx.moveTo(ps.x,ps.y); ctx.lineTo(pe.x,pe.y)
    if (starPower){ctx.shadowColor="#00ffff";ctx.shadowBlur=8}
    ctx.strokeStyle=color+"99"; ctx.lineWidth=2.2*ps.scale; ctx.stroke(); ctx.shadowBlur=0
  }

  // 5 – Hit line glow
  const hlColor=starPower?"0,220,255":"0,200,80"
  const hlAlpha=starPower?0.70:0.32
  const hl=ctx.createLinearGradient(tLB,0,tRB,0)
  hl.addColorStop(0,"transparent"); hl.addColorStop(0.08,`rgba(${hlColor},${hlAlpha*0.5})`)
  hl.addColorStop(0.5,`rgba(${hlColor},${hlAlpha})`); hl.addColorStop(0.92,`rgba(${hlColor},${hlAlpha*0.5})`)
  hl.addColorStop(1,"transparent"); ctx.fillStyle=hl; ctx.fillRect(tLB,hitY-3,tRB-tLB,6)

  // 6 – Hit targets (estilo GH:WT com chamas)
  for (let i=0; i<LANE_COUNT; i++) {
    const {x}=project(i,0,canvas,ns)
    const pressed=keysDown.has(i)
    const {rx,ry}=drawHitTarget(ctx,x,hitY,LANE_COLORS[i],pressed,starPower,now)
    if (showGuide) {
      const label=(keyLabels?.[i]??LANE_LABELS[i]).toUpperCase()
      ctx.fillStyle=pressed?"#fff":"rgba(200,230,210,0.45)"
      ctx.font=`bold ${Math.round(ry*0.85)}px monospace`
      ctx.textAlign="center"; ctx.textBaseline="middle"
      ctx.fillText(label,x,hitY+ry+18)
    }
  }

  // 7 – Notas (estilo GH:WT — disco achatado + chama)
  const maxV=2200/ns
  const visible=notes
    .filter(n=>!n.hit&&!n.missed&&(n.time-currentTime)>=-TIMING_MISS*2&&(n.time-currentTime)<=maxV)
    .sort((a,b)=>(b.time-currentTime)-(a.time-currentTime))

  for (const note of visible) {
    const ahead=note.time-currentTime
    const lane=Math.min(note.lane,LANE_COUNT-1)
    const {x,y,scale}=project(lane,Math.max(ahead,0),canvas,ns)
    if (y>hitY+NOTE_RY_BASE*4) continue
    const rx=NOTE_RX_BASE*scale, ry=NOTE_RY_BASE*scale
    drawNoteGH(ctx,x,y,rx,ry,LANE_COLORS[lane],starPower,now)
  }

  // 8 – Hit effects (explosão + feixe de luz vertical)
  const RC: Record<string,string>={perfect:"#fbbf24",great:"#22c55e",good:"#60a5fa",miss:"#ef4444"}
  for (const fx of hitEffects) {
    const age=now-fx.time; if (age>GLOW_DURATION) continue
    const prog=age/GLOW_DURATION, alpha=Math.max(0,1-prog)
    const lane=Math.min(fx.lane,LANE_COUNT-1)
    const {x}=project(lane,0,canvas,ns)
    const color=LANE_COLORS[lane], rc=RC[fx.rating]||"#fff"
    const isMiss=fx.rating==="miss"
    ctx.save()
    if (!isMiss) {
      // Feixe de luz vertical (como imagem 3)
      if (prog < 0.6) drawLightBeam(ctx,x,hitY,h,color,prog,alpha)
      drawHitExplosion(ctx,x,hitY,color,prog,alpha,fx.rating,NOTE_RX_BASE,NOTE_RY_BASE)
    } else {
      const xs=NOTE_RX_BASE*(1.1+prog*0.35)
      ctx.strokeStyle="#ef4444"+Math.round(alpha*180).toString(16).padStart(2,"0")
      ctx.lineWidth=3.5*(1-prog*0.5); ctx.lineCap="round"
      ctx.shadowColor="#ef4444"; ctx.shadowBlur=6*alpha
      ctx.beginPath(); ctx.moveTo(x-xs,hitY-NOTE_RY_BASE); ctx.lineTo(x+xs,hitY+NOTE_RY_BASE); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x+xs,hitY-NOTE_RY_BASE); ctx.lineTo(x-xs,hitY+NOTE_RY_BASE); ctx.stroke()
      ctx.shadowBlur=0
    }
    const ty=hitY-58-prog*48, fs=Math.round(isMiss?11:16+(1-prog)*7)
    ctx.globalAlpha=alpha*(isMiss?0.50:1); ctx.fillStyle=rc
    ctx.shadowColor=rc; ctx.shadowBlur=isMiss?0:10
    ctx.font=`900 ${fs}px monospace`; ctx.textAlign="center"; ctx.textBaseline="middle"
    ctx.fillText(fx.rating.toUpperCase(),x,ty); ctx.shadowBlur=0; ctx.restore()
  }

  // 9 – HUD: Score
  {
    const sc=stats.score.toLocaleString()
    ctx.save(); ctx.font="bold 24px monospace"
    const sw=ctx.measureText(sc).width, ph=40, ppx=12, ppy=60, ppw=sw+24
    ctx.fillStyle="rgba(0,0,0,0.52)"
    ctx.beginPath(); (ctx as any).roundRect(w-ppw-ppx,ppy,ppw,ph,8); ctx.fill()
    ctx.strokeStyle=starPower?"rgba(0,200,255,0.32)":"rgba(0,200,80,0.22)"; ctx.lineWidth=1; ctx.stroke()
    ctx.shadowColor=starPower?"rgba(0,200,255,0.60)":"rgba(0,200,80,0.50)"; ctx.shadowBlur=12
    ctx.fillStyle="#fff"; ctx.textAlign="right"; ctx.textBaseline="middle"
    ctx.fillText(sc,w-ppx-10,ppy+ph/2); ctx.shadowBlur=0; ctx.restore()
  }

  if (stats.multiplier>1) {
    ctx.save()
    const mt=`×${stats.multiplier}`; ctx.font="bold 10px monospace"
    const mw=ctx.measureText(mt).width+12, mx=w-mw-14, my=60+40+3
    ctx.fillStyle=starPower?"rgba(0,200,255,0.18)":"rgba(0,180,80,0.18)"
    ctx.beginPath(); (ctx as any).roundRect(mx,my,mw,19,5); ctx.fill()
    ctx.strokeStyle=starPower?"rgba(0,200,255,0.42)":"rgba(0,200,80,0.38)"; ctx.lineWidth=1; ctx.stroke()
    ctx.fillStyle=starPower?"#00ccff":"#00cc55"; ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=6
    ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(mt,mx+mw/2,my+9.5)
    ctx.shadowBlur=0; ctx.restore()
  }

  if (stats.combo>1) {
    ctx.save()
    const cc=starPower?"#00ffff":stats.combo>=40?"#f97316":stats.combo>=20?"#fbbf24":stats.combo>=10?"#c084fc":"rgba(255,255,255,0.85)"
    const cs=Math.min(52,18+stats.combo*0.48), cy=h*0.082
    ctx.shadowColor=cc; ctx.shadowBlur=stats.combo>=20?30:14
    ctx.fillStyle=cc; ctx.font=`900 ${cs}px monospace`
    ctx.textAlign="center"; ctx.textBaseline="middle"
    ctx.fillText(`${stats.combo}`,w/2,cy); ctx.shadowBlur=0
    const label=starPower?"⚡ STAR POWER! ⚡":"COMBO"
    ctx.fillStyle=cc+"78"; ctx.font=starPower?"bold 11px monospace":"bold 9px monospace"
    if (starPower){ctx.shadowColor=cc;ctx.shadowBlur=10}
    ctx.fillText(label,w/2,cy+cs*0.76); ctx.shadowBlur=0; ctx.restore()
  }

  {
    const mx=14,my=h-28,mw=152,mh=10
    const fill=stats.rockMeter/100
    const mColor=stats.rockMeter>60?"#22c55e":stats.rockMeter>30?"#fbbf24":"#ef4444"
    ctx.save()
    ctx.fillStyle="rgba(255,255,255,0.20)"; ctx.font="bold 8px monospace"
    ctx.textAlign="left"; ctx.textBaseline="bottom"; ctx.fillText("ROCK",mx,my-2)
    ctx.fillStyle="rgba(0,0,0,0.52)"; ctx.strokeStyle="rgba(255,255,255,0.05)"
    ctx.lineWidth=1; ctx.beginPath(); (ctx as any).roundRect(mx,my,mw,mh,5); ctx.fill(); ctx.stroke()
    if (fill>0) {
      const fg=ctx.createLinearGradient(mx,0,mx+mw*fill,0)
      fg.addColorStop(0,mColor+"70"); fg.addColorStop(1,mColor)
      ctx.shadowColor=mColor; ctx.shadowBlur=6
      ctx.fillStyle=fg; ctx.beginPath(); (ctx as any).roundRect(mx,my,mw*fill,mh,5); ctx.fill()
    }
    ctx.restore()
  }

  // Guitarra decorativa (muda com dificuldade)
  {
    const gSize = 36, gx = 14, gy = 14
    // Fundo semi-transparente
    ctx.save()
    ctx.fillStyle = "rgba(0,0,0,0.38)"
    ctx.beginPath(); (ctx as any).roundRect(gx-4, gy-4, gSize+10, gSize+26, 6); ctx.fill()
    ctx.strokeStyle = starPower ? "rgba(0,200,255,0.28)" : "rgba(255,255,255,0.08)"
    ctx.lineWidth = 1; ctx.stroke()
    ctx.restore()
    drawGuitarSilhouette(ctx, gx, gy, gSize, difficulty, now)
    drawDiffLabel(ctx, gx + gSize*0.38, gy + gSize + 2, difficulty)
  }
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16)
  const r = Math.max(0, Math.min(255, ((n >> 16) & 0xff) + amt))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt))
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt))
  return "rgb(" + r + "," + g + "," + b + ")"
}
