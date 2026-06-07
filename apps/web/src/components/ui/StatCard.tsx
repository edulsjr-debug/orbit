// apps/web/src/components/ui/StatCard.tsx
import type { CSSProperties } from 'react'

type Accent = 'brand' | 'success' | 'warn' | 'danger' | 'neutral'

const ACCENT_COLOR: Record<Accent, string> = {
  brand:   'var(--brand-500, #2F6FE0)',
  success: '#22C55E',
  warn:    '#F59E0B',
  danger:  '#EF4444',
  neutral: 'var(--fg-3, #6B7280)',
}

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: Accent
  style?: CSSProperties
}

export function StatCard({ label, value, sub, accent = 'neutral', style }: StatCardProps) {
  return (
    <div
      style={{
        background: 'var(--bg, #fff)',
        border: '1px solid var(--ink-200, #E5E7EB)',
        borderRadius: 14,
        padding: '20px 20px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        boxShadow: '0 1px 2px rgba(11,15,20,0.04)',
        ...style,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--fg-3, #6B7280)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--fg-1, #111827)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
      {sub && (
        <span
          style={{
            fontSize: 13,
            color: ACCENT_COLOR[accent],
            fontWeight: 500,
          }}
        >
          {sub}
        </span>
      )}
    </div>
  )
}
