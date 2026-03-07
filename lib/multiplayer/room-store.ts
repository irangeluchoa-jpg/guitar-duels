/**
 * room-store.ts — Multiplayer via Supabase (sem delay de RAM)
 */

import { supabase } from "./supabase"

export interface RoomPlayer {
  id: string
  name: string
  score: number
  combo: number
  rockMeter: number
  ready: boolean
}

export interface SerializedRoom {
  code: string
  hostId: string
  songId: string | null
  state: "waiting" | "playing" | "paused" | "ended"
  pausedBy: string | null
  startTime: number | null
  maxPlayers: number
  players: RoomPlayer[]
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function dbToRoom(data: Record<string, unknown>): SerializedRoom {
  return {
    code:       data.code as string,
    hostId:     data.host_id as string,
    songId:     data.song_id as string | null,
    state:      data.state as SerializedRoom["state"],
    pausedBy:   data.paused_by as string | null,
    startTime:  data.start_time as number | null,
    maxPlayers: data.max_players as number,
    players:    (data.players as RoomPlayer[]) || [],
  }
}

export async function createRoom(hostId: string, hostName: string, maxPlayers = 4): Promise<SerializedRoom> {
  let code = generateCode()
  // Garante código único
  while (true) {
    const { data } = await supabase.from("rooms").select("code").eq("code", code).single()
    if (!data) break
    code = generateCode()
  }

  const players: RoomPlayer[] = [{ id: hostId, name: hostName, score: 0, combo: 0, rockMeter: 50, ready: false }]

  const { data, error } = await supabase.from("rooms").insert({
    code, host_id: hostId, song_id: null, state: "waiting",
    paused_by: null, start_time: null, max_players: maxPlayers,
    players, created_at: new Date().toISOString(),
  }).select().single()

  if (error || !data) throw new Error(error?.message || "Erro ao criar sala")
  return dbToRoom(data)
}

export async function getRoom(code: string): Promise<SerializedRoom | null> {
  const { data, error } = await supabase
    .from("rooms").select("*").eq("code", code.toUpperCase()).single()
  if (error || !data) return null
  return dbToRoom(data)
}

export async function joinRoom(code: string, playerId: string, playerName: string): Promise<SerializedRoom | null> {
  const room = await getRoom(code)
  if (!room) return null
  if (room.players.length >= room.maxPlayers) return null
  if (room.state !== "waiting") return null

  const newPlayer: RoomPlayer = { id: playerId, name: playerName, score: 0, combo: 0, rockMeter: 50, ready: false }
  const updatedPlayers = [...room.players, newPlayer]

  const { data, error } = await supabase
    .from("rooms").update({ players: updatedPlayers })
    .eq("code", code.toUpperCase()).select().single()
  if (error || !data) return null
  return dbToRoom(data)
}

export async function updatePlayer(code: string, playerId: string, update: Partial<RoomPlayer>): Promise<SerializedRoom | null> {
  const room = await getRoom(code)
  if (!room) return null

  const updatedPlayers = room.players.map(p => p.id === playerId ? { ...p, ...update } : p)

  const { data, error } = await supabase
    .from("rooms").update({ players: updatedPlayers })
    .eq("code", code.toUpperCase()).select().single()
  if (error || !data) return null
  return dbToRoom(data)
}

export async function setRoomSong(code: string, songId: string): Promise<boolean> {
  const { error } = await supabase.from("rooms")
    .update({ song_id: songId }).eq("code", code.toUpperCase())
  return !error
}

export async function setRoomState(code: string, state: SerializedRoom["state"], pausedBy?: string | null): Promise<boolean> {
  const update: Record<string, unknown> = { state }
  if (state === "playing") update.start_time = Date.now()
  if (pausedBy !== undefined) update.paused_by = pausedBy

  const { error } = await supabase.from("rooms")
    .update(update).eq("code", code.toUpperCase())
  return !error
}
