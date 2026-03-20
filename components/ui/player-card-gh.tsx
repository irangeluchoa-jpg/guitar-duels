"use client"

import { useMemo } from "react"
import { PlayerAvatar } from "@/components/ui/player-avatar"
import { getBestTitle, SPECIAL_TITLES } from "@/lib/progression"
import { loadProfile } from "@/lib/progression"

interface PlayerCardGHProps {
  /** Dados vindos de qualquer fonte (perfil local ou snapshot da sala) */
  name?: string
  avatarUrl?: string
  level?: number
  title?: string        // label do título (ex: "Rei do Combo")
  titleColor?: string   // cor do título
  titleIcon?: string    // emoji do título
  borderId?: string
  score?: number
  combo?: number
  rockMeter?: number
  achievements?: number // quantidade de conquistas desbloqueadas
  isMe?: boolean
  color?: string        // cor do jogador (multiplayer)
  size?: "sm" | "md"
  showStats?: boolean   // mostrar score/combo/rock meter
}

export function PlayerCardGH({
  name,
  avatarUrl,
  level,
  title,
  titleColor = "#f59e0b",
  titleIcon = "🎸",
  borderId = "none",
  score,
  combo,
  rockMeter,
  achievements,
  isMe = false,
  color = "#e11d48",
  size = "md",
  showStats = false,
}: PlayerCardGHProps) {
  const isSm = size === "sm"
  const cardW = isSm ? 170 : 220
  const avatarSz = isSm ? 52 : 68

  return (
    <div style={{
      width: cardW,
      background: "rgba(0,0,0,0.82)",
      backdropFilter: "blur(18px)",
      borderRadius: 14,
      border: `1.5px solid ${isMe ? color + "70" : "rgba(255,255,255,0.10)"}`,
      boxShadow: isMe ? `0 0 24px ${color}30` : "0 4px 20px rgba(0,0,0,0.5)",
      overflow: "hidden",
      fontFamily: "'Inter',Arial,sans-serif",
    }}>
      {/* Stripe de cor no topo */}
      <div style={{
        height: 3,
        background: `linear-gradient(90deg, ${color}, ${color}88)`,
        boxShadow: `0 0 8px ${color}88`,
      }} />

      <div style={{ padding: isSm ? "10px 10px 8px" : "12px 12px 10px" }}>
        {/* Avatar + info principal */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Avatar com borda */}
          <div style={{ flexShrink: 0 }}>
            <PlayerAvatar
              avatar={avatarUrl && avatarUrl.startsWith("http") ? avatarUrl : undefined}
              isPhoto={!!(avatarUrl && avatarUrl.startsWith("http"))}
              size={avatarSz}
              borderId={borderId}
              animated={true}
              showLevel={false}
            />
          </div>

          {/* Infos */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Level */}
            {level !== undefined && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                <span style={{
                  fontSize: isSm ? 9 : 10, fontWeight: 700, color: "rgba(255,255,255,0.35)",
                  textTransform: "uppercase", letterSpacing: "0.15em",
                }}>LEVEL</span>
                <span style={{
                  fontSize: isSm ? 16 : 20, fontWeight: 900, lineHeight: 1,
                  color: "#22c55e",
                  fontFamily: "'Arial Black',Arial,sans-serif",
                  textShadow: "0 0 10px #22c55e88",
                }}>{level}</span>
              </div>
            )}

            {/* Nome */}
            <div style={{
              fontSize: isSm ? 12 : 14, fontWeight: 900, color: "#ffffff",
              fontFamily: "'Arial Black',Arial,sans-serif",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              maxWidth: isSm ? 80 : 108,
              textShadow: isMe ? `0 0 8px ${color}` : "none",
            }}>
              {isMe ? "Você" : (name || "Guitarrista")}
            </div>

            {/* Título */}
            {title && (
              <div style={{
                display: "flex", alignItems: "center", gap: 3, marginTop: 2,
              }}>
                <span style={{ fontSize: isSm ? 8 : 9 }}>{titleIcon}</span>
                <span style={{
                  fontSize: isSm ? 8 : 9, fontWeight: 700,
                  color: titleColor, letterSpacing: "0.05em",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  maxWidth: isSm ? 72 : 95,
                }}>
                  {title.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stats (score/combo/rock meter) — só no multiplayer */}
        {showStats && (score !== undefined || combo !== undefined) && (
          <div style={{ marginTop: 8 }}>
            {/* Score */}
            {score !== undefined && (
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 7, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 1 }}>
                  PONTUAÇÃO
                </div>
                <div style={{
                  fontSize: isSm ? 18 : 22, fontWeight: 900, color: "#fff",
                  fontFamily: "'Arial Black',Arial,sans-serif", lineHeight: 1,
                  textShadow: isMe ? `0 0 10px ${color}` : "none",
                }}>
                  {score.toLocaleString()}
                </div>
              </div>
            )}

            {/* Combo */}
            {combo !== undefined && combo > 1 && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                background: `${color}22`, border: `1px solid ${color}44`,
                borderRadius: 6, padding: "1px 6px", marginBottom: 4,
              }}>
                <span style={{ fontSize: 10, fontWeight: 900, color, fontFamily: "'Arial Black',Arial" }}>
                  ⚡ {combo}x COMBO
                </span>
              </div>
            )}

            {/* Rock meter */}
            {rockMeter !== undefined && (
              <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${rockMeter}%`,
                  background: rockMeter > 60 ? "linear-gradient(90deg,#22c55e,#4ade80)"
                    : rockMeter > 30 ? "#f59e0b" : "#ef4444",
                  borderRadius: 2, transition: "width 0.3s",
                  boxShadow: `0 0 4px ${rockMeter > 60 ? "#22c55e" : rockMeter > 30 ? "#f59e0b" : "#ef4444"}`,
                }} />
              </div>
            )}
          </div>
        )}

        {/* Achievements badge — song select */}
        {!showStats && achievements !== undefined && achievements > 0 && (
          <div style={{
            marginTop: 8, display: "flex", alignItems: "center", gap: 4,
            borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 6,
          }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              🏆 {achievements} conquistas
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/** Hook: carrega dados do perfil local para usar no card */
export function useLocalPlayerCard() {
  return useMemo(() => {
    if (typeof window === "undefined") return null
    try {
      const profile = loadProfile()
      const avatar = localStorage.getItem("guitar-duels-avatar") ?? "🎸"
      const photo = localStorage.getItem("guitar-duels-photo-url") || null
      const title = SPECIAL_TITLES.find(t => t.id === profile.selectedTitle && t.check(profile))
        ?? SPECIAL_TITLES.find(t => t.check(profile))
      return {
        name: profile.displayName || "Guitarrista",
        avatarUrl: photo || avatar,
        level: profile.level,
        title: title?.label,
        titleColor: title?.color || "#f59e0b",
        titleIcon: title?.icon || "🎸",
        borderId: profile.selectedBorder || "none",
        achievements: profile.unlockedAchievements?.length || 0,
      }
    } catch { return null }
  }, [])
}
