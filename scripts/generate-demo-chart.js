/**
 * Script to generate a demo chart.json for testing the game engine.
 */

const { writeFileSync, mkdirSync } = require("fs")
const { join } = require("path")

const notes = []
const bpm = 120
const beatMs = 60000 / bpm // 500ms per beat

// Generate 60 seconds of notes
for (let beat = 0; beat < 120; beat++) {
  const time = beat * beatMs
  const section = Math.floor(beat / 16)

  switch (section) {
    case 0:
      notes.push({ time, lane: beat % 3, type: "normal", duration: 0 })
      break
    case 1:
      notes.push({ time, lane: beat % 6, type: "normal", duration: 0 })
      break
    case 2:
      notes.push({ time, lane: beat % 3, type: "normal", duration: 0 })
      if (beat % 2 === 0) {
        notes.push({ time: time + beatMs / 2, lane: (beat + 1) % 3, type: "normal", duration: 0 })
      }
      break
    case 3:
      notes.push({ time, lane: 0, type: "normal", duration: 0 })
      notes.push({ time, lane: 3, type: "normal", duration: 0 })
      break
    case 4:
      notes.push({ time, lane: beat % 6, type: "normal", duration: 0 })
      notes.push({ time: time + beatMs / 2, lane: (beat + 3) % 6, type: "normal", duration: 0 })
      break
    case 5:
      if (beat % 4 === 0) {
        notes.push({ time, lane: beat % 6, type: "sustain", duration: beatMs * 2 })
      } else if (beat % 4 === 2) {
        notes.push({ time, lane: (beat + 2) % 6, type: "normal", duration: 0 })
      }
      break
    case 6:
      notes.push({ time, lane: beat % 3, type: "normal", duration: 0 })
      notes.push({ time: time + beatMs / 3, lane: (beat + 1) % 3, type: "normal", duration: 0 })
      notes.push({ time: time + (beatMs * 2) / 3, lane: (beat + 2) % 3, type: "normal", duration: 0 })
      break
    default:
      if (beat % 2 === 0) {
        notes.push({ time, lane: beat % 6, type: "normal", duration: 0 })
      }
      break
  }
}

notes.sort((a, b) => a.time - b.time || a.lane - b.lane)

const chart = {
  resolution: 192,
  offset: 0,
  bpmChanges: [{ tick: 0, bpm: 120, time: 0 }],
  timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
  sections: [
    { time: 0, name: "Intro" },
    { time: 8000, name: "Build" },
    { time: 16000, name: "Chorus" },
    { time: 24000, name: "Bridge" },
    { time: 32000, name: "Solo" },
    { time: 40000, name: "Sustain" },
    { time: 48000, name: "Intense" },
    { time: 56000, name: "Outro" },
  ],
  notes,
}

const outDir = "/vercel/share/v0-project/public/songs/demo-song"
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, "chart.json")

writeFileSync(outPath, JSON.stringify(chart, null, 2))
console.log("Generated demo chart with " + notes.length + " notes at " + outPath)
