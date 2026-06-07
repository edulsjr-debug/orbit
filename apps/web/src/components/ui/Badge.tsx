// apps/web/src/components/ui/Badge.tsx
import type { CSSProperties } from 'react'

type Tone = 'success' | 'warn' | 'danger' | 'info' | 'brand' | 'neutral'

const TONE_STYLES: Record<Tone, CSSProperties> = {
  brand:   { background: 'var(--brand-100)', color: 'var(--brand-700)', border: '1px solid var(--brand-200)' },
  success: { background: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0' },
  warn:    { background: '#FEF9C3', color: '#854D0E', border: '1px solid #FEF08A' },
  danger:  { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' },
  info:    { background: '#DBEAFE', color: '#1D4ED8', border: '1px solid #BFDBFE' },
  neutral: { background: 'var(--ink-100, #F3F4F6)', color: 'var(--ink-600, #4B5563)', border: '1px solid var(--ink-200, #E5E7EB)' },
}

interface BadgeProps {
  children: React.ReactNode
  tone?: Tone
  mono?: boolean
  style?: CSSProperties
}

export function Badge({ children, tone = 'neutral', mono = false, style }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
        fontFamily: mono ? 'var(--font-mono, JetBrains Mono, monospace)' : undefined,
        ...TONE_STYLES[tone],
        ...style,
      }}
    >
      {children}
    </span>
  )
}
