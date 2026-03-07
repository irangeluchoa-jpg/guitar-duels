/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  outputFileTracingExcludes: {
    "*": [
      "./public/songs/**/*.ogg",
      "./public/songs/**/*.mp3",
      "./public/songs/**/*.wav",
      "./public/songs/**/*.opus",
      "./public/songs/**/*.mid",
      "./public/songs/**/*.midi",
      "./public/songs/**/Content/**",
    ],
  },
  experimental: {
    serverComponentsExternalPackages: [],
  },
}

export default nextConfig
