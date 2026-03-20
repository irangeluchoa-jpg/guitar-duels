import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MIME: Record<string, string> = {
  ".opus": "audio/ogg; codecs=opus",
  ".ogg":  "audio/ogg",
  ".mp3":  "audio/mpeg",
  ".wav":  "audio/wav",
  ".mp4":  "video/mp4",
  ".webm": "video/webm",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".webp": "image/webp",
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const filePath = searchParams.get("path") || ""

  if (!filePath || filePath.includes("..")) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const fullPath = path.join(process.cwd(), "public", "songs", filePath)

  if (!fs.existsSync(fullPath)) {
    return new NextResponse("Not found", { status: 404 })
  }

  const ext  = path.extname(fullPath).toLowerCase()
  const mime = MIME[ext] || "application/octet-stream"
  const data = fs.readFileSync(fullPath)
  const stat = fs.statSync(fullPath)
  const etag = `"${stat.size}-${stat.mtimeMs.toString(36)}"`

  // Suporte a ETag para evitar re-download quando o arquivo não mudou
  const ifNoneMatch = req.headers.get("if-none-match")
  if (ifNoneMatch === etag) {
    return new NextResponse(null, { status: 304 })
  }

  // Áudio e charts: 7 dias de cache + ETag
  const isAudio = [".ogg",".mp3",".opus",".wav"].includes(ext)
  const maxAge  = isAudio ? 604800 : 86400  // 7d para áudio, 1d para resto

  return new NextResponse(data, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=3600`,
      "ETag": etag,
      "Vary": "Accept-Encoding",
    },
  })
}
