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
| `lib/mercadopago.ts` | `tierConfig()` (valor+plano+título por tier), `mpCreatePayment`, `mpGetPayment` |
| `lib/vitalicio.ts` | `ativarVitalicio(userId, plano)` |
| `lib/cupons.ts` | Cupons: **SORA10/15/25** (%) + **SORA100** (100% off → libera grátis sem passar no MP). `aplicarCupomVitalicio()` recalcula SEMPRE no server |

- **Env (Vercel):** `MP_ACCESS_TOKEN`, `NEXT_PUBLIC_MP_PUBLIC_KEY` (chaves de PRODUÇÃO). Migration `sql/064_vitalicio_intent.sql` (coluna `vitalicio_intent` p/ recuperação levar de volta pro tier certo).

**Landings de venda:**
- **`/oferta`** (`app/oferta/page.tsx`) — landing do vitalício (Hero + pricing dos tiers). Pixel/CAPI: InitiateCheckout.
- **`/kit`** (`app/kit/page.tsx` + `components/landing/KitOferta.tsx`) — landing dedicada do **Kit**, **tema escuro forçado** (`dark` no `<main>` + `@variant dark` no globals), nav sem toggle de tema, cabeçalho preto. Tem **card flutuante de cupom** `components/landing/CupomFlutuante.tsx` (SORA10, dismissível, copiar). Onboarding do Kit esconde "vincular WhatsApp" e "ver o que sei fazer" (Kit não tem zap).
- Ambas usam o `Footer` (com a info legal/CNPJ) e `lib/planos-display.ts` pros dados dos planos.

> Recuperação de pagamento falho: memória `project-recuperacao-pagamento-falho` (crons OFF por padrão — `RECUPERACAO_ATIVA`). CHECK constraint de `users.plano`: todo plano novo (ex. 'kit') precisa entrar no `users_plano_check` via migration senão a ativação falha calada — memória `project-plano-check-constraint`.

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
- **Info legal da empresa no rodapé** (`components/landing/Footer.tsx`): razão social ENOTAS DESENVOLVIMENTO DE SOFTWARES LTDA, CNPJ 14.422.279/0001-06, endereço (Belo Horizonte/MG), `contato@forsora.com` e telefone `(71) 92748-1735`. Aparece em forsora.com/oferta/kit. (Necessário pra verificação de negócio na Meta.)
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

## Painel admin — MRR (correções jul/2026)

`/admin` são **Route Handlers do Next** (`app/api/admin/*`), não o backend Express — usam `supabaseAdmin`. MRR calculado em `app/api/admin/overview/route.ts`.
- **MRR mensal** = só pagantes de intervalo **mensal** (ou null). **Anual é pré-pago → fora do MRR mensal** (contava anual pelo preço mensal = inflava). Retorna `anuais`/`recorrentesMensais` pro breakdown.
- **Colunas 074:** `mrr_excluir` (flag admin de cortesia) + `assinatura_cancelada` (webhook Stripe). Fora do MRR: vitalício, cancelado, mrr_excluir, e-mail admin, anual.
- **Badges no card:** `Recorrente` (pagante ativo não-cancelado), `Anual` (azul), `Cancelou`, `Vitalício`. **Filtros:** Recorrentes · Anuais · Vitalícios (+ os antigos).
- ⚠️ **Toggle dentro de `<label>` dispara 2×** (label reencaminha o clique pro button) → use `<button>` na linha inteira, nunca `<button>` aninhado em `<label>`.

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
- **⚠️ Modal/overlay `fixed` SEMPRE via `createPortal(jsx, document.body)`** — NUNCA renderizar um modal solto dentro da árvore de um card. Os cards do painel usam **`backdrop-blur`** (design system) e um ancestral com `backdrop-filter`/`transform`/`filter`/`will-change` vira o *containing block* do `position: fixed`: o modal fica **preso/recortado dentro do card e aparece ATRÁS** do conteúdo abaixo (bug real: `PagarFaturaModal` ia pra trás do card "Faturas"). z-index NÃO resolve. Guardar `mounted` (`useEffect`→`setMounted(true)` + `if(!mounted) return null`) porque SSR não tem `document`. Memória `feedback-modal-portal-backdrop-blur`.

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
```

> **Pendentes de rodar (confirmar no Supabase):** 042 (bucket dados-arquivos — **obrigatório pro Drive**), 043 (bug_reports), 044 (resumos), **062 (categoria em tarefas), 063 (tabela notas)**, 088 (imagem em dívidas). Sem elas as features respectivas não funcionam. (062 é tolerante: a tarefa cria sem categoria até rodar; 063 é obrigatória pras notas.)
> **Já rodadas:** 074 (mrr_excluir/assinatura_cancelada), 083 (marcas), 084→087 (categorias v3), **090+091+092 (Negócios 2.0)**. **089 (índices) NÃO foi rodada — é opcional** (ganho só em escala).
> **Drive Inteligente:** NÃO tem migration própria — reusa 041 (tabelas) + 042 (bucket). Se o Drive não guardar arquivo, quase sempre é o **bucket 042 que não rodou**.

> **Atenção (lição aprendida):** colunas novas NÃO podem entrar no `select()` de queries do caminho crítico (ex.: `getUser` em `routes/grow.js`) ANTES da migration rodar — o Supabase erra e a feature inteira quebra ("Usuário não encontrado"). Buscar colunas novas em query separada/tolerante (try/catch ou maybeSingle) e retornar default se faltar. **Sempre mandar o link da migration nova pro usuário** (ele roda à mão no Supabase).
