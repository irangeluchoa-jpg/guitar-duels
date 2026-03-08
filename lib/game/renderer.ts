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

// ── Cores do tema — extraídas do guitar.ini fornecido ───────────────────────
// [guitar] note_green/red/yellow/blue/orange
const NOTE_COLORS = [
  "#FF0000",  // Green  — note_green
  "#FF7800",  // Red    — note_red
  "#FFFF00",  // Yellow — note_yellow
  "#0089FF",  // Blue   — note_blue
  "#5AFF00",  // Orange — note_orange
]
// [guitar] note_anim_green/red/yellow/blue/orange (glow das notas)
const NOTE_ANIM_COLORS = [
  "#FF0000",  // Green  — note_anim_green
  "#FFC28B",  // Red    — note_anim_red
  "#FFFF57",  // Yellow — note_anim_yellow
  "#77D1FF",  // Blue   — note_anim_blue
  "#74FF28",  // Orange — note_anim_orange
]
// [guitar] striker_cover (aro externo do hit target)
const STRIKER_COVER = [
  "#B40000",  // Green  — striker_cover_green
  "#B45500",  // Red    — striker_cover_red
  "#B4B200",  // Yellow — striker_cover_yellow
  "#0061B4",  // Blue   — striker_cover_blue
  "#40B400",  // Orange — striker_cover_orange
]
// [guitar] striker_head_cover (head cover interno)
const STRIKER_HEAD_COVER = [
  "#B40000",  // Green  — striker_head_cover_green
  "#B45500",  // Red    — striker_head_cover_red
  "#B4B200",  // Yellow — striker_head_cover_yellow
  "#0061B4",  // Blue   — striker_head_cover_blue
  "#40B400",  // Orange — striker_head_cover_orange
]
// [guitar] striker_head_light (luz interna do hit target pressionado)
const STRIKER_HEAD_LIGHT = [
  "#FF0000",  // Green  — striker_head_light_green
  "#FF7800",  // Red    — striker_head_light_red
  "#FFFF00",  // Yellow — striker_head_light_yellow
  "#0089FF",  // Blue   — striker_head_light_blue
  "#5AFF00",  // Orange — striker_head_light_orange
]
// [other] striker_hit_flame / striker_hit_particles
const HIT_FLAME_COLOR    = "#EE63F7"  // striker_hit_flame
const HIT_PARTICLE_COLOR = "#FF5000"  // striker_hit_particles
const SP_FLAME_COLOR     = "#FFFFFF"  // striker_hit_flame_sp_active
const SP_PARTICLE_COLOR  = "#00FFFF"  // striker_hit_particles_sp_active
// [guitar] note_sp_active / sustain_sp_active
const SP_NOTE_COLOR      = "#EF6DF7"  // note_sp_active
const SP_SUSTAIN_COLOR   = "#EF6DF7"  // sustain_sp_active
// [guitar] sustain colors
const SUSTAIN_COLORS = [
  "#FF0000",  // Green  — sustain_green
  "#FF7800",  // Red    — sustain_red
  "#FFFF00",  // Yellow — sustain_yellow
  "#00C5FF",  // Blue   — sustain_blue
  "#80FF3B",  // Orange — sustain_orange
]
// [other] combo glow
const COMBO_GLOW = ["#FFDD00","#D55800","#00FF00","#4E7F9E","#B2E1FF"]

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
  instrumentVol?: number
  laneCount?: number
  noteShape?: "circle" | "square" | "diamond"
  highwayTheme?: "default" | "neon" | "fire" | "space" | "wood"
  cameraShake?: boolean
  practice?: { enabled: boolean; loopStart: number; loopEnd: number; speed: number }
  whammyActive?: boolean
}

export function getHitLineY(h: number) { return h * HIT_LINE_Y_RATIO }

function project(lane: number, timeAhead: number, canvas: HTMLCanvasElement, noteSpeed: number, lc = LANE_COUNT) {
  const w = canvas.width, h = canvas.height
  const vanishY = h * VANISHING_Y_RATIO, hitY = h * HIT_LINE_Y_RATIO
  const maxMs = 2200 / noteSpeed
  const t = Math.min(timeAhead / maxMs, 1)
  const y = hitY - (hitY - vanishY) * Math.pow(t, 0.74)
  const progress = (hitY - y) / (hitY - vanishY)
  const trackW = w * TRACK_WIDTH_RATIO + (w * TRACK_WIDTH_TOP - w * TRACK_WIDTH_RATIO) * progress
  const laneW  = trackW / lc
  const x = (w - trackW) / 2 + lane * laneW + laneW / 2
  const scale = 1 - progress * 0.78
  return { x, y, scale }
}

function laneWidthAt(w: number, progress: number, lc = LANE_COUNT) {
  return (w * TRACK_WIDTH_RATIO + (w * TRACK_WIDTH_TOP - w * TRACK_WIDTH_RATIO) * progress) / lc
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
function buildFretboard(w: number, h: number, starPower: boolean, diff: number, lc = LANE_COUNT): OffscreenCanvas {
  const oc = new OffscreenCanvas(w, h)
  const ctx = oc.getContext("2d")!
  const vanishY = h * VANISHING_Y_RATIO, hitY = h * HIT_LINE_Y_RATIO
  const trackBot = w * TRACK_WIDTH_RATIO, trackTop = w * TRACK_WIDTH_TOP
  const tLB = (w-trackBot)/2, tRB = tLB+trackBot
  const tLT = (w-trackTop)/2, tRT = tLT+trackTop

  // Fundo transparente (o HTML background aparece atrás)

  // Recorte do fretboard
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(tLB,hitY); ctx.lineTo(tRB,hitY); ctx.lineTo(tRT,vanishY); ctx.lineTo(tLT,vanishY)
  ctx.closePath(); ctx.clip()

  // ── WoR: fundo escuro metálico (preto-azul profundo) ─────────────────
  {
    const bg = ctx.createLinearGradient(0, vanishY, 0, hitY)
    if (starPower) {
      bg.addColorStop(0,   "rgba(0,15,28,1.0)")
      bg.addColorStop(0.5, "rgba(0,22,36,1.0)")
      bg.addColorStop(1,   "rgba(0,28,42,1.0)")
    } else {
      bg.addColorStop(0,   "rgba(4,6,10,1.0)")
      bg.addColorStop(0.5, "rgba(6,8,14,1.0)")
      bg.addColorStop(1,   "rgba(8,10,16,1.0)")
    }
    ctx.fillStyle = bg; ctx.fillRect(0,0,w,h)
  }
  // Reflexo central sutil (coluna de luz no meio)
  {
    const cg = ctx.createRadialGradient(w/2, hitY, 0, w/2, vanishY, trackBot*0.7)
    cg.addColorStop(0, starPower ? "rgba(0,180,220,0.08)" : "rgba(0,160,200,0.05)")
    cg.addColorStop(1, "transparent")
    ctx.fillStyle = cg; ctx.fillRect(0,0,w,h)
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
  // WoR: grid sempre cyan
  const gridColor = "0,200,255"
  for (let r = 1; r < 9; r++) {
    const t = r/9
    const y = hitY-(hitY-vanishY)*Math.pow(t,0.74)
    const al = (1-t) * (starPower ? 0.45 : 0.28)
    ctx.beginPath(); ctx.moveTo(edgeX(0,y),y); ctx.lineTo(edgeX(1,y),y)
    ctx.strokeStyle=`rgba(${gridColor},${al})`; ctx.lineWidth=1; ctx.stroke()
  }

  // ── Divisores de lane — WoR: finos, cyan ──────────────────────────────
  const divColor    = starPower ? "rgba(0,220,255,0.35)" : "rgba(0,180,220,0.22)"
  const borderColor = starPower ? "rgba(0,240,255,0.85)" : "rgba(0,210,255,0.70)"
  for (let i = 0; i <= lc; i++) {
    const bx = tLB+(trackBot/lc)*i, tx = tLT+(trackTop/lc)*i
    const border = i===0||i===LANE_COUNT
    ctx.beginPath(); ctx.moveTo(bx,hitY); ctx.lineTo(tx,vanishY)
    ctx.strokeStyle = border ? borderColor : divColor
    ctx.lineWidth = border?2:1; ctx.stroke()
  }

  // ── Bordas com glow ────────────────────────────────────────────────────
  ctx.save()
  ctx.shadowColor = starPower ? "rgba(0,255,255,0.95)" : "rgba(0,210,255,0.80)"
  ctx.shadowBlur = 22
  for (const [bx,tx] of [[tLB,tLT],[tRB,tRT]] as [number,number][]) {
    ctx.beginPath(); ctx.moveTo(bx,hitY); ctx.lineTo(tx,vanishY)
    ctx.strokeStyle = starPower ? "rgba(0,255,255,0.90)" : "rgba(0,210,255,0.78)"
    ctx.lineWidth=2.5; ctx.stroke()
  }
  ctx.shadowBlur=0; ctx.restore()

  ctx.restore() // unclip

  // ── Névoa no horizonte ─────────────────────────────────────────────────
  const fog = ctx.createLinearGradient(0,vanishY-8,0,vanishY+60)
  fog.addColorStop(0,"rgba(0,0,0,0.97)"); fog.addColorStop(1,"rgba(0,0,0,0)")
  ctx.fillStyle=fog; ctx.fillRect(0,vanishY-8,w,68)

  return oc
}

function getFretboard(w: number, h: number, starPower: boolean, diff: number, lc = LANE_COUNT): OffscreenCanvas {
  loadHighwayImages()
  const key = `${w}x${h}:${diffToHwKey(diff)}:${starPower?1:0}:${lc}`
  if (_fretW !== w || _fretH !== h) {
    _fretCache.clear()
    _fretW = w; _fretH = h
  }
  let cached = _fretCache.get(key)
  if (!cached) {
    cached = buildFretboard(w, h, starPower, diff, lc)
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

// Traça o path do shape da nota (circle, square, diamond)
// rx/ry = raio base; shape determina o contorno
function noteShapePath(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, shape: string) {
  ctx.beginPath()
  if (shape === "square") {
    // Quadrado com cantos arredondados — proporção levemente retangular (mais largo que alto, como GHL)
    const sw = rx * 1.70, sh = rx * 1.60, r = sw * 0.18
    ctx.moveTo(x - sw + r, y - sh)
    ctx.lineTo(x + sw - r, y - sh); ctx.quadraticCurveTo(x + sw, y - sh, x + sw, y - sh + r)
    ctx.lineTo(x + sw, y + sh - r); ctx.quadraticCurveTo(x + sw, y + sh, x + sw - r, y + sh)
    ctx.lineTo(x - sw + r, y + sh); ctx.quadraticCurveTo(x - sw, y + sh, x - sw, y + sh - r)
    ctx.lineTo(x - sw, y - sh + r); ctx.quadraticCurveTo(x - sw, y - sh, x - sw + r, y - sh)
    ctx.closePath()
  } else if (shape === "diamond") {
    // Diamante — eixo vertical ligeiramente maior para ficar proporcional em perspectiva
    const sdx = rx * 1.55, sdy = rx * 1.80
    ctx.moveTo(x,       y - sdy)
    ctx.lineTo(x + sdx, y)
    ctx.lineTo(x,       y + sdy)
    ctx.lineTo(x - sdx, y)
    ctx.closePath()
  } else {
    // Círculo (elipse achatada como GH:WT)
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  }
}


// ── Nota estilo GH:WoR — disco flat prata/cinza, aro cyan luminoso ──────────
function drawNoteGH(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  rx: number, ry: number,
  laneIdx: number,
  starPower: boolean,
  now: number,
  shape: "circle" | "square" | "diamond" = "circle"
) {
  const sp  = starPower
  const t   = now * 0.003
  const laneCol  = NOTE_COLORS[laneIdx]  ?? "#00e5ff"
  const laneAnim = NOTE_ANIM_COLORS[laneIdx] ?? laneCol
  const rimCol   = sp ? "#00ffff" : laneCol
  const rimAnim  = sp ? "#00ffff" : laneAnim
  const rimRgb   = hexToRgb(rimCol)
  const rimAnimRgb = hexToRgb(rimAnim)
  const glowInt  = sp ? 32 : 22
  const isSquare = shape === "square"
  const isDiamond = shape === "diamond"
  // Circle: usa rx/ry completo (elipse achatada GH)
  // Square/Diamond: o noteShapePath já escala internamente (sw=rx*1.70 etc.), então
  // passamos rx menor para que o tamanho final seja proporcional ao círculo
  const sRx = isSquare ? rx * 0.62 : isDiamond ? rx * 0.58 : rx
  const sRy = isSquare ? ry * 0.62 : isDiamond ? ry * 0.58 : ry

  ctx.save()

  // ── Outer glow halo ────────────────────────────────────────────────────
  const haloG = ctx.createRadialGradient(x, y, sRx*0.4, x, y, sRx*3.5)
  haloG.addColorStop(0,   `rgba(${rimAnimRgb},${sp?0.35:0.20})`)
  haloG.addColorStop(0.5, `rgba(${rimAnimRgb},0.06)`)
  haloG.addColorStop(1,   "transparent")
  ctx.fillStyle = haloG
  ctx.beginPath(); ctx.ellipse(x, y, sRx*3.5, sRy*3.5, 0, 0, Math.PI*2); ctx.fill()

  // ── Drop shadow ────────────────────────────────────────────────────────
  ctx.save(); ctx.globalAlpha = 0.30
  ctx.beginPath(); ctx.ellipse(x, y + sRy*1.1, sRx*0.75, sRy*0.18, 0, 0, Math.PI*2)
  ctx.fillStyle = "rgba(0,0,0,1)"; ctx.fill(); ctx.restore()

  // ── Glow shadow ────────────────────────────────────────────────────────
  ctx.shadowColor = rimCol; ctx.shadowBlur = glowInt

  // ── Base (metallic dark gradient) ─────────────────────────────────────
  const baseG = ctx.createRadialGradient(x - sRx*0.22, y - sRy*0.38, 0, x, y, sRx*1.1)
  baseG.addColorStop(0,    "#3e3e3e")
  baseG.addColorStop(0.25, "#202020")
  baseG.addColorStop(0.65, "#111111")
  baseG.addColorStop(1,    "#060606")
  noteShapePath(ctx, x, y, sRx, sRy, shape)
  ctx.fillStyle = baseG; ctx.fill()
  ctx.shadowBlur = 0

  // ── Outer rim (colored glow border) ───────────────────────────────────
  noteShapePath(ctx, x, y, sRx, sRy, shape)
  ctx.strokeStyle = rimCol
  ctx.lineWidth = Math.max(2.0, sRx * (isSquare || isDiamond ? 0.10 : 0.13))
  ctx.shadowColor = rimCol; ctx.shadowBlur = glowInt * 1.3
  ctx.stroke(); ctx.shadowBlur = 0

  // ── Inner ring/detail (always circle — acts as lens/eye) ──────────────
  const innerR = sRx * (isSquare || isDiamond ? 0.55 : 0.62)
  const innerRy = sRy * (isSquare || isDiamond ? 0.55 : 0.62)
  ctx.beginPath(); ctx.ellipse(x, y, innerR, innerRy, 0, 0, Math.PI*2)
  ctx.strokeStyle = `rgba(${rimRgb},${sp?0.65:0.38})`
  ctx.lineWidth = 0.9; ctx.stroke()

  // ── Dark center ────────────────────────────────────────────────────────
  ctx.beginPath(); ctx.ellipse(x, y, sRx*0.42, sRy*0.42, 0, 0, Math.PI*2)
  ctx.fillStyle = "#080808"; ctx.fill()

  // ── Center glow dot ────────────────────────────────────────────────────
  const dotG = ctx.createRadialGradient(x - sRx*0.07, y - sRy*0.12, 0, x, y, sRx*0.30)
  dotG.addColorStop(0,   `rgba(${rimRgb},${sp?0.90:0.65})`)
  dotG.addColorStop(0.6, `rgba(${rimRgb},0.10)`)
  dotG.addColorStop(1,   "transparent")
  ctx.fillStyle = dotG; ctx.fill()

  // ── Specular shine (top-left highlight) ───────────────────────────────
  ctx.save()
  noteShapePath(ctx, x, y, sRx, sRy, shape); ctx.clip()
  const shG = ctx.createRadialGradient(x - sRx*0.30, y - sRy*0.50, 0, x, y, sRx*0.60)
  shG.addColorStop(0,    "rgba(255,255,255,0.80)")
  shG.addColorStop(0.20, "rgba(255,255,255,0.20)")
  shG.addColorStop(1,    "transparent")
  ctx.fillStyle = shG; ctx.fill(); ctx.restore()

  // ── Bottom corona pulse ────────────────────────────────────────────────
  const flicker = 0.80 + Math.sin(t*2.5 + x*0.03)*0.20
  const coronaG = ctx.createRadialGradient(x, y + sRy*0.28, 0, x, y + sRy*0.28, sRx*0.90*flicker)
  coronaG.addColorStop(0,    `rgba(${rimAnimRgb},${sp?0.60:0.38})`)
  coronaG.addColorStop(0.55, `rgba(${rimAnimRgb},0.05)`)
  coronaG.addColorStop(1,    "transparent")
  ctx.fillStyle = coronaG
  ctx.beginPath(); ctx.ellipse(x, y + sRy*0.28, sRx*0.52*flicker, sRy*1.9*flicker, 0, 0, Math.PI*2); ctx.fill()

  ctx.restore()
}


// ── Hit target estilo GH:WoR — anel duplo, centro escuro, aro colorido por lane ─
function drawHitTarget(
  ctx: CanvasRenderingContext2D,
  x: number, baseHitY: number,
  laneIdx: number, pressed: boolean,
  starPower: boolean, now: number,
  jumpY: number = 0, scaleX: number = 1, scaleY: number = 1
) {
  const hitY  = baseHitY - jumpY
  const sp    = starPower
  const laneColor = STRIKER_COVER[laneIdx] ?? "#ffffff"
  const headLight = STRIKER_HEAD_LIGHT[laneIdx] ?? laneColor
  const c     = sp ? "#00ffff" : laneColor
  const cRgb  = sp ? "0,255,255" : hexToRgb(laneColor)
  const rx    = (NOTE_RX_BASE + 8) * scaleX
  const ry    = (NOTE_RY_BASE + 8) * scaleY
  const t     = now * 0.003

  ctx.save()

  // ── Glow halo ao pressionar ───────────────────────────────────────────
  if (pressed) {
    const halo = ctx.createRadialGradient(x, hitY, 0, x, hitY, rx * 3.5)
    halo.addColorStop(0,   `rgba(${cRgb},0.40)`)
    halo.addColorStop(0.5, `rgba(${cRgb},0.10)`)
    halo.addColorStop(1,   "transparent")
    ctx.fillStyle = halo
    ctx.beginPath(); ctx.ellipse(x, hitY, rx*3.5, ry*3.5, 0, 0, Math.PI*2); ctx.fill()
  }

  // ── Anel exterior decorativo (halo externo sempre visível) ─────────────
  ctx.beginPath(); ctx.ellipse(x, hitY, rx + 12, ry + 12, 0, 0, Math.PI*2)
  ctx.strokeStyle = pressed
    ? `rgba(${cRgb},0.70)`
    : sp ? "rgba(0,220,255,0.40)" : "rgba(255,255,255,0.08)"
  ctx.lineWidth = 1.2; ctx.stroke()

  // ── Anel externo (outer ring) — prata escuro ───────────────────────────
  ctx.beginPath(); ctx.ellipse(x, hitY, rx + 5, ry + 5, 0, 0, Math.PI*2)
  const outerG = ctx.createRadialGradient(x, hitY - ry, 0, x, hitY, rx + 5)
  outerG.addColorStop(0,    "#2a2a2a")
  outerG.addColorStop(0.6,  "#151515")
  outerG.addColorStop(1,    "#0a0a0a")
  ctx.fillStyle = outerG
  ctx.shadowColor = pressed ? c : "rgba(0,0,0,0.8)"
  ctx.shadowBlur  = pressed ? 18 : 5
  ctx.fill(); ctx.shadowBlur = 0

  // Borda do outer ring na cor da lane
  ctx.beginPath(); ctx.ellipse(x, hitY, rx + 5, ry + 5, 0, 0, Math.PI*2)
  ctx.strokeStyle = pressed ? `rgba(${cRgb},1.0)` : `rgba(${cRgb},0.75)`
  ctx.lineWidth = pressed ? 3.5 : 2.5
  ctx.shadowColor = c; ctx.shadowBlur = pressed ? 20 : 10
  ctx.stroke(); ctx.shadowBlur = 0

  // ── Gap escuro entre os aros (WoR signature) ──────────────────────────
  ctx.beginPath(); ctx.ellipse(x, hitY, rx + 1, ry + 1, 0, 0, Math.PI*2)
  ctx.fillStyle = "#060606"; ctx.fill()

  // ── Anel interno (inner ring) — body principal ────────────────────────
  ctx.beginPath(); ctx.ellipse(x, hitY, rx, ry, 0, 0, Math.PI*2)
  const innerG = ctx.createRadialGradient(x - rx*0.18, hitY - ry*0.30, 0, x, hitY, rx)
  if (pressed) {
    innerG.addColorStop(0,    "#ffffff")
    innerG.addColorStop(0.15, sp ? "#00ffff" : headLight)
    innerG.addColorStop(0.50, c)
    innerG.addColorStop(1,    `rgba(${cRgb},0.15)`)
  } else {
    innerG.addColorStop(0,    "#222222")
    innerG.addColorStop(0.50, "#111111")
    innerG.addColorStop(1,    "#070707")
  }
  ctx.fillStyle = innerG; ctx.fill()

  // Borda interna fina na cor da lane
  ctx.beginPath(); ctx.ellipse(x, hitY, rx, ry, 0, 0, Math.PI*2)
  ctx.strokeStyle = pressed ? `rgba(${cRgb},0.90)` : `rgba(${cRgb},0.50)`
  ctx.lineWidth = 1.5; ctx.stroke()

  // ── Aro do head light (círculo interno médio) ─────────────────────────
  const hlRgb = sp ? "0,255,255" : hexToRgb(headLight)
  ctx.beginPath(); ctx.ellipse(x, hitY, rx*0.62, ry*0.62, 0, 0, Math.PI*2)
  ctx.strokeStyle = pressed
    ? `rgba(${hlRgb},0.95)`
    : `rgba(${hlRgb},${sp?0.60:0.35})`
  ctx.lineWidth = pressed ? 2.0 : 1.2; ctx.stroke()

  // ── Centro escuro (WoR: centro sempre vazio/escuro) ───────────────────
  if (!pressed) {
    ctx.beginPath(); ctx.ellipse(x, hitY, rx*0.46, ry*0.46, 0, 0, Math.PI*2)
    ctx.fillStyle = "#080808"; ctx.fill()
    // Dot de luz sutil no centro
    const dotG = ctx.createRadialGradient(x, hitY - ry*0.15, 0, x, hitY, rx*0.35)
    dotG.addColorStop(0,   `rgba(${hlRgb},0.45)`)
    dotG.addColorStop(1,   "transparent")
    ctx.fillStyle = dotG; ctx.fill()
  }

  // ── Shine especular ao pressionar ────────────────────────────────────
  if (pressed) {
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, hitY, rx, ry, 0, 0, Math.PI*2); ctx.clip()
    const sh = ctx.createRadialGradient(x - rx*0.22, hitY - ry*0.48, 0, x, hitY, rx*0.80)
    sh.addColorStop(0,    "rgba(255,255,255,0.90)")
    sh.addColorStop(0.25, "rgba(255,255,255,0.18)")
    sh.addColorStop(1,    "transparent")
    ctx.fillStyle = sh; ctx.fill(); ctx.restore()
  }

  // ── Chamas ao pressionar — estilo WoR: energia lateral ────────────────
  if (pressed || sp) {
    const flameRgb   = sp ? "0,255,255" : hexToRgb(HIT_FLAME_COLOR)
    const flameAlpha = pressed ? 1.0 : 0.4 + Math.sin(t + x*0.01)*0.15
    const flicker    = 0.70 + Math.sin(t*2.5 + x*0.02)*0.30

    // Chamas saindo para cima (como no WoR)
    for (let f = 0; f < 4; f++) {
      const fh  = (ry * 4.5 + Math.sin(t*3.0 + f*1.4)*ry*1.2) * flicker
      const fw  = rx * (0.32 - f*0.06) * flicker
      const fy  = hitY - ry * 0.5
      const dx  = Math.sin(t*1.6 + f*2.0 + x*0.01) * fw * 0.4
      const flG = ctx.createLinearGradient(x, fy, x, fy - fh)
      flG.addColorStop(0,    `rgba(255,255,255,${flameAlpha})`)
      flG.addColorStop(0.20, `rgba(${flameRgb},${flameAlpha*0.90})`)
      flG.addColorStop(0.65, `rgba(${flameRgb},${flameAlpha*0.35})`)
      flG.addColorStop(1,    "transparent")
      ctx.fillStyle = flG
      ctx.shadowColor = `rgba(${flameRgb},0.8)`; ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.moveTo(x - fw, fy)
      ctx.quadraticCurveTo(x - fw*0.3 + dx, fy - fh*0.4, x + dx*0.5, fy - fh)
      ctx.quadraticCurveTo(x + fw*0.3 + dx, fy - fh*0.4, x + fw, fy)
      ctx.closePath(); ctx.fill()
    }
    ctx.shadowBlur = 0

    // Faíscas orbitando
    if (pressed) {
      const sparkRgb = sp ? "0,255,255" : hexToRgb(HIT_PARTICLE_COLOR)
      for (let s = 0; s < 6; s++) {
        const ang  = (s/6)*Math.PI*2 + t*4
        const dist = rx*(0.85 + Math.abs(Math.sin(t*5+s))*0.7)
        const sx   = x + Math.cos(ang)*dist
        const sy   = hitY + Math.sin(ang)*dist*0.42
        const sr   = 1.5 + Math.abs(Math.sin(t*6+s))*2.5
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI*2)
        ctx.fillStyle = `rgba(${sparkRgb},0.95)`
        ctx.shadowColor = `rgba(${sparkRgb},1)`; ctx.shadowBlur = 10
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

// ── Explosão ao acertar — estilo GH:WoR: burst de energia + sparks laterais ──
function drawHitExplosion(
  ctx: CanvasRenderingContext2D, x: number, hitY: number,
  color: string, progress: number, alpha: number, rating: string,
  rx: number, ry: number,
  starPower: boolean = false
) {
  const isPerfect = rating === "perfect"
  const isGreat   = rating === "great"
  // WoR: cor principal é sempre cyan/energia — não usa a cor da nota
  const burstCol  = starPower ? "#ffffff" : "#00e5ff"
  const burstRgb  = starPower ? "255,255,255" : "0,229,255"
  const sparkCol  = starPower ? SP_PARTICLE_COLOR : HIT_PARTICLE_COLOR
  const sparkRgb  = hexToRgb(sparkCol)
  ctx.save()

  // ── Flash inicial expansivo ───────────────────────────────────────────
  if (progress < 0.22) {
    const fp  = progress / 0.22
    const fR  = rx * 6 * fp
    const flash = ctx.createRadialGradient(x, hitY, 0, x, hitY, fR)
    flash.addColorStop(0,    `rgba(255,255,255,${(1-fp)*1.0})`)
    flash.addColorStop(0.25, `rgba(${burstRgb},${(1-fp)*0.85})`)
    flash.addColorStop(0.60, `rgba(${burstRgb},${(1-fp)*0.30})`)
    flash.addColorStop(1,    "transparent")
    ctx.fillStyle = flash
    ctx.beginPath(); ctx.ellipse(x, hitY, fR, fR*0.55, 0, 0, Math.PI*2); ctx.fill()
  }

  // ── Anéis elípticos de energia expandindo ─────────────────────────────
  const ringCount = isPerfect ? 4 : isGreat ? 3 : 2
  for (let ring = 0; ring < ringCount; ring++) {
    const rp   = Math.min(progress + ring * 0.10, 1)
    const ra   = Math.max(0, (1 - rp) * alpha * 0.80)
    const hexA = Math.round(ra * 230).toString(16).padStart(2, "0")
    ctx.beginPath()
    ctx.ellipse(x, hitY, rx*(1.0 + rp*4.0), ry*(1.0 + rp*3.5), 0, 0, Math.PI*2)
    ctx.strokeStyle = burstCol + hexA
    ctx.lineWidth = Math.max(0.4, (3.5 - ring*0.6) * (1-rp))
    ctx.shadowColor = burstCol; ctx.shadowBlur = 12*(1-rp)*alpha
    ctx.stroke(); ctx.shadowBlur = 0
  }

  // ── Chamas de energia subindo (WoR: 2-3 colunas verticais) ───────────
  if (progress < 0.70) {
    const fp       = progress / 0.70
    const numFlames = isPerfect ? 5 : isGreat ? 4 : 3
    for (let f = 0; f < numFlames; f++) {
      const offset   = (f - (numFlames-1)/2) * rx * 0.55
      const flameX   = x + offset * (0.8 + fp * 0.4)
      const riseH    = fp * (ry * 10 + f * ry * 1.0)
      const flameW   = rx * (0.28 - f%2*0.06) * (1 - fp*0.5)
      const fAlpha   = alpha * (1 - fp*0.88) * (0.65 + (f%2)*0.35)
      const wobble   = Math.sin(performance.now()*0.007 + f*1.5) * flameW * 0.35

      const flG = ctx.createLinearGradient(flameX, hitY, flameX, hitY - riseH)
      flG.addColorStop(0,    `rgba(255,255,255,${fAlpha})`)
      flG.addColorStop(0.10, `rgba(${burstRgb},${fAlpha*0.95})`)
      flG.addColorStop(0.45, `rgba(${burstRgb},${fAlpha*0.50})`)
      flG.addColorStop(0.80, `rgba(${sparkRgb},${fAlpha*0.15})`)
      flG.addColorStop(1,    "transparent")
      ctx.fillStyle = flG
      ctx.shadowColor = burstCol; ctx.shadowBlur = 8

      ctx.beginPath()
      ctx.moveTo(flameX - flameW, hitY)
      ctx.quadraticCurveTo(flameX + wobble*0.5 - flameW*0.4, hitY - riseH*0.5, flameX + wobble*0.5, hitY - riseH)
      ctx.quadraticCurveTo(flameX + wobble*0.5 + flameW*0.4, hitY - riseH*0.5, flameX + flameW, hitY)
      ctx.closePath(); ctx.fill()
    }
    ctx.shadowBlur = 0
  }

  // ── Sparks voando para os lados (WoR signature) ───────────────────────
  const numSparks = isPerfect ? 18 : isGreat ? 13 : 9
  const speed     = isPerfect ? 4.2 : isGreat ? 3.4 : 2.6
  for (let p = 0; p < numSparks; p++) {
    const angle = (p / numSparks) * Math.PI * 2 + progress * 0.25
    const dist  = rx * (0.8 + progress * speed)
    const px    = x + Math.cos(angle) * dist
    const py    = hitY + Math.sin(angle) * dist * 0.48
    // Trail
    if (progress > 0.06) {
      const pd  = rx * (0.8 + (progress - 0.06) * speed)
      const ppx = x + Math.cos(angle) * pd
      const ppy = hitY + Math.sin(angle) * pd * 0.48
      ctx.beginPath(); ctx.moveTo(ppx, ppy); ctx.lineTo(px, py)
      ctx.strokeStyle = `rgba(${burstRgb},${alpha*0.55})`
      ctx.lineWidth = 1.5; ctx.stroke()
    }
    // Dot
    const pr = Math.max(0, (isPerfect ? 5.5 : isGreat ? 4.5 : 3.5) * (1-progress) * alpha)
    if (pr < 0.3) continue
    ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI*2)
    ctx.fillStyle = isPerfect ? "#ffffff" : burstCol
    ctx.shadowColor = burstCol; ctx.shadowBlur = 10
    ctx.fill(); ctx.shadowBlur = 0
  }

  // ── Estrelas girando (só Perfect) ─────────────────────────────────────
  if (isPerfect && progress < 0.70) {
    const tn = performance.now() * 0.003
    for (let s = 0; s < 5; s++) {
      const ang  = (s/5)*Math.PI*2 + tn*2.0
      const dist = rx*(1.8 + progress*5.0)
      const sx   = x + Math.cos(ang)*dist
      const sy   = hitY + Math.sin(ang)*dist*0.55
      const sr   = Math.max(0, 6.5*(1 - progress/0.70))
      if (sr < 0.4) continue
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(tn*2.8 + s*1.26)
      ctx.beginPath()
      for (let pt = 0; pt < 4; pt++) {
        const a = (pt/4)*Math.PI*2
        pt === 0
          ? ctx.moveTo(Math.cos(a)*sr*2.2, Math.sin(a)*sr*2.2)
          : ctx.lineTo(Math.cos(a)*sr*2.2, Math.sin(a)*sr*2.2)
        ctx.lineTo(Math.cos(a+Math.PI/4)*sr*0.45, Math.sin(a+Math.PI/4)*sr*0.45)
      }
      ctx.closePath()
      ctx.fillStyle = `rgba(0,229,255,${alpha*0.90})`
      ctx.shadowColor = "#00e5ff"; ctx.shadowBlur = 14
      ctx.fill(); ctx.shadowBlur = 0; ctx.restore()
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
  const { canvas, ctx, notes, currentTime, stats, hitEffects, keysDown, speed, showGuide, keyLabels,
          difficulty = 2, instrumentVol = 1, laneCount: LC = LANE_COUNT,
          noteShape = "circle", highwayTheme = "default", cameraShake = true,
          practice, whammyActive = false } = state
  const w=canvas.width, h=canvas.height
  const ns=NOTE_SPEED_BASE*speed
  const hitY=h*HIT_LINE_Y_RATIO, vanishY=h*VANISHING_Y_RATIO
  const trackBot=w*TRACK_WIDTH_RATIO
  const tLB=(w-trackBot)/2, tRB=tLB+trackBot
  const now=performance.now()
  const starPower=stats.combo>=STAR_POWER_COMBO
  // Limpa o canvas
  ctx.clearRect(0, 0, w, h)

  const dangerMode = stats.rockMeter < 20   // Rock meter crítico → vinheta vermelha
  const failWarning = stats.rockMeter < 10  // Iminente falha → pisca

  // ── Star Power B&W overlay (aplicado ANTES do fretboard para afetar tudo) ──
  // Implementado como filtro CSS via canvas filter — não afeta canvas diretamente,
  // mas adicionamos a saturação como overlay após renderizar tudo
  // Guardamos flag para usar depois
  const spBW = starPower   // usaremos no fim

  // ── Câmera shake no Star Power ────────────────────────────────────────
  if (cameraShake && starPower) {
    const t = now
    const shakeX = (Math.sin(t*0.041)*2 + Math.sin(t*0.073)*1.5) * 0.8
    const shakeY = (Math.cos(t*0.031)*1.5 + Math.cos(t*0.059)*1) * 0.6
    ctx.save(); ctx.translate(shakeX, shakeY)
  }

  // ── Overlay de tema da highway ─────────────────────────────────────────
  if (highwayTheme !== "default") {
    const themeOverlays: Record<string, [string, number][]> = {
      neon:  [["rgba(0,255,200,0.04)",0], ["rgba(255,0,200,0.03)",1]],
      fire:  [["rgba(255,80,0,0.06)", 0], ["rgba(255,200,0,0.04)",1]],
      space: [["rgba(100,0,255,0.07)",0], ["rgba(0,100,255,0.04)",1]],
      wood:  [["rgba(120,60,0,0.08)", 0], ["rgba(80,40,0,0.05)",  1]],
    }
    const stops = themeOverlays[highwayTheme]
    if (stops) {
      const grad = ctx.createLinearGradient(0,0,0,h)
      stops.forEach(([c,p]) => grad.addColorStop(p,c))
      ctx.fillStyle = grad; ctx.fillRect(0,0,w,h)
    }
  }
  // 1 – Fretboard (muda visual conforme star power)
  ctx.drawImage(getFretboard(w,h,starPower,difficulty,LC),0,0)

  // 2 – Beat lines dinâmicas
  const visMs=2200/ns
  ctx.save()
  for (let ms=500; ms<visMs; ms+=500) {
    const p0=project(0,ms,canvas,ns,LC), p4=project(LC-1,ms,canvas,ns,LC)
    const hw0=laneWidthAt(w,1-p0.scale,LC)*0.5, hw4=laneWidthAt(w,1-p4.scale,LC)*0.5
    const al=(1-ms/visMs)*(starPower?0.32:0.18)
    ctx.beginPath(); ctx.moveTo(p0.x-hw0,p0.y); ctx.lineTo(p4.x+hw4,p4.y)
    ctx.strokeStyle=`rgba(0,200,255,${al})`
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
    const color=starPower?SP_SUSTAIN_COLOR:(SUSTAIN_COLORS[note.lane]??NOTE_COLORS[note.lane]??LANE_COLORS[note.lane])
    for (let s=0; s<14; s++) {
      const a0=ca+(cb-ca)*(s/14), a1=ca+(cb-ca)*((s+1)/14)
      const pp0=project(note.lane,a0,canvas,ns,LC), pp1=project(note.lane,a1,canvas,ns,LC)
      const hw0=SUSTAIN_WIDTH*pp0.scale*0.5, hw1=SUSTAIN_WIDTH*pp1.scale*0.5
      ctx.beginPath()
      ctx.moveTo(pp0.x-hw0,pp0.y); ctx.lineTo(pp0.x+hw0,pp0.y)
      ctx.lineTo(pp1.x+hw1,pp1.y); ctx.lineTo(pp1.x-hw1,pp1.y); ctx.closePath()
      ctx.fillStyle=color+(note.hit?"40":"88"); ctx.fill()
    }
    const ps=project(note.lane,ca,canvas,ns,LC), pe=project(note.lane,cb,canvas,ns,LC)
    ctx.beginPath(); ctx.moveTo(ps.x,ps.y); ctx.lineTo(pe.x,pe.y)
    if (starPower){ctx.shadowColor="#00ffff";ctx.shadowBlur=8}
    ctx.strokeStyle=color+"99"; ctx.lineWidth=2.2*ps.scale; ctx.stroke(); ctx.shadowBlur=0
  }

  // 5 – Hit line glow
  const hlColor="0,210,255"
  const hlAlpha=starPower?0.70:0.32
  const hl=ctx.createLinearGradient(tLB,0,tRB,0)
  hl.addColorStop(0,"transparent"); hl.addColorStop(0.08,`rgba(${hlColor},${hlAlpha*0.5})`)
  hl.addColorStop(0.5,`rgba(${hlColor},${hlAlpha})`); hl.addColorStop(0.92,`rgba(${hlColor},${hlAlpha*0.5})`)
  hl.addColorStop(1,"transparent"); ctx.fillStyle=hl; ctx.fillRect(tLB,hitY-3,tRB-tLB,6)

  // 6 – Hit targets (estilo GH:WT com chamas + salto ao pressionar)
  for (let i=0; i<LC; i++) {
    const {x}=project(i,0,canvas,ns,LC)
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
    const lane=Math.min(note.lane,LC-1)
    const {x,y,scale}=project(lane,Math.max(ahead,0),canvas,ns,LC)
    if (y>hitY+NOTE_RY_BASE*4) continue
    const rx=NOTE_RX_BASE*scale, ry=NOTE_RY_BASE*scale
    drawNoteGH(ctx,x,y,rx,ry,lane,starPower,now,noteShape)
  }

  // 8 – Hit effects (explosão + feixe de luz vertical)
  const RC: Record<string,string>={perfect:"#fbbf24",great:"#22c55e",good:"#60a5fa",miss:"#ef4444"}
  for (const fx of hitEffects) {
    const age=now-fx.time; if (age>GLOW_DURATION) continue
    const prog=age/GLOW_DURATION, alpha=Math.max(0,1-prog)
    const lane=Math.min(fx.lane,LC-1)
    const {x}=project(lane,0,canvas,ns,LC)
    const color=NOTE_ANIM_COLORS[lane]??LANE_COLORS[lane], rc=RC[fx.rating]||"#fff"
    const isMiss=fx.rating==="miss"
    ctx.save()
    if (!isMiss) {
      // Feixe de luz vertical (como imagem 3)
      if (prog < 0.6) drawLightBeam(ctx,x,hitY,h,color,prog,alpha)
      drawHitExplosion(ctx,x,hitY,color,prog,alpha,fx.rating,NOTE_RX_BASE,NOTE_RY_BASE,starPower)
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

  // 9 – HUD estilo GH clássico
  // ── helper: desenha estrela de 5 pontas ─────────────────────────────────
  function drawGHStar(cx: number, cy: number, r: number, filled: boolean, sp2: boolean) {
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const ang = (i / 5) * Math.PI - Math.PI / 2
      const rad = i % 2 === 0 ? r : r * 0.42
      i === 0 ? ctx.moveTo(cx + Math.cos(ang)*rad, cy + Math.sin(ang)*rad)
              : ctx.lineTo(cx + Math.cos(ang)*rad, cy + Math.sin(ang)*rad)
    }
    ctx.closePath()
    if (filled) {
      const sg = ctx.createRadialGradient(cx, cy - r*0.2, 0, cx, cy, r)
      sg.addColorStop(0, sp2 ? "#aaffff" : "#fff7aa")
      sg.addColorStop(0.5, sp2 ? "#00ddff" : "#f59e0b")
      sg.addColorStop(1,   sp2 ? "#007799" : "#92400e")
      ctx.fillStyle = sg
      ctx.shadowColor = sp2 ? "#00ffff" : "#fbbf24"
      ctx.shadowBlur = 18
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.12)"
      ctx.shadowBlur = 0
    }
    ctx.fill()
    ctx.strokeStyle = filled ? (sp2 ? "#00ffff" : "#fbbf24") : "rgba(255,255,255,0.25)"
    ctx.lineWidth = filled ? 1.5 : 1
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  // ── Score: canto superior direito, grande ─────────────────────────────
  {
    ctx.save()
    const sc = stats.score.toLocaleString()
    ctx.font = "bold 28px 'Arial Black', Arial, sans-serif"
    ctx.textAlign = "right"; ctx.textBaseline = "top"
    ctx.shadowColor = starPower ? "#00ffff" : "rgba(255,255,255,0.6)"
    ctx.shadowBlur = starPower ? 16 : 6
    ctx.fillStyle = "#ffffff"
    ctx.fillText(sc, w - 16, 14)
    ctx.shadowBlur = 0
    ctx.restore()
  }

  // ── 5 estrelas abaixo do score ────────────────────────────────────────
  {
    ctx.save()
    // GH: 1 estrela a cada 20% do score máximo estimado (200k)
    const totalEstimated = Math.max(stats.totalNotes * 100 * 4, 1)
    const starsFilled = Math.min(5, Math.floor((stats.score / totalEstimated) * 5))
    const starR = 11, starGap = 26
    const starsW = 5 * starGap
    const sx0 = w - starsW - 10
    const sy0 = 50
    for (let s = 0; s < 5; s++) {
      drawGHStar(sx0 + s * starGap + starR, sy0 + starR, starR, s < starsFilled, starPower)
    }
    ctx.restore()
  }

  // ── Multiplicador: badge flutuando à direita da highway ───────────────
  if (stats.multiplier > 1) {
    ctx.save()
    const mt   = `×${stats.multiplier}`
    const mulX = tRB + 36
    const mulY = hitY - 60
    const mulR  = 26
    // Fundo circular com gradiente
    const mg = ctx.createRadialGradient(mulX, mulY - mulR*0.2, 0, mulX, mulY, mulR)
    mg.addColorStop(0, starPower ? "rgba(0,80,110,0.95)" : "rgba(10,20,55,0.95)")
    mg.addColorStop(1, starPower ? "rgba(0,30,50,0.95)"  : "rgba(5,10,30,0.95)")
    ctx.beginPath(); ctx.arc(mulX, mulY, mulR, 0, Math.PI*2)
    ctx.fillStyle = mg; ctx.fill()
    // Borda brilhante
    ctx.strokeStyle = starPower ? "#00ffff" : "#5599ff"
    ctx.lineWidth = 2.2
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 16
    ctx.stroke(); ctx.shadowBlur = 0
    // Texto
    ctx.fillStyle = starPower ? "#00ffff" : "#ffffff"
    ctx.font = "bold 15px 'Arial Black', Arial, sans-serif"
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10
    ctx.fillText(mt, mulX, mulY)
    ctx.shadowBlur = 0
    // Combo abaixo do multiplicador
    if (stats.combo > 1) {
      ctx.fillStyle = "rgba(255,255,255,0.55)"
      ctx.font = "bold 9px monospace"
      ctx.fillText(`${stats.combo} COMBO`, mulX, mulY + mulR + 10)
    }
    ctx.restore()
  }

  // ── Whammy bar indicator ─────────────────────────────────────────────
  if (whammyActive) {
    ctx.save()
    const wpulse = 0.7 + Math.abs(Math.sin(now * 0.012)) * 0.3
    // Faixa lateral direita luminosa
    const wGrad = ctx.createLinearGradient(w - 8, 0, w, 0)
    wGrad.addColorStop(0, "transparent")
    wGrad.addColorStop(1, `rgba(255,180,0,${wpulse * 0.6})`)
    ctx.fillStyle = wGrad
    ctx.fillRect(w - 8, h * 0.2, 8, h * 0.6)
    // Texto
    ctx.fillStyle = `rgba(255,180,0,${wpulse})`
    ctx.font = "bold 7px monospace"
    ctx.textAlign = "right"; ctx.textBaseline = "middle"
    ctx.shadowColor = "#ffb400"; ctx.shadowBlur = 8
    ctx.fillText("WHAMMY!", w - 4, h * 0.5)
    ctx.shadowBlur = 0
    ctx.restore()
  }

  // ── Modo prática: marcadores de loop e indicador de velocidade ────────
  if (practice?.enabled) {
    ctx.save()
    // Badge de velocidade
    ctx.fillStyle = "rgba(0,0,0,0.65)"
    ctx.beginPath(); ctx.roundRect(w/2 - 30, 6, 60, 18, 4); ctx.fill()
    ctx.fillStyle = "#f97316"; ctx.font = "bold 9px monospace"
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.shadowColor = "#f97316"; ctx.shadowBlur = 6
    ctx.fillText(`PRÁTICA ${practice.speed}x`, w/2, 15)
    ctx.shadowBlur = 0
    ctx.restore()
  }

  // ── Rock meter: centralizado na parte inferior, versão melhorada ────────
  {
    ctx.save()
    const mw = 240, mh = 14
    const mx = (w - mw) / 2
    const my = h - 30
    const fill = stats.rockMeter / 100
    const mColor = stats.rockMeter > 60 ? "#22c55e" : stats.rockMeter > 30 ? "#f59e0b" : "#ef4444"
    const isDanger = stats.rockMeter < 20
    const isFail   = stats.rockMeter < 10
    const dangerPulse = isFail
      ? 0.7 + Math.abs(Math.sin(now*0.010))*0.3
      : isDanger
        ? 0.6 + Math.abs(Math.sin(now*0.005))*0.2
        : 1.0

    // Skull (baixo) à esquerda
    ctx.fillStyle = isDanger ? `rgba(239,68,68,${dangerPulse})` : "rgba(255,255,255,0.22)"
    ctx.font = `bold ${isDanger ? 15 : 13}px monospace`
    ctx.textAlign = "right"; ctx.textBaseline = "middle"
    if (isDanger) { ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 12 }
    ctx.fillText("💀", mx - 8, my + mh/2)
    ctx.shadowBlur = 0

    // Guitarra à direita
    const isRocking = stats.rockMeter >= 70
    ctx.fillStyle = isRocking ? `rgba(34,197,94,1)` : "rgba(255,255,255,0.22)"
    ctx.font = `bold ${isRocking ? 15 : 13}px monospace`
    ctx.textAlign = "left"
    if (isRocking) { ctx.shadowColor = "#22c55e"; ctx.shadowBlur = 10 }
    ctx.fillText("🎸", mx + mw + 8, my + mh/2)
    ctx.shadowBlur = 0

    // Trilho externo (sombra)
    ctx.fillStyle = "rgba(0,0,0,0.65)"
    ctx.beginPath(); ctx.roundRect(mx - 1, my - 1, mw + 2, mh + 2, 8); ctx.fill()
    // Trilho
    ctx.fillStyle = "rgba(20,20,20,0.85)"
    ctx.beginPath(); ctx.roundRect(mx, my, mw, mh, 7); ctx.fill()
    ctx.strokeStyle = isDanger ? `rgba(239,68,68,${dangerPulse*0.4})` : "rgba(255,255,255,0.07)"
    ctx.lineWidth = 1; ctx.stroke()

    // Preenchimento com gradiente vermelho→amarelo→verde
    if (fill > 0) {
      const fg = ctx.createLinearGradient(mx, 0, mx + mw, 0)
      fg.addColorStop(0,    "#ef4444")
      fg.addColorStop(0.28, "#f59e0b")
      fg.addColorStop(0.55, "#22c55e")
      fg.addColorStop(1,    "#4ade80")
      ctx.fillStyle = fg
      if (isDanger) { ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 10 * dangerPulse }
      ctx.beginPath(); ctx.roundRect(mx, my, mw * fill, mh, 7); ctx.fill()
      ctx.shadowBlur = 0
    }

    // Brilho no topo da barra (reflexo)
    ctx.save()
    ctx.beginPath(); ctx.roundRect(mx, my, mw * fill, mh * 0.4, [7,7,0,0])
    ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fill()
    ctx.restore()

    // Marcador central — GH style divider
    const midX = mx + mw / 2
    ctx.beginPath(); ctx.moveTo(midX, my - 4); ctx.lineTo(midX, my + mh + 4)
    ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 2; ctx.stroke()
    // Losango no centro
    ctx.save()
    ctx.translate(midX, my - 6)
    ctx.beginPath(); ctx.moveTo(0,-4); ctx.lineTo(4,0); ctx.lineTo(0,4); ctx.lineTo(-4,0); ctx.closePath()
    ctx.fillStyle = "rgba(255,255,255,0.70)"; ctx.fill()
    ctx.restore()

    ctx.restore()
  }

  // ── Instrumento: canto inferior direito, minimalista ─────────────────
  {
    ctx.save()
    const barW = 68, barH = 4, bx = w - barW - 12, by = h - 14
    const vc = instrumentVol > 0.65 ? "#22c55e" : instrumentVol > 0.30 ? "#f59e0b" : "#ef4444"
    ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.font = "600 6px monospace"
    ctx.textAlign = "right"; ctx.textBaseline = "bottom"
    ctx.fillText("INSTR", bx + barW, by - 2)
    ctx.fillStyle = "rgba(255,255,255,0.06)"
    ctx.beginPath(); ctx.roundRect(bx, by, barW, barH, 2); ctx.fill()
    if (instrumentVol > 0.01) {
      const fg = ctx.createLinearGradient(bx, 0, bx + barW*instrumentVol, 0)
      fg.addColorStop(0, vc+"99"); fg.addColorStop(1, vc)
      ctx.fillStyle = fg
      ctx.beginPath(); ctx.roundRect(bx, by, barW*instrumentVol, barH, 2); ctx.fill()
    }
    ctx.restore()
  }
  // ── Encerra câmera shake ──────────────────────────────────────────────
  if (cameraShake && starPower) { ctx.restore() }

  // ── Star Power: B&W desaturação overlay (notas preservam cor) ─────────
  if (spBW) {
    ctx.save()
    ctx.globalCompositeOperation = "saturation"
    ctx.globalAlpha = 0.82
    ctx.fillStyle = "#888"
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
    // Brilho das bordas ciano intensificado
    ctx.save()
    ctx.globalCompositeOperation = "screen"
    ctx.globalAlpha = 0.06
    ctx.fillStyle = "#00ffff"
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  // ── Rock meter crítico: vinheta vermelha pulsante ─────────────────────
  if (dangerMode) {
    const pulse = failWarning
      ? 0.45 + Math.abs(Math.sin(now * 0.008)) * 0.35
      : 0.18 + Math.abs(Math.sin(now * 0.004)) * 0.12
    const vig = ctx.createRadialGradient(w/2, h/2, h*0.25, w/2, h/2, h*0.80)
    vig.addColorStop(0, "transparent")
    vig.addColorStop(1, `rgba(200,0,0,${pulse})`)
    ctx.save()
    ctx.fillStyle = vig
    ctx.fillRect(0, 0, w, h)
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
