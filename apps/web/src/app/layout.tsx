import type { Metadata, Viewport } from 'next'
import './globals.css'
import { PushSetup } from '@/components/PushSetup'

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
  themeColor: '#050B14',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <PushSetup />
        {children}
      </body>
    </html>
  )
}
