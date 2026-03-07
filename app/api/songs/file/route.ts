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

  return new NextResponse(data, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=86400",
    },
  })
}
