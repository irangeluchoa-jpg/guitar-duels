/**
 * room-store.ts — Multiplayer persistente via Supabase
 *
 * Usa a tabela `rooms` no Supabase para guardar o estado de cada sala,
 * resolvendo o problema de múltiplas instâncias no Render/Vercel.
 *
 * Schema da tabela `rooms` (crie no Supabase SQL Editor):
 *   code        text PRIMARY KEY
 *   host_id     text NOT NULL
 *   song_id     text
 *   state       text NOT NULL DEFAULT 'waiting'
 *   paused_by   text
 *   start_time  bigint
 *   max_players int  NOT NULL DEFAULT 4
 *   players     jsonb NOT NULL DEFAULT '[]'
 *   created_at  bigint NOT NULL
 */

export interface RoomPlayer {
  id: string
  name: string
  score: number
  combo: number
  rockMeter: number
  ready: boolean
  instrument?: string
  lastSeen: number
}

export interface Room {
  code: string
  hostId: string
  songId: string | null
  players: RoomPlayer[]
  state: "waiting" | "playing" | "paused" | "ended"
  pausedBy: string | null
  startTime: number | null
  createdAt: number
  maxPlayers: number
}

// ── Supabase REST helpers ────────────────────────────────────────────────────

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

function sbHeaders() {
  return {
    "apikey":        SB_KEY,
    "Authorization": `Bearer ${SB_KEY}`,
    "Content-Type":  "application/json",
    "Prefer":        "return=representation",
  }
}

async function sbGet(path: string): Promise<any> {
  const res = await fetch(`${SB_URL}/rest/v1${path}`, { headers: sbHeaders() })
  if (!res.ok) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function sbPost(path: string, body: object): Promise<any> {
  const res = await fetch(`${SB_URL}/rest/v1${path}`, {
    method: "POST", headers: sbHeaders(), body: JSON.stringify(body),
  })
  if (!res.ok) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function sbPatch(path: string, body: object): Promise<any> {
  const res = await fetch(`${SB_URL}/rest/v1${path}`, {
    method: "PATCH", headers: sbHeaders(), body: JSON.stringify(body),
  })
  if (!res.ok) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function sbDelete(path: string): Promise<void> {
  await fetch(`${SB_URL}/rest/v1${path}`, {
    method: "DELETE", headers: sbHeaders(),
  })
}

// ── Row mapper ───────────────────────────────────────────────────────────────

function rowToRoom(row: any): Room {
  return {
    code:       row.code,
    hostId:     row.host_id,
    songId:     row.song_id ?? null,
    state:      row.state,
    pausedBy:   row.paused_by ?? null,
    startTime:  row.start_time ?? null,
    maxPlayers: row.max_players,
    createdAt:  row.created_at,
    players:    Array.isArray(row.players) ? row.players : [],
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function createRoom(hostId: string, hostName: string, maxPlayers = 4): Promise<Room> {
  const code = generateCode()
  const player: RoomPlayer = {
    id: hostId, name: hostName, score: 0, combo: 0,
    rockMeter: 50, ready: false, lastSeen: Date.now(),
  }
  const row = {
    code, host_id: hostId, song_id: null, state: "waiting",
    paused_by: null, start_time: null, max_players: maxPlayers,
    players: [player], created_at: Date.now(),
  }
  const result = await sbPost("/rooms", row)
  const created = result?.[0]
  return created ? rowToRoom(created) : {
    code, hostId, songId: null, state: "waiting", pausedBy: null,
    startTime: null, maxPlayers, players: [player], createdAt: Date.now(),
  }
}

export async function getRoom(code: string): Promise<Room | null> {
  const data = await sbGet(`/rooms?code=eq.${code.toUpperCase()}&select=*`)
  if (!data || !data[0]) return null
  return rowToRoom(data[0])
}

export async function joinRoom(code: string, playerId: string, playerName: string): Promise<Room | null> {
  const room = await getRoom(code)
  if (!room || room.players.length >= room.maxPlayers || room.state !== "waiting") return null
  const player: RoomPlayer = {
    id: playerId, name: playerName, score: 0, combo: 0,
    rockMeter: 50, ready: false, lastSeen: Date.now(),
  }
  const result = await sbPatch(`/rooms?code=eq.${code.toUpperCase()}`, {
    players: [...room.players, player],
  })
  return result?.[0] ? rowToRoom(result[0]) : null
}

export async function updatePlayer(code: string, playerId: string, data: Partial<RoomPlayer>): Promise<Room | null> {
  const room = await getRoom(code)
  if (!room) return null
  const result = await sbPatch(`/rooms?code=eq.${code.toUpperCase()}`, {
    players: room.players.map(p => p.id === playerId ? { ...p, ...data } : p),
  })
  return result?.[0] ? rowToRoom(result[0]) : null
}

export async function setRoomSong(code: string, songId: string): Promise<boolean> {
  const result = await sbPatch(`/rooms?code=eq.${code.toUpperCase()}`, { song_id: songId })
  return !!(result?.[0])
}

export async function setRoomState(code: string, state: Room["state"], pausedBy?: string): Promise<boolean> {
  const patch: any = { state, paused_by: pausedBy ?? null }
  if (state === "playing") patch.start_time = Date.now()
  const result = await sbPatch(`/rooms?code=eq.${code.toUpperCase()}`, patch)
  return !!(result?.[0])
}

export function serializeRoom(room: Room) {
  return {
    code:       room.code,
    hostId:     room.hostId,
    songId:     room.songId,
    state:      room.state,
    pausedBy:   room.pausedBy,
    startTime:  room.startTime,
    maxPlayers: room.maxPlayers,
    players:    room.players,
  }
}

export async function listRooms() {
  const data = await sbGet("/rooms?state=eq.waiting&select=*")
  if (!data) return []
  return (data as any[]).map(row => serializeRoom(rowToRoom(row)))
}

export async function heartbeat(code: string, playerId: string): Promise<boolean> {
  const room = await getRoom(code)
  if (!room) return false
  const result = await sbPatch(`/rooms?code=eq.${code.toUpperCase()}`, {
    players: room.players.map(p => p.id === playerId ? { ...p, lastSeen: Date.now() } : p),
  })
  return !!(result?.[0])
}

export async function removePlayer(code: string, playerId: string): Promise<Room | null> {
  const room = await getRoom(code)
  if (!room) return null
  const newPlayers = room.players.filter(p => p.id !== playerId)
  if (newPlayers.length === 0) { await sbDelete(`/rooms?code=eq.${code.toUpperCase()}`); return null }
  const patch: any = { players: newPlayers }
  if (room.hostId === playerId) patch.host_id = newPlayers[0].id
  if (room.pausedBy === playerId) { patch.state = "playing"; patch.paused_by = null }
  const result = await sbPatch(`/rooms?code=eq.${code.toUpperCase()}`, patch)
  return result?.[0] ? rowToRoom(result[0]) : null
}

export async function evictStalePlayers(code: string, timeoutMs = 8000): Promise<string[]> {
  const room = await getRoom(code)
  if (!room || room.state === "waiting") return []
  // Se a sala acabou de iniciar (menos de 30s), não remover ninguém — 
  // os jogadores ainda não tiveram chance de enviar heartbeat
  if (room.startTime && Date.now() - room.startTime < 30000) return []
  const now = Date.now()
  const evicted: string[] = []
  const newPlayers = room.players.filter(p => {
    if (now - p.lastSeen > timeoutMs) { evicted.push(p.id); return false }
    return true
  })
  if (evicted.length === 0) return []
  if (newPlayers.length === 0) { await sbDelete(`/rooms?code=eq.${code.toUpperCase()}`); return evicted }
  const patch: any = { players: newPlayers }
  if (evicted.includes(room.hostId)) patch.host_id = newPlayers[0].id
  if (room.pausedBy && evicted.includes(room.pausedBy)) { patch.state = "playing"; patch.paused_by = null }
  await sbPatch(`/rooms?code=eq.${code.toUpperCase()}`, patch)
  return evicted
}
