/**
 * room-store.ts — Multiplayer com persistência em arquivo
 *
 * Por que arquivo em vez de Map em memória?
 * O Render.com reinicia o processo Node.js a cada novo deploy ou após
 * períodos de inatividade. global.__rooms é perdido nessas reinicializações,
 * fazendo as salas sumirem com 404. Gravar em /tmp/rooms.json resolve isso.
 */

import fs from "fs"
import path from "path"
import os from "os"

export interface RoomPlayer {
  id: string
  name: string
  score: number
  combo: number
  rockMeter: number
  ready: boolean
  instrument?: string
  laneCount?: number
  lastSeen: number
}

export interface Room {
  code: string
  hostId: string
  songId: string | null
  players: Map<string, RoomPlayer>
  state: "waiting" | "playing" | "paused" | "ended"
  pausedBy: string | null
  startTime: number | null
  createdAt: number
  maxPlayers: number
}

interface RoomFile {
  code: string
  hostId: string
  songId: string | null
  players: RoomPlayer[]
  state: Room["state"]
  pausedBy: string | null
  startTime: number | null
  createdAt: number
  maxPlayers: number
}

const STORE_PATH = path.join(os.tmpdir(), "guitar-duels-rooms.json")
const ROOM_TTL   = 2 * 60 * 60 * 1000  // 2 horas

let _cache: Map<string, Room> | null = null
let _lastWrite = 0

function loadFromDisk(): Map<string, Room> {
  try {
    if (!fs.existsSync(STORE_PATH)) return new Map()
    const raw = fs.readFileSync(STORE_PATH, "utf-8")
    const data: Record<string, RoomFile> = JSON.parse(raw)
    const map = new Map<string, Room>()
    const now = Date.now()
    for (const [code, r] of Object.entries(data)) {
      if (now - r.createdAt > ROOM_TTL) continue
      map.set(code, {
        ...r,
        players: new Map(r.players.map(p => [p.id, p])),
      })
    }
    return map
  } catch {
    return new Map()
  }
}

function saveImmediate(rooms: Map<string, Room>) {
  try {
    const data: Record<string, RoomFile> = {}
    for (const [code, room] of rooms.entries()) {
      if (Date.now() - room.createdAt > ROOM_TTL) continue
      data[code] = { ...room, players: Array.from(room.players.values()) }
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(data), "utf-8")
    _lastWrite = Date.now()
  } catch {}
}

function saveToDisk(rooms: Map<string, Room>) {
  // Throttle: no máximo 1x por segundo (chamado a cada heartbeat/score update)
  if (Date.now() - _lastWrite < 1000) return
  saveImmediate(rooms)
}

function getRooms(): Map<string, Room> {
  if (!_cache) _cache = loadFromDisk()
  return _cache
}

let _lastClean = 0
function maybeClean(rooms: Map<string, Room>) {
  const now = Date.now()
  if (now - _lastClean < 10 * 60 * 1000) return
  _lastClean = now
  for (const [code, room] of rooms.entries()) {
    if (now - room.createdAt > ROOM_TTL) rooms.delete(code)
  }
  saveImmediate(rooms)
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export function createRoom(hostId: string, hostName: string, maxPlayers = 4): Room {
  const rooms = getRooms()
  maybeClean(rooms)
  let code = generateCode()
  while (rooms.has(code)) code = generateCode()
  const room: Room = {
    code, hostId, songId: null, maxPlayers,
    players: new Map([[hostId, {
      id: hostId, name: hostName, score: 0, combo: 0,
      rockMeter: 50, ready: false, lastSeen: Date.now(),
    }]]),
    state: "waiting", pausedBy: null, startTime: null, createdAt: Date.now(),
  }
  rooms.set(code, room)
  saveImmediate(rooms)
  return room
}

export function getRoom(code: string): Room | undefined {
  const rooms = getRooms()
  const upper = code.toUpperCase()
  let room = rooms.get(upper)
  if (room) return room
  // Sala não encontrada no cache → recarrega do disco
  // (cobre reinicializações do processo Node.js)
  _cache = loadFromDisk()
  return _cache.get(upper)
}

export function joinRoom(code: string, playerId: string, playerName: string): Room | null {
  const rooms = getRooms()
  const room = rooms.get(code.toUpperCase())
  if (!room || room.players.size >= room.maxPlayers || room.state !== "waiting") return null
  room.players.set(playerId, {
    id: playerId, name: playerName, score: 0, combo: 0,
    rockMeter: 50, ready: false, lastSeen: Date.now(),
  })
  saveImmediate(rooms)
  return room
}

export function updatePlayer(code: string, playerId: string, data: Partial<RoomPlayer>): Room | null {
  const rooms = getRooms()
  const room = rooms.get(code.toUpperCase())
  if (!room) return null
  const p = room.players.get(playerId)
  if (!p) return null
  Object.assign(p, data)
  saveToDisk(rooms)
  return room
}

export function setRoomSong(code: string, songId: string): boolean {
  const rooms = getRooms()
  const room = rooms.get(code.toUpperCase())
  if (!room) return false
  room.songId = songId
  saveImmediate(rooms)
  return true
}

export function setRoomState(code: string, state: Room["state"], pausedBy?: string): boolean {
  const rooms = getRooms()
  const room = rooms.get(code.toUpperCase())
  if (!room) return false
  room.state = state
  room.pausedBy = pausedBy ?? null
  if (state === "playing") room.startTime = Date.now()
  saveImmediate(rooms)
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
  return Array.from(getRooms().values())
    .filter(r => r.state === "waiting")
    .map(serializeRoom)
}

export function heartbeat(code: string, playerId: string): boolean {
  const rooms = getRooms()
  const room = rooms.get(code.toUpperCase())
  if (!room) return false
  const p = room.players.get(playerId)
  if (!p) return false
  p.lastSeen = Date.now()
  saveToDisk(rooms)
  return true
}

export function removePlayer(code: string, playerId: string): Room | null {
  const rooms = getRooms()
  const room = rooms.get(code.toUpperCase())
  if (!room) return null
  room.players.delete(playerId)
  if (room.hostId === playerId && room.players.size > 0) {
    room.hostId = room.players.keys().next().value as string
  }
  if (room.players.size === 0) {
    rooms.delete(code.toUpperCase())
    saveImmediate(rooms)
    return null
  }
  if (room.pausedBy === playerId) {
    room.state = "playing"
    room.pausedBy = null
  }
  saveImmediate(rooms)
  return room
}

export function evictStalePlayers(code: string, timeoutMs = 8000): string[] {
  const rooms = getRooms()
  const room = rooms.get(code.toUpperCase())
  if (!room || room.state === "waiting") return []
  const now = Date.now()
  const evicted: string[] = []
  for (const [id, p] of room.players.entries()) {
    if (now - p.lastSeen > timeoutMs) {
      room.players.delete(id)
      if (room.hostId === id && room.players.size > 0) {
        room.hostId = room.players.keys().next().value as string
      }
      if (room.pausedBy === id) {
        room.state = "playing"
        room.pausedBy = null
      }
      evicted.push(id)
    }
  }
  if (room.players.size === 0) rooms.delete(code.toUpperCase())
  if (evicted.length > 0) saveImmediate(rooms)
  return evicted
}
