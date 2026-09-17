# Moeda principal (base) configurável — plano aprovado

> **Status:** EM ANDAMENTO. Fases **0, 4, 1 e 2 feitas**; **Fase 5 em andamento** (5a, 5b e 5c feitas — 17/09/2026).
> **Decidido pelo dono:** as duas primeiras moedas são **USD (dólar)** e
> **NOK (coroa norueguesa)**; no MVP a moeda base **trava** depois que o grupo
> tem lançamento.

---

## 0. Progresso

### ✅ Fase 0 — a coluna e a propagação (16/09/2026)

- `sql/168_moeda_base_grupo.sql` — `grupos.moeda_base text not null default 'BRL'`,
  sem CHECK. **Precisa rodar à mão.** Tudo abaixo funciona antes dela.
- `lib/ssr.ts` (`contextoSSR`) devolve `moedaBase`; `/api/me` traz
  `grupo_ativo.moeda_base`; `Perfil` no `AuthContext` tipado.
- ⚠️ **As duas leituras são TOLERANTES**: tentam com a coluna e, se o erro for
  dela (`column grupos_1.moeda_base does not exist` — mensagem MEDIDA), refazem
  sem. O "não existe" **expira em 10 min**, nunca dura o processo: com flag
  permanente a instância que já estava no ar ignoraria a migration até o
  próximo deploy.
- ⚠️ **No `contextoSSR` o embed usa o alias `grupo`, não `grupo_ativo`** — com o
  mesmo nome o objeto substituiria o uuid e o `grupoId` das 11 abas quebraria.
- **Mudança em relação ao plano: `middlewares/auth.js` NÃO foi tocado.** Ele roda
  em toda requisição e nenhuma rota do backend formata dinheiro pro painel (quem
  formata é o painel). O WhatsApp tem leitura própria. Seria egress no caminho
  mais quente sem consumidor. Quando o backend precisar, `moedaBaseDoGrupo()`.
- **Achado de passagem:** `routes/webhook.js` (`obterContexto`) e
  `routes/users.js` (`GET /api/user/:phone`) embutiam `grupos` por
  `users_grupo_ativo_fkey`, nome que **não existe** (o certo é
  `fk_users_grupo_ativo`, medido). Os dois caminhos estavam MORTOS (nenhum
  chamador), então não era bug vivo — mas o plano contava com o embed do
  webhook. Corrigidos.

### ✅ Fase 4 — câmbio com pivô (16/09/2026)

- `services/moeda.js`: `taxaEntre(de, para, tabela)`, `paraBase(valor, moeda,
  base, tabela)` e `moedaBaseDoGrupo(grupoId)`. O BRL virou pivô:
  `USD→NOK = 5,1435 ÷ 0,5515 = 9,33`.
- ⚠️ **Faltando qualquer ponta, a taxa é `null` — nunca 1.** Também com cotação
  zero ou NaN no destino (divisão por zero).
- **`paraBRL` continua existindo e intocado** — 13 arquivos o chamam; some quando
  a Fase 5 migrar os consumidores. A conversão **não** foi espelhada no
  `lib/moeda.ts`, de propósito: a regra da casa é o painel receber valores já
  convertidos, numa fonte só.
- `eval:moeda` ganhou a seção do pivô: **regressão zero** (`paraBase(…, 'BRL')`
  bit a bit igual a `paraBRL` em 7 casos), null nas pontas faltando, e ida e
  volta USD→NOK→USD. A tolerância do `moedaBaseDoGrupo` foi testada **contra o
  banco real sem a migration**: devolve BRL e a 2ª chamada faz **zero** idas.

### ✅ Fase 1 — o formatador único no painel (17/09/2026)

- **A moeda chega pelo SERVIDOR**, igual ao cookie de valores ocultos:
  `app/(app)/layout.tsx` lê `contextoSSR().moedaBase` e passa ao
  `MoedaBaseProvider` (`lib/moeda-base.tsx`). Lida só no cliente, o HTML sairia
  com `R$` e trocaria depois da hidratação. `contextoSSR` virou `React.cache`:
  layout e página dividem UMA leitura por requisição.
- ⚠️ **NÃO é o `formatarMoeda` — o plano estava errado aqui.** Medido: o painel
  inteiro formatava com `Intl.NumberFormat('pt-BR', {style:'currency'})`, que dá
  `-R$⍽1.250,50` (sinal antes, espaço INQUEBRÁVEL); o `formatarMoeda` dá
  `R$ -1.250,50` com espaço comum. Adotá-lo mudaria todo valor da tela. O novo
  `formatarDinheiro` (`lib/moeda.ts`) usa o mesmo Intl e troca só o símbolo pelo
  do catálogo (o Intl escreve "NOK"/"JP¥"; a Sora, "kr"/"¥").
- **Hooks:** `useDinheiro({ entrada, maximoCasas })`, `useSimboloMoeda()` e
  `useComSimbolo(f)` (compacto de eixo). ⚠️ `entrada` reproduz o que cada tela
  fazia com valor inválido — `cru` (`format(v)`), `ouZero` (`v || 0`),
  `finitoOuZero` (`Number.isFinite(v) ? v : 0`). Não unificar: divergem em NaN e
  Infinity.
- **47 arquivos migrados.** 39 formatadores de módulo por codemod AST (resolve
  cada referência pelo SÍMBOLO do TypeScript, insere o hook no topo de cada
  componente que usa — 82 inserções — e recusa referência fora de componente);
  o resto à mão: `RatearModal` (centavos), `ContaDebitoSelect` (formatador
  interno), 3 `Intl` inline dos limites, 4 `toLocaleString`, 4 compactos de
  eixo/calendário, 5 textos `R$ 0,00` e 20 prefixos/rótulos de campo.
- **Removidos 2 compactos MORTOS** (`fmtShort` do dashboard, `fmtCompact` dos
  relatórios) — o lint antes/depois confirmou que não eram usados.
- **Prova de regressão zero:** `eval:dinheiro` §7 renderiza os hooks e compara
  cada modo com a expressão EXATA que ele substituiu, em 26 valores (NaN,
  Infinity, −0…), com e sem provider — mutation-testado (8 e 6 falhas). tsc,
  build e os 18 evals do front passam; lint dos 50 arquivos tocados **idêntico**
  ao de antes (704 → 702, só os dois mortos).
- ⚠️ **Fica em real DE PROPÓSITO:** preço da Sora (Comunidade, Configurações,
  Open Finance, /planos), admin, landing/venda, Wrapped e onboarding (fora do
  provider — lá o hook devolve BRL, igual a antes) e **Negócios** (painel irmão,
  sem o provider; Fase 5).
- ⚠️ **Pendentes medidos, NÃO criados por esta fase:**
  - **Saldo de carteira em moeda ESTRANGEIRA em modais** — `ContaDebitoSelect`,
    `TransferenciaModal` e o "Novo saldo" do ajuste formatam `wallet.saldo`
    (NATIVO, migration 144) com o formatador do painel. Já era assim com `R$`.
    Exceção feita: o prefixo do **cheque especial** no cadastro de conta usa o
    símbolo DA CONTA, igual ao "Saldo inicial" logo acima — o backend soma os
    dois (`disponivel = saldo + cheque_especial`), então são a mesma unidade.
  - **`NovoInvestimentoModal`** crava `R$` junto da cotação, que vem em BRL do
    serviço de cotações → Fase 5 (investimentos).
  - **`saldo_brl`** continua em reais: com a base em coroa o "≈" das contas
    estrangeiras sairia com símbolo de coroa e número de real. **Nenhum grupo
    pode ter base ≠ BRL antes da Fase 5** (e hoje não há como escolher — a
    escolha é a Fase 6).

### ✅ Decidido (17/09/2026) — a grafia dos números segue o IDIOMA, não a moeda

O §3/§5.9 previa a grafia **seguir o locale da moeda** (NOK: `20 000,00 kr`).
**Decisão do dono: fica a grafia pt-BR com o símbolo da moeda**
(`kr 20.000,00`, `US$ 1.250,50`). Moeda é do GRUPO; idioma é do USUÁRIO — eixos
separados. Isso derruba as armadilhas 4 e 9 do §5 como "ataque de cara": quem
digita e lê é o usuário em português, e ele escreve `1.250,50` também num grupo
em dólar.

### ✅ Fase 2 — entrada de valor (17/09/2026)

- **12 campos de valor do painel** liam os dígitos com `/ 100` e 2 casas
  cravadas. Hoje leem as casas da moeda que está sendo DIGITADA:
  `casasDaMoeda`, `valorDasUnidades`, `unidadesDoValor` e `textoDasUnidades`
  (`lib/moeda.ts`). A moeda é a **base do grupo** em metas, dívidas, limites,
  cartão, pagar fatura/parcela e rateio; e a **da CONTA** em Nova transação e
  Conta fixa, que já digitavam na moeda da conta (migration 144).
- ⚠️ **Dormente em USD e NOK** (2 casas, igual ao real). Existe pra armadilha
  5 não voltar na primeira moeda sem centavos: em iene, "1250" era gravado
  como 12,50.
- **Em BRL nada muda:** `eval:dinheiro` §8 compara os helpers com as
  expressões exatas que substituíram (`parseInt(raw) / 100`, o
  `toLocaleString` com e sem máximo de casas, `Math.round(v * 100)`) em 20
  entradas e 12 valores de ida e volta — mutation-testado (4 e 4 falhas).
  tsc, build e os 18 evals passam; lint dos 14 arquivos idêntico (82 → 82).
- **`parseValor` do WhatsApp NÃO mudou**, por causa da decisão da grafia: quem
  digita é o usuário em português, e ele escreve `1.250,50` também num grupo
  em dólar. A armadilha 4 deixa de "atacar de cara".
- ⚠️ **Movido pra Fase 3:** tirar o prefixo e a palavra da moeda na
  normalização do interpretador ("US$ 50", "50 dólares", "200 coroas"). Não é
  entrada de valor, é SEMÂNTICA do WhatsApp: num grupo em real "50 dólares" é
  lançamento em moeda estrangeira (migration 160); num grupo em dólar é a
  própria base. Só dá pra decidir junto com os handlers.
- ⚠️ **Fica pra Fase 5:** os campos de centavos de **Negócios** (fora do
  provider) e o `ehEstrangeira(moedaConta)` de Nova transação e Conta fixa, que
  compara com BRL (armadilha 10) — só faz sentido trocar junto com a conversão
  do backend pra base.

### ✅ Fase 5 — subsistemas que cravam real (17/09/2026)

**5a — backend converte pra BASE (feito, `sora-backend` 5f2e15a).**
- `camposTransacao(v, moeda, tabela, base)` e `somarSaldos(ws, tabela, base)`
  com base opcional (default BRL); `taxasParaBase`, `saldoNaBase`,
  `comSaldoNaBase` (payload ganha `moeda_base`/`saldo_base`/`taxa_base`;
  `saldo_brl`/`taxa_brl` seguem em real, sem renomear — armadilha 6).
- ⚠️ **Invariante escrita no `services/moeda.js`:** `transacoes.moeda` NULL = na
  base; preenchida = conta de outra moeda. A coluna `taxa_brl` passa a guardar a
  taxa PARA A BASE (em grupo em real, é a mesma coisa). Medido: nenhuma linha
  com `moeda = 'BRL'`.
- `moedaBaseDoGrupo` com **cache de 10 min por grupo** (egress) e
  `esquecerMoedaBase(grupoId)`. ⚠️ **A Fase 6 (escolher a moeda) TEM de trocar a
  base por uma rota do backend que chame `esquecerMoedaBase`** — gravando direto
  pelo Supabase, esta instância converteria pela base antiga por até 10 min.
- Pontos migrados: lançamento do painel e do zap, mover de conta, confirmar e
  criar/editar conta fixa, cron de câmbio das contas fixas, "Paguei", rateio, a
  pagar no cartão, Oráculo, "ver saldos", `/api/wallets` e `/api/dashboard`.
  ⚠️ **Conta que não existe é lida como a BASE, não como real** (o 'Dinheiro' que
  ainda vai nascer).
- ⚠️ **Conta nova sem moeda nascia em real** — o default da coluna é 'BRL' e 8
  caminhos do backend criam carteira sem mandar moeda. [`sql/169`](../../sora-backend/sql/169_wallet_moeda_da_base.sql)
  troca o default por um gatilho que usa a base do grupo. **Obrigatória antes
  da Fase 6.** O POST do painel já manda a base na criação.
- `evals/moedaBase.eval.js` (`npm run eval:moeda-base`): em BRL compara com
  cópia congelada das funções antigas (3.582 casos) e passa pela rota real; em
  USD/NOK cobre conversão, cache, rotas, cron, "Paguei", rateio e cartões.
  Mutation-testado.

**5b — painel soma na BASE (feito, `sora-frontend` 80a89b4).** `saldoNaBase`,
`somarSaldosNaBase`, `taxaParaBase`, `ehEstrangeira(m, base)`; SSR manda os
mesmos campos. Dashboard, Resumo, Transações, Previstos/Extrato, Relatórios e
Contas somam na base; Nova transação e Conta fixa comparam com a base e o "≈"
sai nela; conta nova abre na base. `eval:moeda` §7 prova igualdade com
`saldoBRL` em toda forma de payload.

**5c — investimentos (feito).** A cotação, na moeda em que o ativo é negociado,
vira a base no "Atualizar preços", no job das 03:00 e na cotação do modal
(`precoBase`) — `fatorCotacaoParaBase`.
- ⚠️ **Defeito anterior corrigido (decisão do dono: "só corrigir", sem aviso ao
  cliente):** cotação estrangeira entrava sem conversão até em grupo em real. Um
  "MELI" (40 cotas, Nasdaq a US$ 1.838) aparecia como R$ 73.157,60 e passa a
  ~R$ 378 mil. Raio medido nos 170 investimentos com ticker: 37 em real (nada
  muda), 131 sem cotação, 2 em dólar.
- ⚠️ **A caixa da sigla importa:** o Yahoo cota Londres em "GBp" (pence); em
  maiúsculas viraria libra, 100× maior. Sigla fora do catálogo não converte.
- ⚠️ **Defeito anterior registrado, NÃO corrigido:** o job das 03:00 cota TODO
  ticker pelo Yahoo, inclusive cripto. Um "BTC" (0,012) é cotado como um fundo
  americano de US$ 33,79 e aparece como R$ 0,40 (R$ 2,09 depois da conversão) —
  a rota do painel usa o CoinGecko pra cripto, o job não.

**✅ Decidido — Negócios continua em real.** A empresa é tratada como
brasileira (DRE, Simples/DAS, Hotmart). Nada a fazer: o painel de Negócios fica
fora do `MoedaBaseProvider` (hooks devolvem BRL) e o "+" de nova transação
pessoal já é escondido lá (`BottomNav`, `ehNegocios`).

**5d — Open Finance em grupo fora do real: CONTAS (feito, decisão do dono).**
A conta do banco entra como conta **em real** dentro do grupo (igual à conta em
dólar lançada à mão num grupo em real), e cada lançamento é gravado convertido:
`valor` na base, original em `valor_moeda`, taxa em `taxa_brl`
(`inserirTransacoes(…, cambio)`).
- ⚠️ **Não dava pra "deixar como está":** o sync gravava o lançamento sem moeda,
  e num grupo em dólar R$ 100 contariam como US$ 100 em todo o painel.
- ⚠️ **Empréstimo, investimento e caixinha NÃO são importados** num grupo fora
  do real — o sync nem os busca na Celcoin. Todos gravam real em tabela que o
  painel soma como moeda do grupo. A tela de Open Finance **avisa antes** de a
  pessoa conectar; o relatório do sync também registra. (O **cartão** passou a
  ser importado no 5e/C3.)
- ⚠️ **A cobrança que ASSUME a previsão da conta fixa** (`reconciliarPrevisto`)
  passa a levar o original e a taxa do banco — antes só o `valor`, e a linha
  ficaria com o nativo da previsão.
- Conta de OF em moeda ESTRANGEIRA num grupo em real (Wise via OF) passa a
  converter também — medido: 0 hoje.
- `eval:moeda-base` §8 passa pelo `sincronizarConsentimento` real com Celcoin e
  banco falsos, nos dois tipos de grupo. Mutation-testado.

**5e — Cartão numa moeda diferente da base (C1 backend, C2 painel, C3 sync — feito).**
Suporte ao cartão em outra moeda que a do grupo. O caso real é o cartão do Open
Finance (só fala real) num grupo em dólar, que o sync **passou a importar** (C3):
cartão com `moeda: 'BRL'`, lançamentos convertidos (`inserirTransacoes(…, cambio)`),
faturas publicadas, limite, pagamentos e parcelas previstas em real.
- **A regra:** fatura, limite, pagamentos e parcelas previstas ficam NA MOEDA
  DO CARTÃO, que é o número que o app do banco mostra. A soma da fatura usa o
  original (`valor_moeda ?? valor`). Só quem SOMA cartão com outra coisa
  converte pra base: "Fatura atual" e gráfico da aba Cartões, Previstos, a
  seção de gastos fixos em Transações, pendências dos Relatórios, "a pagar",
  "gastos por cartão" (zap), Oráculo e Agenda.
- **Payload:** `/faturas` e `/fatura/status` trazem `moeda`, `moeda_base`,
  `taxa_base` e `bloqueio_pagamento`. No painel: `useDinheiro({ moeda })` pro
  valor de um cartão; `valorDoCartaoNaBase` / `faturaNaBase` pra somar.
- ⚠️ **Pagar fatura e antecipar parcela ficam TRAVADOS nesse cartão**, em todas
  as portas: painel (`/fatura/pagar`, `/antecipar-cartao`), WhatsApp (pagar
  fatura, antecipar parcela) e o aviso automático de fatura do cron (só avisa,
  não pergunta a conta). Debitar uma conta pela fatura misturaria moedas, e o
  pagamento desse cartão já chega pelo banco (`registrarPagamentosDoOF`). A tela
  explica em vez de mostrar botão. **Grupo em real NUNCA trava.** Confirmado
  pelo dono (17/09/2026). Se um dia liberar, o caminho é converter o débito pra
  moeda da conta — medir antes.
- **Compra parcelada** (painel e zap) no cartão fora da base guarda o original
  e converte `valor`, igual ao lançamento avulso. O comando **"parcelas"** do
  zap mostra cada compra na moeda do cartão e o total na do grupo.
- ⚠️ **Editar o valor de uma linha convertida** (`PUT /transacoes/:id`) leva o
  original junto, pela taxa CONGELADA da linha (`originalDoValorNaBase`), e o
  saldo da conta anda pelo original. Antes só o `valor` mudava: a fatura do
  cartão (que soma o original) ficava parada, e numa conta em coroa o saldo
  andava o valor em real. Bug de antes da 168 (afetava as 3 contas em outra
  moeda da base); o WhatsApp já fazia certo.
- ⚠️ **Oráculo lia carteira sem `moeda` no select** — conta em outra moeda era
  somada como real no caixa (bug de antes da 168, corrigido junto).
- Medido antes (17/09/2026): 232 cartões, todos em real; 218 grupos em real;
  nenhuma transação de cartão com `valor_moeda`. **Nada muda pra quem já usa.**
- `eval:moeda-base` §9 (rotas, zap, cron, Oráculo, Agenda; o banco falso passou
  a projetar as colunas do `select`, o que pegou a classe do bug do Oráculo) —
  25 mutações, todas detectadas; §8 ganhou o cartão importado (C3, mais 6
  mutações). `eval:moeda` §8 e `eval:dinheiro` no painel.
- A tela de Open Finance avisa que conta e cartão entram em real e que pagar
  pela Sora não fica disponível nesses cartões.

**5f — O resto do Open Finance em grupo fora do real (feito).** Empréstimo,
financiamento, investimento (com as movimentações) e caixinha passam a ser
importados também num grupo em dólar/coroa.
- **A regra:** essas tabelas não têm coluna de valor original, e o painel soma
  tudo como moeda do grupo. Então o item entra **CONVERTIDO** pelo câmbio do dia
  (`comDinheiroNaBase`) e é regravado a cada sync — o valor em dólar de um CDB
  em real muda com o câmbio, que é o certo pra quem vive em outra moeda. A
  movimentação do investimento é histórico: congela na taxa da entrada.
- ⚠️ **Sem câmbio o item NÃO entra** (e a caixinha existente não é apagada —
  ela conta como "vista" na reconciliação). Gravar real como dólar é o erro que
  isto existe pra impedir.
- **Rentabilidade** é razão (não muda com a conversão) e **quantidade** não é
  dinheiro. **Preço unitário** arredonda em 8 casas, não em centavo.
- ⚠️ **A FOTO DO PATRIMÔNIO somava `wallets.saldo` CRU** — nos dois lugares
  (`fotografarPatrimonio` do sync e o JOB 4 do cron). Num grupo em dólar a conta
  do banco entrava como dólar; num grupo em real, a conta em coroa entrava como
  real. Agora usa `totalDeSaldosNaBase` (sem carteira fora da base, é a soma de
  sempre, sem ida de rede). Bug de antes da 168 — afeta o grupo com as 3 contas
  em outra moeda.
- Medido antes: os 632 investimentos e as 14 caixinhas do Open Finance estão
  **todos em real**, como os 218 grupos. **Nada muda pra quem já usa.**
- `eval:moeda-base` §8 (empréstimo, investimento, movimentação, caixinha e a
  foto, nos dois tipos de grupo) — 11 mutações, todas detectadas. O banco falso
  aprendeu o `not(col, 'in', …)` da reconciliação (sem ele apagava a caixinha
  que acabara de entrar) e a paginação (`range`).

### ✅ Fase 3 — textos do WhatsApp (17/09/2026)

Os 370 `R$` cravados viraram `services/moeda.formatar`. A porta única é
**`formatadorDoGrupo(grupoId)`** (`const fmt = await formatadorDoGrupo(id)`), e
a base é cacheada 10 min — chamar por item não custa ida de rede.

- **Três moedas convivem no mesmo texto, e é de propósito:** o **grupo** (todo
  total, porque `transacoes.valor` já está na base), a **conta** (saldo é
  NATIVO — conta em coroa responde em coroa) e o **cartão** (fatura, limite e
  parcela ficam na moeda dele). Foi o erro mais fácil de cometer: formatar o
  saldo de uma conta em dólar com o símbolo do grupo.
- ⚠️ **O formato mudou pra TODO MUNDO, inclusive em real:** `R$ 1234.56` virava
  `toFixed(2)` com ponto em dezenas de linhas; agora sai `R$ 1.234,56`. É
  correção de um defeito antigo, não regressão.
- ⚠️ **O símbolo é concatenado À MÃO** em `formatar`, nunca `style: 'currency'`:
  o Intl insere um **espaço não separável (U+00A0)** entre símbolo e número, e
  caractere invisível dentro de **parâmetro de template da Meta** é risco que só
  aparece em produção. Medido no corpo do resumo: a única diferença pro texto
  antigo é justamente esse NBSP virando espaço comum.
- ⚠️ **O PROMPT DA IA DO RESUMO TAMBÉM FALA A MOEDA DO GRUPO** — few-shot
  inclusive. A instrução manda a IA *não* repetir valores, mas o 3º exemplo
  mostra ela citando um ("um IOF de R$120"): com os exemplos em real, um grupo
  em coroa receberia a frase falando em reais. **Provado byte a byte:** com a
  base em BRL o prompt sai idêntico ao do commit anterior, nas 8 mensagens.
- **Ficam em real de propósito:** `data/faq.js`, `routes/webhook.js` e
  `services/ia.js` (são os **preços da Sora**, cobrados em real) e a aba
  Negócios inteira (decisão já registrada acima).
- **Sobrou um `console.log`** em `services/reconciliarPrevisto.js` com `R$`
  cravado — é log de servidor, ninguém lê pelo WhatsApp; formatá-lo exigiria uma
  consulta de moeda só pra isso.
- Suíte do backend inteira verde (55 evals) + `eval:moeda-base` §9 com o texto
  no formato novo.

**⏭️ Próximo:** Fase 6 (escolher a moeda no onboarding). Hoje **nenhum grupo sai
do real**, então tudo das Fases 3 e 5 é inerte até ela existir.

**Pendentes anotados, fora da moeda base:** `fotografarPatrimonio` soma
`wallets.saldo` cru (conta estrangeira entra sem conversão no gráfico de
patrimônio — já era assim).

---

## 1. Estado real medido (corrige o CLAUDE.md)

O CLAUDE.md, na seção de i18n, diz que *"transações não têm coluna de moeda —
hoje é implícito BRL"*. **Está desatualizado.** Já existe uma camada de moeda
madura:

| Já existe | Onde |
|---|---|
| `wallets.moeda` + saldo NATIVO | `sql/144_moeda_carteira.sql` |
| `transacoes.moeda` / `valor_moeda` / `taxa_brl` | idem |
| `recorrencias.moeda` / `valor_moeda` / `taxa_brl` | `sql/160_recorrencia_moeda.sql` |
| `cotacoes_moeda` (última cotação conhecida) | `sql/159_cotacoes_moeda.sql` |
| Aritmética canônica + espelho no painel | `services/moeda.js` · `lib/moeda.ts` · `eval:moeda` |
| Catálogo de 12 moedas com casas decimais certas (JPY/CLP sem centavos) | idem |
| Cron diário que aquece as cotações (JOB 1M) | `jobs/index.js` |

**Medido na base de produção em 15/09/2026 (leitura, sem escrita):**

```
carteiras ......... 619    →  616 BRL · 2 NOK · 1 EUR
grupos ............ 217    →  1 com conta estrangeira · 104 com transação
transações ........ 23.364 →  19 com moeda ≠ null
recorrências ...... 7 com moeda
cotacoes_moeda .... 11 moedas gravadas (USD 5,1435 · MXN 0,2999 · NOK 0,5515 …)
maior grupo ....... 1.332 transações   (mediana: 78)
colunas de dinheiro  51, em 40 tabelas (só nas migrations versionadas)
```

Superfície de exibição:

```
frontend ... 64 arquivos com `currency: 'BRL'`  (60 client, 4 server/lib)
             96 arquivos com 'pt-BR' · 29 `toLocaleString('pt-BR'`
backend .... 370 ocorrências de "R$" em 52 arquivos
             só 13 arquivos importam services/moeda (o resto formata na mão)
```

O que **não** existe é a moeda BASE: `BRL` é constante global (`PADRAO` no
backend, `MOEDA_PADRAO` no painel). Moeda estrangeira hoje é sempre
*secundária* — a conta em dólar existe, mas tudo converte pra real pra somar.

---

## 2. Arquitetura

### 2.1 A moeda base é do GRUPO, não do usuário

Não é preferência, é correção. Duas pessoas compartilham um grupo e leem as
MESMAS linhas de `transacoes`. Com base por usuário, o mesmo `valor = 1000`
sairia R$ 1.000 pra um e US$ 1.000 pro outro — dois números pro mesmo dinheiro.

O **idioma** continua por usuário (eixo separado, já existe como
`x-sora-locale`). Um brasileiro pode ler em português um grupo em coroa.

### 2.2 `valor` deixa de significar "BRL" e passa a significar "na moeda base"

É a única mudança conceitual do plano, e é o que a torna barata. As migrations
144 e 160 cravam em maiúsculas que *"`valor` é SEMPRE BRL"*, e é essa regra que
faz dashboard, categorias, relatórios, limites, Wrapped e Oráculo continuarem
certos sem uma linha alterada. Redefinindo a CONSTANTE em vez do modelo:

> `transacoes.valor` está **sempre na moeda base do grupo**, congelado na entrada.

Todos aqueles consumidores seguem corretos **sem alteração**, porque um grupo
nunca mistura bases e **nada no sistema soma dinheiro entre grupos** — conferido:
o `/admin` só soma preço de plano, nunca toca `transacoes` nem `wallets`. Pros
217 grupos de hoje, `moeda_base = 'BRL'` e nada muda.

⚠️ **Descartado:** guardar tudo em BRL e converter na exibição. O próprio
repositório já explica por quê em dois lugares — o "gasto de março" mudaria todo
dia junto com o câmbio, e a cotação se espalharia por 22 consumidores, que é a
receita das "5 cópias divergentes da mesma regra" que este projeto já pagou caro.

### 2.3 O câmbio continua com o real como PIVÔ

`cotacoes_moeda` guarda `taxa_brl` de cada moeda e as 11 já estão populadas.
Taxa cruzada sai de divisão: `USD→NOK = 5,1435 ÷ 0,5515 = 9,33`. Nenhuma fonte
externa nova, nenhuma tabela nova — só `taxaPara(de, para)` onde hoje existe
`taxa(moeda)`. O BRL vira detalhe de implementação em vez de significado.

---

## 3. O que USD + NOK ativam (e o que adiam)

Escolher estas duas primeiro tem consequências concretas:

- ✅ **Zero trabalho de catálogo.** As duas já estão em `MOEDAS` nos dois repos,
  com símbolo e locale, e as duas já têm cotação gravada.
- ✅ **NOK tem cliente real.** Foi o relato que originou a migration 160
  ("recebo meu salário em NOK") e há 2 carteiras NOK na base — dá pra validar
  com dado de verdade, não com conta de teste.
- ✅ **A armadilha da máscara `/100` fica DORMENTE.** Ela só ataca moeda sem
  centavos (JPY, CLP). USD e NOK têm 2 casas. Mesmo assim o código nasce lendo
  `MOEDAS[m].casas` — a armadilha volta na primeira moeda sem centavos.
- ⚠️ **A armadilha da GRAFIA ataca de cara, e nas duas.** USD escreve
  `1,250.50` (en-US) e NOK escreve `1 250,50` (nb-NO, milhar com espaço).
  Hoje `formatarMoeda` usa `pt-BR` **sempre**, com justificativa explícita no
  código ("o usuário é brasileiro e lê 6.834,56") — premissa que cai aqui.
- ⚠️ **O `parseValor` do WhatsApp destrói valor em USD.** Ver §5.4.

---

## 4. As fases

Ordem recomendada: **0 → 4 → 1 → 2 → 5 → 3**. A 4 (pivô) antes da 1 porque o
formatador único precisa da taxa cruzada existindo; a 3 (WhatsApp, 370 pontos)
por último porque é volume, não risco.

### Fase 0 — a coluna e a propagação

`sql/168_moeda_base_grupo.sql`:

```sql
alter table public.grupos
  add column if not exists moeda_base text not null default 'BRL';
```

⚠️ **Sem CHECK constraint**, de propósito — é a regra da casa, escrita na
própria `services/moeda.js`: quatro incidentes desta base (`users_plano_check`,
`investimentos_tipo_check`, `dividas_tipo_check`, `plano='gratis'`) foram
gravação falhando CALADA por causa de CHECK. A validação fica em
`normalizarMoeda`.

⚠️ **A migration roda ANTES de o código subir.** Três leituras do caminho
crítico usam colunas explícitas e quebram a feature inteira se pedirem coluna
que não existe:

| Onde | Hoje | Vira |
|---|---|---|
| `lib/ssr.ts:51` | `select('phone, grupo_ativo')` | + embed `grupos(moeda_base)` |
| `app/api/me/route.ts:19` | `grupo_ativo:grupos!fk(id, nome, dono_id)` | + `moeda_base` |
| `middlewares/auth.js:86` | `select('id, phone, grupo_ativo, plano, …')` | + embed |

O WhatsApp sai de graça: `webhook.js:172` já faz
`select('*, grupos!users_grupo_ativo_fkey(*)')`.

Nenhuma é ida de rede nova — é embed na consulta que já acontece, o que importa
porque a conta de egress do Supabase é por NÚMERO de requisições.

⚠️ **Nunca guardar a moeda em variável de módulo no servidor.** Server
Components renderizam pedidos de usuários diferentes no mesmo processo: uma
global vazaria a moeda de um grupo pro outro. No painel a moeda vem de Context;
no servidor, sempre por parâmetro.

### Fase 1 — o formatador único (painel)

64 arquivos com `currency: 'BRL'`, cada um com o seu `const fmt = …` copiado.
**60 são client components**; só 4 rodam no servidor (`lib/wrapped/build.ts`,
`lib/lancamentos.ts`, `lib/landing-precos.ts`, `app/api/mercadopago/webhook`).

- `MoedaProvider` (Context, alimentado por `perfil.grupo_ativo.moeda_base`) +
  hook `useMoeda()` → devolve `fmt`.
- Os 60 trocam o `fmt` local pelo do hook. Mecânico, mas é o grosso do trabalho
  — fazer por lote/aba, como foi o SSR.
- Os 4 do servidor recebem a moeda por parâmetro.
- `formatarMoeda` de `lib/moeda.ts` vira a fonte única (já trata `casas`).
- A grafia numérica passa a seguir o locale (o campo `locale` já existe em cada
  linha do catálogo `MOEDAS` do backend, sem uso até hoje).

⚠️ **`saldo_brl` é nome de campo de API, não coluna.** `lib/swr-cache.ts` guarda
payloads no localStorage: renomear pra `saldo_base` faria o cache antigo chegar
sem nenhum dos dois e cair no fallback. Se renomear, mandar os DOIS campos por
um release.

### Fase 2 — entrada de valor

- A máscara de `NovaTransacaoModal.tsx:232` faz `parseInt(raw) / 100`; a divisão
  passa a vir de `MOEDAS[m].casas` (dormente em USD/NOK, ver §3).
- `parseValor` e a normalização do interpretador passam a ser guiados pelo
  locale do grupo (ver §5.4).

### Fase 3 — WhatsApp

370 ocorrências de `R$` em 52 arquivos. Concentração: `polpCelcoinSync` (63),
`jobs/index.js` (29), `handlers/transacoes.js` (29), `handlers/investimentos.js`
(24). Só 13 arquivos já importam `services/moeda` — o resto formata na mão
(`R$ ${v.toFixed(2)}`).

Todo handler já tem `grupoId` em mãos → recebe `fmt` pronto ou chama
`formatar(v, moedaBase)`. A IA (`services/ia.js`) cita real no system prompt;
usar a skill `ai-prompting`, e a suíte de 116 casos do `interpretador.eval.js` é
a rede de proteção.

### Fase 4 — câmbio com pivô

- `taxa(moeda)` → `taxaPara(de, para)`, BRL como pivô interno.
- `paraBRL` → `paraBase`; `saldoEmBRL` → `saldoNaBase`; `comSaldoBRL` →
  `comSaldoNaBase`.
- ⚠️ A regra de ouro do arquivo **não muda**: falha de câmbio devolve `null`,
  NUNCA 0 — somar zero apaga o dinheiro do cliente da tela sem avisar.
- `aquecerCotacoes` (JOB 1M) já popula as 11 moedas todo dia → a taxa cruzada
  existe desde o primeiro minuto.
- `lib/ssr-data.ts:219-244` lê `cotacoes_moeda` direto no SSR: passa a dividir
  pelo par.

### Fase 5 — subsistemas que cravam real

| Subsistema | O que crava | Tratamento |
|---|---|---|
| **Investimentos** | 4 conversões `precoBRL` + CoinGecko `vs_currencies=brl` | converter pro par via pivô |
| **Open Finance** | Celcoin é só Brasil, devolve BRL | carteira nasce BRL e é convertida pra base; a regra de ouro da fatura (`−saldo`) não é tocada |
| **Negócios** | `lancamentos_negocio.valor` em CENTAVOS (unidade diferente) | formatador próprio, mesma base |
| **Planos (Stripe/MP)** | preço do produto, não dinheiro do usuário | fora de escopo — já tem `lib/landing-precos.ts` |

### Fase 6 — trocar a base depois de ter dados → **TRAVADO NO MVP (decidido)**

Existem **51 colunas de dinheiro em 40 tabelas** só nas migrations versionadas
(metas, dívidas, limites, aportes, faturas, rollover, parcelas previstas,
caixinhas, folha, vendas, estoque…). Trocar a base de um grupo com histórico
significa reescrever TODAS, com uma taxa, de uma vez — e um erro ali não dá tela
quebrada, dá número plausível e errado.

**Decisão do dono:** a moeda se escolhe no **onboarding** e fica travada
enquanto o grupo tiver lançamento. Grupo vazio troca à vontade. A tela
**explica** em vez de mostrar seletor cinza (regra `read-only-distinction` da
skill `ui-ux-pro-max` — botão cinza lê como "quebrou").

> Registrado pra quem reabrir isto: tecnicamente a conversão é barata (o maior
> grupo da base tem 1.332 transações). Se um dia virar requisito, é **fase
> própria**, com script auditado, taxa registrada e reversão — nunca um toggle.

---

## 5. Armadilhas medidas (não repetir)

1. **CHECK constraint na moeda** — quatro incidentes desta base foram isso.
   Validação no código.
2. **Coluna nova em `select()` de caminho crítico antes da migration** — quebra
   o app com "usuário não encontrado". Migration primeiro.
3. **Variável de módulo com a moeda no servidor** — vaza entre usuários no SSR.
4. **`parseValor` com formato errado.** `handlers/interpretador.js:54`:
   ```
   parseValor("1.000,50")  → 1000.50   ✅ formato BR
   parseValor("1,250.50")  → 1.2505    ❌ formato US — US$ 1.250 viram US$ 1,25
   ```
   Perda silenciosa de três ordens de grandeza. **Ataca no MVP** (USD).
   Junto: a normalização tira o prefixo `R$` e a palavra "reais" (foi o bug do
   áudio de set/2026) — precisa do símbolo e das palavras da moeda base.
5. **Máscara `/100` em moeda sem centavos** — valor 100× menor. Dormente em
   USD/NOK, viva em JPY/CLP.
6. **Renomear `saldo_brl`** — o cache do SWR em localStorage guarda payloads
   antigos.
7. **Câmbio ausente virando 0** — a regra que já existe e não pode regredir.
8. **Os comentários das migrations 144/160 viram documentação ERRADA** — eles
   cravam "valor é SEMPRE BRL" em maiúsculas, e quem ler depois vai acreditar.
   Reescrever junto com o código.
9. **Grafia `pt-BR` fixa** com símbolo estrangeiro — decisão consciente hoje,
   premissa derrubada por este plano.
10. **`ehEstrangeira()` compara com BRL** — passa a comparar com a base do
    grupo. São 8 chamadas.

---

## 6. Verificação

1. `npm run build` nos dois repos — erro de tipo BARRA o deploy desde set/2026,
   e é ele que vai acusar `fmt` esquecido.
2. `npm run eval:moeda` nos dois lados, estendido com base ≠ BRL e taxa cruzada
   (USD↔NOK é o par do MVP e não passa pelo real em nenhuma ponta visível).
3. `npm run eval` do interpretador (116 casos) — regressão do parse em PT é o
   risco nº 1.
4. **Grupo de teste com base USD e outro com base NOK:** lançar pelo painel e
   pelo WhatsApp; conferir dashboard, categorias, relatórios, previstos, extrato,
   Wrapped e o resumo do zap — todos com o símbolo e a grafia certos, nenhum
   "R$" sobrando.
5. **Grupo BRL existente: os mesmos 8 pontos idênticos aos de hoje.** É a
   regressão mais provável e a mais grave.
6. O grupo real com contas NOK/EUR (existe 1 na base): o saldo convertido não
   pode mudar de valor.
