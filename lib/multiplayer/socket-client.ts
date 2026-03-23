// socket-client.ts — Singleton Socket.io client com reconexão melhorada
import { io, Socket } from "socket.io-client"

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      // Polling primeiro: mais estável no Railway (cada request é independente)
      // WebSocket pode ser fechado pelo proxy do Railway após 30s idle
      transports: ["polling", "websocket"],
      upgrade: true,         // tenta upgrade para WebSocket após conectar via polling
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 30000,
      ackTimeout: 10000,
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
 * Emite um evento com retry automático se o callback não chegar ou socket reconectar.
 * Resolve com o resultado ou rejeita após todas as tentativas falharem.
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

      // Garantir conexão estável antes de emitir
      if (!s.connected) {
        const ok = await waitForConnection(15000)
        if (!ok) { reject(new Error("Não foi possível conectar ao servidor")); return }
      }

      const result = await new Promise<T | "reconnected" | null>((res) => {
        const waitPerAttempt = Math.floor(maxWaitMs / (retries + 1))
        const t = setTimeout(() => res(null), waitPerAttempt)

        // Se socket reconectar durante o emit, retentar imediatamente
        const onReconnect = () => {
          clearTimeout(t)
          res("reconnected")
        }
        s.once("connect", onReconnect)

        s.emit(event, data, (response: T) => {
          clearTimeout(t)
          s.off("connect", onReconnect)
          res(response)
        })
      })

      if (result === "reconnected") {
        console.warn(`[Socket] ${event} interrompido por reconexão, retentando...`)
        await new Promise(r => setTimeout(r, 300)) // aguardar socket estabilizar
        continue
      }
      if (result !== null) { resolve(result); return }
      console.warn(`[Socket] ${event} tentativa ${attempt + 1}/${retries + 1} sem resposta`)
    }
    reject(new Error("Servidor não respondeu. Verifique sua conexão."))
  })
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null }
}

export type { Socket }
