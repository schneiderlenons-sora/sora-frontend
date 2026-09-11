import { venceEm, type RecorrenciaQuando } from './frequencia-recorrencia';
import type { ItemRecorrente, ItemParcelado, FaturaProjetada } from './previstos';

// =============================================================================
// EXTRATO FUTURO — "quanto eu preciso ter na conta em cada data?"
//
// Pedido de cliente, e ele descreveu a fórmula melhor do que qualquer spec:
//
//   "Algo semelhante a um extrato bancário, mostrando em cada data:
//    saldo anterior + entradas − saídas = saldo projetado. O ponto importante
//    é que essa visão considere também os valores PREVISTOS."
//
// ── O QUE ESTE ARQUIVO NÃO FAZ ──────────────────────────────────────────────
//
// ⚠️ ELE NÃO INVENTA REGRA NENHUMA SOBRE O QUE CAI NO MÊS. Quem decide se uma
// recorrência vence num dia é `venceEm` (porte canônico do backend, com eval de
// 11.315 combinações); as regras de dívida e fatura são as MESMAS de
// `linhasDoMes` em `lib/previstos.ts`.
//
// Isso não é preciosismo. Este projeto já teve CINCO regras de período de
// fatura coexistindo, e CINCO cópias do vencimento de dívida — e o sintoma é
// sempre o mesmo: duas telas mostrando números diferentes pro mesmo dado, sem
// o usuário ter como saber qual está certa. O eval deste arquivo trava
// exatamente isso: a soma das ocorrências datadas de um mês tem de bater, no
// centavo, com o total que `linhasDoMes` devolve pro mesmo mês.
//
// ── O QUE ELE ACRESCENTA ────────────────────────────────────────────────────
//
// `linhasDoMes` responde em granularidade de MÊS ("setembro sai R$ 4.300").
// Para "no dia 16 você fica negativo" é preciso DATAR cada ocorrência e
// acumular dia a dia. É só isso que este arquivo faz.
//
// ── AS TRÊS FONTES DE UMA LINHA ─────────────────────────────────────────────
//
//   1. TRANSAÇÃO REAL paga → `realizado`.
//   2. TRANSAÇÃO FUTURA não paga → `previsto` avulso (não se repete).
//      ⚠️ EXCETO as "[Previsto]" do cron: essas são a forma ANTIGA de
//      representar a ocorrência de uma recorrência, e nós já a geramos a partir
//      da regra. Contar as duas é a duplicata que o cliente relatou.
//   3. REGRA (recorrência / dívida / fatura) → `previsto`, gerado por data.
//
// ── QUITAÇÃO, PULO E ADIAMENTO ──────────────────────────────────────────────
//
// ⚠️ A CHAVE É `recorrencia_id + competencia`, NUNCA A DATA. É o que faz
// "paguei dia 8 a conta que vence dia 10" cancelar a previsão de setembro: a
// data difere, a competência não. Mesma ideia do `competenciaDoPagamento` que
// resolveu o pagamento de fatura do cartão.
// =============================================================================

const cent = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const ym = (iso: string) => String(iso).slice(0, 7);

export type LinhaExtrato = {
  data: string;
  tipo: 'Gasto' | 'Recebimento';
  /** SEMPRE positivo — o sinal vem de `tipo`. */
  valor: number;
  descricao: string;
  carteira?: string | null;
  origem: 'transacao' | 'recorrencia' | 'divida' | 'fatura';
  estado: 'realizado' | 'previsto';
  /** Valor incerto (conta variável): vira faixa na tela, não número cravado. */
  estimado: boolean;
  /** Só em previsão de recorrência — é por ela que a baixa acontece. */
  recorrenciaId?: string | null;
  competencia?: string | null;
  transacaoId?: string | null;
  adiada?: boolean;
  /**
   * Já está DENTRO do `saldoInicial` — aparece na lista, mas não move o saldo.
   *
   * ⚠️ ISTO IMPEDE UMA DUPLA CONTAGEM SILENCIOSA. `saldoInicial` é o saldo atual
   * das contas, que por definição já reflete tudo que foi PAGO. Somar de novo
   * uma transação paga inflaria o extrato inteiro. Mas escondê-la também é
   * ruim: quem acabou de tocar em "Paguei" veria a linha simplesmente sumir.
   * Ela fica visível, com ✓, e neutra na conta.
   */
  jaNoSaldo?: boolean;
};

export type DiaExtrato = {
  data: string;
  linhas: LinhaExtrato[];
  entradas: number;
  saidas: number;
  /** Saldo ao FIM do dia. */
  saldo: number;
  /** Quanto do saldo acumulado ainda é estimativa (para a faixa da tela). */
  incerteza: number;
};

export type Extrato = {
  saldoInicial: number;
  dias: DiaExtrato[];
  /**
   * O DIA MAIS APERTADO da janela — a resposta à pergunta do cliente.
   *
   * ⚠️ É o MENOR saldo do período, não "o primeiro negativo". Quem tem folga
   * nunca fica negativo e mesmo assim quer saber onde o caixa mais aperta; e
   * quem já está no vermelho precisa saber até onde vai afundar.
   */
  pior: { data: string; saldo: number } | null;
  temEstimativa: boolean;
};

export type Quitacao = { recorrenciaId: string; competencia: string };

export type Ajuste = {
  recorrenciaId: string;
  competencia: string;
  status: 'pulado' | 'movido';
  novaData?: string | null;
  novoValor?: number | null;
};

export type TransacaoExtrato = {
  id?: string | null;
  data: string;
  tipo: 'Gasto' | 'Recebimento';
  valor: number;
  observacao?: string | null;
  carteira_nome?: string | null;
  pago?: boolean | null;
  transferencia?: boolean | null;
  recorrencia_id?: string | null;
};

/** Marcas que o CRON escreve em `observacao` ao materializar uma ocorrência. */
const MARCA_PREVISTO  = '[Previsto]';
const MARCA_RECORRENTE = '[Recorrente]';

/** Sem acento, sem caixa, sem marca — pra casar o texto que NÓS escrevemos. */
function chaveTexto(s?: string | null) {
  return String(s || '')
    .replace(MARCA_PREVISTO, '').replace(MARCA_RECORRENTE, '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .trim().toLowerCase();
}

function diasEntre(de: string, ate: string): string[] {
  const out: string[] = [];
  const [a1, m1, d1] = de.split('-').map(Number);
  const [a2, m2, d2] = ate.split('-').map(Number);
  const cur = new Date(a1, m1 - 1, d1);
  const fim = new Date(a2, m2 - 1, d2);
  // Trava de sanidade: janela absurda não pode travar o navegador.
  for (let i = 0; cur <= fim && i < 800; i++) {
    const mm = String(cur.getMonth() + 1).padStart(2, '0');
    const dd = String(cur.getDate()).padStart(2, '0');
    out.push(cur.getFullYear() + '-' + mm + '-' + dd);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/**
 * Monta o extrato dia a dia.
 *
 * `saldoInicial` é o saldo das contas de DÉBITO no instante `de` — cartão fica
 * de fora (o saldo de uma carteira de crédito é a FATURA, não dinheiro
 * disponível), exatamente como em `lib/saldo-projetado.ts`.
 */
export function montarExtrato(params: {
  de: string;
  ate: string;
  saldoInicial: number;
  transacoes: TransacaoExtrato[];
  recorrencias: (ItemRecorrente & { id?: string; carteira?: string | null })[];
  dividas: (ItemParcelado & { id?: string; carteira?: string | null })[];
  faturas: (FaturaProjetada & { carteira?: string | null })[];
  quitacoes?: Quitacao[];
  ajustes?: Ajuste[];
  /** Só considera estas carteiras. Vazio/ausente = todas. */
  carteiras?: string[];
}): Extrato {
  const { de, ate, saldoInicial } = params;

  const quitadas = new Set(
    (params.quitacoes || []).map((q) => q.recorrenciaId + ':' + q.competencia),
  );
  const ajustePor = new Map(
    (params.ajustes || []).map((a) => [a.recorrenciaId + ':' + a.competencia, a]),
  );
  const filtro = params.carteiras && params.carteiras.length ? new Set(params.carteiras) : null;
  const naCarteira = (c?: string | null) => !filtro || (c ? filtro.has(c) : false);

  const porDia = new Map<string, LinhaExtrato[]>();
  const push = (l: LinhaExtrato) => {
    if (l.data < de || l.data > ate) return;
    if (!naCarteira(l.carteira)) return;
    const arr = porDia.get(l.data) || [];
    arr.push(l);
    porDia.set(l.data, arr);
  };

  // ── 1. Transações ─────────────────────────────────────────────────────────
  for (const t of params.transacoes || []) {
    // ⚠️ Transferência NÃO entra: ela move dinheiro entre contas próprias e
    // somá-la faria o saldo projetado subir ou cair sozinho. Mesma regra de
    // `resumoTransacoes` no backend.
    if (t.transferencia) continue;
    const ehPrevistoDoCron = String(t.observacao || '').startsWith(MARCA_PREVISTO);
    // A forma antiga da MESMA ocorrência que já geramos pela regra abaixo.
    if (ehPrevistoDoCron && t.pago === false) continue;
    const desc = String(t.observacao || '').replace(MARCA_PREVISTO, '').trim();
    push({
      data: String(t.data).slice(0, 10),
      tipo: t.tipo,
      valor: cent(Math.abs(Number(t.valor) || 0)),
      descricao: desc || (t.tipo === 'Gasto' ? 'Gasto' : 'Recebimento'),
      carteira: t.carteira_nome,
      origem: 'transacao',
      estado: t.pago === false ? 'previsto' : 'realizado',
      estimado: false,
      transacaoId: t.id,
      recorrenciaId: t.recorrencia_id || null,
      // Paga = o dinheiro já saiu/entrou e o saldo das contas já reflete isso.
      jaNoSaldo: t.pago !== false,
    });
  }

  const dias = diasEntre(de, ate);

  // ── 1B. QUITAÇÕES IMPLÍCITAS — o que o CRON já materializou ───────────────
  //
  // ⚠️ ISTO CORRIGE UMA CONTAGEM EM DOBRO REAL. No modo `lancar`, o cron cria a
  // transação no dia do vencimento como `[Recorrente] <descrição>`, JÁ PAGA — e
  // **sem `recorrencia_id`**, porque ele é anterior à migration 165. Sem
  // reconhecer essa linha, o extrato gerava a previsão da mesma ocorrência por
  // cima dela: no dia do vencimento, R$ 1.700 saíam duas vezes do saldo
  // projetado (medido).
  //
  // ⚠️ AQUI CASAR POR TEXTO É LEGÍTIMO, ao contrário do casamento com o banco.
  // A diferença é quem escreveu a string: o `[Recorrente] X` foi a PRÓPRIA SORA
  // que gravou, a partir da descrição da recorrência. Com o banco, o texto é de
  // terceiro e muda — e é por isso que lá o casamento é por valor e data.
  //
  // O terceiro caso é o "confirmar" de um `[Previsto]`: ele REMOVE o prefixo, e
  // aí sobra só a descrição. Por isso a comparação sem marca — mas com valor
  // dentro da tolerância, pra não engolir um gasto homônimo de outro valor.
  const TOLERANCIA = 1;   // R$ — mesma do `parcelasPrevistas`/`casarPrevisao`
  /** texto+competência → { comMarca, valores[] } */
  const implicitas = new Map<string, { comMarca: boolean; valores: number[] }>();
  for (const t of params.transacoes || []) {
    if (t.transferencia) continue;
    const obs = String(t.observacao || '');
    const temMarca = obs.startsWith(MARCA_PREVISTO) || obs.startsWith(MARCA_RECORRENTE);
    // ⚠️ SÓ TRANSAÇÃO PAGA MATERIALIZA A OCORRÊNCIA. Um `[Previsto]` com
    // `pago: false` É a previsão — não a realização dela —, e nós já a geramos
    // a partir da regra. Tratá-lo como materialização faria a linha sumir das
    // duas formas e a conta desaparecer do extrato inteiro.
    if (t.pago === false) continue;
    const k = chaveTexto(obs) + '|' + ym(String(t.data).slice(0, 10));
    const atual = implicitas.get(k) || { comMarca: false, valores: [] };
    atual.comMarca = atual.comMarca || temMarca;
    atual.valores.push(cent(Math.abs(Number(t.valor) || 0)));
    implicitas.set(k, atual);
  }
  /** Esta ocorrência já foi materializada por uma transação? */
  const jaMaterializada = (descricao: string | null | undefined, valor: number, comp: string) => {
    const achado = implicitas.get(chaveTexto(descricao) + '|' + comp);
    if (!achado) return false;
    // Com a marca do cron, o texto basta: fomos NÓS que escrevemos aquela linha.
    if (achado.comMarca) return true;
    // Sem marca (um `[Previsto]` confirmado perde o prefixo), exige o valor
    // bater — senão um gasto homônimo de outro valor engoliria a previsão.
    return achado.valores.some((v) => Math.abs(v - cent(valor)) <= TOLERANCIA);
  };

  // ── 2. Recorrências, DATADAS ──────────────────────────────────────────────
  for (const r of params.recorrencias || []) {
    if (!(Number(r.valor) > 0)) continue;
    const rid = r.id ? String(r.id) : null;
    for (const dia of dias) {
      // ⚠️ QUEM DECIDE É `venceEm` — a mesma função que `ocorrenciasNoMes` usa
      // dentro de `linhasDoMes`. Reimplementar "cai no dia 10" aqui seria criar
      // a sexta cópia de uma regra de data nesta base.
      if (!venceEm(r as RecorrenciaQuando, dia)) continue;
      const comp = ym(dia);
      const chave = rid + ':' + comp;
      if (rid && quitadas.has(chave)) continue;        // já foi paga (vínculo)
      // ⚠️ E a que o CRON já materializou, que não tem vínculo (ver 1B). Sem
      // isto, no dia do vencimento a conta saía DUAS vezes do saldo.
      if (jaMaterializada(r.descricao, Number(r.valor), comp)) continue;
      const aj = rid ? ajustePor.get(chave) : undefined;
      if (aj && aj.status === 'pulado') continue;      // pulada de propósito
      const data = aj && aj.status === 'movido' && aj.novaData
        ? String(aj.novaData).slice(0, 10) : dia;
      const valor = aj && aj.novoValor != null ? cent(aj.novoValor) : cent(r.valor);
      push({
        data,
        tipo: r.tipo,
        valor,
        descricao: r.descricao || (r.tipo === 'Gasto' ? 'Conta fixa' : 'Receita fixa'),
        carteira: r.carteira ?? null,
        origem: 'recorrencia',
        estado: 'previsto',
        estimado: !!r.valor_variavel,
        recorrenciaId: rid,
        competencia: comp,
        adiada: !!(aj && aj.status === 'movido'),
      });
    }
  }

  // ── 3. Dívidas — uma parcela por mês, ENQUANTO SOBRAR parcela ─────────────
  const meses: string[] = [];
  for (const d of dias) { const m = ym(d); if (meses[meses.length - 1] !== m) meses.push(m); }

  for (const d of params.dividas || []) {
    if (d.status === 'quitada') continue;
    if (!(Number(d.valor_parcela) > 0)) continue;
    if (d.nos_previstos === false) continue;
    const diaVenc = Number(d.dia_vencimento) || 0;
    if (!diaVenc) continue;
    const total = Number(d.parcelas_total) || 0;
    const pagas = Number(d.parcelas_pagas) || 0;
    // Mesma aritmética de `linhasDoMes`: `k` é a distância em meses e a parcela
    // some quando `k` alcança o que resta.
    const restantes = total > 0 ? Math.max(0, total - pagas) : Infinity;
    for (let k = 0; k < meses.length; k++) {
      if (k >= restantes) break;
      const m = meses[k];
      const [ano, mes] = m.split('-').map(Number);
      // ⚠️ Clamp ao ÚLTIMO DIA do mês: dívida que vence 31 vence em 28/02.
      const ultimo = new Date(ano, mes, 0).getDate();
      const dd = String(Math.min(diaVenc, ultimo)).padStart(2, '0');
      push({
        data: m + '-' + dd,
        tipo: 'Gasto',
        valor: cent(d.valor_parcela),
        descricao: d.titulo || 'Parcela',
        carteira: d.carteira ?? null,
        origem: 'divida',
        estado: 'previsto',
        estimado: false,
      });
    }
  }

  // ── 4. Faturas — só a que o banco já publicou ─────────────────────────────
  //
  // ⚠️ Fatura NÃO é projetada pra frente: ela depende de compras que ainda não
  // aconteceram. Mesma decisão de `linhasDoMes`.
  for (const f of params.faturas || []) {
    if (f.nos_previstos === false) continue;
    const restante = cent(f.restante);
    if (!(restante > 0) || !f.venc) continue;
    push({
      data: String(f.venc).slice(0, 10),
      tipo: 'Gasto',
      valor: restante,
      descricao: ('Fatura ' + (f.nome || '')).trim(),
      carteira: f.carteira ?? null,
      origem: 'fatura',
      estado: 'previsto',
      estimado: false,
    });
  }

  // ── 5. Acumula dia a dia ──────────────────────────────────────────────────
  const saida: DiaExtrato[] = [];
  let saldo = cent(saldoInicial);
  let incertezaAcum = 0;
  let pior: { data: string; saldo: number } | null = null;
  let temEstimativa = false;

  for (const dia of dias) {
    const linhas = (porDia.get(dia) || []).sort((a, b) => {
      // ⚠️ SAÍDAS PRIMEIRO no mesmo dia, de propósito. Se a conta vence no
      // mesmo dia em que o salário cai, o banco pode cobrar ANTES de o crédito
      // compensar. Mostrar o pior caso é o que torna o número acionável —
      // ordenar a favor do usuário esconderia justamente o dia do aperto.
      if (a.tipo !== b.tipo) return a.tipo === 'Gasto' ? -1 : 1;
      return b.valor - a.valor;
    });
    if (!linhas.length) continue;

    let entradas = 0;
    let saidas = 0;
    for (const l of linhas) {
      // ⚠️ Já dentro do saldo inicial: aparece na lista, mas não move o saldo.
      // Ver o campo `jaNoSaldo` — é o que impede a dupla contagem.
      if (l.jaNoSaldo) continue;
      if (l.tipo === 'Recebimento') entradas += l.valor; else saidas += l.valor;
      if (l.estimado) { incertezaAcum += l.valor; temEstimativa = true; }
    }
    saldo = cent(saldo + entradas - saidas);
    saida.push({
      data: dia,
      linhas,
      entradas: cent(entradas),
      saidas: cent(saidas),
      saldo,
      incerteza: cent(incertezaAcum),
    });
    if (!pior || saldo < pior.saldo) pior = { data: dia, saldo };
  }

  return { saldoInicial: cent(saldoInicial), dias: saida, pior, temEstimativa };
}
