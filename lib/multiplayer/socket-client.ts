// socket-client.ts — Singleton Socket.io client com reconexão melhorada
import { io, Socket } from "socket.io-client"

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      // Tentar WebSocket primeiro, cair para polling se necessário
      transports: ["websocket", "polling"],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 30000,    // Railway pode demorar até 20s para acordar
      ackTimeout: 10000, // timeout para acks de callbacks
    })

    socket.on("connect_error", (err) => {
      console.warn("[Socket] Erro de conexão:", err.message)
    })

    socket.on("connect", () => {
      console.log("[Socket] Conectado:", socket?.id)
    })

    socket.on("disconnect", (reason) => {
      console.warn("[Socket] Desconectado:", reason)
    })
  }

  // Se desconectado, reconectar
  if (socket.disconnected) {
    socket.connect()
  }

  return socket
}

/** Retorna true se o socket está conectado E estável (não em processo de upgrade) */
export function isSocketConnected(): boolean {
  return !!socket?.connected
}

/** Aguarda conexão estável por até maxWaitMs ms */
export function waitForConnection(maxWaitMs = 20000): Promise<boolean> {
  return new Promise((resolve) => {
    const s = getSocket()
    if (s.connected) { resolve(true); return }

    const timer = setTimeout(() => {
      s.off("connect", onConnect)
      resolve(false)
    }, maxWaitMs)

    const onConnect = () => {
      clearTimeout(timer)
      // Pequeno delay para garantir que o socket está estável após connect
      setTimeout(() => resolve(true), 100)
    }
    s.once("connect", onConnect)
  })
}

/**
 * Emite um evento com retry automático se o callback não chegar.
 * Resolve com o resultado ou rejeita após maxWaitMs.
 */
export function emitWithRetry<T>(
  event: string,
  data: unknown,
  maxWaitMs = 12000,
  retries = 2
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const s = getSocket()
      if (!s.connected) {
        const ok = await waitForConnection(10000)
        if (!ok) { reject(new Error("Não foi possível conectar ao servidor")); return }
      }

      const result = await new Promise<T | null>((res) => {
        const t = setTimeout(() => res(null), maxWaitMs / (retries + 1))
        s.emit(event, data, (response: T) => {
          clearTimeout(t)
          res(response)
        })
      })

      if (result !== null) { resolve(result); return }
      console.warn(`[Socket] ${event} tentativa ${attempt + 1} sem resposta, retentando...`)
    }
    reject(new Error("Servidor não respondeu após múltiplas tentativas"))
  })
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null }
}

export type { Socket }
