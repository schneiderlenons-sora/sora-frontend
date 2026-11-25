# Assinatura pela Apple (app de iPhone) — o que configurar e como testar

Dentro do app de iPhone a assinatura só pode ser vendida pela cobrança da Apple
(diretriz 3.1.1). O site segue no Stripe e o Android na Google Play. Decisões do
dono (24/11/2026): **implementação própria** (sem RevenueCat), **preço do iPhone
cobrindo a comissão** de 15% e assinaturas criadas **pela API** do App Store
Connect.

O código está pronto e **desligado até o build 1.1.0 existir**: o site só vende
pela Apple quando o User-Agent traz `SoraCompras/` (`uaIosVende` em
`lib/app-ios.ts`). Quem está com o app 1.0 continua sem venda nenhuma.

## Peças no código

| Peça | Papel |
|---|---|
| `ios-app/ios/App/App/SoraComprasPlugin.swift` | StoreKit 2: produtos, comprar (com `appAccountToken` = id da conta), direitos, restaurar, gerenciar |
| `ios-app/ios/App/App/SoraViewController.swift` | registra o plugin (o `SceneDelegate` usa esta tela) |
| `lib/apple-compras.ts` | ponte do site com o plugin (`Capacitor.nativePromise`) |
| `lib/apple-billing.ts` | regras puras — `npm run eval:apple-billing` |
| `lib/app-store.ts` | conferência dos comprovantes (raiz da Apple em `lib/apple-raiz.ts`) e App Store Server API |
| `lib/apple-sync.ts` | fonte única: lê o estado na Apple, grava, acerta o plano |
| `app/api/apple/verificar` · `notificacoes` · `status` | as três portas |
| `components/planos/useAppleCompra.ts` · `PlanosApple.tsx` | compra na tela (paywall da aba bloqueada, /planos, Configurações) |
| `components/app/SincronizarApple.tsx` | restauração silenciosa a cada sessão |
| `sora-backend/sql/199_apple_assinaturas.sql` | tabela + `plano_fonte = 'apple'` |
| `ios-app/loja/criar-assinaturas.mjs` | cria as 6 assinaturas pela API |

## Regras que não podem regredir

- ⚠️ **Na Apple a compra NÃO é devolvida sozinha** (na Play, não confirmar =
  reembolso em 3 dias). Por isso a tela nunca oferece a assinatura da Apple a
  quem já tem plano por outro caminho (vitalício, site, Play). Se acontecer, a
  compra é gravada, o plano não muda e a tela manda pedir o reembolso em
  reportaproblem.apple.com.
- ⚠️ **O estado vem sempre da Apple** (`getAllSubscriptionStatuses`). O app e o
  aviso só dizem qual assinatura olhar.
- ⚠️ **Só rebaixa quem ganhou o plano pela Apple** (`plano_fonte = 'apple'`);
  fim da assinatura → `gratis`, nunca `inativo`.
- ⚠️ **Sandbox convive com produção**: a revisão da Apple e o TestFlight compram
  em sandbox no app de produção. `lib/app-store.ts` tenta os dois ambientes.
- ⚠️ **A tela de assinatura tem de ter** (3.1.2): nome e período, preço, aviso
  de renovação automática e como cancelar, **Restaurar compras** e links de
  Termos de Uso e Política de Privacidade (`AvisoAssinaturaApple`).
- ⚠️ **A Sora não consegue cancelar a assinatura da Apple** de ninguém. A
  exclusão de conta avisa a pessoa a cancelar nos Ajustes antes (5.1.1).
- Sem tabela de preço de reserva no iPhone: sem o preço da App Store, o botão
  fica desligado (o preço do site é outro).

## Passo 1 — Contrato de Apps Pagos (dono)

**Negócios** NÃO fica dentro do app (a barra do app só tem Monetização): é um
ícone da **página inicial** do App Store Connect —
`https://appstoreconnect.apple.com/business`. Lá: **Apps pagos** → aceitar os
termos, cadastrar a conta bancária (no nome do titular: a conta é individual) e
o formulário de impostos. Só o **titular da conta** vê essa área. Sem o contrato
**ativo** não dá nem para testar compra em sandbox. Pode levar dias.

✅ Conferido em 24/11/2026: **Acordo de apps pagos ATIVO** desde 27/10/2026,
conta bancária ativa, W-8BEN ativo. ⚠️ Pendente: o **Formulário fiscal do
Brasil** ("Faltam informações fiscais") pede **CNPJ**, a ajuda da Apple não cita
CPF, e depois de enviado não dá pra editar no App Store Connect (só pelo
suporte). Decisão do dono com o contador.

Não criar nada em **Assinaturas** nem em **Compras dentro do app** à mão: o
script do passo 3 cria o grupo e as 6 assinaturas.

## Passo 2 — Small Business Program (dono)

developer.apple.com/app-store/small-business-program — comissão de 15%.

## Passo 3 — As 6 assinaturas (por script)

Chave em **Usuários e acesso → Integrações → App Store Connect API → Chaves de
equipe**, acesso **Gerente de apps**. O `.p8` fica em `C:\Users\jenif\chaves-apple\`
(fora do OneDrive e do repo).

```bash
APPLE_API_KEY_ID=… APPLE_API_ISSUER_ID=… \
APPLE_API_KEY_PATH=C:/Users/jenif/chaves-apple/AuthKey_….p8 \
node ios-app/loja/criar-assinaturas.mjs            # simulação
node ios-app/loja/criar-assinaturas.mjs --aplicar  # grava
```

Grupo **ForSora**, um produto por plano + ciclo (mesmos IDs da Play), só Brasil:

| ID | Nível | Preço alvo (site ÷ 0,85) |
|---|---|---|
| `sora_platinum_mensal` / `_anual` | 1 | R$ 58,71 / R$ 563,53 |
| `sora_premium_mensal` / `_anual` | 2 | R$ 35,18 / R$ 337,69 |
| `sora_basico_mensal` / `_anual` | 3 | R$ 23,41 / R$ 172,82 |

O script escolhe o **menor preço terminado em ,90 que cubra o alvo** (padrão do
site); sem nenhum ,90 acima do alvo, o menor que cubra.

✅ **CRIADAS em 24/11/2026** (chave de equipe `BZVNC2D656`, o `.p8` em
`C:\Users\jenif\chaves-apple\`). Preços gravados — e o que a Apple diz que você
recebe:

| Plano | Mensal | Anual |
|---|---|---|
| Básico | R$ 23,90 (recebe ~19,60) | R$ 172,90 (~141,82) |
| Premium | R$ 35,90 (~29,45) | R$ 339,90 (~278,80) |
| Platinum | R$ 58,90 (~48,31) | R$ 564,90 (~463,36) |
Preços do site conferidos no Stripe em 24/11/2026: Básico 19,90 / 146,90 ·
Premium 29,90 / 287,04 · Platinum 49,90 / 479,00.

⚠️ Cada assinatura precisa de uma **captura de tela de revisão** (o paywall
aberto no app) antes de ir pra revisão — Assinaturas → produto → Informações de
revisão. E as **primeiras assinaturas vão junto com uma versão do app** (a 1.1.0).

## Passo 4 — Chave de compras no app (dono) e variáveis na Vercel

**Usuários e acesso → Integrações → Compras no app → Gerar chave**. Na Vercel
(Production), depois **Redeploy**:

| Nome | Valor |
|---|---|
| `APPLE_IAP_KEY_ID` | ID dessa chave |
| `APPLE_IAP_ISSUER_ID` | ID do emissor |
| `APPLE_IAP_PRIVATE_KEY` | o conteúdo inteiro do `.p8` |

## Passo 5 — Avisos automáticos

App Store Connect → app → **Informações do app → Notificações do servidor da
App Store** → **Versão 2**, a mesma URL em produção e sandbox:

```
https://www.forsora.com/api/apple/notificacoes
```

Botão "Enviar notificação de teste": nos logs da Vercel aparece
`[apple/notificacoes] aviso de TESTE recebido`.

## Passo 6 — Banco

Rodar `sora-backend/sql/199_apple_assinaturas.sql` no Supabase.

## Passo 7 — Build 1.1.0 e teste

Codemagic → **Start new build** → TestFlight. Testar com uma **conta de
sandbox** (Usuários e acesso → Sandbox → Testadores): comprar, ver o plano
liberar, "Restaurar compras", trocar de plano, cancelar nos Ajustes.

Na revisão: nas Notas, dizer que as assinaturas estão no paywall de qualquer
aba trancada e em Configurações → Plano, e que a conta de demonstração está no
plano Platinum (então ela vê a grade com "Seu plano atual"; para ver o paywall,
usar uma conta nova criada no app).
