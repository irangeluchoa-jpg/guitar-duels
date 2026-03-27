// server.js — Custom Next.js server with Socket.io
const { createServer } = require("http")
const { Server } = require("socket.io")
const next = require("next")

const dev = process.env.NODE_ENV !== "production"
const app = next({ dev })
const handler = app.getRequestHandler()

// Simple ID generator (replaces nanoid to avoid ESM issues)
function nanoid(size = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  const bytes = require('crypto').randomBytes(size)
  for (let i = 0; i < size; i++) {
    id += chars[bytes[i] % chars.length]
  }
  return id
}

// ── In-memory room store ─────────────────────────────────────────────────────
const rooms = new Map()

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function normalizeCode(code) {
  return (code ?? "").toUpperCase().trim()
}

function serializeRoom(room) {
  return {
    code: room.code,
    roomName: room.roomName || room.code,
    hostId: room.hostId,
    songId: room.songId,
    state: room.state,
    pausedBy: room.pausedBy,
    startTime: room.startTime,
    maxPlayers: room.maxPlayers,
    players: Array.from(room.players.values()),
  }
}

function cleanRooms() {
  const now = Date.now()
  for (const [code, room] of rooms.entries()) {
    if (now - room.createdAt > 2 * 60 * 60 * 1000) rooms.delete(code)
  }
}
setInterval(cleanRooms, 10 * 60 * 1000)

// Salas "dormentes" — mantidas por 30s após ficarem vazias
const _emptyRoomTimers = new Map()

// ── Boot ─────────────────────────────────────────────────────────────────────
app.prepare().then(() => {
  const httpServer = createServer(handler)
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    // Configuração simples e robusta — sem customizações que causam problemas
    transports: ["websocket", "polling"],
    pingInterval: 25000,
    pingTimeout: 20000,
  })

  io.on("connection", (socket) => {

    // ── CREATE ROOM ──────────────────────────────────────────────────────────
    socket.on("create-room", ({ playerName, maxPlayers, roomName, playerTitle, playerBorder, avatarUrl }, cb) => {
      const playerId = nanoid(8)
      let code = generateCode()
      while (rooms.has(code)) code = generateCode()

      const room = {
        code, hostId: playerId,
        roomName: roomName || `Sala de ${playerName || "Jogador"}`,
        songId: null, state: "waiting",
        pausedBy: null, startTime: null,
        maxPlayers: maxPlayers || 4,
        createdAt: Date.now(),
        players: new Map([[playerId, {
          id: playerId, name: playerName || "Jogador",
          title: playerTitle || "", border: playerBorder || "none",
          avatarUrl: avatarUrl || "",
          score: 0, combo: 0, rockMeter: 50,
          ready: false, socketId: socket.id,
        }]]),
      }
      rooms.set(code, room)
      socket.join(code)
      socket.data.roomCode = code
      socket.data.playerId = playerId
      cb?.({ success: true, playerId, room: serializeRoom(room) })
    })

    // ── JOIN ROOM ────────────────────────────────────────────────────────────
    socket.on("join-room", ({ code, playerName, playerTitle, playerBorder, avatarUrl }, cb) => {
      const room = rooms.get(code?.toUpperCase())
      if (!room) return cb?.({ success: false, error: "Sala não encontrada" })
      if (room.players.size >= room.maxPlayers) return cb?.({ success: false, error: "Sala cheia" })
      if (room.state !== "waiting") return cb?.({ success: false, error: "Jogo já iniciado" })

      const playerId = nanoid(8)
      room.players.set(playerId, {
        id: playerId, name: playerName || "Jogador",
        title: playerTitle || "", border: playerBorder || "none",
        avatarUrl: avatarUrl || "",
        score: 0, combo: 0, rockMeter: 50,
        ready: false, socketId: socket.id,
      })
      socket.join(code.toUpperCase())
      socket.data.roomCode = code.toUpperCase()
      socket.data.playerId = playerId

      const serialized = serializeRoom(room)
      io.to(code.toUpperCase()).emit("room-update", serialized)
      cb?.({ success: true, playerId, room: serialized })
    })

    // ── SET SONG ─────────────────────────────────────────────────────────────
    socket.on("set-song", ({ code, songId }) => {
      const room = rooms.get(normalizeCode(code))
      if (!room) return
      room.songId = songId
      io.to(code).emit("room-update", serializeRoom(room))
    })

    // ── PLAYER READY ─────────────────────────────────────────────────────────
    socket.on("player-ready", ({ code, playerId, laneCount }) => {
      const room = rooms.get(normalizeCode(code))
      if (!room) return
      const player = room.players.get(playerId)
      if (!player) return
      player.ready = true
      if (laneCount) player.laneCount = laneCount
      const serialized = serializeRoom(room)
      io.to(code).emit("room-update", serialized)

      const players = Array.from(room.players.values())
      if (players.length >= 2 && players.every(p => p.ready) && room.state === "waiting") {
        room.state = "playing"
        room.startTime = Date.now()
        io.to(code).emit("game-start", serializeRoom(room))
      }
    })

    // ── START GAME (manual by host) ───────────────────────────────────────────
    socket.on("start-game", ({ code }) => {
      const room = rooms.get(normalizeCode(code))
      if (!room) return
      room.state = "playing"
      room.startTime = Date.now()
      for (const p of room.players.values()) p.ready = false
      io.to(code).emit("game-start", serializeRoom(room))
    })

    // ── SCORE UPDATE ─────────────────────────────────────────────────────────
    socket.on("score-update", ({ code, playerId, score, combo, rockMeter }) => {
      const room = rooms.get(normalizeCode(code))
      if (!room) return
      const player = room.players.get(playerId)
      if (!player) return
      player.score = score; player.combo = combo; player.rockMeter = rockMeter
      socket.to(code).emit("scores-update", {
        players: Array.from(room.players.values()),
      })
    })

    // ── PAUSE ────────────────────────────────────────────────────────────────
    socket.on("pause-game", ({ code, playerId }) => {
      const room = rooms.get(normalizeCode(code))
      if (!room || room.state !== "playing") return
      room.state = "paused"; room.pausedBy = playerId
      io.to(code).emit("game-paused", { pausedBy: playerId, players: Array.from(room.players.values()) })
    })

    socket.on("resume-game", ({ code, playerId }) => {
      const room = rooms.get(normalizeCode(code))
      if (!room || room.state !== "paused") return
      if (room.pausedBy !== playerId && room.hostId !== playerId) return
      room.state = "playing"; room.pausedBy = null
      io.to(code).emit("game-resumed")
    })

    // ── END GAME ─────────────────────────────────────────────────────────────
    socket.on("end-game", ({ code }) => {
      const nc = normalizeCode(code)
      const room = rooms.get(nc)
      if (!room) return

      // Prevent double-trigger (both players emit end-game)
      if (room.state === "ended" || room.state === "waiting") return

      room.state = "ended"
      io.to(nc).emit("room-update", serializeRoom(room))

      // After 3s reset to waiting so players can queue another song
      setTimeout(() => {
        const r = rooms.get(nc)
        if (!r || r.state !== "ended") return
        r.state = "waiting"
        for (const p of r.players.values()) {
          p.ready = false
          p.score = 0
          p.combo = 0
          p.rockMeter = 50
        }
        io.to(nc).emit("room-update", serializeRoom(r))
      }, 3000)
    })

    // ── LEAVE ────────────────────────────────────────────────────────────────
    socket.on("leave-room", ({ code, playerId }) => {
      handleLeave(socket, io, normalizeCode(code), playerId)
    })

    socket.on("disconnect", () => {
      const { roomCode, playerId } = socket.data
      if (roomCode && playerId) handleLeave(socket, io, normalizeCode(roomCode), playerId)
    })

    // ── GET ROOM ────────────────────────────────────────────────────────────
    socket.on("get-room", ({ code }, cb) => {
      const nc = normalizeCode(code)
      const room = rooms.get(nc)
      if (!room) return cb?.(null)
      // Re-join no socket.io room caso tenha reconectado
      socket.join(nc)
      socket.data.roomCode = nc
      // Atualizar socketId do player se ele já está na sala
      const pid = socket.data.playerId
      if (pid && room.players.has(pid)) {
        room.players.get(pid).socketId = socket.id
      }
      cb?.(serializeRoom(room))
    })
  })

  const PORT = process.env.PORT || 3000
  httpServer.listen(PORT, () => {
    console.log(`> Guitar Duels ready on port ${PORT}`)
  })
})

function handleLeave(socket, io, code, playerId) {
  const nc = normalizeCode(code)
  const room = rooms.get(nc)
  if (!room) return
  room.players.delete(playerId)
  socket.leave(nc)

  if (room.players.size === 0) {
    if (_emptyRoomTimers.has(nc)) clearTimeout(_emptyRoomTimers.get(nc))
    const timer = setTimeout(() => {
      if (rooms.get(nc)?.players.size === 0) rooms.delete(nc)
      _emptyRoomTimers.delete(nc)
    }, 30000)
    _emptyRoomTimers.set(nc, timer)
    return
  }

  if (_emptyRoomTimers.has(nc)) {
    clearTimeout(_emptyRoomTimers.get(nc))
    _emptyRoomTimers.delete(nc)
  }

  if (room.hostId === playerId) {
    room.hostId = room.players.keys().next().value
  }
  if (room.pausedBy === playerId) {
    room.state = "playing"; room.pausedBy = null
  }

  io.to(nc).emit("player-left", { playerId, room: {
    code: room.code, hostId: room.hostId, songId: room.songId,
    state: room.state, pausedBy: room.pausedBy, startTime: room.startTime,
    maxPlayers: room.maxPlayers, players: Array.from(room.players.values()),
  }})
}
