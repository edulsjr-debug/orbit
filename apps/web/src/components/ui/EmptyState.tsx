// apps/web/src/components/ui/EmptyState.tsx
import type { CSSProperties, ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  sub?: string
  style?: CSSProperties
}

export function EmptyState({ icon, title, sub, style }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '48px 24px',
        textAlign: 'center',
        ...style,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'var(--ink-100, #F3F4F6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--fg-3, #6B7280)',
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1, #111827)' }}>{title}</div>
        {sub && <div style={{ marginTop: 4, fontSize: 13, color: 'var(--fg-3, #6B7280)' }}>{sub}</div>}
      </div>
    </div>
  )
}
