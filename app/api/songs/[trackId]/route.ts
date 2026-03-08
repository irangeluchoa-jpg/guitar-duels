import { NextResponse } from "next/server"
import { getSongChart, getSongMeta, getSongAudioUrls, getSongBackgroundUrl, getSongAlbumArt } from "@/lib/songs/library"
import { computeAutodifficulty } from "@/lib/songs/difficulty"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const { trackId } = await params
  const decodedId = decodeURIComponent(trackId)

  const [meta, chart] = await Promise.all([
    getSongMeta(decodedId),
    getSongChart(decodedId),
  ])

  if (!meta || !chart) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 })
  }

  if (meta.difficulty === 3 && chart.notes.length > 0) {
    meta.difficulty = computeAutodifficulty(chart, meta)
  }

  const audioUrls     = getSongAudioUrls(decodedId)
  const backgroundUrl = getSongBackgroundUrl(decodedId)
  const albumArt      = getSongAlbumArt(decodedId)

  const PLAYABLE_KEYS = ["guitar", "rhythm", "bass", "vocals", "keys"]
  const INSTRUMENT_INFO: Record<string, {label: string; icon: string}> = {
    guitar:  { label: "Guitarra",         icon: "🎸" },
    rhythm:  { label: "Guitarra Rítmica", icon: "🎸" },
    bass:    { label: "Baixo",            icon: "🎵" },
    vocals:  { label: "Vocais",           icon: "🎤" },
    keys:    { label: "Teclado",          icon: "🎹" },
  }
  const availableInstruments = PLAYABLE_KEYS
    .filter(k => !!(audioUrls as Record<string,string>)[k])
    .map(k => ({
      key:   k,
      label: INSTRUMENT_INFO[k]?.label ?? k,
      icon:  INSTRUMENT_INFO[k]?.icon  ?? "🎵",
      url:   (audioUrls as Record<string,string>)[k],
    }))

  return NextResponse.json({ meta, chart, audioUrls, backgroundUrl, albumArt, availableInstruments })
}
