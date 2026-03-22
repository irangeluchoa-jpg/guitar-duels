// socket-client.ts — Singleton Socket.io client
import { io, Socket } from "socket.io-client"

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket || socket.disconnected) {
    // Se socket existe mas está desconectado, tentar reconectar
    if (socket?.disconnected) {
      socket.connect()
      return socket
    }
    socket = io({
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 10000,
    })

    socket.on("connect_error", (err) => {
      console.warn("[Socket] Erro de conexão:", err.message)
    })
  }
  return socket
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null }
}

export type { Socket }
