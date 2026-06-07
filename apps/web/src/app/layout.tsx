import type { Metadata, Viewport } from 'next'
import { Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { PushSetup } from '@/components/PushSetup'
import { GoogleProvider } from '@/components/GoogleProvider'
import { PostHogProvider } from '@/components/PostHogProvider'

const instrumentSerif = Instrument_Serif({
  weight: '400',
  style: 'italic',
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Orbit — Organização com Estrutura',
  description: 'Compromissos, tarefas e projetos com notificações em tempo real',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Orbit',
  },
  icons: {
    apple: '/apple-touch-icon.png',
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#2F6FE0',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${instrumentSerif.variable} ${jetbrainsMono.variable}`}>
      <body>
        <PostHogProvider>
          <GoogleProvider>
            <PushSetup />
            {children}
          </GoogleProvider>
        </PostHogProvider>
      </body>
    </html>
  )
}
