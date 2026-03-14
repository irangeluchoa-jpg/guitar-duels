import { NextResponse } from "next/server"
import { createRoom, joinRoom, serializeRoom } from "@/lib/multiplayer/room-store"
import { nanoid } from "nanoid"

export async function POST(req: Request) {
  const body = await req.json()
  const { action, code, playerName, maxPlayers } = body
  const playerId = nanoid(8)

  if (action === "create") {
    const name = playerName || "Jogador 1"
    const max = typeof maxPlayers === "number" && [2,3,4].includes(maxPlayers) ? maxPlayers : 4
    const room = await createRoom(playerId, name, max)
    return NextResponse.json({ success: true, playerId, room: serializeRoom(room) })
  }

  if (action === "join") {
    if (!code) return NextResponse.json({ success: false, error: "Código inválido" }, { status: 400 })
    const name = playerName || "Jogador"
    const room = await joinRoom(code, playerId, name)
    if (!room) return NextResponse.json({ success: false, error: "Sala não encontrada ou cheia" }, { status: 404 })
    return NextResponse.json({ success: true, playerId, room: serializeRoom(room) })
  }

  return NextResponse.json({ success: false, error: "Ação inválida" }, { status: 400 })
}
