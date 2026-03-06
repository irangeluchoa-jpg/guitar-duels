/**
 * upload-to-r2.mjs
 * Faz upload de todas as músicas da pasta public/songs/ para o Cloudflare R2
 *
 * Uso:
 *   node scripts/upload-to-r2.mjs
 *
 * Requer as variáveis no .env.local preenchidas.
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"
import { readFileSync, readdirSync, statSync, existsSync } from "fs"
import { join, extname, relative } from "path"
import { fileURLToPath } from "url"
import { dirname } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

// Carrega .env.local manualmente
function loadEnv() {
  const envPath = join(ROOT, ".env.local")
  if (!existsSync(envPath)) { console.error("❌ .env.local não encontrado!"); process.exit(1) }
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

loadEnv()

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error("❌ Preencha R2_ACCOUNT_ID, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY no .env.local")
  process.exit(1)
}

const BUCKET = R2_BUCKET_NAME || "guitar-duels-songs"
const client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

function getMime(ext) {
  const map = {
    ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".opus": "audio/ogg; codecs=opus",
    ".wav": "audio/wav", ".chart": "text/plain", ".ini": "text/plain",
    ".mid": "audio/midi", ".midi": "audio/midi", ".json": "application/json",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  }
  return map[ext.toLowerCase()] || "application/octet-stream"
}

async function fileExists(key) {
  try { await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })); return true }
  catch { return false }
}

function getAllFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...getAllFiles(full))
    else files.push(full)
  }
  return files
}

async function main() {
  const songsDir = join(ROOT, "public", "songs")
  if (!existsSync(songsDir)) { console.error("❌ Pasta public/songs/ não encontrada!"); process.exit(1) }

  const allFiles = getAllFiles(songsDir)
  console.log(`\n🎸 Guitar Duels — Upload para R2`)
  console.log(`📁 Bucket: ${BUCKET}`)
  console.log(`🎵 ${allFiles.length} arquivos encontrados\n`)

  let uploaded = 0, skipped = 0, failed = 0

  for (const filePath of allFiles) {
    const key = relative(songsDir, filePath).replace(/\\/g, "/")
    const ext = extname(filePath)

    // Pula arquivos temporários
    if (key.startsWith(".") || key.includes("/.")) { skipped++; continue }

    const exists = await fileExists(key)
    if (exists) { console.log(`⏭  ${key} (já existe)`); skipped++; continue }

    try {
      const body = readFileSync(filePath)
      await client.send(new PutObjectCommand({
        Bucket: BUCKET, Key: key,
        Body: body,
        ContentType: getMime(ext),
      }))
      console.log(`✅ ${key}`)
      uploaded++
    } catch (e) {
      console.error(`❌ ${key}: ${e.message}`)
      failed++
    }
  }

  console.log(`\n📊 Resultado: ${uploaded} enviados, ${skipped} ignorados, ${failed} erros`)
  if (uploaded > 0) console.log(`\n🎉 Upload concluído! Abra o jogo e as músicas vão aparecer.`)
}

main().catch(console.error)
