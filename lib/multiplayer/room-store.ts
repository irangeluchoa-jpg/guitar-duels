/**
 * room-store.ts — Multiplayer com suporte a até 4 jogadores e pause global
 */

export interface RoomPlayer {
  id: string
  name: string
  score: number
  combo: number
  rockMeter: number
  ready: boolean
  instrument?: string  // instrumento escolhido (guitar, rhythm, vocals, etc)
}

export interface Room {
  code: string
  hostId: string
  songId: string | null
  players: Map<string, RoomPlayer>
  state: "waiting" | "playing" | "paused" | "ended"
  pausedBy: string | null   // id do jogador que pausou
  startTime: number | null
  createdAt: number
  maxPlayers: number
}

declare global {
  // eslint-disable-next-line no-var
  var __rooms: Map<string, Room> | undefined
  // eslint-disable-next-line no-var
  var __roomsLastClean: number | undefined
}

const rooms: Map<string, Room> = global.__rooms ?? (global.__rooms = new Map())

const ROOM_TTL = 60 * 60 * 1000
function maybeClean() {
  const now = Date.now()
  if (global.__roomsLastClean && now - global.__roomsLastClean < 10 * 60 * 1000) return
  global.__roomsLastClean = now
  for (const [code, room] of rooms.entries()) {
    if (now - room.createdAt > ROOM_TTL) rooms.delete(code)
  }
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export function createRoom(hostId: string, hostName: string, maxPlayers = 4): Room {
  maybeClean()
  let code = generateCode()
  while (rooms.has(code)) code = generateCode()
  const room: Room = {
    code, hostId, songId: null, maxPlayers,
    players: new Map([[hostId, { id: hostId, name: hostName, score: 0, combo: 0, rockMeter: 50, ready: false }]]),
    state: "waiting", pausedBy: null, startTime: null, createdAt: Date.now(),
  }
  rooms.set(code, room)
  return room
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase())
}

export function joinRoom(code: string, playerId: string, playerName: string): Room | null {
  const room = rooms.get(code.toUpperCase())
  if (!room || room.players.size >= room.maxPlayers || room.state !== "waiting") return null
  room.players.set(playerId, { id: playerId, name: playerName, score: 0, combo: 0, rockMeter: 50, ready: false })
  return room
}

export function updatePlayer(code: string, playerId: string, data: Partial<RoomPlayer>): Room | null {
  const room = rooms.get(code.toUpperCase())
  if (!room) return null
  const p = room.players.get(playerId)
  if (!p) return null
  Object.assign(p, data)
  return room
}

export function setRoomSong(code: string, songId: string): boolean {
  const room = rooms.get(code.toUpperCase())
  if (!room) return false
  room.songId = songId
  return true
}

export function setRoomState(code: string, state: Room["state"], pausedBy?: string): boolean {
  const room = rooms.get(code.toUpperCase())
  if (!room) return false
  room.state = state
  room.pausedBy = pausedBy ?? null
  if (state === "playing") room.startTime = Date.now()
  return true
}

export function serializeRoom(room: Room) {
  return {
    code: room.code,
    hostId: room.hostId,
    songId: room.songId,
    state: room.state,
    pausedBy: room.pausedBy,
    startTime: room.startTime,
    maxPlayers: room.maxPlayers,
    players: Array.from(room.players.values()),
  }
}

export function listRooms() {
  return Array.from(rooms.values())
    .filter(r => r.state === "waiting")
    .map(serializeRoom)
}
