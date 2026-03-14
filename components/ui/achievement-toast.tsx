"use client"

import React, { useEffect, useState, useCallback } from "react"
// Inline types to remove ALL dependencies on @/lib/progression
// (prevents TDZ chunk ordering errors in Next.js 16)
interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  rarity: string
  xpReward: number
}
interface LevelUpInfo {
  oldLevel: number
  newLevel: number
  levelsGained: number
}

// Inlined to avoid module initialization ordering issues (TDZ)
const RARITY_COLORS: Record<string, string> = {
  common:    "#9ca3af",
  uncommon:  "#22c55e",
  rare:      "#3b82f6",
  epic:      "#a855f7",
  legendary: "#f59e0b",
}

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
        <div className="relative flex items-center gap-3 px-4 py-3 rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(15,5,30,0.97), rgba(40,10,80,0.99))",
            border: "1.5px solid rgba(168,85,247,0.7)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 40px rgba(168,85,247,0.4)",
            minWidth: 300,
          }}>
          {/* Partículas de fundo */}
          {Array.from({length:8}).map((_,i) => (
            <div key={i} className="absolute rounded-full pointer-events-none"
              style={{
                width: `${3+Math.random()*5}px`, height: `${3+Math.random()*5}px`,
                background: `rgba(168,85,247,${0.4+Math.random()*0.5})`,
                left: `${Math.random()*100}%`, top: `${Math.random()*100}%`,
                animation: `float-up ${1.5+Math.random()}s ease-out ${Math.random()*0.5}s forwards`,
              }} />
          ))}
          <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg,rgba(168,85,247,0.4),rgba(99,102,241,0.3))",
              border: "2px solid rgba(168,85,247,0.8)",
              boxShadow: "0 0 20px rgba(168,85,247,0.6)",
              animation: "level-pop 0.5s cubic-bezier(0.34,1.56,0.64,1)",
            }}>
            <span className="text-2xl font-black" style={{ color: "#a855f7", fontFamily:"'Impact',sans-serif" }}>
              {item.info.newLevel}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "rgba(168,85,247,0.7)" }}>
              🎉 Level Up!
            </p>
            <p className="text-base font-black text-white">
              Nível <span style={{ color: "rgba(255,255,255,0.4)" }}>{item.info.oldLevel}</span>
              {" → "}
              <span style={{ color: "#c084fc", textShadow: "0 0 12px rgba(192,132,252,0.8)" }}>{item.info.newLevel}</span>
            </p>
            {item.info.levelsGained > 1 && (
              <p className="text-[10px] font-bold" style={{ color: "rgba(251,191,36,0.8)" }}>
                +{item.info.levelsGained} níveis de uma vez! 🔥
              </p>
            )}
          </div>
          <div className="text-3xl" style={{ animation: "spin-slow 2s linear infinite" }}>⭐</div>
        </div>
        <style>{`
          @keyframes level-pop { 0%{transform:scale(0) rotate(-20deg)}100%{transform:scale(1) rotate(0deg)} }
          @keyframes float-up { 0%{transform:translateY(0);opacity:1}100%{transform:translateY(-40px);opacity:0} }
          @keyframes spin-slow { from{transform:rotate(0)}to{transform:rotate(360deg)} }
        `}</style>
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
