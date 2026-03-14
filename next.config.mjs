/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: [],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  webpack(config, { isServer, webpack }) {
    if (!isServer) {
      // Force ALL game/lib modules into one stable chunk to prevent TDZ errors.
      // TDZ (Temporal Dead Zone) happens when webpack splits modules into chunks
      // that reference each other's `const` exports before initialization.
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: "all",
          minSize: 20000,
          cacheGroups: {
            // All game lib in one chunk — prevents ordering issues between
            // engine.ts, renderer.ts, sounds.ts, settings.ts, progression.ts
            gameCore: {
              test: /[\\/](lib|hooks)[\\/](game|settings|history|progression|supabase|songs|multiplayer)/,
              name: "game-core",
              chunks: "all",
              priority: 40,
              enforce: true,
              reuseExistingChunk: false,
            },
            // UI components that use game lib in one chunk
            gameComponents: {
              test: /[\\/]components[\\/](game|menu|ui[\\/]achievement)/,
              name: "game-components",
              chunks: "all",
              priority: 35,
              enforce: true,
              reuseExistingChunk: false,
            },
            // Vendors (React, lucide, etc) in standard chunk
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: "vendor",
              chunks: "all",
              priority: 20,
            },
          },
        },
      }
    }
    return config
  },
}

export default nextConfig
