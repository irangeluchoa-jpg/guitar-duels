/**
 * use-audio-output.ts
 * Lista os dispositivos de saída de áudio do sistema e aplica setSinkId
 * em todos os elementos <audio> passados como refs.
 */
import { useEffect, useState, useCallback, RefObject } from "react"

export interface AudioOutputDevice {
  deviceId: string
  label: string
}

/** Pede permissão de microfone (necessário para ver labels dos dispositivos) e lista saídas */
export async function listAudioOutputs(): Promise<AudioOutputDevice[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) return []
  try {
    // Precisamos pedir permissão de getUserMedia para ver os labels
    // Mas só pedimos se ainda não temos labels
    const raw = await navigator.mediaDevices.enumerateDevices()
    const outputs = raw.filter(d => d.kind === "audiooutput")

    // Se os labels estão vazios, pedir permissão de áudio e re-enumerar
    if (outputs.length > 0 && !outputs[0].label) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach(t => t.stop())
        const raw2 = await navigator.mediaDevices.enumerateDevices()
        return raw2
          .filter(d => d.kind === "audiooutput")
          .map(d => ({
            deviceId: d.deviceId,
            label: d.label || `Saída ${d.deviceId.slice(0, 8)}`,
          }))
      } catch {
        // Permissão negada — retorna sem labels
      }
    }

    return outputs.map(d => ({
      deviceId: d.deviceId,
      label: d.label || (d.deviceId === "default" ? "Padrão do sistema" : `Saída ${d.deviceId.slice(0, 8)}`),
    }))
  } catch {
    return []
  }
}

/** Aplica setSinkId a um elemento de áudio se suportado */
async function applySinkId(el: HTMLAudioElement, deviceId: string) {
  if (!el || !("setSinkId" in el)) return
  try {
    await (el as HTMLAudioElement & { setSinkId(id: string): Promise<void> }).setSinkId(deviceId)
  } catch (e) {
    console.warn("setSinkId falhou:", e)
  }
}

/** Hook: enumera dispositivos e aplica o deviceId salvo em todos os refs passados */
export function useAudioOutput(
  audioRefs: RefObject<HTMLAudioElement | null>[],
  deviceId: string
) {
  const [devices, setDevices] = useState<AudioOutputDevice[]>([])
  const [supported, setSupported] = useState(false)
  const [loading, setLoading]   = useState(false)

  // Detectar suporte
  useEffect(() => {
    const el = document.createElement("audio")
    setSupported("setSinkId" in el)
  }, [])

  // Quando deviceId muda, aplicar em todos os elementos
  useEffect(() => {
    if (!deviceId) return
    for (const ref of audioRefs) {
      if (ref.current) applySinkId(ref.current, deviceId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId])

  // Listar dispositivos (chamado pela UI quando o usuário abre o seletor)
  const fetchDevices = useCallback(async () => {
    setLoading(true)
    const list = await listAudioOutputs()
    setDevices(list)
    setLoading(false)
  }, [])

  return { devices, supported, loading, fetchDevices }
}
