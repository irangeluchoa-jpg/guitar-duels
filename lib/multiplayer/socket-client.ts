// socket-client.ts — Singleton Socket.io client com reconexão melhorada
import { io, Socket } from "socket.io-client"

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,  // Railway pode demorar até 15s para acordar
    })

    socket.on("connect_error", (err) => {
      console.warn("[Socket] Erro de conexão:", err.message)
    })
  }

  // Se desconectado, reconectar
  if (socket.disconnected) {
    socket.connect()
  }

  return socket
}

/** Retorna true se o socket está conectado */
export function isSocketConnected(): boolean {
  return !!socket?.connected
}

/** Aguarda conexão por até maxWaitMs ms, depois chama callback */
export function waitForConnection(maxWaitMs = 15000): Promise<boolean> {
  return new Promise((resolve) => {
    const s = getSocket()
    if (s.connected) { resolve(true); return }

    const timer = setTimeout(() => {
      s.off("connect", onConnect)
      resolve(false)
    }, maxWaitMs)

    const onConnect = () => {
      clearTimeout(timer)
      resolve(true)
    }
    s.once("connect", onConnect)
  })
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null }
}

export type { Socket }
