import { NextResponse } from "next/server"
import { getRoom, updatePlayer, setRoomSong, setRoomState } from "@/lib/multiplayer/room-store"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  try {
    const room = await getRoom(code)
    if (!room) return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 })
    return NextResponse.json(room)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const body = await req.json()

  try {
    if (body.action === "score" && body.playerId) {
      await updatePlayer(code, body.playerId, {
        score: body.score, combo: body.combo, rockMeter: body.rockMeter,
      })
    }
    if (body.action === "setSong" && body.songId) {
      await setRoomSong(code, body.songId)
    }
    if (body.action === "setState" && body.state) {
      await setRoomState(code, body.state, body.pausedBy ?? null)
    }
    if (body.action === "ready" && body.playerId) {
      await updatePlayer(code, body.playerId, { ready: body.ready })
    }
    if (body.action === "pause" && body.playerId) {
      await setRoomState(code, "paused", body.playerId)
    }
    if (body.action === "resume" && body.playerId) {
      const room = await getRoom(code)
      if (room && (room.pausedBy === body.playerId || room.hostId === body.playerId)) {
        await setRoomState(code, "playing", null)
      }
    }

    const updated = await getRoom(code)
    if (!updated) return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 })
    return NextResponse.json(updated)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 })
  }
}
