// apps/web/src/components/ui/Progress.tsx
import type { CSSProperties } from 'react'

type Tone = 'brand' | 'success' | 'warn'

const TONE_COLOR: Record<Tone, string> = {
  brand:   'var(--brand-500, #2F6FE0)',
  success: '#22C55E',
  warn:    '#F59E0B',
}

interface ProgressProps {
  value: number // 0–100
  tone?: Tone
  style?: CSSProperties
}

export function Progress({ value, tone = 'brand', style }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div
      style={{
        height: 6,
        background: 'var(--ink-100, #F3F4F6)',
        borderRadius: 9999,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${clamped}%`,
          background: TONE_COLOR[tone],
          borderRadius: 9999,
          transition: 'width 600ms ease-out',
        }}
      />
    </div>
  )
}
