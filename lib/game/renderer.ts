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
// Tamanho das notas proporcional à largura da lane (responsivo a qualquer resolução)
// rx = 42% da meia-largura da lane; ry = 32% de rx (nota achatada estilo GH)
function noteRX(laneW: number) { return Math.max(12, Math.min(laneW * 0.42, 48)) }
function noteRY(laneW: number) { return Math.max(4,  Math.min(laneW * 0.13, 14)) }
// Valores de referência para efeitos que não têm laneW facilmente (mantidos para compat)
const NOTE_RX_BASE      = 33
const NOTE_RY_BASE      = 11
const SUSTAIN_WIDTH     = 16
const STAR_POWER_COMBO  = 30

// ── Paletas de Star Power por tema ──────────────────────────────────────────
// Cada tema tem sua cor primária de SP que substitui o cyan padrão
interface SPPalette {
  primary: string      // cor principal (hex)
  primaryRgb: string   // rgb da cor principal "r,g,b"
  secondary: string    // cor secundária para raios alternados
  secondaryRgb: string
  sustainColor: string // cor dos sustains em SP
  glowColor: string    // cor do glow ambiente
  starFill1: string    // gradiente estrela sp (topo)
  starFill2: string    // gradiente estrela sp (meio)
  starFill3: string    // gradiente estrela sp (base)
}

const SP_PALETTES: Record<string, SPPalette> = {
  default: {
    primary: "#00ffff", primaryRgb: "0,255,255",
    secondary: "#6040ff", secondaryRgb: "96,64,255",
    sustainColor: "#EF6DF7",
    glowColor: "rgba(0,180,255,0.14)",
    starFill1: "#aaffff", starFill2: "#00ddff", starFill3: "#007799",
  },
  neon: {
    primary: "#00ff88", primaryRgb: "0,255,136",
    secondary: "#ff00cc", secondaryRgb: "255,0,204",
    sustainColor: "#88ffcc",
    glowColor: "rgba(0,255,136,0.14)",
    starFill1: "#ccffee", starFill2: "#00ff88", starFill3: "#007744",
  },
  fire: {
    primary: "#ff6600", primaryRgb: "255,102,0",
    secondary: "#ffcc00", secondaryRgb: "255,204,0",
    sustainColor: "#ffaa44",
    glowColor: "rgba(255,100,0,0.18)",
    starFill1: "#ffeeaa", starFill2: "#ff8800", starFill3: "#aa3300",
  },
  space: {
    primary: "#aa44ff", primaryRgb: "170,68,255",
    secondary: "#4488ff", secondaryRgb: "68,136,255",
    sustainColor: "#cc88ff",
    glowColor: "rgba(120,60,255,0.18)",
    starFill1: "#eeccff", starFill2: "#aa44ff", starFill3: "#440099",
  },
  wood: {
    primary: "#ffcc66", primaryRgb: "255,204,102",
    secondary: "#cc8833", secondaryRgb: "204,136,51",
    sustainColor: "#ddaa55",
    glowColor: "rgba(200,140,50,0.14)",
    starFill1: "#fff2cc", starFill2: "#ffcc66", starFill3: "#886622",
  },
  retro: {
    primary: "#ff1493", primaryRgb: "255,20,147",
    secondary: "#00ffcc", secondaryRgb: "0,255,204",
    sustainColor: "#ff88cc",
    glowColor: "rgba(255,20,147,0.16)",
    starFill1: "#ffccee", starFill2: "#ff1493", starFill3: "#880055",
  },
  ice: {
    primary: "#88eeff", primaryRgb: "136,238,255",
    secondary: "#ffffff", secondaryRgb: "255,255,255",
    sustainColor: "#ccf4ff",
    glowColor: "rgba(136,238,255,0.16)",
    starFill1: "#ffffff", starFill2: "#88eeff", starFill3: "#2299bb",
  },
}

function getSPPalette(theme: string): SPPalette {
  return SP_PALETTES[theme] ?? SP_PALETTES.default
}

// ── Cores do tema — extraídas do guitar.ini fornecido ───────────────────────
// [guitar] note_green/red/yellow/blue/orange
const NOTE_COLORS = [
  "#FF0000",  // Green
  "#FF7800",  // Red
  "#FFFF00",  // Yellow
  "#0089FF",  // Blue
  "#5AFF00",  // Orange
  "#CC44FF",  // Purple (lane 6)
]
// [guitar] note_anim_green/red/yellow/blue/orange (glow das notas)
const NOTE_ANIM_COLORS = [
  "#FF0000",  "#FFC28B",  "#FFFF57",  "#77D1FF",  "#74FF28",
  "#E080FF",  // Purple anim
]
// [guitar] striker_cover (aro externo do hit target)
const STRIKER_COVER = [
  "#B40000",  "#B45500",  "#B4B200",  "#0061B4",  "#40B400",
  "#8800CC",  // Purple
]
// [guitar] striker_head_cover (head cover interno)
const STRIKER_HEAD_COVER = [
  "#B40000",  "#B45500",  "#B4B200",  "#0061B4",  "#40B400",
  "#8800CC",
]
// [guitar] striker_head_light (luz interna do hit target pressionado)
const STRIKER_HEAD_LIGHT = [
  "#FF0000",  "#FF7800",  "#FFFF00",  "#0089FF",  "#5AFF00",
  "#CC44FF",
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
  "#FF0000",  "#FF7800",  "#FFFF00",  "#00C5FF",  "#80FF3B",
  "#CC44FF",  // Purple
]
// [other] combo glow
const COMBO_GLOW = ["#FFDD00","#D55800","#00FF00","#4E7F9E","#B2E1FF","#CC44FF"]

// ── Cache ──────────────────────────────────────────────────────────────────
// Cache: [diffKey][starPower] -> OffscreenCanvas
const _fretCache = new Map<string, OffscreenCanvas>()
// Cache de notas pré-renderizadas: evita recriar gradientes a cada frame
const _noteCache = new Map<string, OffscreenCanvas>()
const MAX_NOTE_CACHE = 48
let _fretW = 0, _fretH = 0

/** Limpa o cache do fretboard — chamar quando o tema muda */
export function clearFretCache(): void {
  _fretCache.clear()
}

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
  laneCount?: number
  noteShape?: "circle" | "square" | "diamond"
  highwayTheme?: "default" | "neon" | "fire" | "space" | "wood" | "retro" | "ice"
  cameraShake?: boolean
  topBarH?: number
  songMeta?: { artist?: string; name?: string }
  songProgress?: number  // 0-1, progresso da música para a barra
}

export function getHitLineY(h: number) { return h * HIT_LINE_Y_RATIO }

function project(lane: number, timeAhead: number, canvas: HTMLCanvasElement, noteSpeed: number, lc = LANE_COUNT) {
  const dpr = (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1
  const w = canvas.width / dpr, h = canvas.height / dpr
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

export function getLaneX(lane: number, cw: number, lc = LANE_COUNT) {
  const tw = cw * TRACK_WIDTH_RATIO
  return (cw - tw) / 2 + lane * (tw / lc) + (tw / lc) / 2
}
export function getLaneWidth(cw: number, lc = LANE_COUNT) { return (cw * TRACK_WIDTH_RATIO) / lc }

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
// ── Configuração de temas de highway ─────────────────────────────────────────
// Cada tema define: overlay sobre a imagem, cor das grades/divisores, glow das bordas
const HIGHWAY_THEME_CONFIG: Record<string, {
  imgAlpha: number          // opacidade da imagem base
  overlayStops: [string, number][]  // cor+posição do overlay sobre a imagem
  gridColor: string         // RGB das linhas horizontais
  divColor: string          // cor dos divisores de lane
  borderColor: string       // cor das bordas da highway
  borderGlow: string        // glow das bordas
  fogColor: string          // névoa no horizonte
}> = {
  default: {
    imgAlpha: 0.82,
    overlayStops: [],
    gridColor: "0,200,255",
    divColor: "rgba(0,180,220,0.22)",
    borderColor: "rgba(0,210,255,0.70)",
    borderGlow: "rgba(0,210,255,0.80)",
    fogColor: "rgba(0,0,0,0.97)",
  },
  neon: {
    imgAlpha: 0.55,
    overlayStops: [
      ["rgba(0,255,180,0.22)", 0],
      ["rgba(180,0,255,0.18)", 0.5],
      ["rgba(0,200,255,0.14)", 1],
    ],
    gridColor: "0,255,180",
    divColor: "rgba(180,0,255,0.40)",
    borderColor: "rgba(0,255,180,0.90)",
    borderGlow: "rgba(0,255,180,0.95)",
    fogColor: "rgba(0,0,20,0.97)",
  },
  fire: {
    imgAlpha: 0.50,
    overlayStops: [
      ["rgba(255,60,0,0.28)", 0],
      ["rgba(255,160,0,0.20)", 0.4],
      ["rgba(200,0,0,0.15)", 1],
    ],
    gridColor: "255,140,0",
    divColor: "rgba(255,80,0,0.45)",
    borderColor: "rgba(255,120,0,0.90)",
    borderGlow: "rgba(255,80,0,0.95)",
    fogColor: "rgba(20,0,0,0.97)",
  },
  space: {
    imgAlpha: 0.45,
    overlayStops: [
      ["rgba(60,0,200,0.30)", 0],
      ["rgba(0,80,255,0.22)", 0.5],
      ["rgba(100,0,180,0.18)", 1],
    ],
    gridColor: "100,60,255",
    divColor: "rgba(80,0,255,0.40)",
    borderColor: "rgba(120,80,255,0.90)",
    borderGlow: "rgba(100,0,255,0.95)",
    fogColor: "rgba(0,0,15,0.97)",
  },
  wood: {
    imgAlpha: 0.65,
    overlayStops: [
      ["rgba(140,70,10,0.25)", 0],
      ["rgba(100,50,5,0.18)", 0.6],
      ["rgba(60,30,0,0.12)", 1],
    ],
    gridColor: "200,130,50",
    divColor: "rgba(160,80,20,0.40)",
    borderColor: "rgba(200,120,40,0.85)",
    borderGlow: "rgba(180,90,20,0.90)",
    fogColor: "rgba(10,5,0,0.97)",
  },
  retro: {
    imgAlpha: 0.48,
    overlayStops: [
      ["rgba(255,20,150,0.22)", 0],
      ["rgba(255,200,0,0.16)", 0.4],
      ["rgba(0,200,100,0.14)", 1],
    ],
    gridColor: "255,200,0",
    divColor: "rgba(255,20,150,0.45)",
    borderColor: "rgba(255,200,0,0.90)",
    borderGlow: "rgba(255,20,150,0.95)",
    fogColor: "rgba(10,0,20,0.97)",
  },
  ice: {
    imgAlpha: 0.50,
    overlayStops: [
      ["rgba(180,240,255,0.22)", 0],
      ["rgba(0,180,255,0.18)", 0.5],
      ["rgba(100,220,255,0.12)", 1],
    ],
    gridColor: "140,220,255",
    divColor: "rgba(100,200,255,0.40)",
    borderColor: "rgba(160,230,255,0.90)",
    borderGlow: "rgba(120,210,255,0.95)",
    fogColor: "rgba(0,5,15,0.97)",
  },
}

function buildFretboard(w: number, h: number, starPower: boolean, diff: number, lc = LANE_COUNT, theme = "default"): OffscreenCanvas {
  const oc = new OffscreenCanvas(w, h)
  const ctx = oc.getContext("2d")!
  const vanishY = h * VANISHING_Y_RATIO, hitY = h * HIT_LINE_Y_RATIO
  const trackBot = w * TRACK_WIDTH_RATIO, trackTop = w * TRACK_WIDTH_TOP
  const tLB = (w-trackBot)/2, tRB = tLB+trackBot
  const tLT = (w-trackTop)/2, tRT = tLT+trackTop

  const tc = HIGHWAY_THEME_CONFIG[theme] ?? HIGHWAY_THEME_CONFIG.default
  const sp = getSPPalette(theme)

  // Recorte do fretboard
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(tLB,hitY); ctx.lineTo(tRB,hitY); ctx.lineTo(tRT,vanishY); ctx.lineTo(tLT,vanishY)
  ctx.closePath(); ctx.clip()

  // ── Fundo base (cor do SP varia com tema) ─────────────────────────────
  {
    const bg = ctx.createLinearGradient(0, vanishY, 0, hitY)
    if (starPower) {
      // Fundo tintado com a cor SP do tema
      const [r,g,b] = sp.primaryRgb.split(",").map(Number)
      bg.addColorStop(0,   `rgba(${Math.min(r*0.08,20)},${Math.min(g*0.08,20)},${Math.min(b*0.08,28)},1.0)`)
      bg.addColorStop(0.5, `rgba(${Math.min(r*0.10,25)},${Math.min(g*0.10,25)},${Math.min(b*0.10,36)},1.0)`)
      bg.addColorStop(1,   `rgba(${Math.min(r*0.12,30)},${Math.min(g*0.12,30)},${Math.min(b*0.12,42)},1.0)`)
    } else {
      bg.addColorStop(0,   "rgba(4,6,10,1.0)")
      bg.addColorStop(0.5, "rgba(6,8,14,1.0)")
      bg.addColorStop(1,   "rgba(8,10,16,1.0)")
    }
    ctx.fillStyle = bg; ctx.fillRect(0,0,w,h)
  }

  // ── Textura da highway (imagem real, perspectiva trapézio) ────────────────
  const hwKey = diffToHwKey(diff)
  const hwImg = _hwImages[hwKey]
  if (hwImg && hwImg.complete && hwImg.naturalWidth > 0) {
    const iw = hwImg.naturalWidth, ih = hwImg.naturalHeight
    const COLS = 40, ROWS = 40
    const fH = hitY - vanishY

    ctx.save()
    ctx.globalAlpha = starPower ? tc.imgAlpha * 0.62 : tc.imgAlpha

    for (let c = 0; c < COLS; c++) {
      const t0 = c / COLS, t1 = (c + 1) / COLS
      const bx0 = tLB + trackBot * t0, bx1 = tLB + trackBot * t1
      const tx0 = tLT + trackTop * t0, tx1 = tLT + trackTop * t1
      const sx0 = iw * t0, sw = iw * (t1 - t0)

      for (let r = 0; r < ROWS; r++) {
        const v0 = r / ROWS, v1 = (r + 1) / ROWS
        const cy0 = vanishY + fH * v0, cy1 = vanishY + fH * v1
        const dx0 = tx0 + (bx0 - tx0) * v0
        const dw0 = (tx1 - tx0) + ((bx1 - bx0) - (tx1 - tx0)) * v0
        const sy0 = ih * v0, sh = ih * (v1 - v0)

        ctx.drawImage(hwImg,
          sx0, sy0, sw, sh,
          dx0, cy0, dw0, cy1 - cy0
        )
      }
    }
    ctx.restore()

    // ── Overlay colorido do tema SOBRE a imagem ───────────────────────
    if (tc.overlayStops.length > 0 || starPower) {
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(tLB,hitY); ctx.lineTo(tRB,hitY); ctx.lineTo(tRT,vanishY); ctx.lineTo(tLT,vanishY)
      ctx.closePath(); ctx.clip()

      // Overlay base do tema
      if (tc.overlayStops.length > 0) {
        const grad = ctx.createLinearGradient(0, vanishY, 0, hitY)
        tc.overlayStops.forEach(([color, pos]) => grad.addColorStop(pos, color))
        ctx.fillStyle = grad
        ctx.globalCompositeOperation = "screen"
        ctx.fillRect(tLB, vanishY, trackBot, hitY - vanishY)
        ctx.globalCompositeOperation = "source-over"
      }

      // Overlay adicional de Star Power na cor do tema
      if (starPower) {
        const spGrad = ctx.createLinearGradient(0, vanishY, 0, hitY)
        spGrad.addColorStop(0,   `rgba(${sp.primaryRgb},0.18)`)
        spGrad.addColorStop(0.4, `rgba(${sp.primaryRgb},0.10)`)
        spGrad.addColorStop(1,   `rgba(${sp.secondaryRgb},0.08)`)
        ctx.fillStyle = spGrad
        ctx.globalCompositeOperation = "screen"
        ctx.fillRect(tLB, vanishY, trackBot, hitY - vanishY)
        ctx.globalCompositeOperation = "source-over"

        // Brilho pulsante nas bordas da highway em SP
        const t0 = Date.now() * 0.001
        const pulse = 0.06 + Math.sin(t0 * 2.5) * 0.03
        const leftG = ctx.createLinearGradient(tLB, 0, tLB + trackBot * 0.15, 0)
        leftG.addColorStop(0, `rgba(${sp.primaryRgb},${pulse})`)
        leftG.addColorStop(1, "transparent")
        ctx.fillStyle = leftG; ctx.fillRect(tLB, vanishY, trackBot * 0.15, hitY - vanishY)

        const rightG = ctx.createLinearGradient(tRB, 0, tRB - trackBot * 0.15, 0)
        rightG.addColorStop(0, `rgba(${sp.primaryRgb},${pulse})`)
        rightG.addColorStop(1, "transparent")
        ctx.fillStyle = rightG; ctx.fillRect(tRB - trackBot * 0.15, vanishY, trackBot * 0.15, hitY - vanishY)
      }

      ctx.restore()
    }
  }

  // Reflexo central
  {
    const cg = ctx.createRadialGradient(w/2, hitY, 0, w/2, vanishY, trackBot*0.7)
    cg.addColorStop(0, starPower ? `rgba(${sp.primaryRgb},0.10)` : "rgba(0,160,200,0.04)")
    cg.addColorStop(1, "transparent")
    ctx.fillStyle = cg; ctx.fillRect(0,0,w,h)
  }

  // ── Linhas horizontais da grade ────────────────────────────────────────
  function edgeX(frac: number, y: number) {
    const prog = (hitY-y)/(hitY-vanishY), tw = trackBot+(trackTop-trackBot)*prog
    return (w-tw)/2+tw*frac
  }
  const gridColor = starPower ? sp.primaryRgb : tc.gridColor
  for (let r = 1; r < 9; r++) {
    const t = r/9
    const y = hitY-(hitY-vanishY)*Math.pow(t,0.74)
    const al = (1-t) * (starPower ? 0.45 : 0.28)
    ctx.beginPath(); ctx.moveTo(edgeX(0,y),y); ctx.lineTo(edgeX(1,y),y)
    ctx.strokeStyle=`rgba(${gridColor},${al})`; ctx.lineWidth=1; ctx.stroke()
  }

  // ── Divisores de lane ──────────────────────────────────────────────────
  const divColor   = starPower ? `rgba(${sp.primaryRgb},0.35)` : tc.divColor
  const borderColor= starPower ? `rgba(${sp.primaryRgb},0.85)` : tc.borderColor
  for (let i = 0; i <= lc; i++) {
    const bx = tLB+(trackBot/lc)*i, tx = tLT+(trackTop/lc)*i
    const border = i===0||i===lc
    ctx.beginPath(); ctx.moveTo(bx,hitY); ctx.lineTo(tx,vanishY)
    ctx.strokeStyle = border ? borderColor : divColor
    ctx.lineWidth = border?2:1; ctx.stroke()
  }

  // ── Bordas com glow ────────────────────────────────────────────────────
  ctx.save()
  ctx.shadowColor = starPower ? sp.primary : tc.borderGlow
  ctx.shadowBlur = 22
  for (const [bx,tx] of [[tLB,tLT],[tRB,tRT]] as [number,number][]) {
    ctx.beginPath(); ctx.moveTo(bx,hitY); ctx.lineTo(tx,vanishY)
    ctx.strokeStyle = starPower ? `rgba(${sp.primaryRgb},0.90)` : tc.borderColor
    ctx.lineWidth=2.5; ctx.stroke()
  }
  ctx.shadowBlur=0; ctx.restore()

  ctx.restore() // unclip

  // ── Névoa no horizonte ─────────────────────────────────────────────────
  const fog = ctx.createLinearGradient(0,vanishY-8,0,vanishY+60)
  fog.addColorStop(0, tc.fogColor); fog.addColorStop(1,"rgba(0,0,0,0)")
  ctx.fillStyle=fog; ctx.fillRect(0,vanishY-8,w,68)

  return oc
}

function getFretboard(w: number, h: number, starPower: boolean, diff: number, lc = LANE_COUNT, theme = "default"): OffscreenCanvas {
  loadHighwayImages()
  const key = `${w}x${h}:${diffToHwKey(diff)}:${starPower?1:0}:lc${lc}:${theme}`
  if (_fretW !== w || _fretH !== h) {
    _fretCache.clear()
    _fretW = w; _fretH = h
  }
  let cached = _fretCache.get(key)
  if (!cached) {
    cached = buildFretboard(w, h, starPower, diff, lc, theme)
    _fretCache.set(key, cached)
  }
  return cached
}

// ── Star Power: raios na hit line + bordas laterais da TELA ─────────────────
function drawStarPowerLightning(ctx: CanvasRenderingContext2D, w: number, h: number, now: number, combo: number, theme = "default") {
  if (combo < STAR_POWER_COMBO) return
  const intensity = Math.min(1, (combo-STAR_POWER_COMBO)/25)
  const hitY = h*HIT_LINE_Y_RATIO
  const tBot = w*TRACK_WIDTH_RATIO, tL=(w-tBot)/2, tR=tL+tBot
  const t = now*0.001
  const sp = getSPPalette(theme)
  ctx.save()

  // ── Glow na hit line ───────────────────────────────────────────────────
  const hGlow=ctx.createLinearGradient(tL,0,tR,0)
  hGlow.addColorStop(0,"transparent")
  hGlow.addColorStop(0.08,`rgba(${sp.primaryRgb},${0.25*intensity})`)
  hGlow.addColorStop(0.5,`rgba(${sp.primaryRgb},${0.65*intensity})`)
  hGlow.addColorStop(0.92,`rgba(${sp.primaryRgb},${0.25*intensity})`)
  hGlow.addColorStop(1,"transparent")
  ctx.fillStyle=hGlow; ctx.fillRect(tL,hitY-6,tBot,12)

  ctx.beginPath(); ctx.moveTo(tL,hitY); ctx.lineTo(tR,hitY)
  ctx.strokeStyle=`rgba(${sp.primaryRgb},${0.75*intensity})`; ctx.lineWidth=2.5
  ctx.shadowColor=sp.primary; ctx.shadowBlur=16*intensity
  ctx.stroke(); ctx.shadowBlur=0

  // ── Raios nas bordas do fretboard ─────────────────────────────────────
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
    const useSecondary = ((b + (side ? 1 : 0)) % 2) === 0
    const bc = useSecondary ? sp.secondaryRgb : sp.primaryRgb
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
    ctx.fillStyle=`rgba(${sp.primaryRgb},${(0.5+Math.abs(Math.sin(t*2+p*0.7))*0.4)*intensity})`
    ctx.shadowColor=sp.primary; ctx.shadowBlur=8; ctx.fill(); ctx.shadowBlur=0
  }

  // ── RAIOS VERTICAIS NAS BORDAS DA TELA ────────────────────────────────
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
      const useSecondary=(b+side)%2===0
      const bc=useSecondary ? sp.secondaryRgb : sp.primaryRgb
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
      ctx.fillStyle=`rgba(${sp.primaryRgb},${(0.5+Math.abs(Math.sin(phase*2.5))*0.45)*intensity})`
      ctx.shadowColor=sp.primary; ctx.shadowBlur=10*intensity; ctx.fill(); ctx.shadowBlur=0
    }
  }

  // Glow ambiente lateral com cor do tema
  const lG=ctx.createLinearGradient(0,0,w*0.18,0)
  lG.addColorStop(0,sp.glowColor.replace("0.14", String(0.14*intensity))); lG.addColorStop(1,"transparent")
  ctx.fillStyle=lG; ctx.fillRect(0,0,w*0.18,h)
  const rG=ctx.createLinearGradient(w*0.82,0,w,0)
  rG.addColorStop(0,"transparent"); rG.addColorStop(1,sp.glowColor.replace("0.14", String(0.14*intensity)))
  ctx.fillStyle=rG; ctx.fillRect(w*0.82,0,w*0.18,h)

  ctx.restore()
}

// ── Nota estilo GH:WoR — disco flat prata/cinza, aro cyan luminoso ──────────

// Traça o path do shape da nota (usado para clip e fill)
function noteShapePath(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, shape: string) {
  ctx.beginPath()
  if (shape === "square") {
    const s = rx * 1.55
    const r = s * 0.22
    ctx.moveTo(x - s + r, y - s)
    ctx.lineTo(x + s - r, y - s)
    ctx.quadraticCurveTo(x + s, y - s, x + s, y - s + r)
    ctx.lineTo(x + s, y + s - r)
    ctx.quadraticCurveTo(x + s, y + s, x + s - r, y + s)
    ctx.lineTo(x - s + r, y + s)
    ctx.quadraticCurveTo(x - s, y + s, x - s, y + s - r)
    ctx.lineTo(x - s, y - s + r)
    ctx.quadraticCurveTo(x - s, y - s, x - s + r, y - s)
    ctx.closePath()
  } else if (shape === "diamond") {
    const s = rx * 1.6
    ctx.moveTo(x,     y - s)
    ctx.lineTo(x + s, y)
    ctx.lineTo(x,     y + s)
    ctx.lineTo(x - s, y)
    ctx.closePath()
  } else {
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  }
}

// Desenha nota usando cache de OffscreenCanvas — só reconstrói quando muda tamanho/lane/shape
function drawNoteGH(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  rx: number, ry: number,
  laneIdx: number,
  starPower: boolean,
  now: number,
  shape: "circle" | "square" | "diamond" = "circle",
  spColor = "#00ffff",
  spColorRgb = "0,255,255"
) {
  const sp  = starPower
  const rxR = Math.round(rx * 2) / 2
  const ryR = Math.round(ry * 2) / 2
  // spColor faz parte do cache key — temas diferentes geram notas diferentes
  const cacheKey = `n:${laneIdx}:${rxR}:${ryR}:${sp?1:0}:${shape}:${sp?spColor:"def"}`

  let cached = _noteCache.get(cacheKey)
  if (!cached) {
    if (_noteCache.size >= MAX_NOTE_CACHE) {
      const firstKey = _noteCache.keys().next().value
      if (firstKey) _noteCache.delete(firstKey)
    }
    const pad = Math.ceil(rxR * 3.5)
    const ow  = Math.ceil(rxR * 2 + pad * 2)
    const oh  = Math.ceil(ryR * 2 + pad * 2)
    const oc  = new OffscreenCanvas(ow, oh)
    _drawNoteGHInner(oc.getContext('2d')!, ow / 2, oh / 2, rxR, ryR, laneIdx, sp, shape, spColor)
    cached = oc
    _noteCache.set(cacheKey, cached)
  }

  // Blit do cache (barato — sem gradientes)
  ctx.drawImage(cached, Math.round(x - cached.width / 2), Math.round(y - cached.height / 2))

  // Corona pulsante animada (só 1 ellipse fill por nota — custo mínimo)
  const t      = now * 0.003
  const anim   = NOTE_ANIM_COLORS[laneIdx] ?? "#ffffff"
  const rgb    = hexToRgb(sp ? spColor : anim)
  const flick  = 0.82 + Math.sin(t * 2.4 + x * 0.03) * 0.18
  ctx.globalAlpha = sp ? 0.45 : 0.28
  ctx.beginPath()
  ctx.ellipse(x, y + ryR * 0.3, rxR * 0.45 * flick, ryR * 1.6 * flick, 0, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${rgb},0.9)`
  ctx.fill()
  ctx.globalAlpha = 1
}


// ── Helper interno para renderizar nota em OffscreenCanvas (sem animação) ──────
function _drawNoteGHInner(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  x: number, y: number,
  rx: number, ry: number,
  laneIdx: number,
  sp: boolean,
  shape: "circle" | "square" | "diamond",
  spColor = "#00ffff"
) {
  const laneCol  = NOTE_COLORS[laneIdx]  ?? "#00e5ff"
  const laneAnim = NOTE_ANIM_COLORS[laneIdx] ?? laneCol
  const rimCol   = sp ? spColor : laneCol
  const rimAnim  = sp ? spColor : laneAnim
  const rimRgb   = hexToRgb(rimCol)
  const rimAnimRgb = hexToRgb(rimAnim)
  const glowInt  = sp ? 28 : 20

  ctx.save()

  // Glow externo
  const haloG = (ctx as CanvasRenderingContext2D).createRadialGradient(x, y, rx*0.5, x, y, rx*3.2)
  haloG.addColorStop(0,   `rgba(${rimAnimRgb},${sp?0.30:0.18})`)
  haloG.addColorStop(1,   "transparent")
  ctx.fillStyle = haloG
  noteShapePath(ctx as CanvasRenderingContext2D, x, y, rx*3.2, ry*3.2, shape); ctx.fill()

  // Shadow drop
  ctx.save(); ctx.globalAlpha = 0.35
  ctx.beginPath(); ctx.ellipse(x, y + ry*1.0, rx*0.82, ry*0.20, 0, 0, Math.PI*2)
  ctx.fillStyle = "rgba(0,0,0,1)"; ctx.fill(); ctx.restore()

  // Glow edge
  ctx.shadowColor = rimCol; ctx.shadowBlur = glowInt

  // Base metálica
  const baseG = (ctx as CanvasRenderingContext2D).createRadialGradient(x - rx*0.20, y - ry*0.35, 0, x, y, rx*1.05)
  baseG.addColorStop(0,    "#3a3a3a")
  baseG.addColorStop(0.30, "#1e1e1e")
  baseG.addColorStop(0.70, "#111111")
  baseG.addColorStop(1,    "#080808")
  noteShapePath(ctx as CanvasRenderingContext2D, x, y, rx, ry, shape)
  ctx.fillStyle = baseG; ctx.fill()
  ctx.shadowBlur = 0

  // Aro externo
  noteShapePath(ctx as CanvasRenderingContext2D, x, y, rx, ry, shape)
  ctx.strokeStyle = rimCol
  ctx.lineWidth = Math.max(1.8, rx * 0.12)
  ctx.shadowColor = rimCol; ctx.shadowBlur = glowInt * 1.2
  ctx.stroke(); ctx.shadowBlur = 0

  // Anel interno
  ctx.beginPath(); ctx.ellipse(x, y, rx*0.68, ry*0.68, 0, 0, Math.PI*2)
  ctx.strokeStyle = `rgba(${rimRgb},${sp?0.70:0.45})`
  ctx.lineWidth = 1.0; ctx.stroke()

  // Centro escuro
  ctx.beginPath(); ctx.ellipse(x, y, rx*0.46, ry*0.46, 0, 0, Math.PI*2)
  ctx.fillStyle = "#0a0a0a"; ctx.fill()

  // Dot reflexo
  const dotG = (ctx as CanvasRenderingContext2D).createRadialGradient(x - rx*0.08, y - ry*0.15, 0, x, y, rx*0.32)
  dotG.addColorStop(0,    `rgba(${rimRgb},${sp?0.85:0.60})`)
  dotG.addColorStop(0.5,  `rgba(${rimRgb},0.12)`)
  dotG.addColorStop(1,    "transparent")
  ctx.fillStyle = dotG; ctx.fill()

  // Shine especular
  ctx.save()
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI*2); ctx.clip()
  const shG = (ctx as CanvasRenderingContext2D).createRadialGradient(x - rx*0.28, y - ry*0.48, 0, x, y - ry*0.1, rx*0.58)
  shG.addColorStop(0,    "rgba(255,255,255,0.75)")
  shG.addColorStop(0.18, "rgba(255,255,255,0.18)")
  shG.addColorStop(1,    "transparent")
  ctx.fillStyle = shG; ctx.fill(); ctx.restore()

  ctx.restore()
}

// ── Hit target estilo GH:WoR — anel duplo, centro escuro, aro colorido por lane ─
function drawHitTarget(
  ctx: CanvasRenderingContext2D,
  x: number, baseHitY: number,
  laneIdx: number, pressed: boolean,
  starPower: boolean, now: number,
  jumpY: number = 0, scaleX: number = 1, scaleY: number = 1,
  baseRX: number = NOTE_RX_BASE, baseRY: number = NOTE_RY_BASE,
  spColor = "#00ffff",
  spColorRgb = "0,255,255"
) {
  const hitY  = baseHitY - jumpY
  const sp    = starPower
  const laneColor = STRIKER_COVER[laneIdx] ?? "#ffffff"
  const headLight = STRIKER_HEAD_LIGHT[laneIdx] ?? laneColor
  const c     = sp ? spColor : laneColor
  const cRgb  = sp ? spColorRgb : hexToRgb(laneColor)
  const rx    = (baseRX + 8) * scaleX
  const ry    = (baseRY + 8) * scaleY
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
    : sp ? `rgba(${spColorRgb},0.40)` : "rgba(255,255,255,0.08)"
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
    innerG.addColorStop(0.15, sp ? spColor : headLight)
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
  const hlRgb = sp ? spColorRgb : hexToRgb(headLight)
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
    const flameRgb   = sp ? spColorRgb : hexToRgb(HIT_FLAME_COLOR)
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
      const sparkRgb = sp ? spColorRgb : hexToRgb(HIT_PARTICLE_COLOR)
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
  starPower: boolean = false,
  spColor = "#00ffff", spColorRgb = "0,255,255"
) {
  const isPerfect = rating === "perfect"
  const isGreat   = rating === "great"
  const burstCol  = starPower ? "#ffffff" : "#00e5ff"
  const burstRgb  = starPower ? "255,255,255" : "0,229,255"
  const sparkCol  = starPower ? spColor : HIT_PARTICLE_COLOR
  const sparkRgb  = starPower ? spColorRgb : hexToRgb(HIT_PARTICLE_COLOR)
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
  ctx.fillStyle = color; ctx.font = "bold 9px 'Arial Black', Arial, sans-serif"
  ctx.textAlign = "center"; ctx.textBaseline = "top"
  ctx.shadowColor = color; ctx.shadowBlur = 6
  ctx.fillText(label, x, y)
  ctx.shadowBlur = 0; ctx.restore()
}

// ── RENDER PRINCIPAL ──────────────────────────────────────────────────────────
export function renderFrame(state: RenderState): void {
  const { canvas, ctx, notes, currentTime, stats, hitEffects, keysDown, speed, showGuide, keyLabels, difficulty = 2, laneCount: LC = LANE_COUNT, noteShape = "circle", highwayTheme = "default", cameraShake = true, topBarH = 0 } = state
  // Usar dimensões CSS (não físicas) para que as coords batam com o ctx já escalado pelo dpr
  const dpr = (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1
  const w = canvas.width / dpr
  const h = canvas.height / dpr
  const ns=NOTE_SPEED_BASE*speed
  const hitY=h*HIT_LINE_Y_RATIO, vanishY=h*VANISHING_Y_RATIO
  const trackBot=w*TRACK_WIDTH_RATIO
  const tLB=(w-trackBot)/2, tRB=tLB+trackBot
  const laneW=trackBot/LC   // largura de cada lane na hit line (base para tamanho das notas)
  const NRX=noteRX(laneW), NRY=noteRY(laneW)   // tamanho responsivo das notas
  // Escala de UI: 1.0 em 1080p, menor em telas pequenas, maior em 4K
  const uiScale = Math.max(0.5, Math.min(1.6, w / 1200))
  const now=performance.now()
  const starPower=stats.combo>=STAR_POWER_COMBO
  const spPal = getSPPalette(highwayTheme)  // paleta SP do tema ativo
  // Limpa o canvas (bordas ficam transparentes — mostra o background da música)
  ctx.clearRect(0, 0, w, h)

  // Qualidade de renderização
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  // ── Câmera shake (star power ativo) ────────────────────────────────────
  let shakeX = 0, shakeY = 0
  if (cameraShake && starPower) {
    const t = performance.now()
    shakeX = (Math.sin(t * 0.041) * 2 + Math.sin(t * 0.073) * 1.5) * 0.8
    shakeY = (Math.cos(t * 0.031) * 1.5 + Math.cos(t * 0.059) * 1)  * 0.6
    ctx.save()
    ctx.translate(shakeX, shakeY)
  }

  // 1 – Fretboard (tema + star power integrados)
  ctx.shadowBlur = 0
  ctx.drawImage(getFretboard(w,h,starPower,difficulty,LC,highwayTheme),0,0)

  // 2 – Beat lines dinâmicas
  const visMs=2200/ns
  ctx.save()
  for (let ms=500; ms<visMs; ms+=500) {
    const p0=project(0,ms,canvas,ns,LC), p4=project(LC-1,ms,canvas,ns,LC)
    const hw0=laneWidthAt(w,1-p0.scale)*0.5, hw4=laneWidthAt(w,1-p4.scale)*0.5
    const al=(1-ms/visMs)*(starPower?0.32:0.18)
    ctx.beginPath(); ctx.moveTo(p0.x-hw0,p0.y); ctx.lineTo(p4.x+hw4,p4.y)
    ctx.strokeStyle=`rgba(0,200,255,${al})`
    ctx.lineWidth=Math.max(0.4,p0.scale*1.2); ctx.stroke()
  }
  ctx.restore()

  // 3 – Star Power efeitos visuais completos
  if (starPower) {
    const intensity = Math.min(1, (stats.combo - STAR_POWER_COMBO) / 25)
    const t = now * 0.001
    const sp = spPal

    ctx.save()

    // ── Vinheta pulsante nas bordas da tela ─────────────────────────────
    const vPulse = 0.18 + Math.sin(t * 2.8) * 0.06
    const vL = ctx.createLinearGradient(0, 0, w * 0.22, 0)
    vL.addColorStop(0, `rgba(${sp.primaryRgb},${vPulse * intensity})`)
    vL.addColorStop(1, "transparent")
    ctx.fillStyle = vL; ctx.fillRect(0, 0, w * 0.22, h)
    const vR = ctx.createLinearGradient(w, 0, w * 0.78, 0)
    vR.addColorStop(0, `rgba(${sp.primaryRgb},${vPulse * intensity})`)
    vR.addColorStop(1, "transparent")
    ctx.fillStyle = vR; ctx.fillRect(w * 0.78, 0, w * 0.22, h)
    const vT = ctx.createLinearGradient(0, 0, 0, h * 0.15)
    vT.addColorStop(0, `rgba(${sp.primaryRgb},${vPulse * 0.5 * intensity})`)
    vT.addColorStop(1, "transparent")
    ctx.fillStyle = vT; ctx.fillRect(0, 0, w, h * 0.15)
    const vB = ctx.createLinearGradient(0, h, 0, h * 0.82)
    vB.addColorStop(0, `rgba(${sp.primaryRgb},${vPulse * 0.4 * intensity})`)
    vB.addColorStop(1, "transparent")
    ctx.fillStyle = vB; ctx.fillRect(0, h * 0.82, w, h * 0.18)

    // ── Flash periódico de energia ───────────────────────────────────────
    const flashCycle = Math.sin(t * 4.5)
    if (flashCycle > 0.88) {
      const flashAlpha = (flashCycle - 0.88) / 0.12 * 0.08 * intensity
      ctx.fillStyle = `rgba(${sp.primaryRgb},${flashAlpha})`
      ctx.fillRect(0, 0, w, h)
    }

    // ── Partículas de energia voando pela tela ───────────────────────────
    for (let p = 0; p < 18; p++) {
      const seed = p * 137.5
      const px = (Math.sin(seed + t * (0.3 + p * 0.04)) * 0.5 + 0.5) * w
      const py = ((t * (0.08 + p * 0.012) + seed * 0.01) % 1.0) * h
      const pr = (1.2 + Math.abs(Math.sin(t * 2 + p)) * 2.5) * intensity
      const pa = (0.3 + Math.abs(Math.sin(t * 3 + p * 0.7)) * 0.55) * intensity
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${sp.primaryRgb},${pa})`
      ctx.shadowColor = sp.primary; ctx.shadowBlur = pr * 3
      ctx.fill()
    }
    ctx.shadowBlur = 0

    // ── Ondas de energia horizontais varrendo a tela ─────────────────────
    for (let w2 = 0; w2 < 3; w2++) {
      const waveY = h * ((t * 0.35 + w2 * 0.33) % 1.0)
      const wAlpha = (0.04 + Math.sin(t * 2 + w2) * 0.02) * intensity
      const wG = ctx.createLinearGradient(0, waveY - 30, 0, waveY + 30)
      wG.addColorStop(0, "transparent")
      wG.addColorStop(0.5, `rgba(${sp.primaryRgb},${wAlpha})`)
      wG.addColorStop(1, "transparent")
      ctx.fillStyle = wG
      ctx.fillRect(0, waveY - 30, w, 60)
    }

    // ── Anéis de expansão (pulso de energia) ────────────────────────────
    const ringPhase = (t * 1.2) % 1.0
    const ringR = ringPhase * Math.min(w, h) * 0.6
    const ringAlpha = (1 - ringPhase) * 0.12 * intensity
    ctx.beginPath(); ctx.arc(w / 2, h * 0.5, ringR, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(${sp.primaryRgb},${ringAlpha})`
    ctx.lineWidth = 2
    ctx.stroke()

    const ring2Phase = ((t * 1.2) + 0.5) % 1.0
    const ring2R = ring2Phase * Math.min(w, h) * 0.6
    const ring2Alpha = (1 - ring2Phase) * 0.10 * intensity
    ctx.beginPath(); ctx.arc(w / 2, h * 0.5, ring2R, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(${sp.secondaryRgb},${ring2Alpha})`
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.restore()
  }

  // 3b – Star Power lightning (hit line + raios nas bordas)
  drawStarPowerLightning(ctx,w,h,now,stats.combo,highwayTheme)

  // 4 – Sustain tails
  for (const note of notes) {
    if (note.missed||note.type!=="sustain"||note.duration<=0||note.lane>=LC) continue
    const nA=note.time-currentTime, tE=note.time+note.duration-currentTime
    if (tE<-TIMING_MISS) continue
    const ca=Math.max(nA,0), cb=Math.max(tE,0)
    const color=starPower?spPal.sustainColor:(SUSTAIN_COLORS[note.lane]??NOTE_COLORS[note.lane]??LANE_COLORS[note.lane])
    const isHeld = note.hit && keysDown.has(note.lane)  // sendo segurado agora
    const pulse  = isHeld ? (0.75 + Math.sin(now * 0.012) * 0.25) : 1  // pulsa enquanto segura

    for (let s=0; s<14; s++) {
      const a0=ca+(cb-ca)*(s/14), a1=ca+(cb-ca)*((s+1)/14)
      const pp0=project(note.lane,a0,canvas,ns,LC), pp1=project(note.lane,a1,canvas,ns,LC)
      let ox0=0, ox1=0
      if (starPower) {
        const freq = 18, amp = pp0.scale * 3.5
        ox0 = Math.sin(now * 0.012 * freq + s * 1.1) * amp
        ox1 = Math.sin(now * 0.012 * freq + (s+1) * 1.1) * amp
      }
      const hw0=SUSTAIN_WIDTH*pp0.scale*0.5*(isHeld?1.4:1), hw1=SUSTAIN_WIDTH*pp1.scale*0.5*(isHeld?1.4:1)
      ctx.beginPath()
      ctx.moveTo(pp0.x-hw0+ox0,pp0.y); ctx.lineTo(pp0.x+hw0+ox0,pp0.y)
      ctx.lineTo(pp1.x+hw1+ox1,pp1.y); ctx.lineTo(pp1.x-hw1+ox1,pp1.y); ctx.closePath()
      const alpha = isHeld ? Math.round(0x55 + pulse * 0x55).toString(16).padStart(2,"0") : (note.hit?"40":"88")
      ctx.fillStyle=color+alpha; ctx.fill()
    }
    // Linha central
    const ps=project(note.lane,ca,canvas,ns,LC), pe=project(note.lane,cb,canvas,ns,LC)
    if (starPower) {
      ctx.beginPath()
      const steps = 20
      ctx.shadowColor=spPal.primary; ctx.shadowBlur=10
      ctx.strokeStyle=color+"cc"; ctx.lineWidth=2.5*ps.scale
      for (let i=0; i<=steps; i++) {
        const t2=i/steps
        const pp=project(note.lane,ca+(cb-ca)*t2,canvas,ns,LC)
        const wave=Math.sin(now*0.015*16 + t2*Math.PI*6) * pp.scale * 4
        if(i===0) ctx.moveTo(pp.x+wave,pp.y); else ctx.lineTo(pp.x+wave,pp.y)
      }
      ctx.stroke(); ctx.shadowBlur=0
    } else {
      ctx.beginPath(); ctx.moveTo(ps.x,ps.y); ctx.lineTo(pe.x,pe.y)
      if (isHeld) {
        ctx.shadowColor = starPower ? spPal.primary : color; ctx.shadowBlur = 12 * pulse
        ctx.strokeStyle=color+"ee"; ctx.lineWidth=3.0*ps.scale
      } else {
        ctx.strokeStyle=color+"99"; ctx.lineWidth=2.2*ps.scale
      }
      ctx.stroke(); ctx.shadowBlur=0
    }
  }

  // 5 – Hit line glow
  const hlColor = starPower ? spPal.primaryRgb : "0,210,255"
  const hlAlpha = starPower ? 0.70 : 0.32
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

    const {rx,ry}=drawHitTarget(ctx,x,hitY,i,pressed,starPower,now,jumpY,scaleX,scaleY,NRX,NRY,spPal.primary,spPal.primaryRgb)
    if (showGuide) {
      const label=(keyLabels?.[i]??LANE_LABELS[i]).toUpperCase()
      ctx.fillStyle=pressed?"#fff":"rgba(200,230,210,0.45)"
      ctx.font=`bold ${Math.round(ry*0.85)}px 'Arial Black', Arial, sans-serif`
      ctx.textAlign="center"; ctx.textBaseline="middle"
      ctx.fillText(label,x,hitY+ry+Math.max(8,NRY*1.5))
    }
  }

  // 7 – Notas (estilo GH:WT — disco achatado + chama)
  const maxV=2200/ns
  // Sem sort por frame — notas já vêm em ordem do chart parser, custo O(n) apenas
  const visible=notes
    .filter(n=>!n.hit&&!n.missed&&(n.time-currentTime)>=-TIMING_MISS*2&&(n.time-currentTime)<=maxV)

  for (const note of visible) {
    const ahead=note.time-currentTime
    const lane=Math.min(note.lane,LC-1)
    const {x,y,scale}=project(lane,Math.max(ahead,0),canvas,ns,LC)
    if (y>hitY+NRY*4) continue
    const rx=NRX*scale, ry=NRY*scale
    drawNoteGH(ctx,x,y,rx,ry,lane,starPower,now,noteShape,spPal.primary,spPal.primaryRgb)
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
      drawHitExplosion(ctx,x,hitY,color,prog,alpha,fx.rating,NRX,NRY,starPower,spPal.primary,spPal.primaryRgb)
    } else {
      const xs=NRX*(1.1+prog*0.35)
      ctx.strokeStyle="#ef4444"+Math.round(alpha*180).toString(16).padStart(2,"0")
      ctx.lineWidth=3.5*(1-prog*0.5); ctx.lineCap="round"
      ctx.shadowColor="#ef4444"; ctx.shadowBlur=6*alpha
      ctx.beginPath(); ctx.moveTo(x-xs,hitY-NRY); ctx.lineTo(x+xs,hitY+NRY); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x+xs,hitY-NRY); ctx.lineTo(x-xs,hitY+NRY); ctx.stroke()
      ctx.shadowBlur=0
    }
    const ty=hitY-Math.round(58*uiScale)-prog*Math.round(48*uiScale), fs=Math.round((isMiss?11:16+(1-prog)*7)*uiScale)
    ctx.globalAlpha=alpha*(isMiss?0.50:1); ctx.fillStyle=rc
    ctx.shadowColor=rc; ctx.shadowBlur=isMiss?0:10
    ctx.font=`900 ${fs}px 'Arial Black', Arial, sans-serif`; ctx.textAlign="center"; ctx.textBaseline="middle"
    ctx.fillText(fx.rating.toUpperCase(),x,ty)
    // Penalidade de pontos no miss: "-50", "-100", "-200" em vermelho flutuando acima
    if (isMiss && fx.penalty && fx.penalty > 0) {
      const penaltyY = ty - 18 - prog * 22
      const penaltyAlpha = Math.max(0, 1 - prog * 1.4)
      const penaltyScale = 0.85 + (1 - prog) * 0.35
      ctx.globalAlpha = alpha * penaltyAlpha
      ctx.save()
      ctx.translate(x, penaltyY)
      ctx.scale(penaltyScale, penaltyScale)
      ctx.fillStyle = "#ff4444"
      ctx.shadowColor = "#ff0000"
      ctx.shadowBlur = 8 * penaltyAlpha
      ctx.font = `900 ${Math.round(13*uiScale)}px 'Arial Black', Arial, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(`-${fx.penalty}`, 0, 0)
      ctx.shadowBlur = 0
      ctx.restore()
    }
    ctx.shadowBlur=0; ctx.restore()
  }

  // 9 – HUD lateral esquerdo (estilo Fortnite Festival / referência)
  {
    ctx.save()
    const uS      = uiScale
    const pW      = Math.round(210 * uS)   // largura do painel
    const pX      = Math.round(14 * uS)    // margem esquerda
    const pY      = Math.round((topBarH || 0) + Math.round(10 * uS))
    const rr      = Math.round(12 * uS)    // border-radius
    const sp      = starPower
    const spC     = sp ? spPal.primary : "#e11d48"
    const spCRgb  = sp ? spPal.primaryRgb : "225,29,72"

    // ── Painel de fundo com blur visual ────────────────────────────────
    ctx.fillStyle = sp ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.62)"
    ctx.beginPath(); ctx.roundRect(pX, pY, pW, Math.round(260 * uS), rr); ctx.fill()

    // Borda do painel
    ctx.strokeStyle = sp ? `rgba(${spCRgb},0.40)` : "rgba(255,255,255,0.09)"
    ctx.lineWidth = 1.2
    ctx.beginPath(); ctx.roundRect(pX, pY, pW, Math.round(260 * uS), rr); ctx.stroke()

    // Stripe colorida no topo
    const stripeG = ctx.createLinearGradient(pX, 0, pX + pW, 0)
    stripeG.addColorStop(0, sp ? spPal.primary : "#e11d48")
    stripeG.addColorStop(1, sp ? spPal.secondary : "#f97316")
    ctx.fillStyle = stripeG
    ctx.beginPath(); ctx.roundRect(pX, pY, pW, Math.round(3 * uS), [rr, rr, 0, 0]); ctx.fill()

    let cY = pY + Math.round(10 * uS)

    // ── Nome da música + artista ────────────────────────────────────────
    {
      const artist = (state.songMeta?.artist ?? "").toUpperCase()
      const name   = state.songMeta?.name ?? ""
      const padX   = pX + Math.round(10 * uS)
      const maxW   = pW - Math.round(20 * uS)

      ctx.textAlign = "left"; ctx.textBaseline = "top"
      ctx.fillStyle = "rgba(255,255,255,0.35)"
      ctx.font = `600 ${Math.round(8 * uS)}px 'Inter',Arial,sans-serif`
      ctx.fillText(artist, padX, cY, maxW)
      cY += Math.round(12 * uS)

      ctx.fillStyle = "#ffffff"
      ctx.font = `900 ${Math.round(12 * uS)}px 'Arial Black',Arial,sans-serif`
      ctx.shadowColor = sp ? spPal.primary : "rgba(255,255,255,0.3)"
      ctx.shadowBlur = sp ? 8 : 2
      ctx.fillText(name, padX, cY, maxW)
      ctx.shadowBlur = 0
      cY += Math.round(16 * uS)
    }

    // ── Barra de progresso da música ────────────────────────────────────
    {
      const padX = pX + Math.round(10 * uS)
      const bw   = pW - Math.round(20 * uS)
      const bh   = Math.round(4 * uS)
      ctx.fillStyle = "rgba(255,255,255,0.10)"
      ctx.beginPath(); ctx.roundRect(padX, cY, bw, bh, bh/2); ctx.fill()
      // progresso calculado a partir de stats (aproximação via nota atual)
      const prog = state.songProgress ?? 0
      if (prog > 0) {
        const pg = ctx.createLinearGradient(padX, 0, padX + bw, 0)
        pg.addColorStop(0, sp ? spPal.primary : "#e11d48")
        pg.addColorStop(1, sp ? spPal.secondary : "#f97316")
        ctx.fillStyle = pg
        ctx.shadowColor = sp ? spPal.primary : "#e11d48"; ctx.shadowBlur = 4
        ctx.beginPath(); ctx.roundRect(padX, cY, bw * prog, bh, bh/2); ctx.fill()
        ctx.shadowBlur = 0
      }
      cY += bh + Math.round(10 * uS)
    }

    // ── Separador ────────────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(pX + Math.round(10*uS), cY); ctx.lineTo(pX + pW - Math.round(10*uS), cY); ctx.stroke()
    cY += Math.round(8 * uS)

    // ── Score grande ─────────────────────────────────────────────────────
    {
      const padX = pX + Math.round(10 * uS)
      ctx.textAlign = "left"; ctx.textBaseline = "top"
      ctx.fillStyle = "rgba(255,255,255,0.30)"
      ctx.font = `600 ${Math.round(8*uS)}px 'Inter',Arial,sans-serif`
      ctx.fillText("PONTUAÇÃO", padX, cY)
      cY += Math.round(11 * uS)

      const sc = stats.score.toLocaleString()
      ctx.fillStyle = "#ffffff"
      ctx.font = `900 ${Math.round(28*uS)}px 'Arial Black',Arial,sans-serif`
      ctx.shadowColor = sp ? spPal.primary : "rgba(255,255,255,0.4)"
      ctx.shadowBlur = sp ? 14 : 4
      ctx.fillText(sc, padX, cY, pW - Math.round(20*uS))
      ctx.shadowBlur = 0
      cY += Math.round(32 * uS)
    }

    // ── Estrelas ────────────────────────────────────────────────────────
    {
      const totalEstimated = Math.max(stats.totalNotes * 100 * 4, 1)
      const filled = Math.min(5, Math.floor((stats.score / totalEstimated) * 5))
      const starR  = Math.round(10 * uS)
      const starGap= Math.round(22 * uS)
      const sx0    = pX + (pW - 5 * starGap) / 2

      for (let s = 0; s < 5; s++) {
        const scx = sx0 + s * starGap + starR
        const scy = cY + starR
        ctx.beginPath()
        for (let i = 0; i < 10; i++) {
          const ang = (i / 5) * Math.PI - Math.PI / 2
          const r2  = i % 2 === 0 ? starR : starR * 0.42
          i === 0 ? ctx.moveTo(scx + Math.cos(ang)*r2, scy + Math.sin(ang)*r2)
                  : ctx.lineTo(scx + Math.cos(ang)*r2, scy + Math.sin(ang)*r2)
        }
        ctx.closePath()
        if (s < filled) {
          const sg = ctx.createRadialGradient(scx, scy - starR*0.2, 0, scx, scy, starR)
          sg.addColorStop(0, sp ? spPal.starFill1 : "#fff7aa")
          sg.addColorStop(0.5, sp ? spPal.starFill2 : "#f59e0b")
          sg.addColorStop(1, sp ? spPal.starFill3 : "#92400e")
          ctx.fillStyle = sg
          ctx.shadowColor = sp ? spPal.primary : "#fbbf24"; ctx.shadowBlur = 14
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.shadowBlur = 0
        }
        ctx.fill()
        ctx.strokeStyle = s < filled ? (sp ? spPal.primary : "#fbbf24") : "rgba(255,255,255,0.15)"
        ctx.lineWidth = s < filled ? 1.2 : 0.7; ctx.stroke()
        ctx.shadowBlur = 0
      }
      cY += starR * 2 + Math.round(10 * uS)
    }

    // ── Rock meter ──────────────────────────────────────────────────────
    {
      const padX = pX + Math.round(10 * uS)
      const mw   = pW - Math.round(20 * uS)
      const mh   = Math.round(7 * uS)
      const fill = stats.rockMeter / 100
      const mCol = stats.rockMeter > 60 ? "#22c55e" : stats.rockMeter > 30 ? "#f59e0b" : "#ef4444"

      ctx.fillStyle = "rgba(255,255,255,0.07)"
      ctx.beginPath(); ctx.roundRect(padX, cY, mw, mh, Math.round(3.5*uS)); ctx.fill()
      if (fill > 0) {
        const fg = ctx.createLinearGradient(padX, 0, padX + mw, 0)
        fg.addColorStop(0, "#ef4444"); fg.addColorStop(0.3, "#f59e0b")
        fg.addColorStop(0.6, "#22c55e"); fg.addColorStop(1, "#4ade80")
        ctx.fillStyle = fg
        ctx.shadowColor = mCol; ctx.shadowBlur = 5
        ctx.beginPath(); ctx.roundRect(padX, cY, mw * fill, mh, Math.round(3.5*uS)); ctx.fill()
        ctx.shadowBlur = 0
      }
      const midX = padX + mw / 2
      ctx.strokeStyle = "rgba(255,255,255,0.40)"; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(midX, cY - 2); ctx.lineTo(midX, cY + mh + 2); ctx.stroke()
      ctx.font = `${Math.round(9*uS)}px serif`
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillStyle = stats.rockMeter <= 20 ? "#ef4444" : "rgba(255,255,255,0.28)"
      ctx.fillText("💀", padX - Math.round(7*uS), cY + mh/2)
      ctx.fillStyle = stats.rockMeter >= 80 ? "#22c55e" : "rgba(255,255,255,0.28)"
      ctx.fillText("🎸", padX + mw + Math.round(7*uS), cY + mh/2)
      cY += mh + Math.round(12 * uS)
    }

    // ── Último rating de hit (feedback visível no painel) ────────────────
    {
      const padX = pX + Math.round(10 * uS)
      // Pegar o hit effect mais recente
      const recent = hitEffects.filter(fx => !fx.rating.includes("miss") && (now - fx.time) < 600)
        .sort((a, b) => b.time - a.time)[0]
      if (recent) {
        const age     = now - recent.time
        const alpha2  = Math.max(0, 1 - age / 600)
        const rColors: Record<string,string> = { perfect:"#fbbf24", great:"#22c55e", good:"#3b82f6", miss:"#ef4444" }
        const rLabel:  Record<string,string> = { perfect:"PERFEITO", great:"ÓTIMO", good:"BOM", miss:"MISS" }
        const rc2 = rColors[recent.rating] ?? "#fff"
        ctx.textAlign = "left"; ctx.textBaseline = "top"
        ctx.globalAlpha = alpha2
        ctx.fillStyle = rc2
        ctx.font = `900 ${Math.round(11*uS)}px 'Arial Black',Arial,sans-serif`
        ctx.shadowColor = rc2; ctx.shadowBlur = 8
        ctx.fillText(rLabel[recent.rating] ?? recent.rating.toUpperCase(), padX, cY)
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      }
    }

    ctx.restore()
  }

  // ── Multiplicador central embaixo da highway (estilo referência) ────────
  if (stats.multiplier > 0) {
    const mulR  = Math.round(28 * uiScale)
    const mulX  = w / 2
    const mulY  = hitY + Math.round(48 * uiScale)
    const sp2   = starPower
    const mg2   = ctx.createRadialGradient(mulX, mulY - mulR*0.2, 0, mulX, mulY, mulR)
    mg2.addColorStop(0, sp2 ? `rgba(${spPal.primaryRgb},0.50)` : "rgba(10,30,80,0.96)")
    mg2.addColorStop(1, sp2 ? `rgba(${spPal.primaryRgb},0.15)` : "rgba(5,15,50,0.96)")
    ctx.beginPath(); ctx.arc(mulX, mulY, mulR, 0, Math.PI*2)
    ctx.fillStyle = mg2; ctx.fill()
    ctx.strokeStyle = sp2 ? spPal.primary : "#38bdf8"
    ctx.lineWidth = 2.5
    ctx.shadowColor = sp2 ? spPal.primary : "#38bdf8"; ctx.shadowBlur = 18
    ctx.stroke(); ctx.shadowBlur = 0
    ctx.fillStyle = sp2 ? spPal.primary : "#ffffff"
    ctx.font = `900 ${Math.round(16*uiScale)}px 'Arial Black',Arial,sans-serif`
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10
    ctx.fillText(`${stats.multiplier}x`, mulX, mulY)
    ctx.shadowBlur = 0
    if (stats.combo > 1) {
      ctx.fillStyle = "rgba(255,255,255,0.45)"
      ctx.font = `700 ${Math.round(9*uiScale)}px 'Arial',sans-serif`
      ctx.fillText(`${stats.combo} COMBO`, mulX, mulY + mulR + Math.round(8*uiScale))
    }
  }

  // 10 – Efeitos de borda por tema (decoração ambiente + intensificação em star power)
  if (highwayTheme !== "default") {
    ctx.save()
    const t = now * 0.001
    const spMult = starPower ? (2.5 + Math.sin(t * 3) * 0.5) : 1  // 2.5x mais intenso em SP

    if (highwayTheme === "fire") {
      // Chamas nas bordas laterais — mais altas e numerosas em SP
      const flameCount = starPower ? 10 : 6
      for (let side = 0; side < 2; side++) {
        const bx = side === 0 ? 0 : w
        for (let f = 0; f < flameCount; f++) {
          const fy   = h * (0.1 + f * (starPower ? 0.08 : 0.12)) + Math.sin(t * 2.1 + f) * 18
          const fh   = (60 + Math.sin(t * 3 + f * 1.4) * 20) * spMult
          const fw   = (22 + Math.sin(t * 2 + f) * 8) * (starPower ? 1.8 : 1)
          const flG  = ctx.createLinearGradient(bx, fy + fh, bx, fy)
          flG.addColorStop(0, `rgba(255,80,0,${0.30 * spMult})`)
          flG.addColorStop(0.4, `rgba(255,200,0,${0.18 * spMult})`)
          flG.addColorStop(1, "transparent")
          ctx.fillStyle = flG
          ctx.beginPath()
          ctx.moveTo(bx, fy + fh)
          const dx = side === 0 ? fw : -fw
          ctx.quadraticCurveTo(bx + dx * 0.6, fy + fh * 0.4, bx + dx * 0.3, fy)
          ctx.quadraticCurveTo(bx + dx * 0.6, fy + fh * 0.4, bx, fy + fh)
          ctx.fill()
        }
      }
      // Chamas no topo em SP
      if (starPower) {
        for (let f = 0; f < 8; f++) {
          const fx = w * (0.1 + f * 0.1) + Math.sin(t * 2 + f) * 15
          const fh2 = (40 + Math.sin(t * 3 + f) * 15) * spMult * 0.5
          const flG2 = ctx.createLinearGradient(fx, 0, fx, fh2)
          flG2.addColorStop(0, `rgba(255,80,0,${0.25 * spMult})`)
          flG2.addColorStop(1, "transparent")
          ctx.fillStyle = flG2; ctx.fillRect(fx - 8, 0, 16, fh2)
        }
      }
    }

    if (highwayTheme === "neon") {
      // Scan lines neon + brilho nas bordas
      const scanY = (t * 120) % h
      const neonAlpha = 0.06 * spMult
      const neonG = ctx.createLinearGradient(0, scanY - 60, 0, scanY + 60)
      neonG.addColorStop(0, "transparent")
      neonG.addColorStop(0.5, `rgba(0,255,180,${neonAlpha})`)
      neonG.addColorStop(1, "transparent")
      ctx.fillStyle = neonG; ctx.fillRect(0, 0, w, h)
      if (starPower) {
        // Segunda scan line em SP
        const scan2Y = ((t * 120) + h * 0.5) % h
        const neonG2 = ctx.createLinearGradient(0, scan2Y - 40, 0, scan2Y + 40)
        neonG2.addColorStop(0, "transparent")
        neonG2.addColorStop(0.5, `rgba(255,0,204,${neonAlpha * 0.7})`)
        neonG2.addColorStop(1, "transparent")
        ctx.fillStyle = neonG2; ctx.fillRect(0, 0, w, h)
      }
      // Brilho intenso nas bordas
      const edgeW = starPower ? 50 : 30
      const edgeAlpha = (0.04 + Math.sin(t * 2) * 0.02) * spMult
      const edgeG = ctx.createLinearGradient(0, 0, edgeW, 0)
      edgeG.addColorStop(0, `rgba(0,255,180,${edgeAlpha})`); edgeG.addColorStop(1, "transparent")
      ctx.fillStyle = edgeG; ctx.fillRect(0, 0, edgeW, h)
      const edgeG2 = ctx.createLinearGradient(w, 0, w - edgeW, 0)
      edgeG2.addColorStop(0, `rgba(180,0,255,${edgeAlpha})`); edgeG2.addColorStop(1, "transparent")
      ctx.fillStyle = edgeG2; ctx.fillRect(w - edgeW, 0, edgeW, h)
    }

    if (highwayTheme === "space") {
      // Estrelas caindo nas bordas — mais em SP
      const starCount = starPower ? 18 : 8
      for (let s = 0; s < starCount; s++) {
        const sx = s < starCount / 2
          ? s * (w * 0.05) + 4
          : w - (s - starCount / 2) * (w * 0.05) - 12
        const sy = ((t * 40 * (0.5 + s * 0.15) + s * 97) % h)
        const sr = (1 + (s % 3) * 0.8) * (starPower ? 1.5 : 1)
        const sa = (0.3 + Math.sin(t * 3 + s) * 0.2) * spMult * 0.6
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(150,100,255,${sa})`
        if (starPower) { ctx.shadowColor = "#aa44ff"; ctx.shadowBlur = sr * 4 }
        ctx.fill(); ctx.shadowBlur = 0
      }
      // Nebulosa pulsante em SP
      if (starPower) {
        const nebPulse = 0.06 + Math.sin(t * 1.5) * 0.03
        const nebG = ctx.createRadialGradient(w * 0.1, h * 0.3, 0, w * 0.1, h * 0.3, w * 0.3)
        nebG.addColorStop(0, `rgba(100,0,255,${nebPulse})`); nebG.addColorStop(1, "transparent")
        ctx.fillStyle = nebG; ctx.fillRect(0, 0, w * 0.4, h * 0.6)
        const nebG2 = ctx.createRadialGradient(w * 0.9, h * 0.7, 0, w * 0.9, h * 0.7, w * 0.3)
        nebG2.addColorStop(0, `rgba(60,0,200,${nebPulse * 0.8})`); nebG2.addColorStop(1, "transparent")
        ctx.fillStyle = nebG2; ctx.fillRect(w * 0.6, h * 0.4, w * 0.4, h * 0.6)
      }
      const spG = ctx.createLinearGradient(0, 0, 50 * spMult, 0)
      spG.addColorStop(0, `rgba(60,0,180,${0.08 * spMult})`); spG.addColorStop(1, "transparent")
      ctx.fillStyle = spG; ctx.fillRect(0, 0, 50 * spMult, h)
      const spG2 = ctx.createLinearGradient(w, 0, w - 50 * spMult, 0)
      spG2.addColorStop(0, `rgba(60,0,180,${0.08 * spMult})`); spG2.addColorStop(1, "transparent")
      ctx.fillStyle = spG2; ctx.fillRect(w - 50 * spMult, 0, 50 * spMult, h)
    }

    if (highwayTheme === "ice") {
      // Cristais cintilando — mais em SP
      const crystalCount = starPower ? 14 : 6
      for (let c = 0; c < crystalCount; c++) {
        const cx2 = c < crystalCount / 2 ? c * 20 + 5 : w - (c - crystalCount / 2) * 20 - 12
        const cy2 = h * (0.1 + ((c * 0.08) % 0.85)) + Math.sin(t + c * 1.7) * 10
        const ca  = (0.15 + Math.sin(t * 2.5 + c) * 0.10) * spMult * 0.7
        const hexSize = starPower ? 9 : 5
        ctx.save()
        ctx.translate(cx2, cy2)
        ctx.rotate(t * 0.5 + c)
        ctx.fillStyle = `rgba(160,230,255,${ca})`
        if (starPower) { ctx.shadowColor = "#88eeff"; ctx.shadowBlur = 12 }
        ctx.beginPath()
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2
          const r = hexSize + Math.sin(t * 3 + c + i) * 2
          i === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r)
                  : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r)
        }
        ctx.closePath(); ctx.fill()
        ctx.shadowBlur = 0
        ctx.restore()
      }
      // Geada no topo em SP
      if (starPower) {
        const iceG = ctx.createLinearGradient(0, 0, 0, h * 0.12)
        iceG.addColorStop(0, `rgba(136,238,255,${0.12 * spMult})`)
        iceG.addColorStop(1, "transparent")
        ctx.fillStyle = iceG; ctx.fillRect(0, 0, w, h * 0.12)
      }
    }

    if (highwayTheme === "retro") {
      // Scanlines CRT + brilho nas bordas
      const scanOpacity = starPower ? 0.10 : 0.06
      for (let y = 0; y < h; y += 4) {
        ctx.fillStyle = `rgba(0,0,0,${scanOpacity})`
        ctx.fillRect(0, y, w, 1)
      }
      const retW = starPower ? 35 : 20
      const retAlpha = (0.06 + Math.sin(t * 1.5) * 0.03) * spMult
      const rG1 = ctx.createLinearGradient(0, 0, retW, 0)
      rG1.addColorStop(0, `rgba(255,20,150,${retAlpha})`); rG1.addColorStop(1, "transparent")
      ctx.fillStyle = rG1; ctx.fillRect(0, 0, retW, h)
      const rG2 = ctx.createLinearGradient(w, 0, w - retW, 0)
      rG2.addColorStop(0, `rgba(0,255,200,${retAlpha})`); rG2.addColorStop(1, "transparent")
      ctx.fillStyle = rG2; ctx.fillRect(w - retW, 0, retW, h)
      // Glitch horizontal em SP
      if (starPower && Math.sin(t * 7) > 0.75) {
        const glitchY = Math.random() * h
        const glitchAlpha = 0.06
        ctx.fillStyle = `rgba(255,20,150,${glitchAlpha})`
        ctx.fillRect(0, glitchY, w, 3)
      }
    }

    if (highwayTheme === "wood") {
      // Vinheta quente nas bordas
      const woodW = starPower ? 70 : 40
      const woodAlpha = (0.10 + Math.sin(t * 1.2) * 0.03) * spMult * 0.6
      const wG = ctx.createLinearGradient(0, 0, woodW, 0)
      wG.addColorStop(0, `rgba(120,50,0,${woodAlpha})`); wG.addColorStop(1, "transparent")
      ctx.fillStyle = wG; ctx.fillRect(0, 0, woodW, h)
      const wG2 = ctx.createLinearGradient(w, 0, w - woodW, 0)
      wG2.addColorStop(0, `rgba(120,50,0,${woodAlpha})`); wG2.addColorStop(1, "transparent")
      ctx.fillStyle = wG2; ctx.fillRect(w - woodW, 0, woodW, h)
      // Veios de madeira pulsantes em SP
      if (starPower) {
        for (let v = 0; v < 4; v++) {
          const vx = w * (0.05 + v * 0.05) + Math.sin(t + v) * 8
          const va = (0.04 + Math.sin(t * 2 + v) * 0.02) * spMult
          ctx.strokeStyle = `rgba(200,120,40,${va})`
          ctx.lineWidth = 1.5
          ctx.beginPath(); ctx.moveTo(vx, 0); ctx.lineTo(vx + 20, h); ctx.stroke()
          const vx2 = w - w * (0.05 + v * 0.05) - Math.sin(t + v) * 8
          ctx.beginPath(); ctx.moveTo(vx2, 0); ctx.lineTo(vx2 - 20, h); ctx.stroke()
        }
      }
    }

    ctx.restore()
  }
}
