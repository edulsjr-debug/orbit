'use client'

import { GoogleOAuthProvider } from '@react-oauth/google'

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
if (!clientId) throw new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set')

export function GoogleProvider({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      {children}
    </GoogleOAuthProvider>
  )
}
