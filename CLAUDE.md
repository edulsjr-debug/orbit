# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Root (Turborepo — runs across all apps)
pnpm dev          # start all apps in dev mode
pnpm build        # build all apps
pnpm lint         # lint all apps

# Database (via workspace filter)
pnpm db:generate  # prisma generate
pnpm db:studio    # prisma studio
# Schema changes → prisma db push (no migrations folder, see below)

# Run a single app
pnpm --filter @orbit/web dev
pnpm --filter @orbit/api dev

# Tests (API only — Vitest)
pnpm --filter @orbit/api test
pnpm --filter @orbit/api test -- --run  # single run (no watch)
```

## Architecture

Pnpm monorepo + Turborepo with two apps and two shared packages:

```
apps/
  web/   → Next.js 15 (React 19, App Router, SWR, PWA)
  api/   → Fastify 5 + Prisma 5 (JWT + cookie auth, BullMQ, Resend)
packages/
  database/  → PrismaClient singleton + schema.prisma
  types/     → Shared TypeScript interfaces (User, Event, Task, Project, AppNotification…)
```

### API (`apps/api/src/`)

- `index.ts` — bootstraps Fastify, registers CORS/cookies/JWT, mounts all routes, starts `NotificationWorker`
- `routes/` — 6 route files: `auth`, `events`, `tasks`, `projects`, `notifications`, `push`
- `services/notifications.ts` — Resend email + web-push scheduling logic
- `jobs/notificationWorker.ts` — BullMQ processor for scheduled push/email/WhatsApp notifications

Auth uses JWT stored in HTTP-only cookies. All protected routes call `request.jwtVerify()`.

### Web (`apps/web/`)

- App Router: `app/(dashboard)/` is the protected area; `app/layout.tsx` checks auth and redirects
- `lib/api.ts` — fetch wrapper (adds credentials + JSON headers)
- `lib/push.ts` + `public/sw.js` — Web Push setup (service worker + subscription)
- SWR for all data fetching; no global state library

### Database

Schema is in `packages/database/prisma/schema.prisma`. **No `migrations/` folder** — schema changes are applied via `prisma db push` directly against the Postgres instance.

Core models: `User`, `Event` (Compromissos), `Task`, `Project`, `Notification`, `NotificationJob`. Every domain entity has a corresponding `*History` audit table.

`Event` notifications support four channels: `notifyPush`, `notifyEmail`, `notifyWhatsapp`, `notifyInApp`.

### Deploy flow

1. Push to `dev` branch
2. Deploy to QA environment for validation
3. Eduardo promotes to prod — **never push directly to prod**
4. After schema changes: run `prisma db push` on the target environment
