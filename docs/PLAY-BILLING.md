# Assinatura pela Google Play — o que configurar e como testar

Dentro do app Android a Sora só pode vender pela cobrança do Google (política de
pagamentos do Play; o Brasil não tem billing alternativo). O site segue no
Stripe. O código está pronto e **desligado até a configuração abaixo existir** —
sem ela, o app mostra "Atualize o app" (versão antiga) ou "Indisponível no
momento" (versão nova sem produtos).

Peças no código: `lib/play-billing.ts` (regras, `npm run eval:play-billing`),
`lib/google-play.ts` (API do Google), `lib/play-sync.ts` (confere e libera o
plano), `app/api/play/*` (verificar · rtdn · status), `components/planos/PlanosPlay.tsx`
(a grade no app), `components/app/SincronizarPlay.tsx` (restauração).

> Os nomes dos menus do Google mudam de vez em quando. Se algum não bater
> exatamente, procure pela palavra principal (ex.: "Assinaturas", "Pub/Sub").

---

## Passo 1 — Perfil de pagamentos (conta de comerciante)

Sem ele o Google não deixa criar nada à venda.

Play Console → **Configurações** (engrenagem) → **Perfil de pagamentos** →
criar/vincular. Pede dados da empresa (ou CPF), endereço e a conta bancária
onde o Google deposita. A verificação pode levar alguns dias.

## Passo 2 — Os 6 produtos (assinaturas)

Play Console → app **Sora** → **Monetizar com o Google Play** → **Produtos** →
**Assinaturas** → **Criar assinatura**. Repita 6 vezes.

⚠️ **Um produto pra cada plano + ciclo, cada um com UM só plano básico.** A
ponte do app compra sempre o primeiro plano básico do produto — com mensal e
anual no mesmo produto, o anual nunca seria comprável. O **ID do produto tem de
ser EXATAMENTE este** (não dá pra mudar depois):

| ID do produto | Plano básico (ID / período) | Preço (igual ao site) |
|---|---|---|
| `sora_basico_mensal` | `mensal` · 1 mês · renovação automática | R$ 19,90 |
| `sora_basico_anual` | `anual` · 1 ano · renovação automática | R$ 210,12 |
| `sora_premium_mensal` | `mensal` · 1 mês | R$ 29,90 |
| `sora_premium_anual` | `anual` · 1 ano | R$ 287,04 |
| `sora_platinum_mensal` | `mensal` · 1 mês | R$ 49,90 |
| `sora_platinum_anual` | `anual` · 1 ano | R$ 479,00 *(conferir no Stripe)* |

Em cada plano básico: marque **"Compatível com versões anteriores"**
(backwards compatible), defina o preço em reais e **ative**. Os preços de 19,90,
29,90, 210,12 e 287,04 foram lidos do Stripe em 19/10/2026.

## Passo 3 — A chave pra Sora conversar com o Google (conta de serviço)

1. [Google Cloud Console](https://console.cloud.google.com) → escolha (ou crie)
   um projeto → **APIs e serviços** → **Biblioteca** → ative
   **Google Play Android Developer API**.
2. **IAM e administrador** → **Contas de serviço** → **Criar conta de serviço**
   (nome: `sora-play`). Não precisa dar papel nenhum aqui.
3. Abra a conta criada → **Chaves** → **Adicionar chave** → **JSON**. Baixa um
   arquivo `.json` — **é uma senha: não mande por WhatsApp/e-mail**.
4. Play Console → **Usuários e permissões** → **Convidar novos usuários** → cole
   o e-mail da conta de serviço (termina em `.iam.gserviceaccount.com`) → dê
   acesso ao app Sora com **"Ver dados financeiros"** e **"Gerenciar pedidos e
   assinaturas"**.

⚠️ Sem o passo 4 a API responde 401/403 mesmo com a chave certa. É o erro de
configuração mais comum — e às vezes leva algumas horas pra valer.

## Passo 4 — Avisos automáticos (renovou, cancelou, reembolso)

1. Google Cloud → **Pub/Sub** → **Tópicos** → **Criar tópico** → ID `play-sora`.
2. No tópico → **Permissões** → **Adicionar principal** →
   `google-play-developer-notifications@system.gserviceaccount.com` com o papel
   **Publicador do Pub/Sub**.
3. No tópico → **Criar assinatura** → tipo **Push** → endpoint:
   `https://www.forsora.com/api/play/rtdn?token=<PLAY_RTDN_TOKEN>`
   (o mesmo valor do passo 5).
4. Play Console → **Monetizar com o Google Play** → **Configuração de
   monetização** → **Notificações do desenvolvedor em tempo real** → nome do
   tópico `projects/<id-do-projeto>/topics/play-sora` → salvar → **Enviar
   mensagem de teste**. Nos logs da Vercel aparece
   `[play/rtdn] aviso de teste do Play Console recebido`.

## Passo 5 — Variáveis na Vercel

Vercel → projeto → **Settings** → **Environment Variables** (Production):

| Nome | Valor |
|---|---|
| `GOOGLE_PLAY_SERVICE_ACCOUNT` | o conteúdo INTEIRO do arquivo `.json` do passo 3 |
| `PLAY_RTDN_TOKEN` | a senha longa combinada (a mesma da URL do passo 4) |

Depois: **Deployments** → último → **Redeploy** (variável nova só vale em deploy novo).

## Passo 6 — Banco

Rodar `sora-backend/sql/187_play_assinaturas.sql` no Supabase (SQL Editor).
Sem ela a compra não é registrada — e compra não registrada não é confirmada, e
o Google devolve o dinheiro em 3 dias.

## Passo 7 — Versão nova do app (com a cobrança ligada)

O `twa-manifest.json` de `C:\Users\jenif\sora-android` já está com
`playBilling: true` e `appVersionCode: 11` (o anterior era 10 — o guia antigo
dizia 3 e estava desatualizado; **confira no Play Console → Explorador de pacotes
que nenhum envio usou 11**).

```bash
cd C:\Users\jenif\sora-android
bubblewrap update
bubblewrap build
```

Suba o `app-release-bundle.aab` primeiro na faixa **Teste interno**.

## Passo 8 — Testar sem gastar

1. Play Console → **Configurações** → **Teste de licença** → adicione o seu
   Gmail (e o de quem for testar). Compras dessas contas são de mentira.
2. Instale o app pelo link do **Teste interno** (instalado de outro jeito, a
   cobrança não funciona).
3. Na conta de teste: aba bloqueada → **Ver o plano** → **Assinar** → janela do
   Google. Em teste a assinatura mensal **renova a cada 5 minutos** e expira
   sozinha depois de algumas renovações — dá pra ver renovação e expiração no
   mesmo dia.
4. Conferir: o plano libera na hora; `play_assinaturas` ganha a linha com
   `reconhecida = true`; cancelar na Play Store mantém o plano até o fim do
   período; quando expira, a conta volta pro **grátis**.
5. Trocar de plano: Básico → Premium libera na hora (cobra a diferença);
   Premium → Básico fica pra próxima renovação.

Só depois disso: promover o pacote pra **Produção**.

---

## Regras que não podem regredir

- **Recusar = não confirmar = o Google reembolsa.** Conta vitalícia ou que já
  paga pelo Stripe não ganha plano pela Play; a compra não é confirmada e o
  Google devolve o valor sozinho em 3 dias (`lib/play-sync.ts`).
- **O estado vem SEMPRE da API do Google**, nunca do app nem do aviso. Por isso
  a rota de avisos aceita uma senha simples na URL.
- **Só rebaixa quem ganhou o plano pela Play** (`users.plano_fonte = 'play'`).
  Vitalício, Stripe e cortesia do admin nunca são tocados por aviso da Play.
- **Fim da assinatura Play → `gratis`**, nunca `inativo` (que no site é paywall).
- **Validade = vencimento + 1 dia**: o `exigirPlano` do backend expira o plano
  sozinho, e o aviso de renovação pode chegar com atraso.
- **No app não se fala do site nem de outro meio de pagamento.**
- **Site × Play:** quem assina pela Play não vê a grade do Stripe no site, e o
  checkout do Stripe recusa com 409. O "Gerenciar" leva à Play Store.
- **Excluir conta** (botão do /admin) cancela a assinatura Play antes de apagar.

## Ainda não coberto (decisão consciente, fase seguinte)

- **Kit/vitalício não compram pela Play** (o app mostra só a nota "seu acesso é
  vitalício"). Migrar vitalício → assinatura segue sendo pelo site.
- **Conexão avulsa de Open Finance (R$ 6) não é vendida no app.**
- **MRR do /admin** ainda não soma os assinantes da Play (e eles rendem 85% do
  preço — o Google fica com 15%).
