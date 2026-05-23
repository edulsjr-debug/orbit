'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { api } from '@/lib/api'

const NAV = [
  { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { href: '/dashboard/compromissos', icon: '📅', label: 'Compromissos' },
  { href: '/dashboard/tarefas', icon: '✔️', label: 'Tarefas' },
  { href: '/dashboard/projetos', icon: '📁', label: 'Projetos' },
  { href: '/dashboard/notificacoes', icon: '🔔', label: 'Notificações' },
  { href: '/dashboard/config', icon: '⚙️', label: 'Configurações' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [bellOpen, setBellOpen] = useState(false)

  async function logout() {
    await api.post('/auth/logout', {})
    router.push('/login')
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={S.sidebar}>
        <div style={S.logo}>
          <div style={S.logoIcon}>🌀</div>
          <div>
            <div style={S.logoName}>Orbit</div>
            <div style={S.logoSub}>Agenda inteligente</div>
          </div>
        </div>

        <nav style={{ padding: '14px 12px', flex: 1 }}>
          {NAV.map((item) => (
            <div
              key={item.href}
              onClick={() => router.push(item.href)}
              style={{
                ...S.navItem,
                ...(pathname === item.href ? S.navActive : {}),
              }}
            >
              <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </div>
          ))}
        </nav>

        <div style={S.user} onClick={logout}>
          <div style={S.avatar}>G</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>Gabriela</div>
            <div style={{ color: '#475569', fontSize: 11 }}>Sair ↩</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <header style={S.topbar}>
          <div style={{ flex: 1 }} />
          <div style={{ position: 'relative' }}>
            <button style={S.bellBtn} onClick={() => setBellOpen((v) => !v)}>
              🔔
              <span style={S.bellBadge}>4</span>
            </button>
            {bellOpen && (
              <div style={S.bellDrop}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: 14 }}>
                  Notificações
                </div>
                <div style={{ padding: '8px 16px', fontSize: 13, color: '#64748b' }}>
                  Reunião com fornecedor em 30 min
                </div>
                <div style={{ padding: '8px 16px', fontSize: 13, color: '#64748b' }}>
                  Tarefa "Enviar proposta" vence hoje
                </div>
                <div style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <span
                    style={{ color: '#6366f1', fontSize: 13, cursor: 'pointer' }}
                    onClick={() => { setBellOpen(false); router.push('/dashboard/notificacoes') }}
                  >
                    Ver todas →
                  </span>
                </div>
              </div>
            )}
          </div>
          <div style={S.chip}>
            <div style={S.avatar}>G</div>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Gabriela</span>
          </div>
        </header>

        {/* Content */}
        <main style={S.content}>{children}</main>
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  sidebar: { width: 240, flexShrink: 0, background: '#0f172a', display: 'flex', flexDirection: 'column' },
  logo: { padding: '20px 16px 8px', display: 'flex', alignItems: 'center', gap: 10 },
  logoIcon: { width: 38, height: 38, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  logoName: { color: '#fff', fontSize: 18, fontWeight: 800 },
  logoSub: { color: '#475569', fontSize: 10 },
  navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', marginBottom: 2, fontSize: 13.5, fontWeight: 500 },
  navActive: { background: '#1e1b4b', color: '#818cf8' },
  user: { padding: 12, borderTop: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
  avatar: { width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 },
  topbar: { height: 60, background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12, flexShrink: 0 },
  bellBtn: { position: 'relative', width: 38, height: 38, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 17 },
  bellBadge: { position: 'absolute', top: -5, right: -5, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' },
  bellDrop: { position: 'absolute', top: 46, right: 0, width: 320, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 14, boxShadow: '0 16px 32px rgba(0,0,0,.12)', zIndex: 100 },
  chip: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px 4px 4px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 30, cursor: 'pointer' },
  content: { flex: 1, overflowY: 'auto', padding: 24 },
}
