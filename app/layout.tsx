import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: 'Guitar Duels',
  description: 'Batalhas de guitarra em tempo real. Jogue solo ou desafie amigos em duelos 1v1.',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', sizes: '32x32', type: 'image/png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png',  sizes: '32x32', type: 'image/png', media: '(prefers-color-scheme: dark)'  },
      { url: '/icon.svg',             type: 'image/svg+xml' },
      { url: '/icon-192.png',         sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png',         sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',   // suporte a notch/safe-area no iPhone
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
