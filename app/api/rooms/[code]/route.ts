import { NextResponse } from "next/server"
import { getRoom, serializeRoom, updatePlayer, setRoomSong, setRoomState, heartbeat, removePlayer, evictStalePlayers } from "@/lib/multiplayer/room-store"

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  await evictStalePlayers(code, 8000)
  const room = await getRoom(code)
  if (!room) return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 })
  return NextResponse.json(serializeRoom(room))
}

export async function PATCH(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const body = await req.json()
  const room = await getRoom(code)
  if (!room) return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 })

  if (body.action === "score" && body.playerId) {
    await updatePlayer(code, body.playerId, {
      score: body.score, combo: body.combo, rockMeter: body.rockMeter,
    })
  }

  if (body.action === "setSong" && body.songId) {
    await setRoomSong(code, body.songId)
  }

  if (body.action === "setState" && body.state) {
    await setRoomState(code, body.state, body.pausedBy ?? undefined)
  }

  if (body.action === "ready" && body.playerId) {
    await updatePlayer(code, body.playerId, { ready: body.ready })
  }

  if (body.action === "pause" && body.playerId) {
    await setRoomState(code, "paused", body.playerId)
  }

  if (body.action === "resume" && body.playerId) {
    const r = await getRoom(code)
    if (r && (r.pausedBy === body.playerId || r.hostId === body.playerId)) {
      await setRoomState(code, "playing")
    }
  }

  if (body.action === "heartbeat" && body.playerId) {
    await heartbeat(code, body.playerId)
  }

  if (body.action === "leave" && body.playerId) {
    const after = await removePlayer(code, body.playerId)
    if (!after) return NextResponse.json({ left: true })
    return NextResponse.json(serializeRoom(after))
  }

  const updated = await getRoom(code)
  if (!updated) return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 })
  return NextResponse.json(serializeRoom(updated))
}
