import { NextResponse } from "next/server"
import { getRoom, serializeRoom, updatePlayer, setRoomSong, setRoomState } from "@/lib/multiplayer/room-store"

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const room = getRoom(code)
  if (!room) return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 })
  return NextResponse.json(serializeRoom(room))
}

export async function PATCH(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const body = await req.json()
  const room = getRoom(code)
  if (!room) return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 })

  if (body.action === "score" && body.playerId) {
    updatePlayer(code, body.playerId, {
      score: body.score,
      combo: body.combo,
      rockMeter: body.rockMeter,
    })
  }

  if (body.action === "setSong" && body.songId) {
    setRoomSong(code, body.songId)
  }

  if (body.action === "setState" && body.state) {
    setRoomState(code, body.state, body.pausedBy ?? undefined)
  }

  if (body.action === "ready" && body.playerId) {
    updatePlayer(code, body.playerId, { ready: body.ready })
  }

  // Pause: qualquer jogador pode pausar para todos
  if (body.action === "pause" && body.playerId) {
    setRoomState(code, "paused", body.playerId)
  }

  // Resume: apenas quem pausou (ou o host) pode retomar
  if (body.action === "resume" && body.playerId) {
    const r = getRoom(code)
    if (r && (r.pausedBy === body.playerId || r.hostId === body.playerId)) {
      setRoomState(code, "playing")
    }
  }

  const updated = getRoom(code)!
  return NextResponse.json(serializeRoom(updated))
}
