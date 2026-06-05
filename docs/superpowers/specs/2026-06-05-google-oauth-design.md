# Login com Google — Design Spec

**Data:** 2026-06-05  
**Status:** aprovado

## Contexto

A tela de login atual exige e-mail + senha, o que cria atrito no primeiro acesso. A solução é adicionar "Continuar com o Google" como opção primária, mantendo o fluxo de e-mail/senha como alternativa. Novos usuários passam a se cadastrar com um clique; usuários existentes que tentarem entrar com o Google e tiverem o mesmo e-mail têm as contas vinculadas automaticamente.

## Decisões de design

| Decisão | Escolha |
|---|---|
| Abordagem OAuth | Google Identity Services (popup via `@react-oauth/google`) |
| Posição do botão | Google no topo, formulário e-mail/senha abaixo com divisor "ou" |
| Conflito de e-mail | Vincular automaticamente ao usuário existente |
| Usuários sem senha | `password` vira campo opcional no schema |

## Banco de dados

Dois campos novos no model `User` (`packages/database/prisma/schema.prisma`):

```prisma
googleId  String?  @unique   // ID único retornado pelo Google
password  String?            // era obrigatório; agora opcional (Google users não têm)
```

Aplicado via `prisma db push` (sem migrations folder).

## API — nova rota

**`POST /auth/google`**

Corpo: `{ credential: string }` — o ID token JWT retornado pelo SDK do Google no frontend.

Fluxo:
1. Verifica o token com `google-auth-library` (`OAuth2Client.verifyIdToken`)
2. Extrai `sub` (googleId), `email`, `name` do payload
3. Busca usuário por `googleId` → encontrou: segue para step 5
4. Busca usuário por `email` → encontrou: atualiza `googleId` (vinculação) → step 5; não encontrou: cria usuário (`name`, `email`, `googleId`, `password: null`)
5. Assina JWT, seta cookie `orbit_token` (mesmos parâmetros do login atual)
6. Retorna `{ id, name, email, phone, createdAt }`

Erros:
- Token inválido ou expirado → 401
- Falha ao verificar com Google → 401

Rotas existentes (`/auth/register`, `/auth/login`) **não mudam**.

## Frontend

### Pacote novo
```
@react-oauth/google
```

### Env vars
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<client_id_do_google_cloud>
```

### Wrapper
`GoogleOAuthProvider` envolve `<html>` no `apps/web/app/layout.tsx` com `clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}`.

### Página de login (`apps/web/app/login/page.tsx`)
Layout após a mudança:

```
[Logo + tagline]
[Botão: Continuar com o Google]
──────────── ou ────────────
[Campo: E-mail]
[Campo: Senha]
[Link: Esqueci minha senha]
[Botão: Entrar / Cadastrar]
[Toggle: Já tem conta? / Não tem conta?]
```

Ao clicar em "Continuar com o Google":
1. SDK abre popup de seleção de conta Google
2. Recebe `credential` (ID token)
3. Chama `api.post('/auth/google', { credential })`
4. Em caso de sucesso → `router.push('/inicio')` (igual ao login atual)
5. Em caso de erro → exibe mensagem de erro na tela

O botão do Google funciona tanto para login quanto para cadastro — sem distinção de modo.

### Env var na API
```
GOOGLE_CLIENT_ID=<mesmo client_id>
```
Usado pela `google-auth-library` para verificar o token.

## Pré-requisito manual — Google Cloud Console

Eduardo precisa executar estes passos uma vez antes do deploy:

1. Acessar [console.cloud.google.com](https://console.cloud.google.com)
2. Criar projeto (ex: "Orbit")
3. Menu → **APIs e Serviços** → **Credenciais**
4. **Criar credenciais** → OAuth 2.0 → Tipo: Aplicativo Web
5. **Origens JavaScript autorizadas:**
   - `http://localhost:3000` (dev)
   - `https://orbit.prumosaas.com.br` (prod)
6. Copiar o **Client ID** gerado
7. Adicionar ao `.env` local e às variáveis de ambiente da VM OCI

Não é necessário Client Secret para o fluxo com Google Identity Services (verificação por chave pública).

## O que não muda

- Fluxo de e-mail/senha (login, cadastro, esqueci senha)
- Estrutura de cookies (`orbit_token`, httpOnly, 30 dias)
- Todos os outros endpoints da API
- Schema de User além dos dois campos adicionados
