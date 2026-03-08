import { NextResponse } from "next/server"
import { getSongChart, getSongMeta, getSongAudioUrls, songFileUrl } from "@/lib/songs/library"
import { computeAutodifficulty } from "@/lib/songs/difficulty"

// Impede que a Vercel empacote arquivos estáticos nesta função
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
  const backgroundUrl = songFileUrl(decodedId, "background.jpg")
  return NextResponse.json({ meta, chart, audioUrls, backgroundUrl })
}
