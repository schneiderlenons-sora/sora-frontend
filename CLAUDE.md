# CLAUDE.md

Arquivo de contexto do projeto — lido automaticamente em toda nova conversa.

## ⚠️ Regras de trabalho (LER SEMPRE)

- **Sem servidor local.** O backend roda no **Render + GitHub** e o frontend na **Vercel**. Não usamos `npm run dev` como ambiente oficial — tudo vive em produção.
- **Commit + push automático.** Depois de QUALQUER alteração de código, faça `git commit` e `git push` por conta própria, sem o usuário pedir. Push no `master` (frontend) / `main` (backend) → deploy automático.
- **Domínio oficial:** **https://www.forsora.com** (site + painel da Sora).
- **Preview só quando pedido.** Às vezes o usuário pede um **preview** das alterações (painel ou landing) sem mandar pra produção — esses previews ficam na **Vercel**. Só gere preview se o usuário pedir explicitamente; o padrão é sempre deploy direto pra produção.

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
- Backend: Express.js no Render (sora-backend — repositório separado) → https://sora-backend-jqm8.onrender.com
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
| WhatsApp | **WhatsApp Cloud API OFICIAL da Meta** (migrado do Z-API em jul/2026). Flag `WHATSAPP_PROVIDER=meta`. Z-API descontinuado. |
| IA | OpenAI **gpt-4o-mini** via backend (multimodal: texto + visão). Whisper p/ áudio |
| Pagamentos | Stripe (integrado, webhooks em `/api/stripe/webhook`) |
| Analytics | Meta Pixel + Conversions API (CAPI) |
| Charts | Recharts |
| Icons | Lucide React |
| Language | TypeScript 5 (frontend), JavaScript (backend) |
| Idioma | Português Brasil — todo texto user-facing |

---

## Planos e feature gates

**Arquivo central: `lib/plans.ts`** — fonte única da verdade para gates.

> **Black descontinuado** (2026): não existe mais como plano — TODAS as features do Black foram anexadas ao **Premium** (incl. aba Negócios: DRE, integrações Hotmart/Kiwify/Eduzz/Stripe, forecast, conciliação, tributária + limite de grupo 5). Sobram só **Básico** e **Premium** (+ ofertas vitalícias). Usuários com `plano='black'` no banco continuam existindo e são **equivalentes ao Premium** (Black e Premium são idênticos em features/gates). `PLANO_LABEL['black']` mantido só pra esses usuários. O vitalício "completa" agora ativa `plano='premium'` (antes 'black').

| Plano | Preço mensal | Principais |
|---|---|---|
| Básico | R$19,90 | 3 contas, funcionalidades base, Sora Grow básico |
| Premium | R$29,90 | Tudo: contas ilimitadas, OCR, OFX, investimentos, Sora Grow completo **+ aba Negócios** (DRE, integrações, forecast, conciliação) |

**Helpers:** `podeUsar(plano, feature)` e `limiteDe(plano, recurso)` do `lib/plans.ts`.

**AuthContext** expõe: `plano`, `isBlack` (legado — só usuários black existentes), `isPremium` (premium OU black), `podeUsar()`, `limiteDe()`, `temAcessoGrow`, `podeAtivarTrialGrow`. Gate de Negócios agora é `isPremium`/`podeUsar(plano,'negocios')`.

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

## Vitalício (pagamento único) + Mercado Pago + landings /oferta e /kit

**Vitalício = paga UMA vez, acesso pra sempre** (sem mensalidade). Paralelo à assinatura Stripe. Dois tiers + upgrade:

| Tier | Preço | Plano ativado | Inclui |
|---|---|---|---|
| **Kit** | R$47 | `plano='kit'` | Vitalício **SEM WhatsApp** — só painel (as "8 ferramentas" do Kit) |
| **Completa** | R$97 | `plano='premium'` | Vitalício **COM WhatsApp** — tudo (Sora no zap + Negócios + Grow completo) |
| **Upgrade** | +R$50 | `plano='premium'` | Só pra quem já tem o Kit; senão cobra a Completa cheia |

- **Kit no WhatsApp:** `plano='kit'` NÃO atende pelo zap — o `processarMensagem` responde com CTA de upgrade (`webhook.js`). Kit organiza só pelo painel.

**Pagamento = Mercado Pago** (checkout transparente / Payment Brick), NÃO o Stripe (Stripe é só assinatura mensal/anual):
| Arquivo | Função |
|---|---|
| `app/checkout-vitalicio/page.tsx` | Checkout (design à esquerda + Payment Brick à direita). `?tier=kit\|completa\|upgrade&cupom=&rec=1` |
| `app/api/mercadopago/process/route.ts` | Cria o pagamento no MP (valor+plano SEMPRE pelo tier no server). Cartão aprovado → `ativarVitalicio` na hora; Pix → 'pending' + QR |
| `app/api/mercadopago/webhook/route.ts` | Confirma pagamento (fonte da verdade) → `ativarVitalicio` + evento **Purchase** (CAPI, com fbp/fbc/ip/ua guardados no metadata do /process) |
| `lib/mercadopago.ts` | `tierConfig()` (valor+plano+título por tier), `mpCreatePayment`, `mpGetPayment` — **via SDK oficial `mercadopago`** (ver "Qualidade da integração" abaixo) |
| `lib/vitalicio.ts` | `ativarVitalicio(userId, plano)` |
| `lib/cupons.ts` | Cupons: **SORA10/15/20/25/35** (%) + **SORA100** (100% off → libera grátis sem passar no MP). `aplicarCupomVitalicio()` recalcula SEMPRE no server. ⚠️ **É o catálogo inteiro** — código fora dele vale 0% e o checkout cobra CHEIO dizendo "cupom inválido" (foi o caso do SORA20, divulgado sem cadastrar). Cupom novo entra aqui ANTES de ser anunciado; pro **Stripe** (mensal/anual) é preciso criar o code no painel do Stripe também |

- **Env (Vercel):** `MP_ACCESS_TOKEN`, `NEXT_PUBLIC_MP_PUBLIC_KEY` (chaves de PRODUÇÃO). Migration `sql/064_vitalicio_intent.sql` (coluna `vitalicio_intent` p/ recuperação levar de volta pro tier certo).

### Qualidade da integração do Mercado Pago (ago/2026)

O painel do MP dá uma **nota de 0 a 100** pra integração (mínimo exigido 73). Ela
caiu pra **77** e junto veio um pagamento recusado. A nota é medida
automaticamente pelo MP em cima das SUAS chamadas de API — os itens que faltavam
somavam exatamente 23 (8 + 10 + 5).

- **SDK do backend (5 pts) — era o furo real.** `lib/mercadopago.ts` chamava a
  `api.mercadopago.com` com `fetch` cru ("REST direto, sem SDK"). O MP só
  reconhece o item quando a chamada sai com a assinatura do **SDK oficial**
  (`npm i mercadopago`). Trocado sem mudar UM campo do payload: mesmas funções,
  mesmas assinaturas.
  - ⚠️ **`idempotencyKey` é POR CHAMADA (`requestOptions`), nunca global.** No
    `MercadoPagoConfig.options` ela viraria a mesma chave em toda requisição e o
    MP recusaria a 2ª tentativa do cliente como duplicada.
  - O device id continua indo: o SDK expõe `meliSessionId` no `requestOptions`,
    que ele manda como header `X-Meli-Session-Id` (antes era header na mão).
  - De brinde: retry com backoff em 429/5xx protegido pela idempotency key.
- **Device id (`MP_DEVICE_SESSION_ID`) — o que causava a recusa.** O SDK JS V2
  gera o fingerprint sozinho, mas ele era carregado **só quando o Brick
  montava** — dava pra submeter antes de existir e a compra voltava
  `cc_rejected_high_risk`. Agora o SDK entra pela página (`next/script`,
  `afterInteractive`) e o `onSubmit` **espera até 4s** pelo fingerprint antes de
  enviar (se não vier, envia mesmo assim — melhor tentar do que travar a venda).
- **`payer.address` (boas práticas, não pontua).** O Payment Brick **não coleta
  endereço no cartão** — o `formData` de cartão só traz `email` +
  `identification`; endereço só vem em boleto. Então o endereço é enviado quando
  existe (boleto ou cadastro) e omitido quando não. Pra garantir em toda compra
  seria preciso um campo de CEP no checkout — **não feito de propósito** (atrito
  em página de conversão). Junto foi o `additional_info.payer.registration_date`
  (idade da conta), que já tínhamos de graça e o antifraude usa.
- ⚠️ **Os itens "SDK do frontend" (10) e "Secure Fields/PCI" (8) são falso-positivo
  conhecido com Bricks** — o Payment Brick **é** SDK V2 e **já usa** Secure Fields.
  Está reportado e sem solução no [sdk-react#89](https://github.com/mercadopago/sdk-react/discussions/89);
  a saída oficial do MP é abrir ticket com os IDs de pagamento. Nenhuma mudança
  de código resolve isso — não gastar tempo "consertando" o que já está certo.

**Landings de venda:**
- **`/oferta`** (`app/oferta/page.tsx`) — landing do vitalício (Hero + pricing dos tiers). Pixel/CAPI: InitiateCheckout.
- **`/kit`** (`app/kit/page.tsx` + `components/landing/KitOferta.tsx`) — landing dedicada do **Kit**, **tema escuro forçado** (`dark` no `<main>` + `@variant dark` no globals), nav sem toggle de tema, cabeçalho preto. Tem **card flutuante de cupom** `components/landing/CupomFlutuante.tsx` (SORA10, dismissível, copiar). Onboarding do Kit esconde "vincular WhatsApp" e "ver o que sei fazer" (Kit não tem zap).
- Ambas usam o `Footer` e `lib/planos-display.ts` pros dados dos planos.

> Recuperação de pagamento falho: memória `project-recuperacao-pagamento-falho` (crons OFF por padrão — `RECUPERACAO_ATIVA`). CHECK constraint de `users.plano`: todo plano novo (ex. 'kit') precisa entrar no `users_plano_check` via migration senão a ativação falha calada — memória `project-plano-check-constraint`.

---

## Onboarding wizard

`app/onboarding/` — 9 steps que rodam antes do dashboard (forçado via `OnboardingRedirect` em `components/providers.tsx`).

**Steps:** Boas-vindas/nome → Perfil de uso → Objetivo → Categorias → Contas (com conta padrão ⭐) → Gastos fixos → Receitas fixas → Meta → WhatsApp tour.

### Step 5: "conectar o banco" × "cadastrar à mão" (ago/2026)

O onboarding não mencionava Open Finance em lugar nenhum — quem ia conectar o
banco cadastrava tudo à mão primeiro e depois via o banco trazer as **mesmas**
contas e cartões, duplicado. Agora o step 5 abre com a escolha.

- ⚠️ **A opção só aparece pra quem TEM Open Finance** (`podeVerOpenFinance`):
  é da assinatura recorrente (Básico 1 conexão, Premium 3). **Vitalício e
  sem-plano não têm** — oferecer a eles seria mandá-los pra uma aba que pede
  pagamento no meio do onboarding. Sem OF, a tela é **idêntica** à de antes.
- Escolhendo conectar, contas **e** cartões (que vivem na MESMA tela, não em
  steps separados) somem e dão lugar a um painel que **explica** o que vai
  acontecer. ⚠️ Não é formulário desabilitado: botão cinza lê como "quebrou".
  Regras `read-only-distinction` + `empty-nav-state` da skill `ui-ux-pro-max`.
- A volta atrás fica **sempre visível** ("prefiro cadastrar à mão") — a escolha
  não pode virar armadilha.
- Quem já tinha cadastrado à mão **não perde nada**: o painel avisa que as
  linhas continuam lá e que o Watson ajuda a limpar repetidos depois.
- **Sem migration:** a escolha vive em `lib/of-intent.ts` (localStorage por
  `userId`, TTL 7 dias). É dica de NAVEGAÇÃO que morre no fim do wizard, não
  dado do usuário. Confere o `userId` pra PC compartilhado não herdar a escolha.
- No fim do wizard o `StepNav` manda pra **`/open-finance?onboarding=1`** em vez
  do dashboard — foi o que a tela prometeu.
- Estado derivado (`escolha ?? querOpenFinance(...)`), **não** `useEffect` +
  setState: com efeito, o primeiro render saía "manual" e piscava pra
  "Open Finance" quando o auth chegava.

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
| `lib/ssr.ts` | SSR das abas: `contextoSSR()` (phone/token/grupoId/userId), `backendGet`, `mesRefSSR` |
| `lib/ssr-data.ts` | Leitura DIRETA no Supabase pro SSR — **porte fiel do backend** (ver Performance) |
| `lib/swr-cache.ts` | Cache do SWR em localStorage (+ `limparCacheSWR` no logout) |
| `lib/perfil-cache.ts` | Perfil persistido (cold-start instantâneo) — por `userId`, limpo no logout |
| `lib/prefetch.ts` | Prefetch dos dados das abas (hover + ocioso), usado pela Sidebar |

---

## Páginas principais do app

| Rota | Descrição |
|---|---|
| `/` | Landing page (Pricing usa `lib/planos-display.ts`) |
| `/oferta` | Landing do **vitalício** (pagamento único) — tiers Kit/Completa |
| `/kit` | Landing dedicada do **Kit** (R$47), tema escuro forçado + card de cupom flutuante (`KitOferta.tsx`) |
| `/checkout-vitalicio` | Checkout do vitalício via Mercado Pago (`?tier=kit\|completa\|upgrade&cupom=`) |
| `/planos` | Página de upgrade/downgrade dentro do dashboard |
| `/onboarding` | Wizard 9 steps (novo usuário) |
| `/central-sora` | "Central da Sora" — catálogo de comandos WhatsApp |
| `/configuracoes` | Perfil, Plano e Cobrança (hero + cards de planos), WhatsApp, Dados |
| `/categorias` | Categorias com barras de consumo e limites |
| `/transacoes` | Lista de transações com scroll horizontal no mobile |
| `/investimentos` | Premium+ (era Black-only, mudou) |
| `/negocios` | Premium+ **multi-empresa** (digital/físico/híbrido): DRE, vendas, forecast, integrações + **/caixa, /contas, /equipe** (loja física). Ver "Negócios 2.0" |
| `/grow/*` | Sora Grow — hábitos, tarefas, bem-estar, saúde, estudos, casa, agenda, **coleções (viagens/midia/leituras)**, **Drive (`/grow/dados` — ex-Dados Pessoais)**, **configurações** |
| `/wrapped` | Sora Wrapped — retrospectiva financeira do mês (aviso WhatsApp dedup via `wrapped_avisado`) |
| `/admin` | Painel admin (métricas internas) — acesso restrito |
| `/reportar-bug` | Aba "Relatar um problema" — relato cai no WhatsApp de suporte (via mensageiro → Cloud API) (migration 043) |
| `/comunidade` | Comunidade |

---

## Sidebar nav

Arquivo: `components/layout/Sidebar.tsx`. Items com `gate: Feature` mostram badge "Premium" quando bloqueados.

```
Investimentos → gate: 'investimentos' (Premium+)
Negócios      → gate: 'negocios' (Premium+)
Grupos        → gate: 'compartilhamento' (Premium+)
Central da Sora → sem gate (todos)
Planos        → sem gate (todos)
```

`NAV_GROW` (sub-nav do Sora Grow): Dashboard · Hábitos · Tarefas · Bem-estar · Saúde · Estudos · Casa · Agenda · **Viagens & Lazer** · **Filmes & Séries** · **Leituras** · **Dados** · Configurações.

---

## Sora Grow — design system das abas

Todas as abas do Grow seguem o **estilo da aba Hábitos** (`app/grow/habitos/page.tsx`) — referência obrigatória ao criar/editar abas. Usar a **skill `ui-ux-pro-max`** em todo design novo.

- **Hero:** componente `components/grow/GrowHero.tsx` (badge + título + subtítulo dinâmico). Dashboard do Grow tem hero próprio — não usar o GrowHero lá.
- **Cards:** `rounded-2xl`/`rounded-3xl`, `border border-border/40 backdrop-blur-xl`, fundo `style={{ background: 'hsl(var(--bg-card) / 0.5)' }}`, glow radial `radial-gradient(circle at top right, ${cor}24 0%, transparent 70%)`.
- **Accent:** `BRAND = '#7c3aed'` (violet) é o padrão do Grow. Casa usa âmbar `#d97706` no badge; Receitas usa laranja `#f97316` no botão "Cozinhar".
- **Status:** sempre **ícone + rótulo** (nunca cor sozinha — acessibilidade). Números com `tabular`/`tabular-nums`.
- **Animações:** entrada escalonada `animate-[slide-up_500ms_ease-out_both]` com `animationDelay: ${i*40}ms`. Toggles como `role="switch" aria-checked`. Toque ≥44pt.
- **Otimista:** atualiza UI na hora, chama API, reverte no erro; `onReload(true)` revalida em silêncio.

### Aba Casa (`app/grow/casa/page.tsx`) — 4 sub-abas internas
1. **Compras** — lista de compras + botão "Enviar lista pro WhatsApp" (a Sora manda agrupada por categoria).
2. **Despensa** — itens que você sempre tem (status tem/acabando/acabou). Marcar "acabou" → entra na lista de compras (loop via `despensa_item_id`); comprar → volta pra "tem". Migration 032.
3. **Receitas** — receitas + ingredientes. Botão "Cozinhar" cruza ingredientes com a despensa e manda o que falta pra lista de compras. Migration 034.
4. **Manutenções** — upkeep recorrente (próxima = última + frequência), barra de ciclo, "Fiz hoje", lembrete opt-in. Migration 033.

### Aba Agenda (`app/grow/agenda/page.tsx`) — item próprio no sidebar
Central de tudo que tem data na Sora. Construída em 3 fases (ver memória `project-agenda-grow`):
- **Compromissos nativos** (tabela `compromissos`, migration 035): visão Próximos (lista por dia) + Mês (calendário); categorias coloridas; lembrete opt-in com antecedência.
- **Feed agregador** (`src/services/agendaFeed.js` → `montarFeed`): junta consultas, recorrências, dívidas, faturas de cartão e manutenções no mesmo calendário (read-only, deeplink pra origem). Cada fonte é **tolerante** (try/catch por fonte). Filtro por origem no frontend.
- **Briefing matinal** (opt-in, migration 036, cron JOB 1K) + **criar por linguagem natural** ("marca dentista terça 15h") via parser PT local em `src/handlers/grow.js` (sem IA).

### Backend do Grow
- **Rotas:** `sora-backend/src/routes/grow.js` (CRUD de hábitos, despensa, manutenções, receitas, compromissos + `/agenda/feed` + `/agenda/briefing`). Auth por `requireGrow` (checa acesso ao plano Grow) + `req.userRow.grupo_ativo`.
- **Comandos WhatsApp:** `sora-backend/src/handlers/grow.js` (todos no catálogo `lib/sora-commands.ts` do frontend).
- **Crons:** `sora-backend/src/jobs/index.js` — JOB 1H (hábitos), 1I (manutenções), 1J (compromissos), 1K (briefing). Todos com dedup persistido (à prova de restart) e fuso SP via `agoraSP()`.

---

## Nutrição & macros por foto (Saúde do Grow)

- **Banco local de alimentos:** `sora-backend/src/data/alimentos.json` — **617 itens** de comida brasileira (carnes, peixes, aves, ovos, laticínios, grãos, massas, pães, frutas, legumes, doces, fast food, pratos prontos, bebidas, suplementos, padaria…). Cada entrada: `{nome, aliases[], porcao:{descricao,g}, kcal_100, p_100, c_100, g_100}` (macros por 100g).
- **Service:** `sora-backend/src/services/nutricao.js` — `lookupLocal(termo)`, `macrosParaQuantidade(alimento, gramas)` e **`analisarFotoComida(imageUrl)`** (visão via gpt-4o-mini, refinado com o banco local). Local-first: tenta o banco antes da IA.
- **Roteamento de foto no webhook** (`src/routes/webhook.js`): se a legenda tem palavra de comida (`macro|caloria|kcal|nutri|proteina|carboidrato|gordura|comida|refei|prato|calcula…`) → `analisarFotoComida` → `formatarMacrosFoto`. Senão → OCR de nota fiscal (`lerNotaFiscal`). Gate: `premium`/`black`.
- Comando na Central: `grow-macros-foto` em `lib/sora-commands.ts`.

## FAQ local-first no WhatsApp

- **`src/data/faq.js` + `src/services/faq.js`** — ~32 perguntas respondidas **sem IA**. `responderFaq(mensagem)` roda no webhook ANTES da IA. Gatilhos só de pergunta (não colidem com comandos). Local-first puro.

## Resumos proativos no WhatsApp (semanal + mensal)

- **`src/services/resumoFinanceiro.js`** — resumo semanal + fechamento mensal, independentes do Wrapped. Opt-out via colunas `resumo_*` em `users`; dedup à prova de restart (`resumo_*_em`). Cron em `jobs/index.js`. Migration **044**.
- Toggle na Central: `resumos-toggle`. Comando de suporte: `suporte`. Lembrete de hábito: `grow-lembrete`.

## Privacidade do Grow em grupos (compartilhamento por aba)

Ao usar gestão compartilhada, nem tudo é do grupo. Modelo: toda linha tem **`user_id` (dono) + `grupo_id`**; a leitura troca o filtro conforme o modo.
- **Sempre privado (cada um o seu):** Hábitos, Tarefas, Agenda (+ Saúde/Estudos/Bem-estar que já eram por `user_id`).
- **Opcional (toggle por aba, default privado):** **Casa** (Compras/Despensa/Receitas/Manutenções) e as 3 **Coleções** (Viagens & Lazer, Filmes & Séries, Leituras).
- Toggles em colunas `grow_compartilha_*` na tabela `grupos`. Helper: `src/services/growShare.js`. Migrations **039** (user_id + backfill) e **040** (flags). UI em `app/grow/configuracoes/`.
- **Crons** mandam lembrete pro **dono real** (`user_id`), não mais pro dono do grupo.

## Outras features novas

- **Coleções do Grow** (`app/grow/viagens|midia|leituras`, migration 038): Viagens & Lazer, Filmes/Séries/Desenhos, Leituras.
- **Drive Inteligente** (ex-"Dados Pessoais", `app/grow/dados`, migrations 041/042): quadros → seções → itens (campo/nota/senha/arquivo), PIN de 4 dígitos (trava de UI), arquivos em bucket **privado** (`dados-arquivos`) com URLs assinadas geradas no backend. Aba **rebatizada pra "Drive"** (label/hero/ícone `FolderLock`; quadro→pasta, seção→subpasta; file-first). **Receber arquivo pelo WhatsApp** (`sora-backend/src/services/drive.js` + branch no `webhook.js`): trata `document` (Z-API) e imagem com intenção "salva/guarda/pasta" → baixa → sobe no bucket → resolve pasta (legenda "pasta X" > mapa de palavras local > "Geral") em `quadro "Recebidos" > seção` → grava item `arquivo`. Gate **Premium** (só o recebimento/busca; a aba segue acessível a todo plano pago pra não trancar dados de Básico). **Busca por WhatsApp** ("ache meu comprovante") devolve o arquivo por URL assinada. Painel tem Recentes + busca (`GET /api/dados/arquivos/:phone`). Central: categoria "Drive Inteligente" + Feature `'drive'`. **Sem migration nova** (reusa 041/042). Pendente: **busca semântica** (embeddings/pgvector — fase 3) e validar o payload real de `document` do Z-API.
- **Tarefa por linguagem natural + Notas/insights** (migrations 062/063, `sora-backend/src/handlers/grow.js` → `capturaRapida` + branch no `webhook.js`): **quick-capture local-first** (sem IA) que roda ANTES da Agenda. Regra de ouro: tarefa/nota **só disparam SEM data** (com data continua Agenda). **Tarefa**: "lembra de comprar as passagens" → cria tarefa + **categoria** por mapa de palavras (Viagem/Compras/Trabalho/Saúde/Estudos/Casa/Contatos/Financeiro); categoria em update tolerante (migration 062). **Nota**: "anota que…"/"tive uma ideia…"/"nota:…" salva na tabela `notas` (063); "o que anotei sobre…"/"minhas notas" consulta por **palavra-chave**. Base do Grow (todo plano pago), **só WhatsApp** (sem painel no MVP). Central: comandos `grow-tarefa-natural`, `grow-nota-salvar`, `grow-nota-consultar`. Pendente: busca **semântica** das notas (fase 2) + painel de notas. Detectores/extratores expostos em `module.exports` do grow.js (testados em 19 frases).
- **Desconto de conta destino** (migration 037, `src/services/descontoConta.js` + `contaDebito.js`): ao registrar aporte/pagamento (meta/investimento/dívida/fatura) a Sora pergunta de qual conta descontar.
- **Sora Wrapped** (`app/wrapped`, migration 037_wrapped_aviso): retrospectiva do mês + aviso WhatsApp com dedup.
- **Transações na Agenda** (`agendaFeed.montarFeed` com flag `incluirTransacoes`, origem `transacao`): calendário mostra movimentações do dia + total líquido por dia. Fora do briefing.
- **Relatar um problema** (`app/reportar-bug`, migration 043): relato vai pro WhatsApp de suporte (via mensageiro → Cloud API).
- **Máscara de telefone WhatsApp** (`components/ui/WhatsappInput.tsx`): máscara BR; telefone sempre E.164 sem `+`. Futuro i18n via libphonenumber-js nesse ponto.
- **Landing "Corpo em Dia"** (`components/landing/SaudeShowcase.tsx`): carrossel de 6 imagens 9:16 (3-up desktop / 1-up mobile, bordas redondas + sombra), imagens em `public/landing/corpo/1.png…6.png`, destaque do macros por foto.

### Atualizações jul/2026 (além da migração WhatsApp abaixo)
- **Info legal da empresa no rodapé — REMOVIDA (ago/2026).** Existia razão social/CNPJ/endereço/contato no `Footer.tsx` (jul/2026, pra verificação de negócio na Meta); a pedido do usuário, todas as menções a CNPJ e à razão social foram tiradas das landings e do painel. Se a Meta voltar a exigir, reavaliar.
- **Seção Open Finance nas landings** (`components/landing/OpenFinance.tsx`): seção de marketing "Não quer nem digitar? Conecte seu banco" (carrossel de bancos + garantias + selo "Autorizado pelo BACEN"). Renderizada na **principal (`/`), `/oferta` e `/kit`** (na kit, dentro do bloco `.dark`, logo após o `FinancasChat`/"Controle Financeiro"), além da `/financas`. Foi removida em jul/2026 e **reintroduzida a pedido** do usuário (decisão consciente de manter o selo BACEN). Obs.: o "BACEN · Open Finance" do hero/rodapé/FAQ segue removido — só a **seção** voltou.
- **Extrato de conta bancária** (`components/contas/DetalhesContaModal.tsx`): clicar na caixa "Saldo atual" do card em `/contas-bancarias` abre um modal com saldo, navegação por mês, entradas/saídas/saldo-do-mês, saídas por categoria e movimentações (+entrada verde / −saída vermelha). Espelha o `DetalhesCartaoModal` mas mostra os DOIS fluxos (débito sai da conta). Casa transações por `carteira_nome`.
- **Excluir conta com transações** (`components/contas/ExcluirContaModal.tsx` + backend `DELETE /wallets/:id`): antes deixava transações órfãs; agora, se a conta tem lançamentos, o backend responde 409 e o painel pergunta **mover pra outra conta** ou **excluir junto** (usado em contas-bancarias E cartao-de-credito). Ver memória `project-carteira-fantasma`.
- **Prevenção de conta-fantasma** (backend `handlers/transacoes.js`): `resolverCarteiraReal()` (exato→sem ruído→palavra→fuzzy Levenshtein) casa a conta citada pela IA com uma wallet real; se não achar e o user citou conta, PERGUNTA de qual foi (nº ou nome). Guardrail no import (`routes/transacoes.js`) reconcilia `carteira_nome` → 'Dinheiro' se não existir. "quiosque" → Alimentação no `categorizar.js`.
- **Fix "phone obrigatório" no Grow** (backend `routes/grow.js`, `saude.js`, `dados.js`): `requireGrow`/`requirePremiumGrow` NÃO exigem mais `phone` (o usuário vem do JWT via `req.authUser.id`); antes editar tarefa/consulta/Drive dava 400.
- **Fix CLS na landing** (`components/landing/SocialProof.tsx`): depoimentos empilhados em grid ([grid-area:1/1]) + altura fixa dos avatares → sem pulo ao trocar de depoimento.
- **Ícone da PWA no iOS** (`app/layout.tsx`): `apple-touch-icon` agora é `/sora-icon.png` (verde full-bleed) em vez de `/brands/sora.png` (círculo transparente → borda branca). iOS precisa REINSTALAR o PWA pra atualizar o ícone.
- **Categorias v3 — taxonomia refeita** (migrations **084/085/086/087**): `criar_categorias_padrao` redefinida com a taxonomia nova (despesas + receitas), `unique(grupo_id, nome)` força nome único no grupo, e a **087 remapeia transações** das categorias antigas pras novas. A aba `/categorias` mostra **despesas E receitas juntas** com filtro (o botão de alternar saiu). ⚠️ O **categorizador é acoplado aos NOMES** (`categorizar.js`/`.ts` + `ia.js`) — renomear categoria exige mexer lá. Memória `project-categorias-v3`. Gotcha da 087: `for r in (values …) as t(...)` é inválido em PL/pgSQL — usar `for r in select … from (values …) as t(...)`.
- **Marcas personalizadas** (migration **083** `marcas_personalizadas`): o usuário sobe a logo de uma loja e ela casa por nome na transação (igual iFood/Nike). `MarcasCustomContext` + `CategoriaIcon` (prioridade máxima no ícone) + gerenciador "Minhas marcas" na aba Categorias, com **zoom/enquadramento livre** da imagem dentro do círculo. Memória `project-marcas-personalizadas`.
- **Import OFX robusto** (`components/transacoes/ImportarModal.tsx`): o parser agora fatia por `<STMTTRN>` (SGML sem tag de fechamento) e trata decimal com vírgula. Alguns bancos (ex.: **Mercado Pago**) exportam um "OFX" que na prática é PDF/extrato — o painel avisa isso na tela de importação. Nubank funciona.
- **Dívidas com imagem** (migration **088** `divida_imagem`): mesma organização por foto que já existia em metas.
- **Fix do checkup de hábitos** (`app/grow/habitos/page.tsx`): marcar rápido 2 hábitos perdia um. Causa: otimista com `revalidate:false` sem reconciliar. Fix = **revalidação debounced (600ms)** no `finally` do toggle. Esse é o padrão pra qualquer toggle rápido.

---

## Negócios 2.0 — multi-empresa + negócio FÍSICO (5 fases, EM PRODUÇÃO jul/2026)

A aba Negócios era 100% infoprodutor. Agora atende **loja física** e **múltiplas empresas** (ilimitadas no Premium). Detalhes/pegadinhas: memória `project-negocios-multiempresa`.

- **`empresas`** (migration 090): cada empresa tem `tipo` (`digital`|`fisico`|`hibrido`), logo (data URL, sem bucket — mesmo padrão de marcas), cor de destaque e ícone. **A aba SE ADAPTA ao tipo** — gates `mostraCaixa`/`mostraIntegracoes` em `lib/empresas.ts`. Loja física não vê "Integrações"; digital não vê "Caixa".
- **Empresa ativa por usuário** (`lib/useEmpresaAtiva.ts` + localStorage `sora-empresa-ativa:<userId>`). Componentes: `SeletorEmpresa` (dropdown desktop / bottom sheet mobile), `ModalEmpresa`, `EmpresaAvatar` (iniciais com contraste por luminância WCAG).
- **Caixa** (`/negocios/caixa`, `lancamentos_negocio` migration 091): entradas/saídas, saldo do dia. **Pendente NÃO entra no saldo realizado.**
- **Contas a pagar** (`/negocios/contas`): saída `status=pendente` + vencimento. Uma tabela resolve caixa E contas. Baixa otimista.
- **Equipe/folha** (`/negocios/equipe`, `funcionarios_negocio` migration 092): folha SIMPLES (registro de pagamento, **sem encargos CLT** — decisão consciente). "Pagar" gera lançamento de saída categoria `folha` (não cria estrutura paralela → entra no caixa e no DRE).
- **DRE unificado** (`handlers/negocios.js gerarDre`): agora **por empresa** (era por user_id) e soma o caixa (entrada→receita, saída→custo; só PAGO). Loja física passou a ter DRE.
- **Lembretes de graça:** `agendaFeed.montarFeed` ganhou as fontes `conta_negocio` e `folha` (evento virtual via `ocorrenciasMensais`) → contas/salários vencendo entram no **briefing matinal do WhatsApp** sem cron novo (o briefing já consome o feed).
- **Mock REMOVIDO:** não existe mais `MOCK_DRE`/`DemoBanner`. Sem empresa → onboarding; sem lançamento → zerado (`DRE_ZERO`).
- ⚠️ **Pegadinha resolvida:** `conciliacao_negocio` é a ÚNICA tabela de negócios só com `user_id` (sem grupo_id); `dre_snapshots` unique virou `(empresa_id, periodo)`. Ao mudar constraint, procurar todo `onConflict`/`upsert` que a referencia (isso quebrou o "Atualizar" do DRE entre a 090 e a fase 5).

## Sora Negócios — painel próprio (reconstrução em 7 fases, jul/2026)

Negócios deixou de ser um item da barra do app pessoal e virou **painel irmão do
Sora Labs**: switcher com 3 opções (Sora · Sora Negócios · Sora Labs), navegação
própria e seletor de empresa no topo da sidebar. Plano completo e decisões
aprovadas (ordem das fases, nota fiscal adiada, folha simples + cálculo opcional,
plano pago à parte): memória `project-sora-negocios-fases`.

### ⚠️ ESPAÇAMENTO PADRÃO — vale pra TODA tela do painel

**O container é do LAYOUT, não da página.** `app/negocios/layout.tsx` já envolve
tudo em `max-w-7xl mx-auto w-full`. Tela nova **NÃO declara `max-w-… mx-auto`
no bloco raiz** — devolve só o conteúdo.

> Bug real que gerou a regra: cada página trazia o próprio container (`7xl` no
> Fluxo de caixa, `5xl` no DRE, `3xl` no Insights, `6xl` no Vendas…). A borda
> **pulava de largura ao trocar de aba** e o painel parecia remendado.

Continua valendo dentro do container: `max-w-md mx-auto` em empty state estreito
(paywall, "sem empresa") — isso é **conteúdo**, não container.

### Estrutura (o que garante navegação sem delay)

- **`app/negocios/layout.tsx`** — monta `DashboardLayout` + `EmpresaProvider`
  UMA vez. ⚠️ Página do painel **não importa `DashboardLayout`** (aninharia dois
  shells e traria de volta o remount que causava o delay: antes, cada uma das 11
  páginas montava o próprio, e trocar de aba desmontava sidebar, tema e auth).
- **`components/negocios/EmpresaContext.tsx`** — empresa ativa do painel inteiro.
  Estado DERIVADO (sem `useEffect` sincronizando com props, que dava render em
  cascata e flash de "sem empresa"). Expõe `abrirCadastro()` — o `ModalEmpresa`
  vive no shell e é alcançável de qualquer tela.
- **`lib/negocios-nav.ts`** — FONTE ÚNICA das rotas, agrupadas (Visão geral ·
  Dinheiro · Operação · Gente · Canais). `tipos` esconde o que não faz sentido
  (loja física não vê Integrações; digital não vê Estoque). `breve: true` mostra
  a rota das próximas fases como "em breve" em vez de levar a 404.
- **`app/negocios/loading.tsx`** — skeleton do segmento, no formato do conteúdo
  real (bloco de tamanho errado = salto de layout quando o dado chega).
- **BottomNav tem modo Negócios** — sem ele, cada toque no mobile jogava o
  usuário de volta pro app pessoal.

### As 7 fases — TODAS EM PRODUÇÃO (jul/2026)

Migrations **105→109** (rodar à mão no Supabase). Cada regra de dinheiro nova
tem **eval próprio**: `npm run eval:dre | eval:estoque | eval:folha |
eval:insights-loja | eval:venda-texto`. Erro nesses cálculos **não estoura** —
vira número plausível e errado que o dono usa pra decidir preço.

- **Fase 1 — painel da loja** (`GET /indicadores/:phone` numa chamada só) +
  centro de custo (105).
- **Fase 2 — clientes, produtos e vendas** (106). ⚠️ **VENDA GERA LANÇAMENTO
  NO CAIXA** (à vista = pago, a prazo = pendente = conta a receber). Não existe
  caixa de vendas paralelo — é o que faz DRE e indicadores enxergarem a venda
  sem ponte. **`venda_itens` congela preço E custo**: reprecificar não pode
  reescrever a margem de ontem.
- **Fase 3 — estoque e compras** (107). Custo médio móvel em
  `services/estoque.js` (só muda na ENTRADA). Compra "só pedi" não entra no
  estoque; "recebi" dá entrada e recalcula o custo.
- **Fase 4 — DRE gerencial** (108, `services/dre.js`). ⚠️ **COMPRA DE ESTOQUE
  NÃO É DESPESA**: saída com `compra_id` sai das despesas e vira **CMV** no mês
  em que o item é VENDIDO (pelo custo congelado). Sem isso o mês de
  abastecimento fica no vermelho e o seguinte com margem irreal. Despesa **fixa
  × variável** (mapa em `NATUREZA_PADRAO`, coluna `natureza` vence o mapa)
  existe só pra ter **ponto de equilíbrio** — `null` quando não há receita ou a
  margem de contribuição é negativa (zero leria como "já empatou"). **Mês em
  curso é sempre recalculado**; mês fechado usa o snapshot.
- **Fase 5 — equipe** (109). Comissão **congelada na venda** (`comissao_valor`)
  e `comissao_paga_em` impede pagar duas vezes. Encargos (FGTS/13º/férias +
  **FGTS sobre as provisões**) são **estimativa gerencial opt-in** com aviso de
  contador — desligados porque no Simples I–III a patronal já está no DAS.
  Separar **a pagar** (sai do caixa) de **custo** (com provisão) é o ponto.
- **Fase 6 — insights de loja** (`services/insightsLoja.js`) calculados **AO
  VIVO** (insight de ontem sobre estoque já reposto destrói a confiança na
  tela). Duas regras: **nada abaixo de R$ 50 vira alerta** e a ordem é por
  **ameaça ao caixa**. Mais **venda por WhatsApp** (`services/vendaTexto.js` +
  `handlers/vendaNegocio.js`, local-first): "vendi 3 bolos por 90 pra dona
  Maria". Valor dito = **TOTAL** ("cada" multiplica); **sem valor E sem
  quantidade não é venda** ("vendi bem hoje"); pergunta nunca vira lançamento;
  **fiado vira conta a receber**. Roda no webhook ANTES do Grow e **só com
  empresa física/híbrida cadastrada** — em conta pessoal "vendi meu celular por
  500" é receita.

> **Adiado de propósito:** NF-e (decisão do usuário, entra depois das 7 fases).

## Painel admin — MRR (correções jul/2026)

`/admin` são **Route Handlers do Next** (`app/api/admin/*`), não o backend Express — usam `supabaseAdmin`. MRR calculado em `app/api/admin/overview/route.ts`.
- **MRR mensal** = só pagantes de intervalo **mensal** (ou null). **Anual é pré-pago → fora do MRR mensal** (contava anual pelo preço mensal = inflava). Retorna `anuais`/`recorrentesMensais` pro breakdown.
- **Colunas 074:** `mrr_excluir` (flag admin de cortesia) + `assinatura_cancelada` (webhook Stripe). Fora do MRR: vitalício, cancelado, mrr_excluir, e-mail admin, anual.
- **Badges no card:** `Recorrente` (pagante ativo não-cancelado), `Anual` (azul), `Cancelou`, `Vitalício`. **Filtros:** Recorrentes · Anuais · Vitalícios (+ os antigos).
- ⚠️ **Toggle dentro de `<label>` dispara 2×** (label reencaminha o clique pro button) → use `<button>` na linha inteira, nunca `<button>` aninhado em `<label>`.

## Fatura do cartão = CICLO REAL de fechamento (jul/2026) — fonte única

A fatura **NÃO é o mês-calendário**. Vai do dia seguinte ao fechamento anterior
até o fechamento — uma compra em 30/07 e outra em 01/08 caem na **mesma** fatura
se o cartão fecha dia 5. (Era a queixa de um cliente; antes havia **5 regras de
período** coexistindo, o que já causou "fatura zerada no zap × R$ 146,89 no painel".)

- **Aritmética canônica:** `sora-backend/src/services/cicloFatura.js`, espelhada
  **fielmente** em `sora-frontend/lib/ciclo-fatura.ts`. Mexeu num, mexa no outro e
  rode os DOIS evals (`npm run eval:ciclo` nos dois repos) — o do front compara
  1313 casos campo a campo contra o backend. **Backend é canônico.**
- **`competencia` = 'YYYY-MM' do VENCIMENTO** ("fatura de agosto" = vence em
  agosto, igual Nubank/Itaú). É a chave de `pagamentos_fatura` e `fatura_rollover`
  (096) — e é **única por ciclo**, o que a `unique(cartao_id, competencia)` exige.
- **Clamp ao ÚLTIMO DIA do mês, NUNCA a 28** (`sql/068` já aceita 1..31; 10 cartões
  da base fecham 29/30/31). Cartão que fecha 31 fecha em 28/02 em fevereiro. Ciclos
  consecutivos têm de ser **contíguos** (sem gap nem overlap) — o eval trava isso.
- **`competenciaAtual` = 1º ciclo com `venc >= hoje`**, e olha **1 mês pra trás**:
  quando `venc <= fech` (28 cartões da base), a fatura que vence hoje fechou no mês
  passado — sem isso ele pula pra fatura errada.
- **Cartão sem `dia_fechamento` → mês-calendário** (comportamento legado; quem não
  configurou não sente mudança). **Open Finance continua por `−saldo`** (ver regra
  de ouro abaixo) — não somar transações nele.
- **Datas em `hojeSP()`, nunca `toISOString()`** (é UTC: às 21h BR já é o dia/mês
  seguinte e o pagamento ia pra fatura errada).
- O painel soma filtrando **todas** as transações pelo `[ini, fimExcl)` do ciclo —
  **não** dá pra buscar por mês (o ciclo cruza meses). Fonte em lote pro painel:
  **`GET /api/wallets/faturas/:phone?offset=0`** (offset navega FATURAS, não meses),
  que devolve período, vencimento, `restante` e `vencida` (fatura anterior que
  venceu e ainda tem saldo — não esconder dívida do usuário).
- O rollover ancora o "Fatura anterior" no **`ini` do ciclo seguinte** (era o dia 1
  do mês, podia cair na fatura errada).
- ⚠️ Fatura em aberto **não** é `pago=false`: gasto em cartão nasce `pago=true`
  (por isso o aviso do cron quase nunca saía). Use `statusFatura` (fatura do ciclo
  − `pagamentos_fatura`).
- **Fora de escopo (decisão consciente):** "contabilizar a fatura pelo mês do
  pagamento" (regime de caixa) — mexeria em dashboard/categorias/relatórios/Wrapped.

## Fatura: crédito ABATE, pagamento é NEUTRO (ago/2026) — fonte única

A fatura só sabia **somar**. Os **7** pontos que a calculavam filtravam
`tipo === 'Gasto'` e **descartavam todo crédito** — estorno, cashback,
"Crédito de parcelamento de compra". Estorno de R$ 40 não abatia nada: a fatura
da Sora ficava R$ 40 maior que a do banco **para sempre**, e o limite
comprometido nunca voltava. (Cliente Nubank conferia lançamento por lançamento
todo mês.)

- **Aritmética canônica:** `sora-backend/src/services/valorFatura.js`, espelhada
  **fielmente** em `sora-frontend/lib/valor-fatura.ts`. Mexeu num, mexa no outro
  e rode `npm run eval:valor-fatura`.
- **A soma é ASSINADA:** compra `+valor` · estorno/cashback/crédito `−valor` ·
  **pagamento da fatura `0`**. O pagamento já abate por `pagamentos_fatura`
  (`restante = fatura − pago`) — contar nos dois lugares tira o valor **em dobro**.
- **A regra é ESTREITA de propósito:** só abate `Recebimento` **+**
  `transferencia = true` **+** categoria ≠ Fatura. Sem a condição de
  `transferencia` eu abateria os `📦 Importado` de OFX (um de R$ 2.129,45 com
  cara de pagamento) e um `Salário` lançado por engano na carteira do cartão.
  **Medido nos 102 cartões da base: ZERO faturas mudam de valor.**
- **`normalizeTxCartao` separa `pagouFatura` de `creditoAjuste`.** Antes os dois
  saíam como `categoria: 'Fatura'`, indistinguíveis. Crédito nasce
  `CATEGORIA_ESTORNO` (`'Reembolso'`, já existe na taxonomia v4 — **sem migration**)
  e ambos seguem `transferencia: true`, então estorno **não vira "receita comum"**.
- ⚠️ **`ehPagamentoFaturaCat` normaliza emoji/acento.** O `ehPagamentoFatura` do
  catálogo compara a string EXATA, então `'💳 Fatura'` devolvia `false` — e a
  linha viraria abatimento, derrubando a fatura indevidamente.
- **Rollover intacto:** "Fatura anterior" é `Gasto` com `transferencia=true` e
  continua **somando**. **Open Finance por `−saldo` intocado.**
- O ranking por categoria do `DetalhesCartaoModal` segue **só com `Gasto`** —
  crédito viraria barra negativa. O abatimento aparece no **total**.
- Lançar estorno à mão: toggle **"Estorno / crédito na fatura"** no
  `NovaTransacaoModal` (só com cartão selecionado; o seletor esconde cartão
  quando o tipo é Recebimento, então é a única porta de entrada).

> **Pendente:** "Pix no crédito/NuPay não importa" — única queixa não
> diagnosticável pelo código. Suspeito nº 1: `if (!redistribuida && data > hoje)
> return null` em `normalizeTxCartao` (Pix parcelado **sem** marcador "N/M" é
> descartado). **Não mexer sem o payload cru** — é a mesma linha que impede
> parcela virar despesa em 2027.

## Fatura EM CURSO também tem parcela a vencer (ago/2026)

Relato: fatura atual **R$ 706,08** no app do Itaú × **R$ 218,70** na Sora.

A projeção da migration 116 excluía a **competência atual inteira**, com a
justificativa de que *"a compra do ciclo em curso já veio pelo extrato"*. A
justificativa vale pra **COMPRA (parcela 1)**, não pra **PARCELA** — e o Itaú
também não manda o marcador "N/M", então a parcela 5/9 de R$ 347,52 de uma
compra de abril não é transação nenhuma: só existe em `parcelamentos`.

- **A prova está na fatura JÁ FECHADA do mesmo cartão:** R$ 2.406,28 de
  transações + R$ 347,52 da parcela 4/9 = **R$ 2.753,80**, exatamente o total
  que o banco publicou. O banco cobra a parcela; nós é que não a víamos.
- ⚠️ **O `simulated_bill_total_amount` TAMBÉM não a inclui** — veio 218,70, que
  é exatamente a soma das transações do ciclo. Parcela a vencer ainda não é
  "débito sem fatura", então fica de fora dele. Por isso o ramo **simulada**
  do `faturaVista` soma as previstas (`fonte: 'simulada+previstas'`).
- ⚠️ **A parcela 1 NUNCA é projetada na competência da compra** — é ela que
  chega pelo extrato. É o que impede a contagem em dobro.
- ⚠️ **No ciclo em curso a dedup é MAIS RÍGIDA**: vale também transação **sem
  marcador**, desde que caia dentro do ciclo e bata **no centavo**. Em
  competência futura esse casamento por valor não existe de propósito — lá
  qualquer compra de valor parecido cancelaria uma parcela real.
- **`lerPrevistas` virou fonte única** e o `agendaFeed` passou a usá-la: sem
  isso a agenda mostraria a fatura **sem** as parcelas, divergindo do painel —
  exatamente o que o `faturaVista` existe pra impedir.
- **Raio de impacto medido:** 29 cartões de OF, 12 com projeção, **zero** linhas
  na competência atual hoje → a mudança é **inerte até o sync regravar**. 15
  cartões estão no ramo simulada e podem ganhar valor.
- Travado em `eval:parcelas-previstas` (§5 reescrito — cravava a premissa
  derrubada — e §5B novo) e `eval:fatura-vista` §2B.

> **Pendente medido:** sobram **R$ 139,86** nesse cartão (218,70 + 347,52 =
> 566,22 × 706,08 do banco). Não dá pra fechar sem o payload cru de
> `parcelamentos` — a suspeita é um parcelamento cuja ÚLTIMA parcela cai no
> ciclo em curso, que não deixa rastro na projeção gravada (só grava o futuro).
> Conferir com `/api/admin/of-debug?email=<cliente>&resumo=1`.

## ⚠️ DOCS DA CELCOIN SALVOS EM `sora-backend/docs/celcoin/` (ago/2026)

Os **35 docs** da Polp/Celcoin estão versionados em texto no repo. Consultar
ALI antes de supor qualquer campo — foi supor que custou um dia inteiro de
correções erradas na fatura de um cliente.

- `docs/celcoin/baixar.js` reatualiza a cópia (`node docs/celcoin/baixar.js`).
- ⚠️ **O HTML É LEGÍVEL POR `curl`.** O CLAUDE.md dizia que "não lê, use
  browser" — está errado, o conteúdo vem no HTML servido.
- Nomes: `credit-cards__installments.txt`, `bills__transactions.txt`, etc.

### O que os docs corrigiram das nossas suposições

| Suposição que estava no código | O que o doc diz |
|---|---|
| `/installments` não traz a data da compra | **Traz `purchasedAt`** (não documentado, mas vem no payload) |
| `paidInstallments` = quantas parcelas vieram | **É o MAIOR `charge_identificator` observado** — com histórico truncado vem 3 com uma ocorrência só |
| `occurrences` é só contagem | São os **IDs das transações**, ordenados por `charge_identificator` |
| `available_amount` pode incluir a aplicação | **Não inclui** cheque especial, investimentos automáticos nem reservas |
| — | `GET /bills/{bill}/transactions` lista as transações **de uma fatura específica** (ainda não usamos) |
| — | `simulated_bill_total_amount` = "soma dos débitos **sem fatura** no ciclo atual, após o último `bill_closing_date`, até +31 dias" |

## A fatura divergente NÃO era erro de cálculo (ago/2026)

Relato: fatura do Mercado Pago **R$ 1.596,17** no banco × **R$ 1.319,66** na
Sora, depois de meses de divergências em vários clientes.

Medido com o payload **VIVO** da API (`/api/admin/of-debug`):

```
descrição      charge   data crua    → data que o sync calcula
CHINOCA         1/3     2026-06-20     2026-06-20
CHINOCA         2/3     2026-06-20     2026-07-20   ✓
CHINOCA         3/3     2026-06-20     2026-08-20   ✓
PayU *ADI       2/2     2026-07-14     2026-08-13   ✓
JIM.COM PROSED  2/2     2026-08-03     2026-09-03   ✓
```

**Tudo certo.** O emissor manda TODAS as parcelas com a data da COMPRA, e
`normalizeTxCartao` já as desloca pra compra + (N−1) meses usando
`charge_identificator`/`charge_number`.

- ⚠️ **O QUE FALHAVA: o histórico nunca era reescrito.** Essas linhas já
  existiam no banco com a data da compra (importadas antes desse cálculo), e
  `inserirTransacoes` dedupa por `of_tx_id` — a data certa nunca chegava à
  tabela. A fatura da compra ficava inflada e as seguintes vazias, **para
  sempre**. `reconciliarParcelas()` fecha isso.
- ⚠️ É **exceção estreita** à regra "o sync nunca reescreve linha existente":
  a regra protege a **categoria** corrigida à mão. Aqui só `data`, `pago` e os
  campos de parcela são tocados.
- ⚠️ **LIÇÃO DE MEDIÇÃO:** cheguei a construir uma redistribuição por
  `occurrences` inteira porque medi "8 dos 29 cartões não recebem marcador" —
  **medido no NOSSO BANCO**, que reflete linhas antigas, não a API. Na API o
  marcador vem. Medir o sintoma no lugar da origem gerou código de risco pra
  um problema inexistente (removido).
- Travado em `npm run eval:reconciliar-parcelas` (payload real do cartão).

## Fatura: pagamento do banco e parcelas a vencer (ago/2026)

Duas metades do mesmo relato ("o card do cartão continua completamente bugado").

**1. O pagamento vinha e não contava.** O sync JÁ importava o pagamento da
fatura como transação (`Recebimento` + `transferencia`, categoria Fatura), mas
nada chegava em **`pagamentos_fatura`** — a tabela de onde sai
`restante = fatura − pago`. Então `pago = 0` pra sempre e a fatura nunca ficava
quitada. `faturaRollover.registrarPagamentosDoOF` fecha isso no fim do laço de
cartões do `polpCelcoinSync`.
- **Competência = vencimento MAIS PRÓXIMO da data do pagamento**
  (`competenciaDoPagamento`), mesma ideia do `vencimentoCoberto` das dívidas:
  pagar 12/07 quita a que vence 13/07; pagar 20/07 quita **a mesma**, atrasado,
  não a de agosto. Escolher "a próxima a vencer" jogaria todo atraso pra frente.
- **Idempotente por `transacao_id`** (o sync roda todo dia) e tolerante: falha
  aqui não derruba o sync. **Sem `dia_vencimento` não grava** — sem ciclo o
  "mais próximo" compara com o último dia do mês e erra a fatura.
- **Raio de impacto medido antes de ligar:** 113 cartões (7 de OF) → 39
  pagamentos registrados em 5 cartões e **1 único cartão** muda de
  comportamento na tela.
- ⚠️ **Só encerra a fatura o pagamento feito DEPOIS do fechamento**
  (`quitadaDepoisDoFechamento`). No Mercado Pago é comum abater a fatura em curso
  aos poucos — medido nesta conta: fatura de agosto R$ 2.804,28, abatida em
  R$ 2.243,60 no dia 03 (fechando dia 08), e o banco passou a publicar
  R$ 560,68. Ela seguia **aberta**; quem a encerrou foi o pagamento de R$ 565,68
  no dia 09. Contar o abatimento como quitação dava fatura "paga" de pé.
- **Pulo pra fatura seguinte é decisão de TELA** (`DetalhesCartaoModal`): abre em
  `offsetMes = 1` quando o servidor diz `fechada && quitada`. `competenciaAtual`
  (eval de 1313 casos) fica intocada.
- ⚠️ **Não deslocar a fatura "atual" pra frente.** Já tentei: assumi que o valor
  do banco era da fatura NOVA e abri o modal na seguinte. É o contrário — o
  `simulated_bill_total_amount` é o saldo da fatura que **fechou**, e o
  deslocamento jogou o valor dela por cima da fatura em curso. A única regra é
  "fechou E foi paga".

**2. Parcelas que só o banco conhece.** A fatura de setembro saía **R$ 282,27**
onde o app mostrava **R$ 558,78** — faltavam Prosed 79,86 + PayU Adidas 139,99 +
Chinoca 56,66. O Mercado Pago manda parcela **sem o marcador "N/M"**, e é dele
que a redistribuição do sync depende: a 2ª parcela nunca vira transação, só
existe no endpoint `parcelamentos`. `services/parcelasPrevistas.js` +
migration **116**.
- **NÃO vira transação.** É projeção: apagada e regravada a cada sync. (Já
  existiu uma `sql/078` só pra limpar parcela futura importada como gasto.)
- **Dedup por INSTANTE DA COMPRA** (ao segundo) + nº de parcelas + valor ±R$1.
  A Polp manda a mesma compra duas vezes com descrição e 1 centavo diferentes
  (`JIM.COM PROSED ES` 79,86 × `JIM.COM PROSED ESPECIALID` 79,87) — casar por
  descrição devolvia **zero** duplicatas justamente aí.
- **Guiada por DATA, nunca por `paidInstallments`** (a Polp erra: o Chinoca vinha
  "3 de 3 pagas" com uma por vencer).
- ⚠️ **`jaEhTransacao` impede a contagem em dobro**: cartão que manda "N/M"
  (Nubank) já tem a parcela futura lançada — projetar por cima faria a fatura
  sair MAIOR que a do banco, o inverso do bug de origem.
- **Só competência FUTURA.** No ciclo em curso a compra já chegou pelo extrato.
- **Pode dar 1 centavo a mais por compra**: a API informa a parcela NOMINAL e o
  banco arredonda na ÚLTIMA. Por isso a tela rotula "Previstas pelo banco" e diz
  que aproxima — inventar a diferença seria pior.
- Travado em `npm run eval:parcelas-previstas` e `npm run eval:pagamento-fatura`.

**3. Quem decide o VALOR exibido: `services/faturaVista.js`** — fonte única das
duas rotas de fatura (`/fatura/status` e `/faturas`) e do feed da agenda, que
antes decidiam cada uma a sua e faziam as telas divergirem no mesmo cartão.
Ordem de prioridade, do mais confiável pro menos:
1. **Fatura PUBLICADA pelo banco** (`of_faturas`, migration 118) — a verdade.
   `bill_total_amount − payments[]`, o número que o cliente vê no app do banco.
2. **SIMULADA** (`simulated_bill_total_amount`, chega em `wallets.saldo`) —
   pro ciclo que o emissor ainda não publicou. ⚠️ Já vem **líquido de
   pagamentos** (não descontar `pago` de novo).
3. **Soma do ciclo + parcelas previstas** (migration 116) — fallback pra fatura
   que ninguém publicou nem simulou. Medido: 282,27 + 276,51 = **558,78**.
4. **Cartão manual → `fatura − pago`**, como sempre.

## Pagamento da fatura: CADA BANCO TEM A SUA FRASE (ago/2026)

Continuação direta da migration **119** (Nubank, "Pagamento recebido"). O
relato era *"o saldo/fatura não bate"*; o diagnóstico mostrou as duas faturas
de agosto do cliente **integralmente em aberto** (R$ 2.753,80 + R$ 13.123,09)
mesmo tendo sido pagas por débito automático.

- **Causa:** nenhuma dessas frases contém a palavra "fatura", então
  `ehPagamentoFaturaDescricao` não casa — de propósito, pra "pagamento pix"
  numa CONTA não virar transferência. A linha caía em `creditoAjuste` →
  categoria **Reembolso** → e passava a **ABATER** a fatura. E, por não ter
  categoria Fatura, nunca chegava em `pagamentos_fatura` (é o filtro de
  `registrarPagamentosDoOF`), então `pago` ficava 0 pra sempre.
- **Medido na base** (1.037 créditos em carteira de cartão, 36 como Reembolso):
  **12 são pagamento de fatura**, e a prova é que o valor **BATE com o total de
  uma fatura publicada pelo banco** —
  `PAGAMENTO DEBITO AUTOMATICO` (Itaú) 4x R$ 30.384,92 · `Obrigado pelo
  pagamento` (Visa Infinite) 3x R$ 2.188,71 · `Pagamento com saldo` (Itaú
  Click) 3x R$ 917,77 · `PAGAMENTO ON LINE` (Gold) 1x R$ 2.024,90.
- ⚠️ **A armadilha que define o formato da regra:** `PAGAMENTO CASHBACK TAG`
  (R$ 5,00 todo mês num cartão da base) tem a palavra "pagamento" e **NÃO é
  quitação** — é cashback, consumo que voltou, e tem de continuar **abatendo**.
  Procurar "pagamento" solto subiria a fatura desse cliente R$ 5,00 por mês do
  nada. Por isso a regra é de **FRASES INTEIRAS**, com o cashback barrado.
- **Escopo:** só crédito, só com `of_tx_id`, só em carteira tipo Crédito. Em
  DÉBITO a mesma frase segue sendo gasto. Migration **127** corrige o histórico
  (o sync nunca reescreve linha existente).
- Travado em `eval:pagamento-fatura` §4C.

## Investimento não salvava — CHECK de `tipo` + erro engolido (ago/2026)

Relato de cliente premium: *"tentei incluir valores nos investimentos, porém
não está salvando e atualizando"* — patrimônio R$ 0,00 com a conta saudável
(626 transações, 2 conexões OF ativas). **Nada a ver com Open Finance.**

- **Causa raiz:** a constraint `investimentos_tipo_check` rejeitava **5 dos 13
  tipos** que o modal oferece. Medido inserindo um de cada: passam Ações, FIIs,
  ETFs, Cripto, Tesouro Direto, Previdência, Imóveis e Caixa; **falham CDB,
  Renda Fixa, Fundos, Reserva e Negócio**. Prova de que nunca funcionou: a base
  inteira só tem 5 tipos distintos em 36 investimentos. Migration **121**.
- ⚠️ **Por que ninguém viu:** a rota fazia `const { data } = await
  ...insert()` e respondia `res.json(data)` — **sem ler o `error`**. Falha =
  `data` null = **200 OK com null**, e o painel fechava o modal achando que
  salvou. Corrigido no POST e no PUT (que tinha o mesmo defeito).
- ⚠️ **ISSO TAMBÉM EXPLICA O OPEN FINANCE:** `tipoInvestimento` classifica renda
  fixa bancária como **CDB**, crédito privado como **Renda Fixa** e fundos como
  **Fundos** — os três barrados. O "só apareceu renda variável na base" que eu
  havia registrado como *"pode ser ausência real de dado"* **não era**: era a
  constraint recusando o insert.
- **Bônus:** o modal já mandava `is_reserva_emergencia`, `taxa_anual`,
  `data_vencimento`, `indexador` e `percentual_indexador`, e a rota
  **descartava os 5**. Agora são gravados (o primeiro é o que faz o tipo
  "Reserva" contar na aba de reserva de emergência).
- **Mesma família do `users_plano_check`** (memória
  `project-plano-check-constraint`): valor novo na aplicação tem de entrar no
  CHECK, senão a gravação falha calada. A lista da 121 espelha `TIPOS` em
  `NovoInvestimentoModal.tsx` — mexeu num, mexa no outro.

## Renomear conta/cartão — `PUT /api/wallets/:id` (ago/2026)

Relato de cliente: *"bancos do Open Finance ficam com o nome 'Banco' e não
consigo renomeá-los. Edito, salvo, mas permanece 'Banco'."* **Era bug nosso, e
não tinha nada a ver com o Open Finance.**

- **Causa:** não existia `PUT`. O salvar era só
  `POST /api/wallets` com `upsert(onConflict: 'grupo_id,nome')` — a chave é o
  **NOME**. Mandar um nome novo não achava nada pra atualizar e **criava outra
  carteira**, deixando a antiga intacta. Valia pra QUALQUER carteira (contas e
  cartões), não só as do OF. O modal de cartão até mandava `id` no payload — o
  POST ignorava.
- ⚠️ **RENOMEAR TEM DE CASCATEAR.** Transação não aponta pra wallet por id: ela
  guarda **`carteira_nome` (texto)**. Renomear só a wallet transforma o
  histórico em conta-fantasma. Medido: as 4 carteiras chamadas "Banco" tinham
  **779 transações**. As únicas duas tabelas que ligam por nome são
  `transacoes.carteira_nome` e `recorrencias.carteira` (`dividas`/`metas` não
  têm a coluna).
- **Ordem importa:** renomeia a **wallet primeiro** (é onde o unique pode
  estourar, e falhar ali não deixa rastro), só depois as 700+ transações. Se a
  cascata falhar, **desfaz o rename** em vez de deixar histórico órfão.
- ⚠️ `%` e `_` são curingas no `ilike` — escapados, senão renomear "Banco_1"
  arrastaria as transações de "Banco11".
- **409 `nome_duplicado`** quando o nome já existe no grupo: além de quebrar o
  unique, fundiria duas contas na visão das transações (que casam por nome).
- ✅ **Seguro pro Open Finance:** o sync casa por `of_conta_id`, nunca por nome,
  e `upsertWallet` **não grava `nome`** em carteira existente (devolve
  `ja.nome`) — os lançamentos novos já entram com o nome escolhido. Renomear
  não desliga nem duplica a conexão.
- **Raiz do "Banco":** `brand_name` vem vazio em parte das contas. Agora
  `normalizeConta(acc, instituicao)` usa a instituição do consentimento como 2º
  recurso; "Banco" só sobra quando nem isso existe. Travado no
  `eval:celcoin` §6B. Carteiras JÁ criadas seguem com o nome antigo (o sync não
  reescreve nome) — o usuário renomeia à mão, que agora funciona.

## Detetive Watson interativo — painel + WhatsApp (ago/2026)

O motor de detecção (`services/duplicadas.js`) já existia e era testado, e a
rota `GET /api/transacoes/duplicadas/:phone` também — **mas o painel nunca a
chamava**. O agente só sabia falar sozinho depois do sync; não dava pra pedir.

- **Duas listas, NUNCA misturadas.** `analisar()` devolve `confirmadas` (o que
  ele **afirma**, com prova: mesmo milissegundo ou manual×banco) e `suspeitas`
  (o que ele **pergunta**: mesmo valor + descrição em ≤1 dia). ⚠️ A regra das
  suspeitas é a que, medida na base (4.357 gastos), acusa **27 pares em que a
  maioria é legítima** — por isso ela tem visual próprio, texto de dúvida,
  **nunca vem pré-selecionada e NUNCA entra no aviso proativo do WhatsApp**.
  Agente que grita lobo o usuário desliga. O eval trava que uma transação não
  aparece nas duas listas.
- **Escopo por FATURA ATUAL** (`?cartao=<wallet_id>`): usa `cicloFatura` — não
  filtra por mês, porque o ciclo cruza meses (mesma regra do resto do painel).
  Cartão sem `dia_fechamento` cai nos últimos N dias.
- **Painel** (`components/agentes/WatsonDuplicadas.tsx`, dentro do
  `AgenteDrawer`): exclusão **otimista com "Desfazer" por 10s** — some da tela
  na hora e só vai pro servidor depois. ⚠️ Se o drawer fechar com exclusão
  pendente, ela **acontece mesmo assim**: o usuário mandou apagar, sair da tela
  não é desfazer.
- **WhatsApp** (`handlers/duplicadas.js`, local-first, roda antes do FAQ):
  lista numerada → "apaga a 2" → **confirmação nomeando valor e data** → exclui.
  ⚠️ Nunca em um passo só: no zap não existe desfazer. Aceita *trocar* pra
  manter a outra cópia. **Relê do banco antes de apagar** — entre a listagem e a
  resposta o usuário pode ter resolvido pelo painel, e agir sobre contexto velho
  apagaria a transação errada. Só as **confirmadas** entram no zap.
- Gatilho estreito e travado em eval: *"paguei duas vezes o aluguel"* é relato,
  **não** vira investigação.
- Pendentes novos: `escolher_duplicada` e `confirmar_exclusao_dup`. **Sem
  migration** (reusa `transacoes_pendentes`). `npm run eval:duplicadas`.

## Caixinhas (saldos reservados) na aba Investimentos (ago/2026)

A Polp publicou `GET /accounts/{account}/reserved-balances` — é como as
**"Caixinhas" do Nubank** chegam pelo Open Finance. Antes disso `of_caixinhas`
(tabela da 069) só era escrita pelo trilho **Pluggy legado**: no trilho Celcoin,
que é o que roda hoje, ela tinha **0 linhas com 14 conexões ativas**.

⚠️ **Era dinheiro invisível, não enfeite.** A doc de `GET /accounts/{id}` diz
que `balance.available_amount` "não inclui cheque especial, investimentos
automáticos nem **reservas de saldo**". Quem tinha R$ 5.000 em caixinhas não os
via em lugar nenhum do painel. Pelo mesmo motivo, somar a caixinha à parte
**não duplica** nada.

- **Aritmética:** `normalizeCaixinha` em `polpCelcoinSync.js`, travada em
  `npm run eval:caixinhas`. Migration **120** (colunas de remuneração).
- ⚠️ **`available_amount` é um ARRAY**, não um valor — cada item é
  `{ amount, currency, remuneration? }`. Ler `.amount` direto devolve
  `undefined` e a caixinha entra **zerada**. Somamos todos os itens.
- ⚠️ **A chave é `reserved_identification`** (UUID do Open Finance), não o `id`
  — que a doc chama de "identificador **interno** da reserva".
- `amount` é **string com 2 a 4 casas** ("1000.0400") → `cent()` no fim da soma.
- **Só chamar quando `balance.has_reserved_balance === true`** (a doc manda).
  Lista vazia é resposta válida ("tem o produto, não tem reserva") — e aí a
  reconciliação apaga o que sobrou de um sync anterior. **A reconciliação só
  roda quando a leitura DEU CERTO**: reconciliar em cima de falha de rede
  apagaria todas as caixinhas do cliente.
- **Não conflita com investimento:** a doc diz que o endpoint "não inclui
  reservas atreladas a investimentos do CPF/CNPJ" — essas vêm pelas APIs de
  Investimentos.
- **Painel:** aba **Caixinhas** em `/investimentos` (só aparece quando existem)
  + card de atalho no Resumo. Total **separado** do investido — caixinha não tem
  aporte nem rentabilidade, então misturar sujaria a rentabilidade da carteira.

### Auditoria dos investimentos do OF (mesma leva)

- ⚠️ **`product` aninhado é LEGADO e pode vir `null`.** A doc (versão atual):
  "Campos de `product` passam a existir na **raiz**". O código lia **só o
  legado** — quando ele vinha null o investimento perdia ticker, nome, ISIN e
  datas de uma vez, e em renda variável um FII virava "Ações" (a classificação
  depende do ticker). `produtoDe()` agora lê **raiz primeiro, legado como
  fallback**; travado no `eval:celcoin` §12B.
- ⚠️ **Limite conhecido, sem solução na origem:** a Celcoin **não manda tipo de
  ativo** em renda variável (só `ticker` e `isin_code`). FII × ETF × ação sai de
  heurística "final 11 → FII", o que classifica **ETF como FII** (BOVA11,
  IVVB11) e direito de subscrição (final 12) como ação. Não inventar lista de
  ETFs conhecidos — envelhece mal.
- As 5 famílias **são** consultadas (`FAMILIAS_INVESTIMENTO`). Na base real só
  apareceu `variable_income` (10 posições) — nenhum CDB/fundo/Tesouro; sem
  acesso à API não dá pra saber se é ausência real ou dado não sincronizado.

## Open Finance: fidelidade da fatura ao banco (ago/2026) — leitura dos docs

Releitura completa dos docs da Celcoin (`polp.com.br/docs/celcoin`, renderizados
por JS — use browser) depois de um cliente relatar **app R$ 1.035,55 × banco
R$ 1.788,00** no Nubank. Três achados, todos com correção medida na base:

⚠️ **`simulated_bill_total_amount` NÃO é "a fatura atual".** O doc define:
"soma dos débitos **sem fatura** no ciclo atual (após o último
`bill_closing_date`, até +31 dias)". Ou seja, é o ciclo **seguinte ao da última
fatura PUBLICADA** — que só coincide com a atual quando o emissor publica em
dia. O Mercado Pago nunca publica a fatura em aberto, então lá o simulado é uma
fatura que **já fechou**: pendurá-lo na competência atual mostrava o valor de
uma fatura em cima dos lançamentos de outra (R$ 560,68 de agosto exibido como
setembro). `faturasBanco.competenciaDoSimulado()` resolve isso.

⚠️ **As faturas publicadas eram DESCARTADAS.** O emissor manda `due_date`,
`bill_closing_date`, `bill_total_amount` e `payments[]` a cada sync; a Sora
guardava só o ID da aberta e **reconstruía** o valor somando transações.
Reconstruir falha de três jeitos já vistos em produção: transação faltando,
carteira duplicada contando em dobro, e parcela sem "N/M" sumindo. Agora tudo é
persistido em `of_faturas` (118) e o valor vem pronto do banco.

⚠️ **"Pagamento recebido" (Nubank) ABATIA a fatura.** É como o Nubank descreve o
pagamento — sem "fatura" nem "cartão". O `ehPagamentoFaturaDescricao` exige as
duas palavras juntas **de propósito** (numa CONTA, "pagamento pix" não pode
virar transferência), então a linha caía em crédito de ajuste → Reembolso → e
abatia. Medido: R$ 2.293,71 de abatimento indevido levaram a soma do ciclo a
**−R$ 2.256,09**; na base inteira eram **5 linhas, R$ 4.694,21**. O fix é
**escopado ao cartão** (`normalizeTxCartao`): crédito num cartão com essa
descrição só pode ser quitação — cartão não recebe salário. Migration **119**
corrige o histórico (o sync nunca reescreve linha existente).
Estorno e "Crédito de parcelamento de compra" **continuam abatendo** — são
consumo que voltou, não quitação. Travado em `eval:pagamento-fatura` §4B.

Campos estruturados que o sync já prefere (e devem continuar vindo antes de
qualquer parse de descrição): `charge_identificator`/`charge_number` (parcela
N/M) e `category_ref = LOAN_PAYMENTS_CREDIT_CARD_PAYMENT`. ⚠️ O regex antigo
`credit\s*card\s*payment` **não** casava com esse enum — o separador é
UNDERSCORE, não espaço; agora há comparação direta.

> **Pendente conhecido:** carteira DUPLICADA ao reconectar o banco. Medido: 2
> grupos, 4 carteiras. O consent novo traz `of_conta_id` novo pro mesmo cartão
> físico, `upsertWallet` não reconhece, cria outra e o nome ganha " (OF)" —
> transações entram nas duas. Precisa de fix próprio (merge por
> `payment_methods.identification_number` + nome), com medição à parte.

## `unbilled_amount` 0 = emissor sem transação, não fatura zerada (set/2026)

Cliente com Banco Inter: **R$ 10.217,60 no painel × R$ 1.995,24 no banco**.

- ⚠️ **A definição do campo estava registrada pela metade.** A doc diz "soma das
  transações com `bill_id` null **e `bill_post_date` posterior a
  `bill_closing_date` + 1 mês**". É a cláusula do MÊS que faz o campo ser
  **parcela de fatura FUTURA**, não "fatura em aberto" — e é o que dá sentido à
  regra de ouro (`used − unbilled` = limite usado menos o que já está lançado
  para depois do próximo fechamento).
- ⚠️ **Ele é DERIVADO DAS TRANSAÇÕES.** Emissor que não as entrega manda **0**, e
  `used − 0` devolve o **limite usado inteiro** como se fosse a fatura. Medido:
  a Polp tinha **4 transações** desse cartão (1 no ciclo aberto), nós
  descartamos **0**, e o consentimento vinha `PARTIAL_SUCCESS` +
  `PARTIALLY_UNAVAILABLE_RESOURCES`. O `used_amount` é o único campo que vem
  **direto do emissor**, por isso é o único preenchido nesse cenário.
- **Não dá pra reconstruir**: nenhuma fórmula sobre esse payload chega em
  1.995,24 (as candidatas dão 8.690,81 e 9.259,74), e ali o `used_amount` é
  `CONSOLIDADO`/`LIMITE_CREDITO_TOTAL` — parece incluir linha de crédito além do
  cartão. Quem barra o número absurdo é `faturaVista.simuladoEhOLimiteUsado`.
- ⚠️ **A tela de cartões tinha uma SEGUNDA fonte da verdade.** `CartaoClient`
  calculava a fatura por conta própria e, no cartão de OF, usava `−wallets.saldo`
  direto — então o guard do backend não a alcançava. Agora ela lê o `restante`
  do payload de `/wallets/faturas`, que já buscava. O `ResumoCards` do dashboard
  sempre fez certo (`restanteApi ?? local`); era por isso que as duas telas
  mostravam números diferentes pro mesmo cartão.

### ⚠️ `payments[]` pertence à fatura SEGUINTE — por contrato, e JÁ ESTÁ TRATADO

"Um pagamento fica atrelado à fatura que fechar em seguida a ele" (doc da
Celcoin). Como se paga a fatura N−1 durante o ciclo N, o pagamento vem pendurado
na fatura **N**, em TODO emissor. No Itaú de um cliente as 12 faturas conferidas
tinham `pago[N] === total[N−1]` **no centavo** — parece bug clamoroso e **não é**.

`faturasBanco.pagoPorCompetencia` já atribui cada pagamento pela **DATA**
(migration **128**, rodada — 325 das 394 faturas da base já têm os pagamentos
datados), e `faturaVista` reporta `fonte: 'banco+datas'` quando isso acontece.
**Não "consertar" de novo.** O `pago` que o `/api/admin/of-debug` mostra é o
**BRUTO** (`pagoDaBill`), exposto só pra diagnóstico — não é o que a tela usa.

---

## Dívidas — vencimento respeita o PAGAMENTO (ago/2026) — fonte única

O card dizia *"Próxima parcela em 3 dias"* mesmo depois do usuário pagar: a
regra só olhava `dia_vencimento` + calendário, nunca o pagamento. (Caso real:
cliente quitou **16 dívidas** no dia 07, todas vencendo dia 10 — as 16
seguiram cobrando, no painel **e** no lembrete do WhatsApp.)

- **Aritmética canônica:** `sora-backend/src/services/vencimentoDivida.js`,
  espelhada **fielmente** em `sora-frontend/lib/vencimento-divida.ts`. Mexeu
  num, mexa no outro e rode `npm run eval:vencimento-divida`. Havia **5 cópias
  divergentes** da regra (card, resumo do painel, `ssr-data`, cron de lembrete
  e `agendaFeed`) — todas passaram a chamar o helper.
- **`vencimentoCoberto(pagamento, dia)`** = qual parcela aquele pagamento
  quitou: a ocorrência de `dia` **mais próxima** da data do pagamento. É o que
  separa *"paguei dia 07 a que vence dia 10"* (adiantado → pula) de *"paguei
  dia 12 a que venceu dia 10"* (atrasado → **não** pula a do mês seguinte).
  Esse falso positivo está travado no eval — é o erro fácil aqui.
- **Só anda PRA FRENTE.** Pagamento antigo nunca joga o vencimento pro passado.
  Dívida **sem pagamento registrado na Sora** — todas as do **Open Finance**,
  onde as parcelas pagas vêm do banco — dá o **mesmo** resultado de antes; o
  eval compara 20 casos contra a regra antiga pra provar regressão zero.
- **Clamp ao último dia do mês:** dívida que vence dia 31 vence em **28/02** —
  `new Date(Y, 1, 31)` rolava pra 03/03. Datas em `hojeSP()`, nunca
  `toISOString()` (UTC: depois das 21h no BR a parcela pulava de dia).
- O card mostra **"Parcela paga · próxima em Nd"** (verde) no lugar do alerta.

### Open Finance não duplica dívida cadastrada à mão

Quem lançou o empréstimo manualmente e depois conectou o banco ficava com
**duas linhas** do mesmo contrato — e a cópia manual costuma trazer o **saldo
devedor** no lugar do valor contratado, inflando o total devido (caso real:
`Empréstimo · R$ 18.255,88` convivendo com o `Credito Pessoal · R$ 8.000` que
o OF trouxe do mesmo contrato de 36×629,51).

`upsertDivida` (`polpCelcoinSync.js`) agora **adota** a linha manual em vez de
criar a gêmea — preserva o `id`, logo o histórico de `divida_pagamentos`, a
foto e o lembrete. O casamento (`mesmaDividaManual`) é **estreito de
propósito**: mesmo nº de parcelas + mesma parcela (±R$1) + mesmo banco no
credor/título. **O valor total fica FORA** — é justamente onde os dois
divergem. Deixar uma duplicata passar custa muito menos do que **fundir duas
dívidas diferentes** do usuário. Travado em `npm run eval:divida-duplicada`.

> ⚠️ Ao investigar "o OF importou errado", **confira `origem`/`of_id`/`created_at`
> antes**: neste caso a dívida acusada era `origem: 'manual'`, criada 8 dias
> **antes** de a conexão OF existir. O sync estava correto.

## Open Finance: franquia por plano + conexão avulsa pra QUALQUER plano (ago/2026)

**Franquia grátis** (`LIMITES.conexoes_of` em `lib/plans.ts`): **Básico 1 ·
Premium/Black 3 · vitalício 0** (ele não paga mensalidade nenhuma, então não
ganha franquia — cada conexão custa mensalidade nossa no agregador). Já estava
certo no código; o que faltava era a COMPRA da conexão extra.

**Não existe teto.** Além da franquia, QUALQUER plano — não só o vitalício —
compra quantas conexões extras quiser, uma a uma, R$6/mês (ou R$60/ano) cada,
numa assinatura separada da do plano (`/api/stripe/conexao-of`,
`subscriptionItems.update({ quantity: qtd })` com proration). O preço mora só
no texto de `ContratarConexao` (`app/open-finance/page.tsx`) — não existe
constante central pra não ter dois lugares pra desalinhar.

**Bug real corrigido:** cliente vitalício pagou a 1ª conexão e não conseguia
comprar a 2ª — a tela só mostrava um texto morto, sem botão. Causa:
`<ContratarConexao/>` só renderizava no painel de boas-vindas (`!liberado`,
zero conexões). Assim que ele tinha 1 paga, `liberado` virava `true` e ele caía
no ramo normal, que nunca oferecia comprar mais uma — nem pro vitalício nem pro
assinante Básico/Premium que batesse no teto da franquia. O backend sempre
funcionou; faltava o botão aparecer sempre que `noLimite`, pra qualquer plano.

⚠️ **A quantidade enviada é o TOTAL da assinatura, não um incremento.**
`ContratarConexao` manda `atual + 1` (prop `atual` = `of_conexoes_pagas`) —
reenviar sempre `1` fixo (como era) faria a 2ª compra "atualizar" a assinatura
de volta pra 1 em vez de somar.

**Básico no limite** mostra as DUAS saídas juntas, nunca uma escondendo a
outra: banner "Premium já vem com 3 grátis" + o card de comprar avulso —
porque conectar 2+ bancos costuma sair mais barato no upgrade do que pagando
avulso um a um, mas a escolha é do usuário.

## Open Finance (Polp) — teste fechado, fatura do cartão

Integração **funcionando** com banco real (Nubank + Mercado Pago). Allowlist nos
DOIS lados (`config/openFinanceAccess.js` no back — é quem autoriza de verdade —
e `lib/open-finance-access.ts` no front, que mostra a aba). Fora da lista: aba
"em atualização".

**REGRA DE OURO DA FATURA — não regredir:**
```
fatura do cartão = balance − parcelas a vencer
```
- O `balance` do cartão **NÃO é a fatura**: é o **limite usado**, e inclui parcela
  a vencer. Erra sempre PRA CIMA (medido: MP 904,71 × 708,06 real; Nubank
  5.349,63 × 2.845,20 real).
- **Parcelas a vencer = transações que a Polp manda com data no FUTURO**
  (ex.: `2027-03-13`, `"HOTEIS.COM 12/12"`, `status: PENDING`). Medidas, nunca
  projetadas — projetar a partir de `start_date × total_installments` deu
  6.379,06 onde o real era 2.504,43.
- O sync **não importa transação com data > hoje** (viraria despesa em 2027).
- Não depende de data de fechamento — que nem Nubank nem MP mandam
  (`balanceCloseDate: null`). Sem parcelamento, futuras = 0 → fatura = balance.
- `polpSync.normalizeConta` grava `saldo: 0` em cartão? **NÃO** — grava
  `-(balance − futuras)`. (O `pluggySync` legado zerava e deixava a fatura vir
  das transações; isso dá o mês do CALENDÁRIO, não o ciclo, e ignora o pagamento
  da fatura — deu 1410 onde o real era 708.)

**⚠️ NO TRILHO CELCOIN (v2) A REGRA DE OURO NÃO FECHA — medido em ago/2026:**
- `limits[].used_amount` **4.061,99** × fatura no app do Nubank **3.423,57** →
  sobram **638,42** de parcelas de faturas FUTURAS ocupando limite hoje.
- Não dá pra descontar: **transações com data futura vêm ZERO** (a Celcoin manda
  cada parcela com a data da **COMPRA**, ao contrário da Pluggy), e
  `parcelamentos` vem **DUPLICADO** (3 linhas pro mesmo Mercado Livre, com
  `paidInstallments` 5, 3 e 1) — somando dá 2.887,67 ou 1.159,49, nenhuma perto
  de 638,42.
- Por isso, **no Celcoin a fatura em aberto sai das TRANSAÇÕES do ciclo**
  (auditável: bate com a lista logo abaixo do valor na tela). Sai a MENOS quando
  há parcelamento, e o card **diz isso** em vez de exibir número redondo errado.
  O `used_amount` vai pra **barra de limite** (`wallets.of_limite_usado`,
  migration 110), que é o lugar dele.
- **Nunca exibir o limite usado como "Fatura atual".** Travado em
  `npm run eval:fatura-of`.
- ⚠️ **`escolherFaturaAberta` NÃO tem fallback pra "a mais recente"**: o emissor
  só publica a fatura depois que ela FECHA, então no meio do ciclo a lista para
  na passada. O fallback antigo elegia uma fatura fechada como atual e a tela
  somava as compras dela + as do ciclo novo (**5.013,99** onde o banco mostrava
  3.423,57). Sem fatura publicada à frente → `null`.
- ⚠️ **`pertenceAFatura` decide o critério UMA VEZ por fatura**
  (`criterioDaFatura`), nunca por transação: como o emissor só vincula depois do
  fechamento, o ciclo aberto tem linhas sem `of_bill_id` — decidir linha a linha
  misturava duas faturas.
- Diagnóstico pronto: **`/api/admin/of-debug?email=<cliente>`** (painel, logado
  como admin) mostra limite total/usado/disponível, `bill_total_amount` de cada
  fatura e o que cada regra daria.

**Bugs da POLP (reportados, não são nossos):**
- `GET /accounts/{id}/balance` → **HTTP 500** em conta CREDIT (funciona em BANK).
- `GET /accounts/{id}/installments` **não devolve `paid_installments`** (a doc
  cita o campo no texto). E `start_date`/`end_date` são a janela **observada**,
  não o cronograma → **esse endpoint não serve pra calcular parcela a vencer**.
- O mesmo parcelamento vem **duplicado** com cronogramas deslocados +1 mês
  (suspeita: o usuário mudou a data de vencimento no MP).
- MP não publica a fatura do mês (`List Bills` para no mês passado, já pago) nem
  parcela futura como transação — por isso **MP com parcelamento fica impreciso**.

**Doc da Polp:** https://polp.com.br/docs/pluggy — 37 páginas, renderizadas por
JS (curl não lê; use browser). `List Bills` = vencimento DESC, 15/página.

> Detalhes e o histórico do diagnóstico: memória `project-open-finance-polp`.

---

## Performance do painel — regras que não podem regredir

Otimização de jul/2026 (dashboard: mobile 45 → 64, desktop 45 → 82;
JS 3 MB → 1,16 MB; FCP 2,2s → 1,1s). O que quebrou e não pode voltar:

- **Fonte:** a Inter vem do `next/font` (self-hospedada) e o CSS a referencia por
  `var(--font-inter)`. **NUNCA** voltar com `@import url('fonts.googleapis...')`
  no `globals.css` — bloqueia o render por 830ms. Pedir `'Inter'` pelo NOME faz
  o CSS depender do @import e anula o next/font.
- **recharts (~288 KB + d3):** nunca importar direto numa página. O gráfico mora
  em componente próprio, carregado com `next/dynamic` + `ssr:false` + skeleton de
  altura igual (senão CLS). Ver `components/dashboard/GraficoGastos.tsx`.
- **Sidebar com `prefetch={false}`** (`components/layout/Sidebar.tsx`): ela fica
  sempre visível e o `<Link>` prefetcha a rota INTEIRA ao aparecer na tela — como
  /investimentos, /metas, /relatorios, /juros e /planejamento empacotam recharts,
  o dashboard baixava 3 cópias (864 KB) sem desenhar um gráfico.
- **`lib/useVisivel(ativo, margem)`:** adia trabalho abaixo da dobra. ⚠️ Só
  observe DEPOIS que o conteúdo principal chegou (`ativo = !!data`) — enquanto a
  página é skeleton ela é curta, tudo "parece" visível e o gate abre sozinho
  (medido: gráfico a 1227px com limite de 940px, carregado assim mesmo). Usa
  callback ref de propósito (com `useRef+useEffect`, nó não montado = `null` sem
  reexecução).
- **Meta Pixel em `lazyOnload`**: em `afterInteractive` o `fbevents.js` (103 KB)
  começava em 755ms, ANTES da `/api/dashboard` (1395ms). Analytics não compete
  com conteúdo.
- **`preconnect` pro backend** no `app/layout.tsx` (a chamada do LCP só sai após
  a hidratação e pagava DNS+TLS ali).
- **Medir sempre sem extensão** (janela anônima): Adobe Acrobat/adblock injetam
  script e sujam o resultado. E o Lighthouse roda em **emulação mobile** —
  desktop e mobile dão números bem diferentes.

### Rodada 2 (jul/2026) — SSR + dados diretos + cache — **EM PRODUÇÃO**

O que era "PENDENTE" (SSR) foi feito. A ordem antiga era `baixa JS → hidrata →
chama o Render → pinta`; agora o **servidor busca e o HTML já chega pintado**.
Regras que não podem regredir:

- **SSR por aba** — toda a navegação de Finanças é Server Component, no padrão:
  `page.tsx` (server, busca os dados) + `<Aba>Client.tsx` (`'use client'`) +
  `layout.tsx` (o `DashboardLayout`) + `loading.tsx` (skeleton).
  ⚠️ A key do SWR depende do `phone` — por isso o server passa **`phoneInicial`**;
  sem ele a key é `null` no servidor e o `fallbackData` NÃO pinta.
- **`lib/ssr.ts`** — `contextoSSR()` (sessão via cookie → `phone`, `token`,
  `grupoId`, `userId`), `backendGet()` e `mesRefSSR()` (mês no fuso SP).
- **`lib/ssr-data.ts` — lê DIRETO do Supabase** (corta o hop do Render).
  **Medido:** dashboard **155ms direto × 483ms via Render**. O Render é free tier
  (CPU ~0,1 vCPU) em **Oregon**; o Supabase está em **us-east-2 (Ohio)**.
  ⚠️ **É PORTE FIEL do backend** (`routes/dashboard.js` + `services/resumoTransacoes.js`).
  O backend continua **canônico** e o cliente revalida por ele — se a regra do que
  conta como gasto/transferência mudar lá, **espelhar aqui**, senão os números
  "pulam" na tela ao revalidar.
  ⚠️ **Rotas gated por plano (metas, investimentos) NÃO entram aqui** — ler direto
  furaria o `exigirPlano` do backend; elas seguem no `backendGet`.
- **`lib/swr-cache.ts`** (cache do SWR em localStorage → revisita instantânea) e
  **`lib/perfil-cache.ts`** (perfil persistido → cold-start/F5 instantâneo,
  hidratado com `useLayoutEffect` pra não dar hydration mismatch).
  🔒 **Os dois são limpos no `signOut` e descartados se a sessão for de outro
  `userId`** — senão vaza dado financeiro pro próximo usuário num PC compartilhado.
- **`lib/prefetch.ts` + Sidebar** — prefetch de rota + dados no hover (desktop) e
  no ocioso (`requestIdleCallback`) pra todas as abas. **Sem `onTouchStart`** — no
  mobile isso causava travada no toque.
- **`app/grow/layout.tsx`** — o gate de auth do Grow **não pode voltar a bloquear
  tudo num spinner**: hoje mostra **shell (sidebar) + skeleton**. O spinner antigo
  mascarava qualquer HTML pintado — por isso **SSR nas páginas do Grow é inútil**.
- **Skeletons:** `components/ui/PageSkeleton.tsx` (abas SSR, via `loading.tsx`) e
  `components/ui/SectionSkeleton.tsx` (abas client+SWR: Negócios e todo o Grow).
  Exceções de propósito: `grow/dados` (é gate de **PIN**) e os redirects.
- **Listas longas:** `content-visibility: auto` + `contain-intrinsic-size` nas
  linhas (transações 500+ e movimentações dos relatórios) — virtualização nativa
  do browser, **sem lib** e sem mexer no grid/scroll horizontal.
- **Mutação otimista** (`optimisticData` + `rollbackOnError` + `populateCache:false`):
  transações criar/editar/excluir e deletes de metas/dívidas/categorias. Os modais
  expõem props opt-in (`onOptimisticCreate`/`onOptimisticSave`) — retrocompatíveis.
  ⚠️ Em **toggle rápido** usar `revalidate:false` + **revalidação debounced** (o
  padrão do hábitos); sem isso, clicar rápido perde marcação.
- **`/api/perf-diag`** (auth-gated) — cronometra sessão, lookup, Supabase direto e
  o hop do Render (2× pra flagrar cold start) + região da Vercel. **Medir antes de
  otimizar** (foi ele que provou que o #2 valia).

> **O que sobrou (decisão consciente):** o Render free em Oregon ainda paga a
> travessia até o Supabase (Ohio), mas **as leituras não passam mais por ele** e as
> escritas são otimistas → quase não se sente no painel. Ainda afeta a resposta da
> **Sora no WhatsApp** (toda mensagem passa pelo Render). `sql/089` (índices) é
> seguro de ESCALA, opcional hoje. Falta só o item #7 do roadmap (View Transitions).
> Memórias: `project-roadmap-performance-ultra` e `project-ssr-dados-diretos`.

---

## WhatsApp Cloud API oficial (Meta) — migração CONCLUÍDA (jul/2026)

A Sora migrou do **Z-API (não-oficial)** pra **WhatsApp Cloud API OFICIAL da Meta**. Z-API descontinuado (ao registrar o número na Cloud API ele sai do app/Z-API — não dá pra voltar). Empresa verificada na Meta (ENOTAS DESENV DE SOFTWARES LTDA, CNPJ 14.422.279/0001-06).

**Arquitetura (backend):**
- **`src/services/mensageiro.js`** — dispatcher: `WHATSAPP_PROVIDER=meta` → `services/whatsapp.js` (Cloud API), senão `services/zapi.js` (legado). Todos os handlers importam do mensageiro. Compara em **lowercase**.
- **`src/services/whatsapp.js`** — Cloud API: enviarTexto/Menu/Imagem/Link/BotaoLink/**enviarTemplate** (com cabeçalho de imagem OU texto) + `baixarMidia`. `to()` reinsere o 9º dígito BR.
- **`src/routes/webhook-meta.js`** (em `/webhook/meta`) — recebe inbound e chama `require('./webhook').processarMensagem` (o MESMO cérebro do Z-API). Tem `/diag?key=<WHATSAPP_VERIFY_TOKEN>` com: lastInbound/lastStatus/lastSendError/lastProcessError/lastTrace, `&status=1`, `&subscribe=1`, `&to=`, `&template=`, `&tplinfo=all|NOME`, `&dbtest=1`, `&welcome=PHONE&nome=X`.
- **9º dígito BR:** a Meta remove o 9 do `wa_id` → `processarMensagem` busca usuário com `variantesPhone` (com E sem o 9). NÃO regredir.

**Janela de 24h (regra da Cloud API):** resposta DENTRO da janela (usuário falou nas últimas 24h) = texto livre/rico como sempre. FORA da janela (proativos) = **só template aprovado**. Proativos roteados via `services/proativo.js → enviarProativo({texto, template})`: crons (`jobs/index.js`, helper `lembrete()`), welcome, resumos, briefing. Catálogo em `sora-backend/docs/MIGRACAO-WHATSAPP-TEMPLATES.md`.

**GOTCHAS (lições aprendidas nessa migração):**
- **Templates são POR WABA.** A WABA mudou no setup → templates da WABA antiga NÃO valem. Todos precisam existir/aprovar na WABA ATUAL (`WHATSAPP_WABA_ID`). O nome no código tem que bater EXATAMENTE (ex.: `boas_vindas`, `lembretes_gerais`). Conferir com `/diag?...&tplinfo=all`.
- **Comparar provider em lowercase.** A env estava `META` (maiúsculo) e a trava comparava `!== 'meta'` → webhook ficava DORMENTE e a Sora recebia mas não respondia. Sempre `.toLowerCase()`.
- **Pagamento obrigatório.** Mesmo resposta grátis in-window exige método de pagamento válido (erro 131042 = "Business eligibility payment issue"). Real (BRL) não aparece na lista de moedas → usar **USD**.
- **Dispatch com `await`.** Handlers no switch do webhook.js precisam de `await` — sem isso, erro do handler vira unhandled rejection e some sem log/resposta.
- **Categoria do template:** cupom/oferta → Marketing; template 100% variável (`{{1}}`) tende a Marketing. Utilidade = aviso específico/transacional (texto fixo + variáveis).
- **Cache do iOS:** número migrado some pra quem tinha o chat antigo ("não está mais no WhatsApp"); link `wa.me/<num>?text=Oi` abre chat novo e contorna.
- ⚠️ **A Meta cacheia URL de imagem de cabeçalho que deu 404.** O `sora.png` do
  agente Sora (`src/agentes/index.js`) ficou 404 por um tempo (arquivo sem
  commit no frontend) — corrigido o 404, a Meta continuou recusando o envio
  pra essa MESMA URL. Fix: `capaVersao` no catálogo anexa `?v=N` só nesse
  agente, forçando a Meta a tratar como URL nova. Se um agente novo tiver o
  mesmo sintoma (imagem responde 200 mas o template continua sendo recusado),
  é isso — sobe o `capaVersao`.

> Detalhes completos + IDs na memória `project-migracao-whatsapp-cloud`.

---

## Responsividade mobile — regras aplicadas

- **Sidebar:** botão fechar com `safe-area-inset-top` + toque 44pt
- **Transações:** botões hero mobile-first (CTA full-width); movimentações com scroll horizontal (`overflow-x-auto`, `min-w:700px`, mesmo grid desktop/mobile); filtros em `grid-cols-3`
- **Categorias:** scroll horizontal nas linhas, barras de consumo visíveis no mobile, botões touch 44pt
- **Hábitos Grow:** tabela semana com `overflow-x-auto` + `min-w-[600px]`
- **Negócios:** botões header em scroll horizontal com `whitespace-nowrap`
- **Saúde/Estudos layouts:** `sticky top-0` (não mais `calc(env(safe-area-inset-top))`)
- **Regra geral:** nunca usar `opacity-0 group-hover:opacity-100` pra elementos de ação no mobile — usar `lg:opacity-0 lg:group-hover:opacity-100`
- **⚠️ Mini-card de stat com valor que pode truncar = SEMPRE expansível.** Qualquer card/chip compacto que mostra um número ou frase que no mobile é cortado com `truncate` (ex.: os 3 chips do hero do dashboard "Gasto em Jul / VS mês anterior / Maior gasto") **precisa** virar um `<button>` que, ao toque, abre um **painel de detalhe full-width abaixo** com o valor/frase COMPLETO — nunca deixar o usuário sem ver o valor inteiro. Padrão (feito no `app/dashboard/DashboardClient.tsx`, hero): estado `statExpandido: 'a'|'b'|null` (um aberto por vez); cada chip é botão com `aria-expanded`, borda/ring de brand quando ativo e um `ChevronRight` que gira `rotate-90`; a expansão usa `grid-template-rows: 0fr→1fr` + `opacity` com `transition-all duration-300` (anima altura sem `max-height` mágico) e o conteúdo completo vem em `text-2xl tabular` + sublinha explicativa. Toque ≥44pt, `active:scale-[0.98]`. Mesma família do `ResumoCards` (Saldo/Gastos/Cartões que expandem por conta). **Regra:** ao criar um card de stat novo desse tipo, já nasce com a expansão — não repetir o bug do valor cortado.
- **⚠️ Card num GRID de 2+ colunas: o painel expandido tem que abrir logo APÓS A LINHA do card tocado, não no fim de tudo** — senão no mobile o painel aparece embaixo dos outros cards e o usuário nem percebe que expandiu. Solução (feita no `ResumoCards`): o painel é um item do PRÓPRIO grid com `col-span-full` e a posição controlada por **`order`** — no mobile `order-3` (depois da 1ª linha) pro card da linha de cima e `order-6` pros da linha de baixo; no desktop (fileira única) `lg:order-last` mantém sempre abaixo. Os cards recebem `order-1/2/4/5` (gap no 3 pro painel encaixar). Renderiza condicional (`{aberto && ...}`) pra não deixar gap do grid quando fechado.
- **⚠️ Modal/overlay `fixed` SEMPRE via `createPortal(jsx, document.body)`** — NUNCA renderizar um modal solto dentro da árvore de um card. Os cards do painel usam **`backdrop-blur`** (design system) e um ancestral com `backdrop-filter`/`transform`/`filter`/`will-change` vira o *containing block* do `position: fixed`: o modal fica **preso/recortado dentro do card e aparece ATRÁS** do conteúdo abaixo (bug real: `PagarFaturaModal` ia pra trás do card "Faturas"). z-index NÃO resolve. Guardar `mounted` (`useEffect`→`setMounted(true)` + `if(!mounted) return null`) porque SSR não tem `document`. Memória `feedback-modal-portal-backdrop-blur`.

---

## Animação de abertura no mobile (`app/layout.tsx`) — ago/2026

Vídeo de abertura que roda ao abrir o painel no celular
(`public/abertura/sora-intro.mp4` + `.webm`). Custou 5 tentativas; as duas
causas reais não eram nenhuma das óbvias (arquivo, CSS, service worker,
codec — **todas medidas e todas certas**).

- ⚠️ **O REACT APAGA NÓ CRIADO POR SCRIPT DENTRO DE ELEMENTO QUE ELE RENDERIZA.**
  O `<video>` era criado por JS dentro da `<div id="sora-abertura">`, que vem do
  JSX. Na hidratação o React compara os filhos daquele elemento com o que ele
  desenhou (nenhum) e **remove o extra** — o vídeo sumia antes de tocar. Era o
  "aparece um frame e pula". Fix: o `<video>` vai no HTML do servidor via
  **`dangerouslySetInnerHTML`**, que o React não inspeciona.
- ⚠️ **A decisão roda em `<script>` no `<head>`, nunca em `useEffect`.** Efeito
  roda depois da hidratação, que roda depois do primeiro paint — o painel
  aparecia ANTES da animação. O script põe `data-abertura="on"` no `<html>` e o
  CSS (em `globals.css`) revela o overlay já no primeiro paint.
- ⚠️ **A marca de sessão grava no FIM, não na decisão.** Gravando antes, uma
  tentativa QUE FALHOU queimava a sessão e a animação não voltava nem depois de
  consertada — e no PWA do iOS o `sessionStorage` sobrevive ao app minimizado.
  Ao mexer aqui, **bumpar a chave** (`sora-abertura-v3`) pra destravar quem ficou
  preso.
- **MP4 primeiro**, webm depois: H.264 toca em todo lugar. E **nunca** barrar por
  `canPlayType('video/webm; codecs="vp9"')` — no iOS isso devolve string vazia,
  e essa "proteção" era o que impedia a animação de aparecer no iPhone.
- `muted`/`playsinline` **escritos no atributo**, antes de qualquer fonte ser
  escolhida — são eles que autorizam o play sem gesto no iOS.
- `preload="none"` e sem `autoplay` no HTML; o script liga os dois só quando a
  abertura vai acontecer, senão o desktop baixa o vídeo à toa.
- **`?abertura=1`** força a abertura (ignora sessão, largura e reduced-motion) —
  é como se testa sem depender do estado do aparelho.
- ⚠️ **Modo de Baixo Consumo do iOS bloqueia autoplay inline**, mesmo mudo.
  Nenhum código contorna; é a primeira coisa a checar num "não toca no iPhone".

---

## 🌍 Internacionalização (Espanhol) — PRÓXIMO FOCO (planejado, NÃO iniciado)

> Objetivo do usuário: **traduzir a Sora pro espanhol e vender pra outros países**. Este é o roteiro pré-desenhado. Memória: `project-i18n-espanhol`. **Ao começar, use a skill `ui-ux-pro-max` no que for UI e `ai-prompting` no que for IA.**

**Diagnóstico do terreno (medido nesta base):**
- **Nenhuma lib de i18n** instalada. App é **100% português hardcoded** (~75 arquivos usam `Intl … 'pt-BR'` / `currency: 'BRL'`).
- **IA do backend** tem `responda em português` cravado no system prompt (`sora-backend/src/services/ia.js` ~linha 158). O interpretador devolve **nomes de categoria em PT** e o categorizador é **acoplado a esses nomes** (`categorizar.js`/`.ts` + `ia.js`) — ver `project-categorias-v3`. **Esse acoplamento é o problema técnico mais difícil da tradução.**
- **Transações não têm coluna de moeda** — hoje é implícito BRL. Multi-moeda de verdade = migration + tocar em tudo.
- **Pagamento:** Stripe (BRL) + Mercado Pago (BRL). MP cobre LatAm (MX/AR/CO/CL) com credenciais por país; Stripe pro resto.
- **WhatsApp:** número Meta é BR (+55); templates são **por idioma e por WABA** (precisa aprovar versões ES). Máscara de telefone é BR (`components/ui/WhatsappInput.tsx`) — futuro i18n via `libphonenumber-js` já anotado (`project-whatsapp-input-i18n`).

**⚠️ DECISÕES QUE O USUÁRIO PRECISA TOMAR ANTES (perguntar no início):**
1. **Mercado primeiro?** (México / Argentina / Espanha / Colômbia / pan-LatAm) — define moeda, meio de pagamento, formato de telefone e se "DRE/tributário" faz sentido.
2. **Moeda:** por país (MXN/ARS/COP/CLP/USD) ou **USD pra todos** no começo? Recomendação: **moeda por GRUPO/usuário** (não por transação) no MVP — evita a migration de multi-moeda por linha.
3. **Domínio/SEO:** `forsora.com/es`, subdomínio, ou domínio `.mx`/`.com.ar` novo?
4. **WhatsApp:** manter o número BR (funciona, mas +55 gera desconfiança e paga a travessia Render-Oregon→Supabase) ou número local por país (melhor, mais trabalho)?

**Arquitetura recomendada (Next 16 App Router):**
- **`next-intl`** (padrão pra App Router + Server Components). Routing por locale (`/es`, `/pt`), middleware de detecção, catálogos `messages/pt.json` + `messages/es.json`.
- **Extrair as strings hardcoded** pros catálogos — é o grosso do trabalho (~75+ arquivos). Fazer por lote/aba, como foi o SSR.
- **Moeda/data locale-aware:** trocar `'pt-BR'`/`'BRL'` fixos por `locale`/`currency` do usuário (helper central; hoje está espalhado). Criar `lib/i18n.ts` como fonte única de `formatMoney(valor, {locale, currency})`.

**Fases sugeridas (cada uma vai pro preview e valida antes da master):**
1. **Infra i18n** — instala next-intl, locale routing, extrai strings do painel pra `pt.json`/`es.json` (PT continua igual pra quem já usa). Sem mudança de comportamento pro BR.
2. **Locale-aware** — moeda/data/telefone pelo país do usuário (coluna `idioma`/`pais`/`moeda` em `users` ou `grupos`).
3. **IA em espanhol** (skill `ai-prompting`) — system prompt condicional por `idioma`; **decidir a estratégia de categorias**: dar às categorias uma **KEY/slug estável** (neutra) + nome de exibição por locale, e o categorizador casa por key/aliases nos DOIS idiomas — senão a IA em ES devolve nomes que o categorizador PT não reconhece. FAQ local-first, welcome, resumos, briefing e templates da Meta ganham versão ES.
4. **Pagamento + preços por país** (Mercado Pago por país / Stripe internacional; tabela de preços local em `lib/planos-display.ts`).
5. **Landings + SEO + marketing** em ES.

**Regra de ouro:** PT (BR) não pode regredir. Cada fase mantém o português intacto e adiciona o ES ao lado.

---

## Convenções de código

- **Componentes:** functional + hooks, `'use client'` quando usa state/effects
- **Tailwind v4:** `border: 1px solid <color> !important` (border shorthand, não split)
- **Cores:** Brand `#61D17B` (Sora green). Dark mode via classe `.dark`.
- **Moeda:** `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
- **Plano guard:** sempre usar `podeUsar(plano, feature)` de `lib/plans.ts`
- **IA local-first:** preferir parsers/banco locais (regex, lookup) antes de chamar a OpenAI (gpt-4o-mini); sempre manter fallback local
- **Skill `ai-prompting` (auto):** ao mexer na IA/interpretador (`ia.js`, `interpretador.js`, `categorizar.js`, system prompt, mapear frase→ação, "não entendi", structured outputs/JSON mode, evals/bateria de perguntas), usar a skill `ai-prompting` **sem o usuário precisar pedir**. (Espelha a regra de usar `ui-ux-pro-max` em todo design novo.)

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

**Backend `.env` (Render — configurar em render.com → serviço → Environment):**
```
WHATSAPP_PROVIDER=meta   (dispatcher: 'meta' = Cloud API oficial; 'zapi' = legado)
WHATSAPP_TOKEN           (token PERMANENTE de System User — o do painel expira!)
WHATSAPP_PHONE_NUMBER_ID , WHATSAPP_WABA_ID , WHATSAPP_VERIFY_TOKEN
WHATSAPP_API_VERSION     (opcional, default v21.0)
ZAPI_INSTANCE, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN (Z-API LEGADO — não usar mais)
OPENAI_API_KEY (IA — gpt-4o-mini + Whisper)
API_SECRET_TOKEN (autenticação entre frontend e backend)
SUPABASE_URL, SUPABASE_KEY
SORA_CAPA_URL (capa 1200x630 da Sora; default ${APP_URL}/sora-capa.png)
```

---

## E-mails de auth (Supabase) — `docs/emails/`

Único e-mail de auth em uso é o de **redefinir senha** (confirmação no cadastro
está desligada). Template em PT + instruções de SMTP próprio em
`docs/emails/` — **é a fonte versionada**; o painel do Supabase não guarda
histórico, então quem editar por lá tem de trazer a mudança pro arquivo.

- ⚠️ O SMTP embutido do Supabase é de desenvolvimento e limita a ~2–4 envios/h
  **em silêncio**. "Pedi e não chegou nada" → suspeitar disso primeiro.
- ⚠️ **NUNCA chamar `exchangeCodeForSession` na `/redefinir-senha`.**
  `createBrowserClient` força PKCE e liga `detectSessionInUrl`: o client já
  troca o `?code=` sozinho na init e o código é de USO ÚNICO. A segunda troca
  falhava e a tela dizia "link expirado" com a sessão criada. Só esperar a
  sessão (`getSession()` aguarda a init internamente).
- ⚠️ PKCE guarda o `code_verifier` no navegador que PEDIU o link → abrir o
  e-mail em outro aparelho falha **sem** erro na URL. É tela própria ("abra no
  mesmo navegador"), não "expirado" — senão a pessoa pede link novo em looping.
- Conferir em *Authentication → URL Configuration* que `forsora.com/**` **e**
  `www.forsora.com/**` estão nas Redirect URLs (host diferente = cookie do
  verifier não acompanha).

## Deployment

- **Frontend:** Vercel — auto-deploy a cada push no branch `master` do GitHub
- **Backend:** Render — auto-deploy via GitHub (sora-backend-jqm8.onrender.com). Vars de ambiente via painel Render → Environment.
- **Migrations SQL:** rodar manualmente no Supabase Dashboard → SQL Editor
- **Cache Vercel:** `export const revalidate = 0` em `app/page.tsx` pra landing não cachear
- **Service Worker:** `public/sw.js` usa `CACHE = 'sora-v3'`, HTML nunca cacheado

---

## Migrations SQL a rodar (se ainda não rodou)

> **Local dos arquivos:** todas em `sora-backend/sql/` (NÃO no frontend). Rodar à mão no Supabase → SQL Editor; são idempotentes.

```
sql/018_stripe.sql              — colunas Stripe em users
sql/019_onboarding.sql          — colunas onboarding em users
sql/020_welcome_tracking.sql    — coluna welcomed_at em users
sql/021_wallet_padrao.sql       — coluna wallet_padrao_id em users
sql/022_transacoes_pendentes.sql — tabela state machine conversas
sql/023_cartao_metadata.sql     — colunas limite/dia_fechamento/bandeira em wallets
sql/030_categorias_extra.sql    — Encomendas/iFood/Uber/Nike/Shein/Adidas (funções criar_categorias_extra + backfill)
sql/031_habito_lembrete.sql     — colunas habito_lembrete_* em users (lembrete diário hábitos)
sql/032_despensa.sql            — tabela despensa_itens + link despensa_item_id em itens_lista_compras
sql/033_manutencoes.sql         — tabela manutencoes (upkeep recorrente da casa)
sql/034_receitas.sql            — tabelas receitas + receita_ingredientes
sql/035_compromissos.sql        — tabela compromissos (Agenda do Grow)
sql/036_agenda_briefing.sql     — colunas agenda_briefing_* em users (briefing matinal)
sql/037_pendente_descontar.sql  — tipo de pendente 'descontar_destino' (aporte/pagamento → descontar de conta)
sql/037_wrapped_aviso.sql       — coluna wrapped_avisado em users (dedup do aviso mensal do Wrapped)
sql/038_grow_colecoes.sql       — tabelas das Coleções do Grow (viagens, bucket_list, midia, leituras)
sql/039_grow_user_id.sql        — user_id (dono) + backfill nas tabelas do Grow (privacidade em grupo)
sql/040_grow_share_flags.sql    — flags grow_compartilha_* na tabela grupos (toggle por aba)
sql/041_dados_pessoais.sql      — aba "Dados Pessoais" do Grow (quadros/seções/itens) + PIN
sql/042_dados_arquivos_bucket.sql — bucket PRIVADO `dados-arquivos` (URLs assinadas) — usado pela aba Drive E pelo recebimento de arquivo por WhatsApp (obrigatório pro Drive funcionar)
sql/043_bug_reports.sql         — tabela bug_reports (aba Relatar um problema)
sql/044_resumos.sql             — colunas resumo_* em users (resumos proativos semanal/mensal no WhatsApp)
sql/062_tarefa_categoria.sql    — coluna categoria em tarefas (tarefa por linguagem natural já categorizada)
sql/063_notas.sql               — tabela notas (insights/ideias salvos e consultados pelo WhatsApp)
sql/069_open_finance.sql        — tabelas of_conexoes/of_caixinhas + of_tx_id/of_conta_id (Open Finance)
sql/075_categoria_trabalho.sql  — categoria "💼 Trabalho/Negócio" (anúncios: FACEBK/Meta/Google Ads)
sql/076_recategorizar_of.sql    — re-categoriza transações OF JÁ importadas (o sync dedupa por of_tx_id e NUNCA reescreve linha existente — de propósito: senão apagaria a categoria corrigida à mão)
sql/077_cartao_minimo.sql       — coluna pagamento_minimo em wallets (o painel estimava 15% da fatura; o banco manda o valor real)
sql/078_limpa_parcela_futura.sql — remove parcelas FUTURAS importadas como gasto (a Polp manda parcela a vencer como transação datada em 2027; o sync já corta, isto limpa o passado)
sql/083_marcas_personalizadas.sql — tabela marcas_personalizadas (logo de loja custom que casa por nome)
sql/084_categorias_v3.sql        — taxonomia nova: redefine criar_categorias_padrao (aditiva)
sql/085_categorias_v3_dedup.sql  — unique(grupo_id, nome) + dedup das duplicadas
sql/086_fix_probe_shein.sql      — remove categoria bugada __probe__ e move a sub "Shein" pra Encomendas
sql/087_categorias_v4_rebuild.sql — rebuild final + REMAPEIA as transações das categorias antigas pras novas
sql/088_divida_imagem.sql        — coluna de imagem em dividas (organização por foto, igual metas)
sql/089_indices_performance.sql  — índices das queries quentes (transacoes grupo_id+data, wallets, categorias, limites, dividas, metas). OPCIONAL hoje: é seguro de ESCALA — as queries já voltam em ~58ms; não muda a latência atual
sql/090_empresas.sql             — Negócios 2.0: tabela `empresas` + empresa_id em tudo + BACKFILL (quem já usava ganha "Meu negócio") + config_negocio PK vira empresa_id + eventos_financeiros.integracao_id nullable (receita manual). RODADA.
sql/091_lancamentos_negocio.sql  — livro caixa do negócio (entrada|saida, status pago|pendente, vencimento). Conta a pagar = saída pendente. RODADA.
sql/092_funcionarios_negocio.sql — quadro de pessoal + folha + FK do lancamentos_negocio.funcionario_id. RODADA.
sql/105_centros_custo.sql        — Sora Negócios fase 1: centro de custo. RODADA.
sql/106_clientes_produtos_vendas.sql — fase 2: clientes, produtos, vendas + venda_itens (congela preço E custo). RODADA.
sql/107_estoque_compras.sql      — fase 3: fornecedores, compras, estoque_movimentos + estoque_atual/controla_estoque nos produtos. RODADA.
sql/108_dre_gerencial.sql        — fase 4: natureza fixa/variável (lançamentos e custos) + CMV/lucro bruto/despesas por natureza/ponto de equilíbrio em dre_snapshots.
sql/109_comissao_encargos.sql    — fase 5: comissao_pct/encargos no funcionário + comissao_valor/comissao_paga_em na venda.
sql/114_wallet_datas_manuais.sql — flag `datas_manuais` em wallets: fechamento/vencimento corrigidos à mão param de ser sobrescritos pelo sync do Open Finance (a API do MP publica 12/17 e o app mostra 8/14).
sql/115_divida_nos_previstos.sql — flag `nos_previstos` em dividas: excluir a dívida do card "Previstos do mês" sem apagá-la da aba Dívidas (reversível lá).
sql/116_of_parcelas_previstas.sql — tabela `of_parcelas_previstas`: parcelas a vencer que o BANCO conhece e a Sora não (MP manda parcela sem "N/M"). É PROJEÇÃO — reescrita a cada sync, nunca vira transação.
sql/117_recorrencia_lembrete_dia.sql — coluna `ultimo_lembrete_dia` em recorrencias: modo "só avisa" não cria transação, então não havia dedup e o lembrete saía 3× (8h/9h/10h).
sql/118_of_faturas.sql          — tabela `of_faturas`: as faturas PUBLICADAS pelo banco (total, pago, fechamento, vencimento). Fim da reconstrução do valor por soma de transações — é a base da fidelidade ao app do banco.
sql/119_pagamento_recebido_cartao.sql — reclassifica "Pagamento recebido" em cartão OF (Nubank) de Reembolso → Fatura. Sem isso o pagamento ABATE a fatura e ela sai menor que a do banco (medido: 5 linhas, R$ 4.694,21).
sql/120_caixinhas_celcoin.sql   — colunas de remuneração em `of_caixinhas` (indexador, taxa, periodicidade) + `of_conta_id`. Sem ela as Caixinhas do Nubank aparecem sem o "rende X% do CDI" (o upsert é tolerante); a tabela em si já vem da 069.
sql/121_investimentos_tipo_check.sql — CHECK de `investimentos.tipo` aceitando os 13 tipos do painel. **OBRIGATÓRIA**: sem ela, CDB, Renda Fixa, Fundos, Reserva e Negócio NÃO salvam (nem à mão nem pelo Open Finance).
sql/122_aportes_resgate.sql     — coluna `tipo` (aporte|resgate) em `aportes`. Sem ela o RESGATE de investimento é recusado com instrução (aporte segue funcionando).
sql/123_cartao_nos_previstos.sql — `wallets.nos_previstos`: tirar/voltar a fatura do card "Previstos do mês". Sem ela a fatura aparece, só o toggle recusa.
sql/124_debito_automatico_fatura.sql — reclassifica "Débito automático FATURA …" (Itaú) de gasto → pagamento de fatura. Sem ela o histórico segue contando a fatura EM DOBRO (medido: R$ 30.384,92 num cliente).
sql/125_divida_consorcio.sql    — tipo `consorcio` no CHECK + carta de crédito, contemplação, lance e grupo/cota. **OBRIGATÓRIA** pro tipo Consórcio salvar.
sql/126_saldo_aplicado.sql      — `wallets.saldo_aplicado`: quanto do saldo está na aplicação automática do banco. O saldo já soma sem ela; a coluna é pra tela explicar "dos quais R$ X aplicados".
sql/127_pagamento_fatura_frases.sql — pagamento de fatura descrito com a frase de CADA banco ("PAGAMENTO DEBITO AUTOMATICO", "Obrigado pelo pagamento", "Pagamento com saldo", "PAGAMENTO ON LINE"). Sem ela a fatura JÁ PAGA segue de pé no painel e o crédito ainda ABATE (medido: 11 linhas, R$ 35.516,30).
```

> **Pendentes de rodar (confirmar no Supabase):** 042 (bucket dados-arquivos — **obrigatório pro Drive**), 043 (bug_reports), 044 (resumos), **062 (categoria em tarefas), 063 (tabela notas)**, 088 (imagem em dívidas), **114, 115, 116, 117, 118 e 119**. Sem elas as features respectivas não funcionam. (062 é tolerante: a tarefa cria sem categoria até rodar; 063 é obrigatória pras notas.)
> **Já rodadas:** 074 (mrr_excluir/assinatura_cancelada), 083 (marcas), 084→087 (categorias v3), **090+091+092 (Negócios 2.0)**. **089 (índices) NÃO foi rodada — é opcional** (ganho só em escala).
> **Drive Inteligente:** NÃO tem migration própria — reusa 041 (tabelas) + 042 (bucket). Se o Drive não guardar arquivo, quase sempre é o **bucket 042 que não rodou**.

> **Atenção (lição aprendida):** colunas novas NÃO podem entrar no `select()` de queries do caminho crítico (ex.: `getUser` em `routes/grow.js`) ANTES da migration rodar — o Supabase erra e a feature inteira quebra ("Usuário não encontrado"). Buscar colunas novas em query separada/tolerante (try/catch ou maybeSingle) e retornar default se faltar. **Sempre mandar o link da migration nova pro usuário** (ele roda à mão no Supabase).

## Saldo da conta soma a APLICAÇÃO AUTOMÁTICA (ago/2026)

Relato: painel **R$ 1,00** × app do Itaú **R$ 2.541,12**. O diagnóstico
`?foco=saldo` confirmou a causa em vez de deixar no palpite:

```
available_amount ............... R$     1,00   ← era só isto que entrava
automatically_invested_amount .. R$ 2.541,17   ← ignorado
blocked_amount ................. R$     0,00
```

- A doc da Celcoin diz que `available_amount` **"não inclui cheque especial,
  investimentos automáticos nem reservas de saldo"**. Itaú (e afins) jogam quase
  todo o saldo numa aplicação que volta sozinha quando o cliente gasta — é
  dinheiro **disponível**, e é o que o app do banco soma.
- ⚠️ **NÃO duplica com a aba Investimentos:** conferido na conta real, as 11
  posições importadas (CDBs, fundos, Tesouro) **não** incluem a aplicação
  automática. Ela é produto **DA CONTA** e vem em `balance`, não pela API de
  investimentos.
- **`blocked_amount` continua FORA** — bloqueado não é gastável.
- Migration **126** (`wallets.saldo_aplicado`) guarda a parcela aplicada pra a
  tela explicar "dos quais R$ X aplicados", em vez de o saldo mudar sozinho.
- ⚠️ **O eval tinha a suposição errada cravada** (`saldo = available_amount; NÃO
  somar automatically_invested`). Era a premissa que os dados derrubaram —
  `eval:celcoin` §6C agora trava o comportamento certo, com os números reais.

## Diagnóstico de saldo — `?foco=saldo`

`/api/admin/of-debug?email=<cliente>&foco=saldo` mostra, por conta,
`available_amount`, `automatically_invested_amount`, `blocked_amount`,
`has_reserved_balance` e as somas prontas. Use quando o saldo divergir do app do
banco. O modo **completo** faz ~40 chamadas e estoura o timeout no par
Vercel + Render free — daí os focos `cartoes` e `saldo`.

## Tipo CONSÓRCIO em Dívidas (ago/2026)

Pedido: *"onde posso colocar e controlar as cartas de consórcio?"*. Antes só
dava pra usar "Financiamento", que cobre PAGAR mas ignora o que é próprio do
consórcio: a **carta de crédito** (dinheiro a RECEBER — é ativo, não só dívida)
e a **contemplação** (divide a cota em antes e depois). Migration **125** com
`consorcio_credito`, `consorcio_contemplado(_em)`, `consorcio_lance`,
`consorcio_grupo`, `consorcio_cota`.

- ⚠️ **Mesma família do `investimentos_tipo_check`**: o `dividas_tipo_check`
  recusava `'consorcio'`. A 125 recria o CHECK com **todos** os tipos já em uso
  na base — recriar sem algum quebraria dívida existente.
- A **taxa de administração** reusa `taxa_juros` (só muda o rótulo na tela):
  duas colunas pro mesmo número dariam divergência.
- Os campos só vão no payload quando o tipo É consórcio, então trocar de tipo
  não deixa carta órfã.
