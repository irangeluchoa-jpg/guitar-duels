"use client"

import React, { useEffect, useState, useCallback } from "react"
import type { Achievement, LevelUpInfo } from "@/lib/progression"
import { RARITY_COLORS } from "@/lib/progression"

interface AchievementToast {
  id: string
  achievement: Achievement
}

interface LevelToast {
  id: string
  info: LevelUpInfo
}

type ToastItem =
  | { type: "achievement"; id: string; achievement: Achievement }
  | { type: "levelup";     id: string; info: LevelUpInfo }
  | { type: "xp";          id: string; amount: number; label: string }

let _dispatch: ((t: ToastItem) => void) | null = null

export function showAchievementToast(achievement: Achievement) {
  _dispatch?.({ type: "achievement", id: `ach-${Date.now()}-${achievement.id}`, achievement })
}
export function showLevelUpToast(info: LevelUpInfo) {
  _dispatch?.({ type: "levelup", id: `lvl-${Date.now()}`, info })
}
export function showXPToast(amount: number, label: string) {
  _dispatch?.({ type: "xp", id: `xp-${Date.now()}-${Math.random()}`, amount, label })
}

function SingleToast({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 50)
    const t2 = setTimeout(() => setVisible(false), 3800)
    const t3 = setTimeout(onDone, 4400)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  const base: React.CSSProperties = {
    transition: "all 0.4s cubic-bezier(0.34,1.56,0.64,1)",
    transform: visible ? "translateX(0) scale(1)" : "translateX(120%) scale(0.85)",
    opacity: visible ? 1 : 0,
    pointerEvents: "none",
  }

  if (item.type === "achievement") {
    const rc = RARITY_COLORS[item.achievement.rarity]
    return (
      <div style={{ ...base, marginBottom: 8 }}>
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{
            background: `linear-gradient(135deg, rgba(0,0,0,0.92), rgba(20,20,30,0.96))`,
            border: `1.5px solid ${rc}55`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${rc}22`,
            minWidth: 280, maxWidth: 340,
          }}>
          {/* Ícone */}
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: `${rc}18`, border: `1px solid ${rc}44` }}>
            {item.achievement.icon}
          </div>
          {/* Texto */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
              style={{ color: rc }}>Conquista Desbloqueada!</p>
            <p className="text-sm font-black text-white leading-tight">{item.achievement.title}</p>
            <p className="text-[10px] text-white/40 leading-tight mt-0.5 truncate">{item.achievement.description}</p>
          </div>
          {/* XP */}
          {item.achievement.xpReward > 0 && (
            <div className="flex-shrink-0 text-right">
              <p className="text-xs font-black" style={{ color: "#fbbf24" }}>+{item.achievement.xpReward}</p>
              <p className="text-[9px] text-white/30">XP</p>
            </div>
          )}
        </div>
        {/* Barra de progresso */}
        <div className="h-0.5 rounded-full overflow-hidden mt-1" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full" style={{
            background: rc,
            width: visible ? "0%" : "100%",
            transition: "width 3.8s linear",
          }}/>
        </div>
      </div>
    )
  }

  if (item.type === "levelup") {
    return (
      <div style={{ ...base, marginBottom: 8 }}>
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{
            background: "linear-gradient(135deg, rgba(15,5,30,0.95), rgba(30,10,60,0.98))",
            border: "1.5px solid rgba(168,85,247,0.6)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 30px rgba(168,85,247,0.3)",
            minWidth: 280,
          }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 animate-pulse"
            style={{ background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.5)" }}>
            ⬆️
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
              style={{ color: "#a855f7" }}>Level Up!</p>
            <p className="text-sm font-black text-white">
              Nível {item.info.oldLevel} → <span style={{ color: "#a855f7" }}>{item.info.newLevel}</span>
            </p>
          </div>
          <div className="text-3xl">🎸</div>
        </div>
      </div>
    )
  }

  if (item.type === "xp") {
    return (
      <div style={{ ...base, marginBottom: 4 }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{
            background: "rgba(251,191,36,0.12)",
            border: "1px solid rgba(251,191,36,0.3)",
            backdropFilter: "blur(8px)",
          }}>
          <span className="text-sm font-black" style={{ color: "#fbbf24" }}>+{item.amount} XP</span>
          <span className="text-[10px] text-white/40">{item.label}</span>
        </div>
      </div>
    )
  }

  return null
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dispatch = useCallback((t: ToastItem) => {
    setToasts((prev: ToastItem[]) => [...prev, t])
  }, [])

  useEffect(() => {
    _dispatch = dispatch
    return () => { _dispatch = null }
  }, [dispatch])

  const remove = useCallback((id: string) => {
    setToasts((prev: ToastItem[]) => prev.filter((t: ToastItem) => t.id !== id))
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed z-[9999] flex flex-col items-end"
      style={{ bottom: 24, right: 20, maxWidth: 360 }}>
      {toasts.map((t: ToastItem) => (
        <SingleToast key={t.id} item={t} onDone={() => remove(t.id)} />
      ))}
    </div>
  )
}
