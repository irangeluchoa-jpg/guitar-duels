/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "github.com",
      },
      {
        protocol: "https",
        hostname: "objects.githubusercontent.com",
      },
    ],
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
}

export default nextConfig
