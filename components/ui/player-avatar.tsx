"use client"

import { useEffect, useState } from "react"
import { PROFILE_BORDERS, type ProfileBorder } from "@/lib/progression"

const PHOTO_KEY = "guitar-duels-photo-url"
const AVATAR_KEY = "guitar-duels-avatar"

// Global helper to get photo URL (used by all components)
export function getStoredPhoto(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(PHOTO_KEY)
}

interface PlayerAvatarProps {
  avatar?: string           // emoji or image URL (optional - loads from storage if not provided)
  size?: number
  borderId?: string
  borderData?: ProfileBorder | null
  level?: number
  animated?: boolean
  isPhoto?: boolean
  showLevel?: boolean
}

export function PlayerAvatar({
  avatar,
  size = 48,
  borderId = "none",
  borderData,
  level,
  animated = true,
  isPhoto,
  showLevel = true,
}: PlayerAvatarProps) {
  const border = borderData ?? PROFILE_BORDERS.find(b => b.id === borderId) ?? PROFILE_BORDERS[0]
  const hasBorder = border.id !== "none"
  const padding = Math.max(2, Math.round(size * 0.055))

  // Auto-load photo and avatar from localStorage if not provided
  const [resolvedAvatar, setResolvedAvatar] = useState<string>(avatar ?? "🎸")
  const [resolvedIsPhoto, setResolvedIsPhoto] = useState<boolean>(!!isPhoto)

  useEffect(() => {
    if (avatar !== undefined) {
      setResolvedAvatar(avatar)
      setResolvedIsPhoto(!!isPhoto || avatar.startsWith("data:") || avatar.startsWith("http"))
      return
    }
    // Auto-load from storage
    const photo = localStorage.getItem(PHOTO_KEY)
    if (photo) {
      setResolvedAvatar(photo)
      setResolvedIsPhoto(true)
    } else {
      const emoji = localStorage.getItem(AVATAR_KEY) ?? "🎸"
      setResolvedAvatar(emoji)
      setResolvedIsPhoto(false)
    }
  }, [avatar, isPhoto])

  // Listen for photo changes (so all avatars update when photo is set)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PHOTO_KEY) {
        if (e.newValue) { setResolvedAvatar(e.newValue); setResolvedIsPhoto(true) }
        else {
          const emoji = localStorage.getItem(AVATAR_KEY) ?? "🎸"
          setResolvedAvatar(emoji); setResolvedIsPhoto(false)
        }
      }
      if (e.key === AVATAR_KEY && !localStorage.getItem(PHOTO_KEY)) {
        setResolvedAvatar(e.newValue ?? "🎸"); setResolvedIsPhoto(false)
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const innerContent = resolvedIsPhoto ? (
    <img
      src={resolvedAvatar}
      alt="avatar"
      style={{
        width: "100%", height: "100%",
        borderRadius: "50%",
        objectFit: "cover",
      }}
    />
  ) : (
    <span style={{ fontSize: size * 0.42, lineHeight: 1, userSelect: "none" }}>
      {resolvedAvatar}
    </span>
  )

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {hasBorder ? (
        <>
          {/* Glow externo */}
          <div style={{
            position: "absolute", inset: -2, borderRadius: "50%",
            boxShadow: `0 0 ${size * 0.25}px ${border.glow}88, 0 0 ${size * 0.5}px ${border.glow}33`,
            pointerEvents: "none",
          }}/>

          {/* Anel de borda giratório — APENAS o gradiente gira, não o conteúdo */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            padding,
            overflow: "hidden",
          }}>
            {/* Camada do gradiente que gira */}
            <div style={{
              position: "absolute",
              inset: -size,   // estende para além do círculo para cobrir ao girar
              borderRadius: "50%",
              background: border.gradient,
              animation: border.animated && animated ? "border-ring-spin 3s linear infinite" : "none",
            }} />
            {/* Buraco central que mascara — mostra só o anel externo */}
            <div style={{
              position: "absolute",
              inset: padding,
              borderRadius: "50%",
              background: "#0d0b08",
            }} />
          </div>

          {/* Conteúdo (foto/emoji) — completamente parado, sobre a borda */}
          <div style={{
            position: "absolute",
            inset: padding,
            borderRadius: "50%",
            background: "#0d0b08",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
            zIndex: 1,
          }}>
            {innerContent}
          </div>
        </>
      ) : (
        <div style={{
          width: size, height: size, borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          border: "1.5px solid rgba(255,255,255,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}>
          {innerContent}
        </div>
      )}

      {/* Level badge */}
      {showLevel && level !== undefined && (
        <div style={{
          position: "absolute", bottom: -6, left: "50%",
          transform: "translateX(-50%)",
          background: hasBorder ? border.glow : "#333",
          color: hasBorder ? "#000" : "#fff",
          fontSize: Math.max(7, size * 0.15),
          fontWeight: 900,
          fontFamily: "Impact, sans-serif",
          padding: "1px 5px",
          borderRadius: "8px",
          border: "1.5px solid #0d0b08",
          lineHeight: 1.3,
          boxShadow: hasBorder ? `0 0 8px ${border.glow}88` : "none",
          whiteSpace: "nowrap",
          zIndex: 2,
        }}>
          {level}
        </div>
      )}

      <style>{`
        @keyframes border-ring-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
