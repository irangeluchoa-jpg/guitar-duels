/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Ignora erros de TS no build ─────────────────────────────────────
  typescript: { ignoreBuildErrors: true },

  // ── Compressão gzip/brotli automática nas respostas ───────────────────
  compress: true,

  // ── Imagens: habilitar WebP/AVIF automático para next/image ───────────
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,  // 24h de cache nas imagens
  },

  // ── Socket.IO roda no server.js, não no Next.js ───────────────────────
  serverExternalPackages: ["socket.io"],

  // ── Headers HTTP de cache para assets estáticos ───────────────────────
  async headers() {
    return [
      {
        // Áudios e charts: cache de 7 dias (raramente mudam)
        source: "/api/songs/file",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
      {
        // Imagens estáticas: cache de 30 dias
        source: "/:path*\\.(png|jpg|jpeg|webp|svg|ico)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" },
        ],
      },
      {
        // JS/CSS gerados pelo Next.js: cache de 1 ano (hashes no nome)
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ]
  },
}

export default nextConfig
