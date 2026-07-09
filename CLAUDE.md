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
| `/negocios` | Premium+ (DRE, vendas, forecast, integrações) — antes Black-only |
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
- **Removido "BACEN · Open Finance"** de hero/rodapé/FAQ/stack de valor de todas as landings (não afirmar autorização/integração que não temos).
- **Extrato de conta bancária** (`components/contas/DetalhesContaModal.tsx`): clicar na caixa "Saldo atual" do card em `/contas-bancarias` abre um modal com saldo, navegação por mês, entradas/saídas/saldo-do-mês, saídas por categoria e movimentações (+entrada verde / −saída vermelha). Espelha o `DetalhesCartaoModal` mas mostra os DOIS fluxos (débito sai da conta). Casa transações por `carteira_nome`.
- **Excluir conta com transações** (`components/contas/ExcluirContaModal.tsx` + backend `DELETE /wallets/:id`): antes deixava transações órfãs; agora, se a conta tem lançamentos, o backend responde 409 e o painel pergunta **mover pra outra conta** ou **excluir junto** (usado em contas-bancarias E cartao-de-credito). Ver memória `project-carteira-fantasma`.
- **Prevenção de conta-fantasma** (backend `handlers/transacoes.js`): `resolverCarteiraReal()` (exato→sem ruído→palavra→fuzzy Levenshtein) casa a conta citada pela IA com uma wallet real; se não achar e o user citou conta, PERGUNTA de qual foi (nº ou nome). Guardrail no import (`routes/transacoes.js`) reconcilia `carteira_nome` → 'Dinheiro' se não existir. "quiosque" → Alimentação no `categorizar.js`.
- **Fix "phone obrigatório" no Grow** (backend `routes/grow.js`, `saude.js`, `dados.js`): `requireGrow`/`requirePremiumGrow` NÃO exigem mais `phone` (o usuário vem do JWT via `req.authUser.id`); antes editar tarefa/consulta/Drive dava 400.
- **Fix CLS na landing** (`components/landing/SocialProof.tsx`): depoimentos empilhados em grid ([grid-area:1/1]) + altura fixa dos avatares → sem pulo ao trocar de depoimento.
- **Ícone da PWA no iOS** (`app/layout.tsx`): `apple-touch-icon` agora é `/sora-icon.png` (verde full-bleed) em vez de `/brands/sora.png` (círculo transparente → borda branca). iOS precisa REINSTALAR o PWA pra atualizar o ícone.

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

---

## Convenções de código

- **Componentes:** functional + hooks, `'use client'` quando usa state/effects
- **Tailwind v4:** `border: 1px solid <color> !important` (border shorthand, não split)
- **Cores:** Brand `#61D17B` (Sora green). Dark mode via classe `.dark`.
- **Moeda:** `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
- **Plano guard:** sempre usar `podeUsar(plano, feature)` de `lib/plans.ts`
- **IA local-first:** preferir parsers/banco locais (regex, lookup) antes de chamar a OpenAI (gpt-4o-mini); sempre manter fallback local

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
```

> **Pendentes de rodar (confirmar no Supabase):** 042 (bucket dados-arquivos — **obrigatório pro Drive**), 043 (bug_reports), 044 (resumos), **062 (categoria em tarefas), 063 (tabela notas)**. Sem elas as features respectivas não funcionam. (062 é tolerante: a tarefa cria sem categoria até rodar; 063 é obrigatória pras notas.)
> **Drive Inteligente:** NÃO tem migration própria — reusa 041 (tabelas) + 042 (bucket). Se o Drive não guardar arquivo, quase sempre é o **bucket 042 que não rodou**.

> **Atenção (lição aprendida):** colunas novas NÃO podem entrar no `select()` de queries do caminho crítico (ex.: `getUser` em `routes/grow.js`) ANTES da migration rodar — o Supabase erra e a feature inteira quebra ("Usuário não encontrado"). Buscar colunas novas em query separada/tolerante (try/catch ou maybeSingle) e retornar default se faltar. **Sempre mandar o link da migration nova pro usuário** (ele roda à mão no Supabase).
