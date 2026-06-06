import { PostHog } from 'posthog-node'

let client: PostHog | null = null

function getClient(): PostHog | null {
  if (!process.env.POSTHOG_KEY) return null
  if (!client) {
    client = new PostHog(process.env.POSTHOG_KEY, {
      host: process.env.POSTHOG_HOST ?? 'https://app.posthog.com',
      flushAt: 20,
      flushInterval: 10_000,
    })
  }
  return client
}

export function capture(
  distinctId: string,
  event: string,
  properties: Record<string, unknown> = {}
): void {
  const ph = getClient()
  if (!ph) return
  try {
    ph.capture({
      distinctId,
      event,
      properties: {
        ...properties,
        environment: process.env.NODE_ENV ?? 'production',
      },
    })
  } catch {
    // fire-and-forget — nunca propagar erro de analytics
  }
}
