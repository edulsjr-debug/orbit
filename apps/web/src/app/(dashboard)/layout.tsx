import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies()
  if (!store.get('orbit_token')) redirect('/login')
  return <AppShell>{children}</AppShell>
}
