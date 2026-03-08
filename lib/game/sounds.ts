/**
 * sounds.ts — sons gerados via Web Audio API (sem arquivos externos)
 * v7: Sons mais ricos, contagem com impacto dramático, cliques tácteis
 */

let ctx: AudioContext | null = null
let pendingSinkId: string | null = null

/** Define o dispositivo de saída para os sons SFX/WebAudio */
export async function setAudioOutputDevice(deviceId: string) {
  pendingSinkId = deviceId
  if (ctx && "setSinkId" in ctx) {
    try {
      await (ctx as AudioContext & { setSinkId(id: string): Promise<void> }).setSinkId(deviceId)
    } catch (e) {
      console.warn("AudioContext setSinkId:", e)
    }
  }
}

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    if (pendingSinkId && "setSinkId" in ctx) {
      (ctx as AudioContext & { setSinkId(id: string): Promise<void> }).setSinkId(pendingSinkId).catch(() => {})
    }
  }
  if (ctx.state === "suspended") ctx.resume()
  return ctx
}

function master(volume: number): GainNode {
  const ac = getCtx()
  const g = ac.createGain()
  g.gain.value = Math.max(0, Math.min(1, volume))
  g.connect(ac.destination)
  return g
}

// Compressor global para evitar clipping
function compressedMaster(volume: number): GainNode {
  const ac = getCtx()
  const comp = ac.createDynamicsCompressor()
  comp.threshold.value = -12
  comp.knee.value = 6
  comp.ratio.value = 3
  comp.attack.value = 0.003
  comp.release.value = 0.1
  comp.connect(ac.destination)
  const g = ac.createGain()
  g.gain.value = Math.max(0, Math.min(1, volume))
  g.connect(comp)
  return g
}

// ── Clique de nota (hit) ──────────────────────────────────────────────────────
export function playHitSound(lane: number, rating: "perfect" | "great" | "good" | "miss", volume = 1) {
  try {
    const ac = getCtx()
    const now = ac.currentTime
    const gain = compressedMaster(volume * (rating === "miss" ? 0.2 : 0.6))

    if (rating === "miss") {
      // Miss: som de "bum" descendente com vibrato
      const osc = ac.createOscillator()
      const g   = ac.createGain()
      osc.type = "sawtooth"
      osc.frequency.setValueAtTime(200, now)
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.18)
      g.gain.setValueAtTime(0.5, now)
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
      osc.connect(g); g.connect(gain)
      osc.start(now); osc.stop(now + 0.2)
      return
    }

    // Frequências por lane (escala pentatônica de guitarra)
    const freqs = [329.63, 392, 440, 523.25, 587.33]
    const freq  = freqs[Math.min(lane, freqs.length - 1)]
    const decay = rating === "perfect" ? 0.45 : rating === "great" ? 0.3 : 0.2

    // --- Corpo da nota (triangle wave com envelope suave) ---
    const osc  = ac.createOscillator()
    const env  = ac.createGain()
    osc.type   = "triangle"
    osc.frequency.value = freq
    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(0.9, now + 0.006)
    env.gain.exponentialRampToValueAtTime(0.001, now + decay)
    osc.connect(env); env.connect(gain)
    osc.start(now); osc.stop(now + decay + 0.05)

    // --- Harmônico 2x (brilho) ---
    const osc2 = ac.createOscillator()
    const env2 = ac.createGain()
    osc2.type  = "sine"
    osc2.frequency.value = freq * 2
    env2.gain.setValueAtTime(0, now)
    env2.gain.linearRampToValueAtTime(0.35, now + 0.005)
    env2.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
    osc2.connect(env2); env2.connect(gain)
    osc2.start(now); osc2.stop(now + 0.15)

    // --- Clique de palheta (transiente percussivo) ---
    const click = ac.createOscillator()
    const cEnv  = ac.createGain()
    click.type  = "square"
    click.frequency.setValueAtTime(freq * 4, now)
    click.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.02)
    cEnv.gain.setValueAtTime(0.7, now)
    cEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.022)
    click.connect(cEnv); cEnv.connect(gain)
    click.start(now); click.stop(now + 0.025)

    // --- Perfect: faísca brilhante + shimmer ---
    if (rating === "perfect") {
      const spark = ac.createOscillator()
      const sEnv  = ac.createGain()
      spark.type  = "sine"
      spark.frequency.setValueAtTime(freq * 5, now + 0.008)
      spark.frequency.exponentialRampToValueAtTime(freq * 8, now + 0.22)
      sEnv.gain.setValueAtTime(0.25, now + 0.008)
      sEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
      spark.connect(sEnv); sEnv.connect(gain)
      spark.start(now + 0.008); spark.stop(now + 0.3)

      // Shimmer (LFO rápido)
      const shimmer = ac.createOscillator()
      const shimEnv = ac.createGain()
      shimmer.type = "sine"
      shimmer.frequency.setValueAtTime(freq * 3, now + 0.015)
      shimmer.frequency.linearRampToValueAtTime(freq * 6, now + 0.15)
      shimEnv.gain.setValueAtTime(0.15, now + 0.015)
      shimEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
      shimmer.connect(shimEnv); shimEnv.connect(gain)
      shimmer.start(now + 0.015); shimmer.stop(now + 0.22)
    }
  } catch {}
}

// ── Contagem regressiva (3, 2, 1) ────────────────────────────────────────────
export function playCountdownBeep(number: number, volume = 1) {
  try {
    const ac  = getCtx()
    const now = ac.currentTime
    const gain = compressedMaster(volume * 0.75)

    // Frequências dramáticas: 3=Dó, 2=Mi, 1=Sol (acorde crescente)
    const freqMap: Record<number, number> = { 3: 261.63, 2: 329.63, 1: 392 }
    const freq = freqMap[number] ?? 440
    const duration = number === 1 ? 0.7 : 0.35

    // --- Beep principal com corpo encorpado ---
    const osc = ac.createOscillator()
    const env = ac.createGain()
    osc.type  = "triangle"
    osc.frequency.value = freq

    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(1, now + 0.012)
    env.gain.setValueAtTime(1, now + 0.06)
    env.gain.exponentialRampToValueAtTime(0.001, now + duration)

    osc.connect(env); env.connect(gain)
    osc.start(now); osc.stop(now + duration + 0.05)

    // --- Harmônico que dá "peso" ---
    const osc2 = ac.createOscillator()
    const env2 = ac.createGain()
    osc2.type  = "sine"
    osc2.frequency.value = freq * 1.5
    env2.gain.setValueAtTime(0, now)
    env2.gain.linearRampToValueAtTime(0.4, now + 0.01)
    env2.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
    osc2.connect(env2); env2.connect(gain)
    osc2.start(now); osc2.stop(now + 0.25)

    // --- Sub-grave (punch nos graves) ---
    const sub = ac.createOscillator()
    const subEnv = ac.createGain()
    sub.type = "sine"
    sub.frequency.value = freq * 0.5
    subEnv.gain.setValueAtTime(0, now)
    subEnv.gain.linearRampToValueAtTime(0.6, now + 0.008)
    subEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
    sub.connect(subEnv); subEnv.connect(gain)
    sub.start(now); sub.stop(now + 0.15)

    // --- Click de impacto (transiente) ---
    const click = ac.createOscillator()
    const clickEnv = ac.createGain()
    click.type = "square"
    click.frequency.setValueAtTime(800, now)
    click.frequency.exponentialRampToValueAtTime(100, now + 0.015)
    clickEnv.gain.setValueAtTime(0.8, now)
    clickEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.018)
    click.connect(clickEnv); clickEnv.connect(gain)
    click.start(now); click.stop(now + 0.02)

    // Num=1: shimmer final extra
    if (number === 1) {
      const rise = ac.createOscillator()
      const riseEnv = ac.createGain()
      rise.type = "sine"
      rise.frequency.setValueAtTime(600, now + 0.05)
      rise.frequency.exponentialRampToValueAtTime(1200, now + 0.4)
      riseEnv.gain.setValueAtTime(0.3, now + 0.05)
      riseEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
      rise.connect(riseEnv); riseEnv.connect(gain)
      rise.start(now + 0.05); rise.stop(now + 0.55)
    }
  } catch {}
}

// ── GO! ───────────────────────────────────────────────────────────────────────
export function playGoSound(volume = 1) {
  try {
    const ac  = getCtx()
    const now = ac.currentTime
    const gain = compressedMaster(volume * 0.8)

    // Power chord: Dó + Sol + Dó (oitava) rápido strum
    const chord = [261.63, 392, 523.25, 659.25, 784]
    chord.forEach((freq, i) => {
      const osc = ac.createOscillator()
      const env = ac.createGain()
      osc.type  = "sawtooth"
      osc.frequency.value = freq
      const t = now + i * 0.022
      env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(0.5, t + 0.015)
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.7)
      osc.connect(env); env.connect(gain)
      osc.start(t); osc.stop(t + 0.75)
    })

    // Distortion layer
    const dist = ac.createWaveShaper()
    const curve = new Float32Array(256)
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1
      curve[i] = (3 + 80) * x * 20 * (Math.PI / 180) / (Math.PI + 80 * Math.abs(x))
    }
    dist.curve = curve
    dist.connect(ac.destination)

    const distOsc = ac.createOscillator()
    const distEnv = ac.createGain()
    distOsc.type = "sawtooth"
    distOsc.frequency.value = 261.63
    distEnv.gain.setValueAtTime(0, now)
    distEnv.gain.linearRampToValueAtTime(0.15, now + 0.03)
    distEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
    distOsc.connect(distEnv); distEnv.connect(dist)
    distOsc.start(now); distOsc.stop(now + 0.55)

    // High shimmer
    const shimmer = ac.createOscillator()
    const shimEnv = ac.createGain()
    shimmer.type = "sine"
    shimmer.frequency.setValueAtTime(1600, now)
    shimmer.frequency.exponentialRampToValueAtTime(3200, now + 0.3)
    shimEnv.gain.setValueAtTime(0.3, now)
    shimEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
    shimmer.connect(shimEnv); shimEnv.connect(gain)
    shimmer.start(now); shimmer.stop(now + 0.45)
  } catch {}
}

// ── Pause / Resume ────────────────────────────────────────────────────────────
export function playPauseSound(volume = 1) {
  try {
    const ac  = getCtx()
    const now = ac.currentTime
    const gain = master(volume * 0.45)
    const osc  = ac.createOscillator()
    const env  = ac.createGain()
    osc.type   = "sine"
    osc.frequency.setValueAtTime(880, now)
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.1)
    env.gain.setValueAtTime(0.7, now)
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
    osc.connect(env); env.connect(gain)
    osc.start(now); osc.stop(now + 0.16)
  } catch {}
}

export function playResumeSound(volume = 1) {
  try {
    const ac  = getCtx()
    const now = ac.currentTime
    const gain = master(volume * 0.45)
    const osc  = ac.createOscillator()
    const env  = ac.createGain()
    osc.type   = "sine"
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.1)
    env.gain.setValueAtTime(0.7, now)
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
    osc.connect(env); env.connect(gain)
    osc.start(now); osc.stop(now + 0.16)
  } catch {}
}

// ── UI Click (menu buttons) ────────────────────────────────────────────────────
export function playClickSound(volume = 1) {
  try {
    const ac  = getCtx()
    const now = ac.currentTime
    const gain = master(volume * 0.35)

    // Click tático (como um switch mecânico)
    const osc  = ac.createOscillator()
    const env  = ac.createGain()
    osc.type   = "square"
    osc.frequency.setValueAtTime(1200, now)
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.025)
    env.gain.setValueAtTime(0.6, now)
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.03)
    osc.connect(env); env.connect(gain)
    osc.start(now); osc.stop(now + 0.04)

    // Sub clique (corpo)
    const sub  = ac.createOscillator()
    const sEnv = ac.createGain()
    sub.type   = "sine"
    sub.frequency.setValueAtTime(300, now)
    sub.frequency.exponentialRampToValueAtTime(100, now + 0.05)
    sEnv.gain.setValueAtTime(0.4, now)
    sEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.055)
    sub.connect(sEnv); sEnv.connect(gain)
    sub.start(now); sub.stop(now + 0.06)
  } catch {}
}

// ── Hover (menu hover) ────────────────────────────────────────────────────────
export function playHoverSound(volume = 1) {
  try {
    const ac  = getCtx()
    const now = ac.currentTime
    const gain = master(volume * 0.15)
    const osc  = ac.createOscillator()
    const env  = ac.createGain()
    osc.type   = "sine"
    osc.frequency.setValueAtTime(600, now)
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.04)
    env.gain.setValueAtTime(0.5, now)
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
    osc.connect(env); env.connect(gain)
    osc.start(now); osc.stop(now + 0.06)
  } catch {}
}

// ── Game Over ─────────────────────────────────────────────────────────────────
export function playGameOverSound(volume = 1) {
  try {
    const ac  = getCtx()
    const now = ac.currentTime
    const gain = compressedMaster(volume * 0.5)
    const notes = [523, 466, 415, 370, 294]
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator()
      const env = ac.createGain()
      osc.type  = "sawtooth"
      osc.frequency.value = freq
      const t = now + i * 0.18
      env.gain.setValueAtTime(0.5, t)
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
      osc.connect(env); env.connect(gain)
      osc.start(t); osc.stop(t + 0.4)
    })
  } catch {}
}

// ── Combo milestone (a cada 10 combos) ───────────────────────────────────────
export function playComboSound(combo: number, volume = 1) {
  try {
    const ac  = getCtx()
    const now = ac.currentTime
    const gain = master(volume * 0.35)
    const freq = 440 + Math.min(combo * 8, 400)
    const osc  = ac.createOscillator()
    const env  = ac.createGain()
    osc.type   = "sine"
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.18)
    env.gain.setValueAtTime(0.8, now)
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
    osc.connect(env); env.connect(gain)
    osc.start(now); osc.stop(now + 0.3)
  } catch {}
}
