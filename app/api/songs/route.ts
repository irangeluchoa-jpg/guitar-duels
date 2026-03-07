import { NextResponse } from "next/server"
import { getSongList } from "@/lib/songs/library"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const songs = await getSongList()
  return NextResponse.json(songs)
}
