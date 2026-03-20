import { NextResponse } from "next/server"
import { getSongList } from "@/lib/songs/library"

// Revalida a cada 5 minutos — lista de músicas raramente muda
// Primeira visita: gera a lista. Próximas: serve do cache.
export const dynamic = "force-static"
export const revalidate = 300  // 5 minutos

export async function GET() {
  const songs = await getSongList()
  return NextResponse.json(songs, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  })
}
