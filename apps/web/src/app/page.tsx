import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function Home() {
  const store = await cookies()
  const token = store.get('orbit_token')
  if (token) redirect('/inicio')
  redirect('/login')
}
