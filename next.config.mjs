/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: [],
  // Fix TDZ (Temporal Dead Zone) errors with lucide-react and other ESM packages
  // that have module initialization ordering issues in Next.js 16 + Turbopack
  transpilePackages: ["lucide-react"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
}

export default nextConfig
