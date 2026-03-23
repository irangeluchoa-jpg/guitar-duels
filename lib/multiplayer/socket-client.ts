// socket-client.ts — Singleton Socket.io client
import { io, Socket } from "socket.io-client"

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      // Configuração simples e robusta — funciona no Render e Railway
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
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

  if (socket.disconnected) {
    socket.connect()
  }

  return socket
}

export function isSocketConnected(): boolean {
  return !!socket?.connected
}

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
      resolve(true)
    }
    s.once("connect", onConnect)
  })
}

/**
 * Emite com retry simples — sem dividir o timeout por tentativas.
 * Cada tentativa tem maxWaitMs inteiros, e faz até retries tentativas.
 */
export function emitWithRetry<T>(
  event: string,
  data: unknown,
  maxWaitMs = 10000,
  retries = 2
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const s = getSocket()

      if (!s.connected) {
        const ok = await waitForConnection(15000)
        if (!ok) {
          reject(new Error("Servidor offline. Tente novamente."))
          return
        }
      }

      const result = await new Promise<T | null>((res) => {
        const t = setTimeout(() => {
          console.warn(`[Socket] ${event} tentativa ${attempt + 1} timeout`)
          res(null)
        }, maxWaitMs)

        s.emit(event, data, (response: T) => {
          clearTimeout(t)
          res(response)
        })
      })

      if (result !== null) {
        resolve(result)
        return
      }

      if (attempt < retries) {
        // Aguardar 1s antes de retentar
        await new Promise(r => setTimeout(r, 1000))
      }
    }
    reject(new Error("Servidor não respondeu. Tente novamente."))
  })
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null }
}

export type { Socket }
