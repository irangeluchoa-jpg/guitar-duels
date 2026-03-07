import {
  LANE_COUNT, LANE_COLORS, LANE_LABELS, TIMING_MISS,
  type ActiveNote, type HitEffect, type GameStats,
} from "./engine"

// ── Layout ───────────────────────────────────────────────────────────────────
const VANISHING_Y_RATIO = 0.13
const HIT_LINE_Y_RATIO  = 0.83
const TRACK_WIDTH_RATIO = 0.50
const TRACK_WIDTH_TOP   = 0.09
const GLOW_DURATION     = 520
const NOTE_SPEED_BASE   = 0.55
const NOTE_RX_BASE      = 33
const NOTE_RY_BASE      = 11   // notas achatadas tipo GH:WT / GHL
const SUSTAIN_WIDTH     = 16
const STAR_POWER_COMBO  = 30

// ── Cores do tema (guitar.ini / YARG theme) ──────────────────────────────────
// Cores das notas
const NOTE_COLORS = [
  "#00E14F",  // Lane 0 — Green
  "#FF2828",  // Lane 1 — Red
  "#FFFD4B",  // Lane 2 — Yellow
  "#55ADFF",  // Lane 3 — Blue
  "#FF9537",  // Lane 4 — Orange
]
// Cores das animações (glow/brilho) das notas
const NOTE_ANIM_COLORS = [
  "#00E14F",  // Green
  "#FF2828",  // Red
  "#FFFD4B",  // Yellow
  "#55ADFF",  // Blue
  "#FF9537",  // Orange
]
// Cover dos strikers (aro externo do botão)
const STRIKER_COVER = [
  "#00E14F",  // Green
  "#FF2828",  // Red
  "#FFFD4B",  // Yellow
  "#55ADFF",  // Blue
  "#FF9537",  // Orange
]
// Partículas/chama do hit
const HIT_FLAME_COLOR  = "#FFBF6D"  // striker_hit_flame
const HIT_PARTICLE_COLOR = "#FF6600" // striker_hit_particles
const SP_FLAME_COLOR   = "#00FFFF"  // striker_hit_flame_sp_active
const SP_PARTICLE_COLOR = "#00FFFF" // striker_hit_particles_sp_active
// Star Power
const SP_NOTE_COLOR    = "#00FFFF"  // note_sp_active
const SP_SUSTAIN_COLOR = "#00FFFF"  // sustain_sp_active
// Combo glow colors
const COMBO_GLOW = ["#FFDD00","#D55800","#00FF00","#874E9E","#E8B1FF"]

// ── Cache ──────────────────────────────────────────────────────────────────
// Cache: [diffKey][starPower] -> OffscreenCanvas
const _fretCache = new Map<string, OffscreenCanvas>()
let _fretW = 0, _fretH = 0

// Pre-loaded highway images (loaded once on first use)
const _hwImages: Record<string, HTMLImageElement | null> = {
  easy: null, hard: null, expert: null
}
let _hwLoaded = false

function loadHighwayImages() {
  if (_hwLoaded) return
  _hwLoaded = true
  for (const [key, src] of [
    ["easy",   "/highways/highway_easy.png"],
    ["hard",   "/highways/highway_hard.png"],
    ["expert", "/highways/highway_expert.png"],
  ] as [string, string][]) {
    const img = new Image()
    img.src = src
    img.onload = () => {
      _hwImages[key] = img
      // Invalidate cache so fretboard gets rebuilt with texture
      _fretCache.clear()
    }
    // Store immediately so we can check .complete
    _hwImages[key] = img
  }
}

function diffToHwKey(diff: number): string {
  if (diff >= 6) return "expert"
  if (diff >= 4) return "hard"
  return "easy"
}

// ── Timestamps do último press por lane (para animação de salto) ─────────────
const _pressTime: number[] = [0, 0, 0, 0, 0]
const _wasPressed: boolean[] = [false, false, false, false, false]

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
  instrumentVol?: number   // 0-1, volume dinâmico do instrumento (para HUD)
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

// ── Helper: hex -> "r,g,b" string ────────────────────────────────────────────
function hexToRgb(hex: string): string {
  // Handle rgb(...) format passthrough
  if (hex.startsWith("rgb")) {
    const m = hex.match(/\d+/g)
    return m ? `${m[0]},${m[1]},${m[2]}` : "128,128,128"
  }
  const n = parseInt(hex.replace("#",""), 16)
  return `${(n>>16)&0xff},${(n>>8)&0xff},${n&0xff}`
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
function buildFretboard(w: number, h: number, starPower: boolean, diff: number): OffscreenCanvas {
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

  // ── Textura da highway (imagem real, perspectiva trapézio) ────────────────
  const hwKey  = diffToHwKey(diff)
  const hwImg  = _hwImages[hwKey]
  if (hwImg && hwImg.complete && hwImg.naturalWidth > 0) {
    // ── Perspectiva correcta: grade cols × rows ────────────────────────────
    // A imagem tem ratio ~0.5:1 (largura:altura) — mapeamos ela inteira
    // no trapézio do fretboard mantendo proporções corretas
    const iw = hwImg.naturalWidth, ih = hwImg.naturalHeight
    const COLS = 40   // fatias verticais (para convergência X)
    const ROWS = 40   // fatias horizontais (para perspectiva Y)
    const fH   = hitY - vanishY  // altura do fretboard em pixels

    ctx.save()
    ctx.globalAlpha = starPower ? 0.50 : 0.82

    for (let c = 0; c < COLS; c++) {
      const t0 = c / COLS, t1 = (c + 1) / COLS
      const bx0 = tLB + trackBot * t0, bx1 = tLB + trackBot * t1  // X no fundo
      const tx0 = tLT + trackTop * t0, tx1 = tLT + trackTop * t1  // X no topo
      const sx0 = iw * t0, sw = iw * (t1 - t0)                    // X na imagem

      for (let r = 0; r < ROWS; r++) {
        const v0 = r / ROWS, v1 = (r + 1) / ROWS
        // Y no canvas (de vanishY até hitY)
        const cy0 = vanishY + fH * v0
        const cy1 = vanishY + fH * v1
        // X interpolado na linha (perspectiva horizontal)
        const dx0 = tx0 + (bx0 - tx0) * v0
        const dx1 = tx0 + (bx0 - tx0) * v1
        const dw0 = (tx1 - tx0) + ((bx1 - bx0) - (tx1 - tx0)) * v0
        // Y na imagem — mapeado de cima para baixo (topo=0, fundo=ih)
        const sy0 = ih * v0, sh = ih * (v1 - v0)

        ctx.drawImage(hwImg,
          sx0, sy0, sw,  sh,          // source (col × row da imagem)
          dx0, cy0, dw0, cy1 - cy0    // dest   (célula do trapézio)
        )
      }
    }
    ctx.restore()
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

function getFretboard(w: number, h: number, starPower: boolean, diff: number): OffscreenCanvas {
  loadHighwayImages()
  const key = `${w}x${h}:${diffToHwKey(diff)}:${starPower?1:0}`
  if (_fretW !== w || _fretH !== h) {
    _fretCache.clear()
    _fretW = w; _fretH = h
  }
  let cached = _fretCache.get(key)
  if (!cached) {
    cached = buildFretboard(w, h, starPower, diff)
    _fretCache.set(key, cached)
  }
  return cached
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
  laneIdx: number,
  starPower: boolean,
  now: number
) {
  const sp    = starPower
  const color = NOTE_COLORS[laneIdx] ?? "#ffffff"
  const anim  = NOTE_ANIM_COLORS[laneIdx] ?? color
  const c     = sp ? SP_NOTE_COLOR : color
  const ca    = sp ? SP_NOTE_COLOR : anim
  const t     = now * 0.003

  ctx.save()

  // ── Sombra elíptica no fretboard ─────────────────────────────────────
  ctx.save(); ctx.globalAlpha = 0.18
  ctx.beginPath(); ctx.ellipse(x, y + ry*0.55, rx*0.80, ry*0.28, 0, 0, Math.PI*2)
  ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fill(); ctx.restore()

  // ── Glow externo (anim color) ─────────────────────────────────────────
  ctx.shadowColor = ca; ctx.shadowBlur = sp ? 26 : 18

  // ── Base preta do disco (striker_base) ────────────────────────────────
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI*2)
  ctx.fillStyle = "#1a1a1a"; ctx.fill()

  // ── Cover colorido (striker_cover) — anel externo colorido ───────────
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI*2)
  ctx.strokeStyle = c
  ctx.lineWidth = Math.max(2, rx * 0.14); ctx.stroke()

  // ── Corpo principal — gradiente 3D ────────────────────────────────────
  const bodyG = ctx.createRadialGradient(x - rx*0.25, y - ry*0.42, ry*0.02, x, y, rx*1.05)
  bodyG.addColorStop(0,    sp ? "#aaffff" : "#ffffff")
  bodyG.addColorStop(0.12, c)
  bodyG.addColorStop(0.55, sp ? "#006688" : shade(c, -30))
  bodyG.addColorStop(1,    "#111111")
  ctx.beginPath(); ctx.ellipse(x, y, rx*0.88, ry*0.88, 0, 0, Math.PI*2)
  ctx.fillStyle = bodyG; ctx.fill()
  ctx.shadowBlur = 0

  // ── Aro interno brilhante (striker_head_light) ────────────────────────
  ctx.beginPath(); ctx.ellipse(x, y, rx*0.62, ry*0.62, 0, 0, Math.PI*2)
  ctx.strokeStyle = sp ? "rgba(0,255,255,0.80)" : "rgba(255,255,255,0.55)"
  ctx.lineWidth = 1.2; ctx.stroke()

  // ── Shine especular no topo ───────────────────────────────────────────
  ctx.save()
  ctx.beginPath(); ctx.ellipse(x, y, rx*0.88, ry*0.88, 0, 0, Math.PI*2); ctx.clip()
  const shineG = ctx.createRadialGradient(x - rx*0.22, y - ry*0.44, 0, x - rx*0.05, y - ry*0.12, rx*0.68)
  shineG.addColorStop(0,    "rgba(255,255,255,0.95)")
  shineG.addColorStop(0.28, "rgba(255,255,255,0.28)")
  shineG.addColorStop(1,    "transparent")
  ctx.fillStyle = shineG; ctx.fill(); ctx.restore()

  // ── Chama/glow embaixo (striker_hit_flame cor) ────────────────────────
  const flameY   = y + ry + 1
  const flicker  = 0.72 + Math.sin(t + x*0.05)*0.28
  const flameCol = sp ? "0,255,255" : hexToRgb(anim)
  const flG = ctx.createRadialGradient(x, flameY, 0, x, flameY, rx * 0.8 * flicker)
  flG.addColorStop(0,   `rgba(255,255,255,0.85)`)
  flG.addColorStop(0.25, `rgba(${flameCol},0.65)`)
  flG.addColorStop(1,    "transparent")
  ctx.fillStyle = flG
  ctx.beginPath(); ctx.ellipse(x, flameY, rx*0.52*flicker, ry*2.2*flicker, 0, 0, Math.PI*2); ctx.fill()

  ctx.restore()
}


// ── Hit target estilo GH3 — botão redondo com base preta, aro colorido, chamas ─
function drawHitTarget(
  ctx: CanvasRenderingContext2D,
  x: number, baseHitY: number,
  laneIdx: number, pressed: boolean,
  starPower: boolean, now: number,
  jumpY: number = 0, scaleX: number = 1, scaleY: number = 1
) {
  const hitY  = baseHitY - jumpY   // posição Y com salto aplicado
  const sp    = starPower
  const color = STRIKER_COVER[laneIdx] ?? "#ffffff"
  const c     = sp ? SP_NOTE_COLOR : color
  const rx    = (NOTE_RX_BASE + 6) * scaleX
  const ry    = (NOTE_RY_BASE + 6) * scaleY
  const t     = now * 0.003

  ctx.save()

  // ── Glow halo ao pressionar ───────────────────────────────────────────
  if (pressed) {
    ctx.shadowColor = c; ctx.shadowBlur = sp ? 50 : 40
    const grd = ctx.createRadialGradient(x, hitY, 0, x, hitY, rx*3.2)
    grd.addColorStop(0, `rgba(${hexToRgb(c)},0.33)`); grd.addColorStop(1, "transparent")
    ctx.fillStyle = grd
    ctx.beginPath(); ctx.ellipse(x, hitY, rx*3.2, ry*3.2, 0, 0, Math.PI*2); ctx.fill()
    ctx.shadowBlur = 0
  }

  // ── Aro externo GH3 (grande, com sombra) ─────────────────────────────
  ctx.beginPath(); ctx.ellipse(x, hitY, rx + 10, ry + 10, 0, 0, Math.PI*2)
  ctx.strokeStyle = pressed
    ? `rgba(${hexToRgb(c)},0.80)`
    : sp ? "rgba(0,220,255,0.45)" : "rgba(255,255,255,0.15)"
  ctx.lineWidth = 2; ctx.stroke()

  // ── Base escura do botão (striker_base = #313131) ─────────────────────
  ctx.beginPath(); ctx.ellipse(x, hitY, rx + 3, ry + 3, 0, 0, Math.PI*2)
  ctx.fillStyle = pressed ? "#1c1c1c" : "#313131"
  ctx.shadowColor = pressed ? c : "rgba(0,0,0,0.8)"; ctx.shadowBlur = pressed ? 8 : 4
  ctx.fill(); ctx.shadowBlur = 0

  // ── Cover colorido (striker_cover) — anel colorido no aro ─────────────
  ctx.beginPath(); ctx.ellipse(x, hitY, rx + 3, ry + 3, 0, 0, Math.PI*2)
  ctx.strokeStyle = pressed ? `rgba(${hexToRgb(c)},1.0)` : `rgba(${hexToRgb(c)},0.80)`
  ctx.lineWidth = pressed ? 4 : 3; ctx.stroke()

  // ── Corpo central ─────────────────────────────────────────────────────
  ctx.beginPath(); ctx.ellipse(x, hitY, rx, ry, 0, 0, Math.PI*2)
  if (pressed) {
    const fg = ctx.createRadialGradient(x - rx*0.22, hitY - ry*0.42, 0, x, hitY, rx)
    fg.addColorStop(0, "#ffffff"); fg.addColorStop(0.25, c); fg.addColorStop(1, `rgba(${hexToRgb(c)},0.30)`)
    ctx.fillStyle = fg
  } else {
    // Gradiente escuro com leve toque da cor
    const fg = ctx.createRadialGradient(x, hitY - ry*0.3, 0, x, hitY, rx)
    fg.addColorStop(0, `rgba(${hexToRgb(c)},0.27)`)
    fg.addColorStop(1, "#0a0a0a")
    ctx.fillStyle = fg
  }
  ctx.fill()

  // ── Aro do head light (striker_head_light) ─────────────────────────────
  ctx.beginPath(); ctx.ellipse(x, hitY, rx*0.65, ry*0.65, 0, 0, Math.PI*2)
  ctx.strokeStyle = pressed ? `rgba(${hexToRgb(c)},0.93)` : `rgba(${hexToRgb(c)},0.40)`
  ctx.lineWidth = pressed ? 2.5 : 1.5; ctx.stroke()

  // ── Cover do head (striker_head_cover = #313131) ──────────────────────
  if (!pressed) {
    ctx.beginPath(); ctx.ellipse(x, hitY, rx*0.50, ry*0.50, 0, 0, Math.PI*2)
    ctx.fillStyle = "#313131"; ctx.fill()
    // Pequena luz no centro
    const dot = ctx.createRadialGradient(x, hitY - ry*0.2, 0, x, hitY, rx*0.35)
    dot.addColorStop(0, `rgba(${hexToRgb(c)},0.38)`); dot.addColorStop(1, "transparent")
    ctx.fillStyle = dot; ctx.fill()
  }

  // ── Shine ao pressionar ───────────────────────────────────────────────
  if (pressed) {
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, hitY, rx, ry, 0, 0, Math.PI*2); ctx.clip()
    const sh = ctx.createRadialGradient(x - rx*0.22, hitY - ry*0.46, 0, x, hitY, rx*0.82)
    sh.addColorStop(0, "rgba(255,255,255,0.92)")
    sh.addColorStop(0.38, "rgba(255,255,255,0.15)")
    sh.addColorStop(1, "transparent")
    ctx.fillStyle = sh; ctx.fill(); ctx.restore()
  }

  // ── Chamas (striker_hit_flame / striker_hit_spark) ─────────────────────
  if (pressed || sp) {
    const flameAlpha = pressed ? 1.0 : (0.35 + Math.sin(t + x*0.01)*0.2)
    const flameRgb   = sp ? "0,220,255" : hexToRgb(color)
    const flicker    = 0.72 + Math.sin(t*2.2 + x*0.02)*0.28

    for (let f = 0; f < 3; f++) {
      const fh  = (ry*3.5 + Math.sin(t*2.8 + f*1.5)*ry)*flicker
      const fw  = rx*(0.38 - f*0.10)*flicker
      const fy  = hitY + ry + 3
      const flG = ctx.createLinearGradient(x, fy + fh, x, fy)
      flG.addColorStop(0,    `rgba(${flameRgb},0)`)
      flG.addColorStop(0.35, `rgba(${flameRgb},${flameAlpha*0.55})`)
      flG.addColorStop(0.75, `rgba(255,220,150,${flameAlpha*0.80})`)
      flG.addColorStop(1,    `rgba(255,255,255,${flameAlpha})`)
      ctx.fillStyle = flG
      const dx = Math.sin(t*1.4 + f*2.1 + x*0.01)*fw*0.35
      ctx.beginPath()
      ctx.moveTo(x - fw, fy)
      ctx.quadraticCurveTo(x - fw*0.4 + dx, fy + fh*0.45, x + dx*0.5, fy + fh)
      ctx.quadraticCurveTo(x + fw*0.4 + dx, fy + fh*0.45, x + fw, fy)
      ctx.closePath(); ctx.fill()
    }

    // Faíscas (striker_hold_spark)
    if (pressed) {
      const sparkColor = sp ? SP_PARTICLE_COLOR : HIT_PARTICLE_COLOR
      for (let s = 0; s < 5; s++) {
        const ang  = (s/5)*Math.PI*2 + t*3
        const dist = rx*(0.9 + Math.abs(Math.sin(t*4+s))*0.8)
        const sx   = x + Math.cos(ang)*dist
        const sy   = hitY + Math.sin(ang)*dist*0.45
        const sr   = 2 + Math.abs(Math.sin(t*5+s))*2
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI*2)
        ctx.fillStyle = sparkColor
        ctx.shadowColor = sparkColor; ctx.shadowBlur = 8
        ctx.fill(); ctx.shadowBlur = 0
      }
    }
  }

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
  const { canvas, ctx, notes, currentTime, stats, hitEffects, keysDown, speed, showGuide, keyLabels, difficulty = 2, instrumentVol = 1 } = state
  const w=canvas.width, h=canvas.height
  const ns=NOTE_SPEED_BASE*speed
  const hitY=h*HIT_LINE_Y_RATIO, vanishY=h*VANISHING_Y_RATIO
  const trackBot=w*TRACK_WIDTH_RATIO
  const tLB=(w-trackBot)/2, tRB=tLB+trackBot
  const now=performance.now()
  const starPower=stats.combo>=STAR_POWER_COMBO
  // 1 – Fretboard (muda visual conforme star power)
  ctx.drawImage(getFretboard(w,h,starPower,difficulty),0,0)

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
    const color=starPower?SP_SUSTAIN_COLOR:(NOTE_COLORS[note.lane]??LANE_COLORS[note.lane])
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

  // 6 – Hit targets (estilo GH:WT com chamas + salto ao pressionar)
  for (let i=0; i<LANE_COUNT; i++) {
    const {x}=project(i,0,canvas,ns)
    const pressed=keysDown.has(i)

    // Detecta novo press para registrar timestamp
    if (pressed && !_wasPressed[i]) { _pressTime[i] = now }
    _wasPressed[i] = pressed

    // Animação de salto: squash na descida, stretch na subida
    // t=0 no momento do press, dura ~200ms
    const JUMP_DUR = 200
    const age = now - _pressTime[i]
    let jumpY = 0, scaleX = 1, scaleY = 1

    if (pressed) {
      // Pressionado: squash (achata para baixo, alarga)
      scaleX = 1.18
      scaleY = 0.75
      jumpY  = 0
    } else if (age < JUMP_DUR) {
      // Solto: bounce para cima e volta
      const progress = age / JUMP_DUR
      // Curva: sobe rápido, desce com bounce
      const bounce = Math.sin(progress * Math.PI) * (1 - progress * 0.3)
      jumpY  = bounce * 14                     // sobe até 14px
      scaleX = 1 - bounce * 0.12              // estreita levemente
      scaleY = 1 + bounce * 0.18              // estica verticalmente (stretch)
    }

    const {rx,ry}=drawHitTarget(ctx,x,hitY,i,pressed,starPower,now,jumpY,scaleX,scaleY)
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
    drawNoteGH(ctx,x,y,rx,ry,lane,starPower,now)
  }

  // 8 – Hit effects (explosão + feixe de luz vertical)
  const RC: Record<string,string>={perfect:"#fbbf24",great:"#22c55e",good:"#60a5fa",miss:"#ef4444"}
  for (const fx of hitEffects) {
    const age=now-fx.time; if (age>GLOW_DURATION) continue
    const prog=age/GLOW_DURATION, alpha=Math.max(0,1-prog)
    const lane=Math.min(fx.lane,LANE_COUNT-1)
    const {x}=project(lane,0,canvas,ns)
    const color=NOTE_ANIM_COLORS[lane]??LANE_COLORS[lane], rc=RC[fx.rating]||"#fff"
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
    ctx.beginPath(); ctx.roundRect(w-ppw-ppx,ppy,ppw,ph,8); ctx.fill()
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
    ctx.beginPath(); ctx.roundRect(mx,my,mw,19,5); ctx.fill()
    ctx.strokeStyle=starPower?"rgba(0,200,255,0.42)":"rgba(0,200,80,0.38)"; ctx.lineWidth=1; ctx.stroke()
    ctx.fillStyle=starPower?"#00ccff":"#00cc55"; ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=6
    ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(mt,mx+mw/2,my+9.5)
    ctx.shadowBlur=0; ctx.restore()
  }

  if (stats.combo>1) {
    ctx.save()
    const cc=starPower?"#00ffff":starPower?"#00ffff":stats.combo>=40?COMBO_GLOW[4]:stats.combo>=20?COMBO_GLOW[3]:stats.combo>=10?COMBO_GLOW[2]:COMBO_GLOW[1]
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
    ctx.lineWidth=1; ctx.beginPath(); ctx.roundRect(mx,my,mw,mh,5); ctx.fill(); ctx.stroke()
    if (fill>0) {
      const fg=ctx.createLinearGradient(mx,0,mx+mw*fill,0)
      fg.addColorStop(0,mColor+"70"); fg.addColorStop(1,mColor)
      ctx.shadowColor=mColor; ctx.shadowBlur=6
      ctx.fillStyle=fg; ctx.beginPath(); ctx.roundRect(mx,my,mw*fill,mh,5); ctx.fill()
    }
    ctx.restore()
  }

  // ── Indicador de volume do instrumento ──────────────────────────────────
  {
    const barW = 80, barH = 6, bx = w - barW - 14, by = h - 44
    const volColor = instrumentVol > 0.65 ? "#22c55e" : instrumentVol > 0.30 ? "#fbbf24" : "#ef4444"
    ctx.save()
    // Label
    ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.font = "bold 7px monospace"
    ctx.textAlign = "left"; ctx.textBaseline = "bottom"
    ctx.fillText("INSTRUMENTO", bx, by - 2)
    // Fundo
    ctx.fillStyle = "rgba(0,0,0,0.50)"; ctx.strokeStyle = "rgba(255,255,255,0.05)"
    ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(bx, by, barW, barH, 3); ctx.fill(); ctx.stroke()
    // Preenchimento
    if (instrumentVol > 0.01) {
      const fg = ctx.createLinearGradient(bx, 0, bx + barW * instrumentVol, 0)
      fg.addColorStop(0, volColor + "88"); fg.addColorStop(1, volColor)
      ctx.shadowColor = volColor; ctx.shadowBlur = 5
      ctx.fillStyle = fg; ctx.beginPath(); ctx.roundRect(bx, by, barW * instrumentVol, barH, 3); ctx.fill()
      ctx.shadowBlur = 0
    }
    // Ícone de guitarra (simples) ou X se silenciado
    ctx.fillStyle = instrumentVol < 0.05 ? "#ef4444" : volColor
    ctx.font = "bold 9px monospace"; ctx.textAlign = "left"
    ctx.fillText(instrumentVol < 0.05 ? "🔇" : "🎸", bx + barW + 4, by + barH/2 + 3)
    ctx.restore()
  }

  // Guitarra decorativa (muda com dificuldade)
  {
    const gSize = 36, gx = 14, gy = 14
    // Fundo semi-transparente
    ctx.save()
    ctx.fillStyle = "rgba(0,0,0,0.38)"
    ctx.beginPath(); ctx.roundRect(gx-4, gy-4, gSize+10, gSize+26, 6); ctx.fill()
    ctx.strokeStyle = starPower ? "rgba(0,200,255,0.28)" : "rgba(255,255,255,0.08)"
    ctx.lineWidth = 1; ctx.stroke()
    ctx.restore()
    drawGuitarSilhouette(ctx, gx, gy, gSize, difficulty, now)
    drawDiffLabel(ctx, gx + gSize*0.38, gy + gSize + 2, difficulty)
  }
}
