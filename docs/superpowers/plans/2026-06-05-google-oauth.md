# Login com Google — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar "Continuar com o Google" à tela de login do Orbit usando Google Identity Services, mantendo o fluxo email/senha existente e vinculando contas automaticamente pelo e-mail.

**Architecture:** O frontend usa `@react-oauth/google` para abrir o popup do Google e receber um ID token (credential). Esse token é enviado para `POST /auth/google` no Fastify, onde é verificado via `google-auth-library`. A API encontra ou cria o usuário, seta o mesmo cookie `orbit_token` do fluxo atual e retorna o usuário. Nenhuma rota existente é alterada — apenas a rota de login ganha um guard para usuários sem senha.

**Tech Stack:** `google-auth-library` (Node), `@react-oauth/google` (React), Prisma `prisma db push`, Fastify 5, Next.js 15 App Router.

---

## Pré-requisito manual (Eduardo faz uma vez)

Antes de iniciar o código, executar no Google Cloud Console:

1. Acessar https://console.cloud.google.com
2. Criar projeto → nome: **Orbit**
3. Menu lateral → **APIs e Serviços** → **Tela de permissão OAuth** → tipo Externo → preencher nome do app e e-mail
4. Menu lateral → **Credenciais** → **Criar credenciais** → **ID do cliente OAuth 2.0** → tipo: **Aplicativo da Web**
5. Em **Origens JavaScript autorizadas** adicionar:
   - `http://localhost:3000`
   - `https://orbit.prumosaas.com.br`
6. Salvar e copiar o **ID do cliente** gerado (formato: `XXXXX.apps.googleusercontent.com`)
7. Guardar esse Client ID — será usado nas Tasks 2 e 4

---

## Mapa de arquivos

| Ação | Arquivo |
|---|---|
| Modificar | `packages/database/prisma/schema.prisma` |
| Modificar | `apps/api/src/routes/auth.ts` |
| Criar | `apps/api/src/routes/__tests__/auth.google.test.ts` |
| Criar | `apps/web/src/components/GoogleProvider.tsx` |
| Modificar | `apps/web/src/app/layout.tsx` |
| Modificar | `apps/web/src/app/login/page.tsx` |

---

## Task 1: Schema — password opcional + googleId

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Editar schema**

Substituir o bloco `model User` por:

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  password  String?
  googleId  String?  @unique
  phone     String?
  pushSub   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  events        Event[]
  tasks         Task[]
  projects      Project[]
  notifications Notification[]
}
```

- [ ] **Step 2: Aplicar no banco**

```bash
pnpm db:generate
```

Depois, conectado ao banco de dev:

```bash
pnpm --filter @orbit/database exec prisma db push
```

Saída esperada: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Commit**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "feat(db): password opcional + googleId no model User"
```

---

## Task 2: API — instalar dependência e variável de ambiente

**Files:**
- Modify: `apps/api/package.json` (via pnpm add)
- Modify: `apps/api/.env`

- [ ] **Step 1: Instalar google-auth-library**

```bash
pnpm --filter @orbit/api add google-auth-library
```

Saída esperada: linha `google-auth-library` adicionada em `apps/api/package.json` dependencies.

- [ ] **Step 2: Adicionar GOOGLE_CLIENT_ID ao .env da API**

Em `apps/api/.env`, adicionar a linha:

```
GOOGLE_CLIENT_ID=SEU_CLIENT_ID_AQUI
```

(Substituir pelo Client ID obtido no pré-requisito.)

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore(api): adicionar google-auth-library"
```

---

## Task 3: API — rota POST /auth/google (TDD)

**Files:**
- Create: `apps/api/src/routes/__tests__/auth.google.test.ts`
- Modify: `apps/api/src/routes/auth.ts`

- [ ] **Step 1: Escrever o teste (vai falhar)**

Criar `apps/api/src/routes/__tests__/auth.google.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { authRoutes } from '../auth.js'

const mockVerifyIdToken = vi.fn()
vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}))

const mockFindUnique = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
vi.mock('@orbit/database', () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
    },
  },
}))

async function buildApp() {
  const app = Fastify()
  await app.register(cookie)
  await app.register(jwt, { secret: 'test-secret' })
  app.decorate('authenticate', async (req: any) => { await req.jwtVerify() })
  await app.register(authRoutes)
  await app.ready()
  return app
}

describe('POST /auth/google', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GOOGLE_CLIENT_ID = 'test-client-id'
  })

  it('cria novo usuário quando email não existe', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'gid-123', email: 'novo@teste.com', name: 'Novo User' }),
    })
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue({
      id: 'user-1',
      name: 'Novo User',
      email: 'novo@teste.com',
      phone: null,
      createdAt: new Date('2026-01-01'),
    })

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { credential: 'fake-token' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.email).toBe('novo@teste.com')
    expect(res.cookies.find((c: any) => c.name === 'orbit_token')).toBeDefined()
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ googleId: 'gid-123', email: 'novo@teste.com' }),
      })
    )
  })

  it('vincula googleId a usuário existente pelo email', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'gid-456', email: 'existente@teste.com', name: 'Existente' }),
    })
    mockFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'user-2',
        name: 'Existente',
        email: 'existente@teste.com',
        phone: null,
        createdAt: new Date('2026-01-01'),
      })
    mockUpdate.mockResolvedValue({
      id: 'user-2',
      name: 'Existente',
      email: 'existente@teste.com',
      phone: null,
      createdAt: new Date('2026-01-01'),
    })

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { credential: 'fake-token' },
    })

    expect(res.statusCode).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { googleId: 'gid-456' },
      select: expect.any(Object),
    })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('retorna 401 para token inválido', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Token inválido'))

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { credential: 'token-ruim' },
    })

    expect(res.statusCode).toBe(401)
  })
})
```

- [ ] **Step 2: Rodar os testes — confirmar que falham**

```bash
pnpm --filter @orbit/api test -- --run
```

Saída esperada: testes de `auth.google.test.ts` falham com `Route POST:/auth/google not found` ou similar.

- [ ] **Step 3: Implementar a rota em auth.ts**

Em `apps/api/src/routes/auth.ts`, adicionar o import no topo:

```typescript
import { OAuth2Client } from 'google-auth-library'
```

Adicionar a rota dentro da função `authRoutes`, antes do fechamento `}`:

```typescript
  // Login com Google
  app.post('/auth/google', async (req, reply) => {
    const { credential } = z.object({ credential: z.string() }).parse(req.body)

    const clientId = process.env.GOOGLE_CLIENT_ID ?? ''
    const client = new OAuth2Client(clientId)

    let payload
    try {
      const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId })
      payload = ticket.getPayload()
    } catch {
      return reply.code(401).send({ error: 'Token Google inválido' })
    }

    if (!payload?.sub || !payload?.email) {
      return reply.code(401).send({ error: 'Token Google inválido' })
    }

    const { sub: googleId, email, name = email } = payload

    // 1. Busca por googleId (já vinculado)
    let user = await prisma.user.findUnique({
      where: { googleId },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    })

    // 2. Busca por email — vincula se encontrar
    if (!user) {
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) {
        user = await prisma.user.update({
          where: { id: existing.id },
          data: { googleId },
          select: { id: true, name: true, email: true, phone: true, createdAt: true },
        })
      }
    }

    // 3. Cria novo usuário
    if (!user) {
      user = await prisma.user.create({
        data: { name, email, googleId, password: null },
        select: { id: true, name: true, email: true, phone: true, createdAt: true },
      })
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email })
    reply.setCookie('orbit_token', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 30 })

    return { data: user }
  })
```

- [ ] **Step 4: Rodar os testes — confirmar que passam**

```bash
pnpm --filter @orbit/api test -- --run
```

Saída esperada: todos os testes passando, incluindo os 3 novos de `auth.google.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/auth.ts apps/api/src/routes/__tests__/auth.google.test.ts
git commit -m "feat(api): rota POST /auth/google com Google Identity Services"
```

---

## Task 4: API — guard para usuário sem senha no login

**Files:**
- Modify: `apps/api/src/routes/auth.ts` (rota `/login`)

Com `password` agora opcional, um usuário que se cadastrou pelo Google pode tentar fazer login com senha — retornará 401 genérico. Este guard melhora a mensagem.

- [ ] **Step 1: Substituir o guard de senha no login**

Em `apps/api/src/routes/auth.ts`, localizar no handler `/login`:

```typescript
    if (!user || user.password !== hashPassword(body.password)) {
      return reply.code(401).send({ error: 'E-mail ou senha incorretos' })
    }
```

Substituir por:

```typescript
    if (!user) {
      return reply.code(401).send({ error: 'E-mail ou senha incorretos' })
    }
    if (!user.password) {
      return reply.code(401).send({ error: 'Esta conta usa login com Google. Clique em "Continuar com o Google".' })
    }
    if (user.password !== hashPassword(body.password)) {
      return reply.code(401).send({ error: 'E-mail ou senha incorretos' })
    }
```

- [ ] **Step 2: Rodar os testes**

```bash
pnpm --filter @orbit/api test -- --run
```

Saída esperada: todos os testes passando.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/auth.ts
git commit -m "fix(api): mensagem de erro clara para contas Google no login por senha"
```

---

## Task 5: Frontend — GoogleProvider component + layout

**Files:**
- Create: `apps/web/src/components/GoogleProvider.tsx`
- Modify: `apps/web/src/app/layout.tsx`

`GoogleOAuthProvider` é um Client Component. O `layout.tsx` raiz exporta `metadata` (Server Component). A solução é extrair o provider para um componente separado.

- [ ] **Step 1: Instalar @react-oauth/google**

```bash
pnpm --filter @orbit/web add @react-oauth/google
```

- [ ] **Step 2: Adicionar NEXT_PUBLIC_GOOGLE_CLIENT_ID ao .env.local do web**

Em `apps/web/.env.local` (criar se não existir), adicionar:

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=SEU_CLIENT_ID_AQUI
```

(Mesmo Client ID usado na API.)

- [ ] **Step 3: Criar GoogleProvider**

Criar `apps/web/src/components/GoogleProvider.tsx`:

```tsx
'use client'

import { GoogleOAuthProvider } from '@react-oauth/google'

export function GoogleProvider({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
      {children}
    </GoogleOAuthProvider>
  )
}
```

- [ ] **Step 4: Atualizar layout.tsx**

Substituir o conteúdo completo de `apps/web/src/app/layout.tsx` por:

```tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { PushSetup } from '@/components/PushSetup'
import { GoogleProvider } from '@/components/GoogleProvider'

export const metadata: Metadata = {
  title: 'Orbit — Organização com Estrutura',
  description: 'Compromissos, tarefas e projetos com notificações em tempo real',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Orbit',
  },
  icons: {
    apple: '/apple-touch-icon.png',
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#050B14',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <GoogleProvider>
          <PushSetup />
          {children}
        </GoogleProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/GoogleProvider.tsx apps/web/src/app/layout.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): GoogleOAuthProvider no layout raiz"
```

---

## Task 6: Frontend — botão Google na página de login

**Files:**
- Modify: `apps/web/src/app/login/page.tsx`

- [ ] **Step 1: Adicionar import do GoogleLogin**

No topo de `apps/web/src/app/login/page.tsx`, após o import do `api`:

```tsx
import { GoogleLogin } from '@react-oauth/google'
```

- [ ] **Step 2: Adicionar handler handleGoogleSuccess**

Dentro de `LoginPage`, após `handleForgotPassword`, adicionar:

```tsx
  async function handleGoogleSuccess(credentialResponse: { credential?: string }) {
    if (!credentialResponse.credential) {
      setError('Falha ao autenticar com o Google. Tente novamente.')
      return
    }
    setLoading(true)
    setError('')
    setLoginFailed(false)
    setResetSent(false)
    try {
      await api.post('/auth/google', { credential: credentialResponse.credential })
      router.push('/inicio')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
```

- [ ] **Step 3: Inserir botão Google + divisor no JSX**

Dentro de `<div style={styles.formShell}>`, localizar o bloco do `modeSwitch`:

```tsx
            <div style={styles.modeSwitch}>
```

Logo após o fechamento `</div>` do `modeSwitch` e antes de `<form`, inserir:

```tsx
            <div style={styles.googleSection}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Falha ao autenticar com o Google. Tente novamente.')}
                text="continue_with"
                locale="pt-BR"
                theme="outline"
                shape="rectangular"
                size="large"
                width="450"
              />
            </div>

            <div style={styles.divider}>
              <span style={styles.dividerLine} />
              <span style={styles.dividerText}>ou</span>
              <span style={styles.dividerLine} />
            </div>
```

- [ ] **Step 4: Adicionar estilos**

Dentro do objeto `styles` no final do arquivo, adicionar após `resetMessage`:

```tsx
  googleSection: {
    display: 'flex',
    justifyContent: 'center',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: 'rgba(5,11,20,0.12)',
    display: 'block',
  } as React.CSSProperties,
  dividerText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: 500,
    letterSpacing: '0.04em',
  },
```

- [ ] **Step 5: Verificar build TypeScript**

```bash
pnpm --filter @orbit/web build
```

Saída esperada: build concluído sem erros TypeScript.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/login/page.tsx
git commit -m "feat(web): botão Continuar com o Google na tela de login"
```

---

## Task 7: Variáveis de ambiente na VM OCI (deploy)

Após validar localmente, adicionar as vars no ambiente de produção da VM OCI.

- [ ] **Step 1: Adicionar GOOGLE_CLIENT_ID na VM**

No servidor OCI, editar o `.env` do container `orbit-api` (ou o arquivo de compose):

```bash
echo "GOOGLE_CLIENT_ID=SEU_CLIENT_ID" >> /path/to/orbit/apps/api/.env
```

- [ ] **Step 2: Adicionar NEXT_PUBLIC_GOOGLE_CLIENT_ID na VM**

```bash
echo "NEXT_PUBLIC_GOOGLE_CLIENT_ID=SEU_CLIENT_ID" >> /path/to/orbit/apps/web/.env.local
```

- [ ] **Step 3: Rebuild containers**

```bash
git pull && docker compose up -d --build
```

- [ ] **Step 4: Aplicar schema no banco de produção**

```bash
docker compose exec orbit-api npx prisma db push
```

Saída esperada: `Your database is now in sync with your Prisma schema.`

---

## Verificação end-to-end

1. Abrir `http://localhost:3000/login`
2. Confirmar que o botão "Continuar com o Google" aparece acima do divisor "ou"
3. Clicar no botão → popup do Google abre → selecionar conta
4. Confirmar redirecionamento para `/inicio`
5. Abrir DevTools → Application → Cookies → confirmar `orbit_token` presente
6. Fazer logout, tentar login com email/senha de uma conta criada pelo Google → confirmar mensagem "Esta conta usa login com Google"
7. Criar conta por email/senha com o mesmo email do Google → confirmar que ao clicar em Google com esse email, o mesmo usuário é retornado (vinculação)
