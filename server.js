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
// Works because Socket.io guarantees single process (no multi-instance issue)
// Supabase still used for global leaderboard / scores

const rooms = new Map()

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
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

// ── Boot ─────────────────────────────────────────────────────────────────────
app.prepare().then(() => {
  const httpServer = createServer(handler)
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
    // Railway tem latência de 3-4s — aumentar timeouts para evitar reconexões
    pingInterval: 25000,   // 25s entre pings
    pingTimeout:  20000,   // 20s para responder ping (era 5s — causava reconexões!)
    connectTimeout: 30000, // 30s para estabelecer conexão inicial
    // Desabilitar compressão — Railway proxy não suporta bem
    perMessageDeflate: false,
    httpCompression: false,
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
      const room = rooms.get(code)
      if (!room) return
      room.songId = songId
      io.to(code).emit("room-update", serializeRoom(room))
    })

    // ── PLAYER READY ─────────────────────────────────────────────────────────
    socket.on("player-ready", ({ code, playerId, laneCount }) => {
      const room = rooms.get(code)
      if (!room) return
      const player = room.players.get(playerId)
      if (!player) return
      player.ready = true
      if (laneCount) player.laneCount = laneCount
      const serialized = serializeRoom(room)
      io.to(code).emit("room-update", serialized)

      // Auto-start when ALL players are ready (minimum 2)
      const players = Array.from(room.players.values())
      if (players.length >= 2 && players.every(p => p.ready) && room.state === "waiting") {
        room.state = "playing"
        room.startTime = Date.now()
        io.to(code).emit("game-start", serializeRoom(room))
      }
    })

    // ── START GAME (manual by host) ───────────────────────────────────────────
    socket.on("start-game", ({ code }) => {
      const room = rooms.get(code)
      if (!room) return
      room.state = "playing"
      room.startTime = Date.now()
      // Reset ready states
      for (const p of room.players.values()) p.ready = false
      io.to(code).emit("game-start", serializeRoom(room))
    })

    // ── SCORE UPDATE ─────────────────────────────────────────────────────────
    socket.on("score-update", ({ code, playerId, score, combo, rockMeter }) => {
      const room = rooms.get(code)
      if (!room) return
      const player = room.players.get(playerId)
      if (!player) return
      player.score = score; player.combo = combo; player.rockMeter = rockMeter
      // Broadcast to others in room (not sender)
      socket.to(code).emit("scores-update", {
        players: Array.from(room.players.values()),
      })
    })

    // ── PAUSE ────────────────────────────────────────────────────────────────
    socket.on("pause-game", ({ code, playerId }) => {
      const room = rooms.get(code)
      if (!room || room.state !== "playing") return
      room.state = "paused"; room.pausedBy = playerId
      io.to(code).emit("game-paused", { pausedBy: playerId, players: Array.from(room.players.values()) })
    })

    socket.on("resume-game", ({ code, playerId }) => {
      const room = rooms.get(code)
      if (!room || room.state !== "paused") return
      if (room.pausedBy !== playerId && room.hostId !== playerId) return
      room.state = "playing"; room.pausedBy = null
      io.to(code).emit("game-resumed")
    })

    // ── END GAME ─────────────────────────────────────────────────────────────
    socket.on("end-game", ({ code }) => {
      const room = rooms.get(code)
      if (!room) return
      room.state = "ended"
      io.to(code).emit("room-update", serializeRoom(room))
    })

    // ── LEAVE ────────────────────────────────────────────────────────────────
    socket.on("leave-room", ({ code, playerId }) => {
      handleLeave(socket, io, code, playerId)
    })

    socket.on("disconnect", () => {
      const { roomCode, playerId } = socket.data
      if (roomCode && playerId) handleLeave(socket, io, roomCode, playerId)
    })

    // ── GET ROOM (for reconnects/refreshes) ────────────────────────────────────
    socket.on("get-room", ({ code }, cb) => {
      const room = rooms.get(code?.toUpperCase())
      if (!room) return cb?.(null)
      cb?.(serializeRoom(room))
    })

    // ── REST API bridge ──────────────────────────────────────────────────────
    // /api/rooms kept for backward compat but WS is primary
  })

  const PORT = process.env.PORT || 3000
  httpServer.listen(PORT, () => {
    console.log(`> Guitar Duels ready on http://localhost:${PORT}`)
  })
})

// Salas "dormentes" aguardando host voltar (deletadas após timeout)
const _emptyRoomTimers = new Map()

function handleLeave(socket, io, code, playerId) {
  const room = rooms.get(code)
  if (!room) return
  room.players.delete(playerId)
  socket.leave(code)

  if (room.players.size === 0) {
    // Não deletar imediatamente — dar 30s para o host voltar ao lobby
    if (_emptyRoomTimers.has(code)) clearTimeout(_emptyRoomTimers.get(code))
    const timer = setTimeout(() => {
      if (rooms.get(code)?.players.size === 0) rooms.delete(code)
      _emptyRoomTimers.delete(code)
    }, 30000)
    _emptyRoomTimers.set(code, timer)
    return
  }

  // Cancelar timer de deleção se alguém voltou
  if (_emptyRoomTimers.has(code)) {
    clearTimeout(_emptyRoomTimers.get(code))
    _emptyRoomTimers.delete(code)
  }

  // Promote new host if needed
  if (room.hostId === playerId) {
    room.hostId = room.players.keys().next().value
  }
  if (room.pausedBy === playerId) {
    room.state = "playing"; room.pausedBy = null
  }

  io.to(code).emit("player-left", { playerId, room: {
    code: room.code, hostId: room.hostId, songId: room.songId,
    state: room.state, pausedBy: room.pausedBy, startTime: room.startTime,
    maxPlayers: room.maxPlayers, players: Array.from(room.players.values()),
  }})
}
