import { NextResponse } from "next/server"
import { getSongChart, getSongMeta, getSongAudioUrlsAsync } from "@/lib/songs/library"
import { computeAutodifficulty } from "@/lib/songs/difficulty"
import type { InstrumentTrack } from "@/lib/songs/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const INSTRUMENT_INFO: Record<string, { label: string; icon: string }> = {
  guitar:  { label: "Guitarra",         icon: "🎸" },
  rhythm:  { label: "Guitarra Rítmica", icon: "🎸" },
  bass:    { label: "Baixo",            icon: "🎵" },
  vocals:  { label: "Vocais",           icon: "🎤" },
  drums:   { label: "Bateria",          icon: "🥁" },
  drums_1: { label: "Bateria 1",        icon: "🥁" },
  drums_2: { label: "Bateria 2",        icon: "🥁" },
  drums_3: { label: "Bateria 3",        icon: "🥁" },
  keys:    { label: "Teclado",          icon: "🎹" },
  backing: { label: "Base",             icon: "🎶" },
  song:    { label: "Mixado",           icon: "🎶" },
}

const PLAYABLE = ["guitar", "rhythm", "bass", "vocals", "keys"]

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const { trackId } = await params
  const decodedId = decodeURIComponent(trackId)

  const [meta, chart, audioUrls] = await Promise.all([
    getSongMeta(decodedId),
    getSongChart(decodedId),
    getSongAudioUrlsAsync(decodedId),
  ])

  if (!meta || !chart) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 })
  }

  if (meta.difficulty === 3 && chart.notes.length > 0) {
    meta.difficulty = computeAutodifficulty(chart, meta)
  }

  const availableInstruments: InstrumentTrack[] = PLAYABLE
    .filter(key => !!(audioUrls as Record<string, string | undefined>)[key])
    .map(key => ({
      key,
      label: INSTRUMENT_INFO[key]?.label ?? key,
      icon:  INSTRUMENT_INFO[key]?.icon  ?? "🎵",
      url:   (audioUrls as Record<string, string>)[key],
    }))

  return NextResponse.json({ meta, chart, audioUrls, availableInstruments })
}
