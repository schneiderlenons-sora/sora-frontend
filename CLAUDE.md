# CLAUDE.md

Arquivo de contexto do projeto — lido automaticamente em toda nova conversa.

## Comandos essenciais

```bash
npm run dev        # Dev server (http://localhost:3000) — app está em forsora.com
npm run build      # Build produção
npm run lint       # ESLint
git push           # Vercel deploya automaticamente do GitHub (branch master)
```

## Visão geral

**Sora** — assistente financeira pessoal integrada ao WhatsApp. Usuário envia "gastei 50 no mercado" pelo WhatsApp e a IA interpreta, categoriza e lança na conta certa.

**URLs:**
- Frontend: https://forsora.com (Vercel, auto-deploy do GitHub)
- Backend: Express.js no Fly.io (sora-backend — repositório separado)
- DB/Auth: Supabase

**Repositórios:**
- Frontend: `c:\Users\jenif\OneDrive\Área de Trabalho\Sora\sora-frontend` (Next.js)
- Backend: `c:\Users\jenif\OneDrive\Área de Trabalho\Sora\sora-backend` (Express.js)

---

## Stack técnica

| Camada | Tech |
|---|---|
| Framework | Next.js 16.2.6 (App Router, Turbopack) |
| UI | React 19 + Tailwind CSS 4 |
| Auth/DB | Supabase (ssr client) |
| Backend | Express.js (Node.js, JS puro) |
| WhatsApp | Z-API |
| IA | Claude API (Anthropic) via backend |
| Pagamentos | Stripe (integrado, webhooks em `/api/stripe/webhook`) |
| Analytics | Meta Pixel + Conversions API (CAPI) |
| Charts | Recharts |
| Icons | Lucide React |
| Language | TypeScript 5 (frontend), JavaScript (backend) |
| Idioma | Português Brasil — todo texto user-facing |

---

## Planos e feature gates

**Arquivo central: `lib/plans.ts`** — fonte única da verdade para gates.

| Plano | Preço mensal | Principais exclusivos |
|---|---|---|
| Básico | R$19,90 | 3 contas, funcionalidades base, trial 7d Grow |
| Premium | R$29,90 | Contas ilimitadas, OCR, OFX, investimentos, Sora Grow incluso |
| Black | R$79,90 | Tudo + aba Negócios (DRE, integrações Hotmart/Stripe) |

**Helpers:** `podeUsar(plano, feature)` e `limiteDe(plano, recurso)` do `lib/plans.ts`.

**AuthContext** expõe: `plano`, `isBlack`, `isPremium`, `podeUsar()`, `limiteDe()`, `temAcessoGrow`, `podeAtivarTrialGrow`.

---

## Stripe (pagamentos)

**Integração:** Next.js Route Handlers (não o backend Express).

| Arquivo | Função |
|---|---|
| `app/api/stripe/checkout/route.ts` | Cria Checkout Session |
| `app/api/stripe/portal/route.ts` | Cria Customer Portal session |
| `app/api/stripe/webhook/route.ts` | Recebe eventos, atualiza `users.plano` no Supabase |
| `lib/stripe.ts` | Instância Stripe (lazy Proxy) + mapa Price IDs |
| `lib/supabase-admin.ts` | Client server-side com service role (lazy Proxy) |
| `lib/supabase-server.ts` | Client server-side com cookie auth |

**Env vars necessárias (Vercel):**
```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_BASICO_MENSAL / ANUAL
STRIPE_PRICE_PREMIUM_MENSAL / ANUAL
STRIPE_PRICE_BLACK_MENSAL / ANUAL
NEXT_PUBLIC_APP_URL=https://forsora.com
SUPABASE_SERVICE_KEY (ou SUPABASE_SERVICE_ROLE_KEY)
```

**Webhook:** `https://forsora.com/api/stripe/webhook`
Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

**Colunas novas no Supabase (`users`):**
- `stripe_customer_id`, `stripe_subscription_id`, `plano_intervalo`, `plano_valido_ate`
- Migrations: `sql/018_stripe.sql`, `sql/021_wallet_padrao.sql`, `sql/022_transacoes_pendentes.sql`, `sql/023_cartao_metadata.sql`

---

## Onboarding wizard

`app/onboarding/` — 9 steps que rodam antes do dashboard (forçado via `OnboardingRedirect` em `components/providers.tsx`).

**Steps:** Boas-vindas/nome → Perfil de uso → Objetivo → Categorias → Contas (com conta padrão ⭐) → Gastos fixos → Receitas fixas → Meta → WhatsApp tour.

**Guard:** `components/auth/OnboardingRedirect.tsx` — redireciona pra `/onboarding` se `perfil.onboarding_completed === false`.

**Colunas Supabase (`users`):** `onboarding_completed`, `onboarding_step`, `perfil_uso`, `objetivo_principal`, `wallet_padrao_id`, `welcomed_at`.

---

## WhatsApp — conta padrão e conversas pendentes

**Conta padrão (`wallet_padrao_id`):** Se usuário manda "gastei 50 mercado" sem mencionar banco, a Sora usa a conta padrão. Se não tiver configurada e houver múltiplas contas, inicia wizard conversacional perguntando de qual conta saiu.

**State machine de conversas (`transacoes_pendentes`):** Tabela com TTL 10min. Tipos: `escolher_conta`, `marcar_principal`, `criar_conta`, `criar_cartao`, `tipo_conta`. O webhook processa pendente ANTES de chamar a IA.

**Arquivo central backend:** `src/handlers/pendentes.js` — resolve cada tipo de conversa pendente.

**WhatsApp boas-vindas:** Disparado após vincular número. `src/services/welcome.js` + rota `POST /api/user/welcome`.

---

## Analytics (Meta Pixel + CAPI)

| Arquivo | Função |
|---|---|
| `components/analytics/MetaPixel.tsx` | Pixel client-side (afterInteractive) |
| `lib/analytics.ts` | Helpers com dedup (event_id) pra ambos os canais |
| `lib/facebook-capi.ts` | Envia eventos server-side pro Graph API |
| `app/api/analytics/route.ts` | Ponte frontend → CAPI |

**Env vars:** `NEXT_PUBLIC_FB_PIXEL_ID`, `FB_ACCESS_TOKEN`.

**Eventos rastreados:** PageView, CompleteRegistration (signup), InitiateCheckout (clicar assinar), Purchase (webhook Stripe).

---

## Catálogos centrais importantes

| Arquivo | O que contém |
|---|---|
| `lib/plans.ts` | Features × planos, helpers `podeUsar` / `limiteDe` |
| `lib/planos-display.ts` | Textos/features/cores dos 3 planos (landing + painel) |
| `lib/stripe.ts` | Price IDs do Stripe + mapa price→plano |
| `lib/sora-commands.ts` | Todos os comandos WhatsApp (Central da Sora) |
| `lib/plan-intent.ts` | Intenção de plano salva no signup (localStorage, TTL 24h) |
| `lib/analytics.ts` | Helpers de eventos Meta Pixel + CAPI |
| `lib/planos-display.ts` | FONTE ÚNICA dos dados visuais dos planos |

---

## Páginas principais do app

| Rota | Descrição |
|---|---|
| `/` | Landing page (Pricing usa `lib/planos-display.ts`) |
| `/planos` | Página de upgrade/downgrade dentro do dashboard |
| `/onboarding` | Wizard 9 steps (novo usuário) |
| `/central-sora` | "Central da Sora" — catálogo de comandos WhatsApp |
| `/configuracoes` | Perfil, Plano e Cobrança (hero + cards de planos), WhatsApp, Dados |
| `/categorias` | Categorias com barras de consumo e limites |
| `/transacoes` | Lista de transações com scroll horizontal no mobile |
| `/investimentos` | Premium+ (era Black-only, mudou) |
| `/negocios` | Black-only (DRE, vendas, forecast, integrações) |
| `/grow/*` | Sora Grow — hábitos, saúde, estudos, casa, bem-estar |

---

## Sidebar nav

Arquivo: `components/layout/Sidebar.tsx`. Items com `gate: Feature` mostram badge "Premium" ou "Black" quando bloqueados.

```
Investimentos → gate: 'investimentos' (Premium+)
Negócios      → gate: 'negocios' (Black)
Grupos        → gate: 'compartilhamento' (Premium+)
Central da Sora → sem gate (todos)
Planos        → sem gate (todos)
```

---

## Responsividade mobile — regras aplicadas

- **Sidebar:** botão fechar com `safe-area-inset-top` + toque 44pt
- **Transações:** botões hero mobile-first (CTA full-width); movimentações com scroll horizontal (`overflow-x-auto`, `min-w:700px`, mesmo grid desktop/mobile); filtros em `grid-cols-3`
- **Categorias:** scroll horizontal nas linhas, barras de consumo visíveis no mobile, botões touch 44pt
- **Hábitos Grow:** tabela semana com `overflow-x-auto` + `min-w-[600px]`
- **Negócios:** botões header em scroll horizontal com `whitespace-nowrap`
- **Saúde/Estudos layouts:** `sticky top-0` (não mais `calc(env(safe-area-inset-top))`)
- **Regra geral:** nunca usar `opacity-0 group-hover:opacity-100` pra elementos de ação no mobile — usar `lg:opacity-0 lg:group-hover:opacity-100`

---

## Convenções de código

- **Componentes:** functional + hooks, `'use client'` quando usa state/effects
- **Tailwind v4:** `border: 1px solid <color> !important` (border shorthand, não split)
- **Cores:** Brand `#61D17B` (Sora green). Dark mode via classe `.dark`.
- **Moeda:** `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
- **Plano guard:** sempre usar `podeUsar(plano, feature)` de `lib/plans.ts`
- **IA local-first:** preferir parsers locais antes de chamar Claude API

---

## Variáveis de ambiente

**Frontend `.env.local`:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
NEXT_PUBLIC_API_URL=https://... (URL do backend Express)
NEXT_PUBLIC_API_TOKEN
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_BASICO_MENSAL / ANUAL
STRIPE_PRICE_PREMIUM_MENSAL / ANUAL
STRIPE_PRICE_BLACK_MENSAL / ANUAL
NEXT_PUBLIC_APP_URL=https://forsora.com
NEXT_PUBLIC_FB_PIXEL_ID
FB_ACCESS_TOKEN
```

**Backend `.env` (Fly.io):**
```
ZAPI_INSTANCE, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN (WhatsApp Z-API)
ANTHROPIC_API_KEY (IA)
API_SECRET_TOKEN (autenticação entre frontend e backend)
SUPABASE_URL, SUPABASE_KEY
```

---

## Deployment

- **Frontend:** Vercel — auto-deploy a cada push no branch `master` do GitHub
- **Backend:** Fly.io — deploy manual ou via CI
- **Migrations SQL:** rodar manualmente no Supabase Dashboard → SQL Editor
- **Cache Vercel:** `export const revalidate = 0` em `app/page.tsx` pra landing não cachear
- **Service Worker:** `public/sw.js` usa `CACHE = 'sora-v3'`, HTML nunca cacheado

---

## Migrations SQL a rodar (se ainda não rodou)

```
sql/018_stripe.sql              — colunas Stripe em users
sql/019_onboarding.sql          — colunas onboarding em users
sql/020_welcome_tracking.sql    — coluna welcomed_at em users
sql/021_wallet_padrao.sql       — coluna wallet_padrao_id em users
sql/022_transacoes_pendentes.sql — tabela state machine conversas
sql/023_cartao_metadata.sql     — colunas limite/dia_fechamento/bandeira em wallets
```
