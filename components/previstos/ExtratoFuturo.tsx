'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Clock, CalendarClock, SkipForward, TriangleAlert, Wallet, Plus, Undo2, CreditCard, Link2, History, Pencil } from 'lucide-react';
import { montarExtrato, type Extrato, type LinhaExtrato } from '@/lib/extrato-futuro';
import { totalPendente, type Pendencia } from '@/lib/previstos-atrasados';
import SeletorPagamento from '@/components/previstos/SeletorPagamento';

/** Os status que a LINHA do extrato sabe informar por si — nenhum campo novo. */
type StatusFiltro = 'todos' | 'aberto' | 'pagos' | 'adiados' | 'conciliar';
const FILTROS_STATUS: { id: StatusFiltro; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Tudo' },
  { id: 'aberto', rotulo: 'Em aberto' },
  { id: 'pagos', rotulo: 'Pagos' },
  { id: 'adiados', rotulo: 'Adiados' },
  { id: 'conciliar', rotulo: 'A conciliar' },
];
import { hojeSP } from '@/lib/ciclo-fatura';
import { useDinheiro, useSimboloMoeda } from '@/lib/moeda-base';
import { parseValorBR, nomeMesCurto } from '@/lib/formato-br';

// =============================================================================
// EXTRATO FUTURO — a tela que o cliente pediu, e um pouco mais.
//
// Pedido, literal: "uma lista simples de lançamentos, um check para indicar o
// que foi ou não pago e, principalmente, a visualização contínua do saldo atual
// e futuro."
//
// ⚠️ O QUE ELA ACRESCENTA AO EXTRATO DE BANCO. O sistema que ele usava mostra a
// coluna de saldo e deixa a pessoa DESCOBRIR o problema escaneando linha a
// linha. A Sora sabe três coisas que aquele app não sabe, e as três viram
// informação em vez de tabela:
//
//   · qual é o DIA MAIS APERTADO e quanto falta nele — a pergunta real
//     ("quanto preciso ter disponível na conta em cada data futura");
//   · quais valores são ESTIMATIVA (conta variável) — mostrados como faixa, não
//     como número cravado, porque cravar seria inventar;
//   · que dívida ACABA — a projeção cai quando a última parcela vence.
//
// A aritmética não mora aqui: vem de `lib/extrato-futuro.ts`, que tem eval
// travando que ela não diverge da aba Projeção.
// =============================================================================

const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const BRAND = '#61D17B';
const NOME_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
/** '2026-09' → 'Setembro' (ou 'Setembro/2025' quando não é o ano corrente). */
function mesPorExtenso(ym: string, hoje = hojeSP()) {
  const [a, m] = String(ym).split('-').map(Number);
  const nome = NOME_MES[(m || 1) - 1] || ym;
  const rotulo = nome.charAt(0).toUpperCase() + nome.slice(1);
  return String(a) === hoje.slice(0, 4) ? rotulo : `${rotulo}/${a}`;
}

const DIA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
function rotuloDia(iso: string) {
  const [a, m, d] = iso.split('-').map(Number);
  return `${diaMes(iso)} · ${DIA_SEMANA[new Date(a, m - 1, d).getDay()]}`;
}

const VAZIO = {
  descricao: '', valor: '', data: '',
  tipo: 'Gasto' as 'Gasto' | 'Recebimento', carteira: '',
};


/** Os saltos que cobrem quase todo "adiar" real. */
const ATALHOS_ADIAR = [
  { dias: 7,  rotulo: '+7 dias' },
  { dias: 15, rotulo: '+15 dias' },
  { dias: 30, rotulo: '+30 dias' },
];

/**
 * Soma dias a uma data ISO, sem passar por `new Date(iso)`.
 *
 * ⚠️ `new Date('2026-09-10')` é interpretado como UTC — no Brasil isso é 21h do
 * dia ANTERIOR, e a conta volta um dia. É o mesmo bug que `lib/data-br.ts`
 * existe pra impedir; aqui a data é construída por partes, no fuso local.
 */
function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  const x = new Date(a, m - 1, d + dias);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export type AcaoOcorrencia = {
  linha: LinhaExtrato;
  /**
   * `quitar` / `pular` / `adiar` agem sobre a PREVISÃO (ainda não aconteceu).
   *
   * `corrigir` e `nao-paguei` agem sobre a linha JÁ LANÇADA — e existem por
   * causa desta frase do cliente: "ao manter a opção de lançar, a transação só
   * é criada na data do vencimento. Porém, na prática, um pagamento pode ser
   * antecipado ou atrasado."
   *
   * ⚠️ `nao-paguei` é a única resposta possível para o pior caso, que ele nem
   * chegou a nomear: a conta NÃO foi paga. Hoje a Sora afirma que foi, o saldo
   * fica errado para sempre e a dívida fica invisível.
   */
  acao: 'quitar' | 'pular' | 'adiar' | 'corrigir' | 'nao-paguei' | 'despular' | 'ajustar-valor';
  data?: string;
  valor?: number;
  /**
   * Só na baixa pela SUGESTÃO do banco: a cobrança do extrato que já é o
   * pagamento. Com ela a rota amarra essa linha em vez de criar outra (que
   * seria a duplicata).
   */
  transacaoBanco?: string;
};

export type Sugestao = {
  recorrencia_id: string;
  competencia: string;
  transacao_id: string;
  data: string;
  valor: number;
  automatico: boolean;
  motivo?: string;
};

const PERIODOS = [
  { id: 'mes', rotulo: 'Este mês' },
  { id: '30d', rotulo: '30 dias' },
  { id: '60d', rotulo: '60 dias' },
  { id: '90d', rotulo: '90 dias' },
  { id: '6m', rotulo: '6 meses' },
];

export default function ExtratoFuturo({
  dados, carteiras, carteirasBanco, carteiraAtiva, onCarteira, onAcao, ocupado, sugestoes, onNovoPrevisto,
  baixaAutomatica, onBaixaAutomatica, abrirNovo,
  periodo, ate, onPeriodo, contasPagamento, onContaFatura, onContaDivida, erroContaFatura,
  pendencias, onConciliar, onPularPendencia, phone,
}: {
  dados: Parameters<typeof montarExtrato>[0];
  carteiras: string[];
  /** Contas que vêm do Open Finance. Nelas o valor real quem traz é o
   *  BANCO, então o campo "valor pago" não aparece — ver o painel do
   *  "Paguei" lá embaixo. */
  carteirasBanco?: string[];
  carteiraAtiva: string | null;
  onCarteira: (c: string | null) => void;
  onAcao: (a: AcaoOcorrencia) => void;
  ocupado?: string | null;
  sugestoes?: Sugestao[];
  onNovoPrevisto?: (p: {
    descricao: string; valor: number; data: string;
    tipo: 'Gasto' | 'Recebimento'; carteira: string | null;
  }) => Promise<void>;
  /** Abre o formulario de previsto unico ja na montagem. Vem de
   *  /previstos?aba=extrato&novo=1, o link do card "Previstos do mes". */
  abrirNovo?: boolean;
  baixaAutomatica?: boolean;
  onBaixaAutomatica?: (v: boolean) => void;
  /** Contas fixas de meses ANTERIORES que ficaram em aberto. */
  pendencias?: Pendencia[];
  /** Amarra um lançamento existente à previsão daquele mês. */
  onConciliar?: (p: Pendencia, transacaoId: string) => void | Promise<void>;
  onPularPendencia?: (p: Pendencia) => void | Promise<void>;
  /** Só pro seletor de pagamento buscar os lançamentos do mês. */
  phone?: string;
  /** Período: '30d' | '60d' | '90d' | '6m' | 'mes' ou uma data 'YYYY-MM-DD'. */
  periodo?: string;
  /** Último dia do período, já resolvido — valor do campo "Até". */
  ate?: string;
  onPeriodo?: (p: string) => void;
  /** Contas de débito que podem pagar uma fatura. */
  contasPagamento?: { id: string; nome: string }[];
  onContaFatura?: (cartaoId: string, contaId: string | null) => Promise<void>;
  /** De qual conta sai a PARCELA da dívida (migration 182). */
  onContaDivida?: (dividaId: string, contaId: string | null) => Promise<void>;
  erroContaFatura?: string | null;
}) {
  const fmt = useDinheiro();
  const simbolo = useSimboloMoeda();
  const extrato: Extrato = useMemo(() => montarExtrato(dados), [dados]);
  // Faturas do período que ficam FORA do extrato de uma conta por não terem
  // conta de pagamento — a mesma regra que `montarExtrato` usa pra incluí-las.
  const faturasSemConta = useMemo(() => (dados.faturas || []).filter((f) =>
    f.nos_previstos !== false && !f.carteira && Number(f.restante) > 0 && f.venc
    && String(f.venc).slice(0, 10) >= dados.de && String(f.venc).slice(0, 10) <= dados.ate).length,
  [dados]);
  const [aberta, setAberta] = useState<string | null>(null);
  /** Linha cujo VALOR está sendo ajustado, e o texto digitado.
   *
   *  ⚠️ Pedido de cliente: "previsões de contas contínuas podem ter variação,
   *  como plano de saúde, luz, combustível". Antes, mudar o valor de UM mês só
   *  dava pela porta errada — editar a regra (muda todos os meses) ou pular
   *  (some do extrato). Aqui a previsão continua aberta e só muda de valor. */
  const [ajustando, setAjustando] = useState<string | null>(null);
  const [valorAjuste, setValorAjuste] = useState('');
  const [novoAberto, setNovoAberto] = useState(false);
  // ⚠️ Efeito e nao valor inicial: o estado inicial vem do SERVIDOR, e ler a
  // URL ali daria hydration mismatch (mesma regra do `ehDesktop` da Sidebar).
  useEffect(() => { if (abrirNovo) setNovoAberto(true); }, [abrirNovo]);
  const [novo, setNovo] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  // Qual linha está com o seletor de data aberto (um por vez).
  const [adiando, setAdiando] = useState<string | null>(null);
  // Qual linha está com o painel de "Paguei" aberto, e o que foi digitado.
  const [quitando, setQuitando] = useState<string | null>(null);
  const [quitacao, setQuitacao] = useState<{ data: string; valor: string }>({ data: '', valor: '' });

  // Conta conectada ao banco? Decide se o campo de VALOR aparece.
  const doBanco = useMemo(() => new Set(carteirasBanco || []), [carteirasBanco]);

  // Sugestões indexadas por ocorrência — o casamento em si é feito no BACKEND
  // (`services/casarPrevisao.js`), fonte única que a baixa automática também
  // usa. A tela só desenha o resultado.
  const sugestaoDe = useMemo(() => {
    const m = new Map<string, Sugestao>();
    for (const s of sugestoes || []) m.set(s.recorrencia_id + ':' + s.competencia, s);
    return m;
  }, [sugestoes]);

  const pior = extrato.pior;
  const apertado = pior && pior.saldo < 0;

  // Qual pendência está escolhendo o lançamento que a pagou.
  const [conciliando, setConciliando] = useState<Pendencia | null>(null);
  const totaisPendentes = useMemo(() => totalPendente(pendencias || []), [pendencias]);

  // ── FILTRO POR STATUS ────────────────────────────────────────────────────
  // Pedido do cliente (Vander): "além de poder criar um filtro por status nas
  // previsões". A aba só filtrava por período e por conta, então o que já foi
  // pago ficava misturado com o que ainda vai vencer.
  //
  // ⚠️ Os status são os que a LINHA já carrega (`jaNoSaldo` = quitada,
  // `adiada`, e a sugestão de baixa pendente). Nenhum campo novo: filtrar por
  // algo que a linha não sabe dizer exigiria outra fonte de verdade.
  const [status, setStatus] = useState<StatusFiltro>('todos');
  const diasFiltrados = useMemo(() => {
    if (status === 'todos') return extrato.dias;
    const passa = (l: LinhaExtrato) => {
      const temSugestao = !!(l.recorrenciaId && l.competencia
        && sugestaoDe.get(l.recorrenciaId + ':' + l.competencia));
      if (status === 'pagos')    return l.estado === 'realizado' || !!l.jaNoSaldo;
      if (status === 'aberto')   return l.estado === 'previsto' && !l.jaNoSaldo;
      if (status === 'adiados')  return !!l.adiada;
      if (status === 'conciliar') return temSugestao;
      return true;
    };
    return extrato.dias
      .map((d) => ({ ...d, linhas: d.linhas.filter(passa) }))
      .filter((d) => d.linhas.length > 0);
  }, [extrato.dias, status, sugestaoDe]);

  // ⚠️ O SALDO NÃO É RECALCULADO PELO FILTRO. Ele vem do extrato inteiro: um
  // "saldo" que ignora metade das linhas não seria saldo de nada. O filtro
  // esconde linhas pra procurar, não muda o dinheiro.
  const filtrando = status !== 'todos';

  return (
    <div className="space-y-4">
      {/* ── A MANCHETE: a resposta, não a tabela ───────────────────────────
          ⚠️ É ela que diferencia esta tela de um extrato comum. O cliente não
          quer escanear uma coluna; quer saber QUANDO aperta e QUANTO falta. */}
      <div
        className="rounded-2xl border border-border/40 backdrop-blur-xl p-4 sm:p-5 animate-[slide-up_500ms_ease-out_both]"
        style={{
          background: 'hsl(var(--bg-card) / 0.5)',
          backgroundImage: `radial-gradient(circle at top right, ${apertado ? '#ef444424' : '#61D17B24'} 0%, transparent 70%)`,
        }}
      >
        {pior ? (
          <>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {apertado ? <TriangleAlert size={14} className="text-red-500" /> : <Check size={14} className="text-emerald-500" />}
              Seu ponto mais apertado
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-bold tabular">
              {diaMes(pior.data)}
              <span className={`ml-2 ${apertado ? 'text-red-500' : 'text-emerald-500'}`}>
                {fmt(pior.saldo)}
              </span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {apertado
                ? <>Faltam <strong className="text-red-500">{fmt(Math.abs(pior.saldo))}</strong> para cobrir tudo até lá.</>
                : <>É o menor saldo do período — daqui até lá você não fica no vermelho.</>}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Nada previsto neste período.</p>
        )}

        {/* ⚠️ A honestidade sobre o que a Sora NÃO sabe. Conta variável entra
            como estimativa; dizer isso vale mais do que cravar um número. */}
        {extrato.temEstimativa && (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Clock size={13} className="mt-0.5 flex-shrink-0" />
            Algumas contas variam de valor. Elas entram pela média e estão
            marcadas com <span className="font-semibold">≈</span> — o número real pode mudar.
          </p>
        )}
      </div>

      {/* ── PREVISTO ÚNICO ─────────────────────────────────────────────────
          ⚠️ Fecha a terceira queixa do cliente: "tudo o que informo nessa área
          acaba assumindo um comportamento recorrente". Era verdade — o único
          jeito de adicionar algo em Previstos era o formulário de CONTA FIXA.
          Aqui entra o compromisso que acontece UMA vez: IPVA, uma viagem, o
          presente de aniversário.

          Por baixo é só uma transação com data futura: o backend já grava
          `pago: false` e NÃO debita a carteira nesse caso. Nenhuma tabela nova. */}
      {onNovoPrevisto && (
        <div className="rounded-2xl border border-border/40 overflow-hidden"
             style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          {!novoAberto ? (
            <button
              type="button"
              onClick={() => setNovoAberto(true)}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold
                         text-primary min-h-[48px] active:scale-[0.99] transition-transform"
            >
              <Plus size={16} /> Previsto único
            </button>
          ) : (
            <div className="p-3 space-y-2.5">
              <p className="text-xs text-muted-foreground">
                Um compromisso que acontece <strong>uma vez só</strong> — não se repete todo mês.
              </p>
              <input
                value={novo.descricao}
                onChange={(e) => setNovo({ ...novo, descricao: e.target.value })}
                placeholder="Ex.: IPVA, viagem, presente"
                className="w-full h-11 px-3 rounded-lg bg-background border border-border/50 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={novo.valor}
                  onChange={(e) => setNovo({ ...novo, valor: e.target.value })}
                  inputMode="decimal" placeholder="0,00"
                  className="h-11 px-3 rounded-lg bg-background border border-border/50 text-sm tabular"
                />
                <input
                  type="date" value={novo.data}
                  onChange={(e) => setNovo({ ...novo, data: e.target.value })}
                  className="h-11 px-3 rounded-lg bg-background border border-border/50 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={novo.tipo}
                  onChange={(e) => setNovo({ ...novo, tipo: e.target.value as 'Gasto' | 'Recebimento' })}
                  className="h-11 px-3 rounded-lg bg-background border border-border/50 text-sm"
                >
                  <option value="Gasto">Vou pagar</option>
                  <option value="Recebimento">Vou receber</option>
                </select>
                <select
                  value={novo.carteira}
                  onChange={(e) => setNovo({ ...novo, carteira: e.target.value })}
                  className="h-11 px-3 rounded-lg bg-background border border-border/50 text-sm"
                >
                  <option value="">Conta…</option>
                  {carteiras.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => { setNovoAberto(false); setNovo(VAZIO); }}
                  className="h-11 rounded-lg text-sm font-medium bg-muted/50 text-muted-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!novo.descricao.trim() || !novo.valor || !novo.data || salvando}
                  onClick={async () => {
                    setSalvando(true);
                    try {
                      await onNovoPrevisto({
                        descricao: novo.descricao.trim(),
                        // Aceita "1.234,56" e "1234.56" — o brasileiro digita os dois.
                        valor: Number(novo.valor.replace(/\./g, '').replace(',', '.')),
                        data: novo.data,
                        tipo: novo.tipo,
                        carteira: novo.carteira || null,
                      });
                      setNovoAberto(false); setNovo(VAZIO);
                    } finally { setSalvando(false); }
                  }}
                  className="h-11 rounded-lg text-sm font-semibold bg-primary text-white disabled:opacity-50"
                >
                  {salvando ? 'Salvando…' : 'Adicionar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Período (pedido de cliente) ─────────────────────────────────────
          Sempre a partir de HOJE: o saldo de partida é o de agora. */}
      {onPeriodo && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 items-center">
          {PERIODOS.map((p) => (
            <Chip key={p.id} ativo={periodo === p.id} onClick={() => onPeriodo(p.id)}>{p.rotulo}</Chip>
          ))}
          <label className={`flex-shrink-0 flex items-center gap-1.5 pl-3 pr-1 rounded-full text-xs font-medium min-h-[36px] ${
            periodo && /^\d{4}-/.test(periodo) ? 'bg-primary text-white' : 'bg-muted/50 text-muted-foreground'
          }`}>
            Até
            <input
              type="date"
              value={ate || ''}
              min={hojeSP()}
              onChange={(e) => { if (e.target.value) onPeriodo(e.target.value); }}
              aria-label="Ver o extrato até esta data"
              className="bg-transparent text-xs h-8 rounded-full px-1 outline-none"
            />
          </label>
        </div>
      )}

      {/* ── Filtro por conta ──────────────────────────────────────────────── */}
      {carteiras.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <Chip ativo={!carteiraAtiva} onClick={() => onCarteira(null)}>Todas as contas</Chip>
          {carteiras.map((c) => (
            <Chip key={c} ativo={carteiraAtiva === c} onClick={() => onCarteira(c)}>{c}</Chip>
          ))}
        </div>
      )}

      {/* ⚠️ A fatura sem conta de pagamento NÃO entra no extrato de uma conta
          (não dá pra saber de onde sai o dinheiro). Dizer isso, em vez de a
          fatura simplesmente não aparecer, é o que evita o "não está
          considerando o cartão" do relato. */}
      {carteiraAtiva && faturasSemConta > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 flex items-start gap-2">
          <CreditCard size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed flex-1">
            {faturasSemConta === 1 ? '1 fatura de cartão não aparece' : `${faturasSemConta} faturas de cartão não aparecem`} aqui
            porque ainda não {faturasSemConta === 1 ? 'tem' : 'têm'} conta de pagamento.{' '}
            <button type="button" onClick={() => onCarteira(null)} className="font-semibold underline">
              Escolher em Todas as contas
            </button>
          </p>
        </div>
      )}
      {erroContaFatura && (
        <p role="alert" className="text-xs text-red-500 px-1">{erroContaFatura}</p>
      )}

      {/* ── Saldo de partida ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl border border-border/40 px-4 py-3"
           style={{ background: 'hsl(var(--bg-card) / 0.35)' }}>
        <span className="text-sm text-muted-foreground flex items-center gap-2">
          <Wallet size={15} /> Saldo de partida
        </span>
        <span className="font-semibold tabular">{fmt(extrato.saldoInicial)}</span>
      </div>

      {/* ── EM ABERTO DE MESES ANTERIORES ─────────────────────────────────
          ⚠️ FORA DO SALDO, DE PROPÓSITO. O saldo de partida é o saldo ATUAL
          das contas, que já reflete tudo que aconteceu — somar uma pendência
          de setembro cobraria duas vezes o mesmo dinheiro. Por isso este bloco
          fica acima do extrato, como pendência a conciliar, e não como linha.

          Pedido do cliente (Vander, 01/10/2026): "conseguir apontar que um
          determinado pagamento se refere a uma previsão NAQUELE MÊS". Até aqui
          a conta de setembro sem baixa sumia da tela em 1º de outubro. */}
      {!!pendencias?.length && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 overflow-hidden"
             style={{ background: 'color-mix(in srgb, #f59e0b 5%, transparent)' }}>
          <div className="px-4 py-3 border-b border-amber-200/60 dark:border-amber-900/40">
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <History size={12} /> Em aberto de meses anteriores
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {totaisPendentes.quantidade === 1 ? 'Uma conta' : `${totaisPendentes.quantidade} contas`} que
              venceram antes deste mês e não foram marcadas como pagas.
              {totaisPendentes.aPagar > 0 && <> Somam <strong className="text-foreground tabular">{fmt(totaisPendentes.aPagar)}</strong>.</>}
              {' '}Não entram no saldo acima — aponte o lançamento que pagou cada uma.
            </p>
          </div>
          <ul className="divide-y divide-amber-200/50 dark:divide-amber-900/30">
            {pendencias.map((p) => {
              const ocupadaAgora = ocupado === p.recorrenciaId + ':' + p.competencia;
              return (
                <li key={p.recorrenciaId + ':' + p.competencia} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{p.descricao}</p>
                      <p className="text-[11px] text-muted-foreground tabular">
                        {mesPorExtenso(p.competencia)} · {p.estimado && '≈ '}{fmt(p.valor)}
                        {p.carteira ? ` · ${p.carteira}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {onConciliar && phone && (
                        <button type="button" onClick={() => setConciliando(p)} disabled={ocupadaAgora}
                          className="h-9 px-3 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1.5 disabled:opacity-50"
                          style={{ background: BRAND }}>
                          <Link2 size={13} /> Já paguei
                        </button>
                      )}
                      {onPularPendencia && (
                        <button type="button" onClick={() => onPularPendencia(p)} disabled={ocupadaAgora}
                          className="h-9 px-3 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground border border-border disabled:opacity-50">
                          Não vou pagar
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── FILTRO POR STATUS ─────────────────────────────────────────────
          Pedido do mesmo cliente: "poder criar um filtro por status nas
          previsões". O que já foi pago ficava misturado com o que ainda vence. */}
      <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filtrar por status">
        {FILTROS_STATUS.map((f) => (
          <button key={f.id} type="button" onClick={() => setStatus(f.id)} aria-pressed={status === f.id}
            className={`h-9 px-3 rounded-full text-[11px] font-bold border transition-all ${
              status === f.id
                ? 'border-primary text-primary bg-primary/10'
                : 'border-border text-muted-foreground hover:text-foreground'}`}>
            {f.rotulo}
          </button>
        ))}
      </div>

      {/* ⚠️ DIZ QUE ESTÁ FILTRANDO. Sem este aviso, quem esquece o filtro ligado
          lê o extrato pela metade achando que é o extrato inteiro — e o saldo
          de partida logo acima continua sendo o do período TODO. */}
      {filtrando && (
        <p className="text-[11px] text-muted-foreground px-1" role="status">
          Mostrando só <strong className="text-foreground">{FILTROS_STATUS.find((f) => f.id === status)?.rotulo.toLowerCase()}</strong>.
          O saldo acima continua considerando tudo.{' '}
          <button type="button" onClick={() => setStatus('todos')} className="font-semibold underline">Ver tudo</button>
        </p>
      )}

      {/* ── O extrato ─────────────────────────────────────────────────────── */}
      {filtrando && !diasFiltrados.length && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nada com esse status no período.
        </p>
      )}
      {diasFiltrados.map((dia, i) => (
        <div key={dia.data} className="animate-[slide-up_400ms_ease-out_both]" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
          <div className="flex items-baseline justify-between px-1 pb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {rotuloDia(dia.data)}
            </span>
            <span className={`text-sm font-bold tabular ${dia.saldo < 0 ? 'text-red-500' : 'text-foreground'}`}>
              {fmt(dia.saldo)}
            </span>
          </div>

          <div className="rounded-2xl border border-border/40 backdrop-blur-xl overflow-hidden"
               style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
            {dia.linhas.map((l, j) => {
              const id = `${dia.data}:${j}`;
              const previsto = l.estado === 'previsto';
              // Receita não se "paga": a mesma baixa, com as palavras de quem
              // RECEBEU (pedido de cliente — o vale que caiu antes do dia).
              const receita = l.tipo === 'Recebimento';
              // ⚠️ PAGA TAMBÉM É ACIONÁVEL — é o ponto da Fase C. Antes só a
              // previsão podia ser tocada, então a linha que o cron lançou (e
              // que pode estar com data ou valor errados, ou nem ter sido paga)
              // era intocável. Basta saber QUAL ocorrência ela resolve.
              // Fatura: tocar escolhe a conta que paga (migration 170).
              const ehFatura = l.origem === 'fatura' && !!l.cartaoId && !!onContaFatura;
              // Dívida: tocar escolhe a conta que paga a parcela (migration 182).
              // Era a linha que saía "Sem conta" sem nenhuma porta pra mudar isso.
              const ehDivida = l.origem === 'divida' && !!l.dividaId && !!onContaDivida;
              const podeAgir = !!l.recorrenciaId || ehFatura || ehDivida;
              const sug = previsto && l.recorrenciaId && l.competencia
                ? sugestaoDe.get(l.recorrenciaId + ':' + l.competencia) : undefined;
              return (
                <div key={id} className={j > 0 ? 'border-t border-border/30' : ''}>
                  <button
                    type="button"
                    disabled={!podeAgir}
                    onClick={() => setAberta(aberta === id ? null : id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-left min-h-[48px] ${podeAgir ? 'active:scale-[0.99] transition-transform' : 'cursor-default'}`}
                  >
                    {/* ⚠️ Ícone + rótulo, nunca cor sozinha (acessibilidade). */}
                    <span
                      aria-label={previsto ? 'Previsto' : 'Pago'}
                      className={`flex-shrink-0 w-6 h-6 rounded-full grid place-items-center border ${
                        previsto ? 'border-border text-muted-foreground' : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-500'
                      }`}
                    >
                      {previsto ? <Clock size={13} /> : <Check size={14} />}
                    </span>

                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">
                        {l.descricao}
                        {l.adiada && <span className="ml-1.5 text-[10px] font-semibold text-amber-500">adiada</span>}
                      </span>
                      {ehFatura && !l.carteira ? (
                        <span className="block text-[11px] font-medium text-amber-600 dark:text-amber-400 truncate">
                          Sem conta de pagamento · toque para escolher
                        </span>
                      ) : (
                        <span className="block text-[11px] text-muted-foreground truncate">
                          {ehFatura ? `Paga pela ${l.carteira}` : (l.carteira || 'Sem conta')} · {previsto ? 'previsto' : receita ? 'recebido' : 'pago'}
                        </span>
                      )}
                    </span>

                    <span className={`flex-shrink-0 text-sm font-semibold tabular ${
                      l.tipo === 'Recebimento' ? 'text-emerald-500' : 'text-foreground'
                    }`}>
                      {l.tipo === 'Recebimento' ? '+' : '−'} {fmt(l.valor).replace(simbolo, '').trim()}
                      {l.estimado && <span className="ml-0.5 text-muted-foreground">≈</span>}
                    </span>
                  </button>

                  {/* ── O banco já confirmou esta cobrança ──────────────────
                      ⚠️ Aparece SEM a pessoa ter configurado nada. A chave de
                      baixa automática decide se a Sora quita sozinha; a
                      SUGESTÃO é o padrão e não precisa de opt-in — ela só
                      mostra o que o banco já disse, e a baixa continua sendo
                      um toque consciente. */}
                  {sug && aberta !== id && (
                    <button
                      type="button"
                      onClick={() => { onAcao({ linha: l, acao: 'quitar', data: sug.data, valor: sug.valor, transacaoBanco: sug.transacao_id }); }}
                      disabled={ocupado === l.recorrenciaId}
                      className="w-full flex items-center gap-2 px-3 py-2 border-t border-border/30
                                 bg-emerald-500/10 text-left min-h-[44px] active:scale-[0.99] transition-transform
                                 disabled:opacity-50"
                    >
                      <Check size={14} className="flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span className="flex-1 min-w-0 text-[11.5px] leading-tight">
                        <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                          O banco confirmou esta cobrança em {diaMes(sug.data)}
                        </span>
                        {sug.motivo && (
                          <span className="block text-muted-foreground">
                            Confira antes: {sug.motivo}.
                          </span>
                        )}
                      </span>
                      <span className="flex-shrink-0 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                        {ocupado === l.recorrenciaId ? '...' : 'Dar baixa'}
                      </span>
                    </button>
                  )}

                  {/* Painel de ação — inline, logo abaixo da linha tocada.
                      ⚠️ Inline e não modal de propósito: os cards usam
                      `backdrop-blur`, e um `position: fixed` dentro deles fica
                      preso/atrás do conteúdo (memória `feedback-modal-portal`).
                      Aqui não há fixed nenhum, então o problema não existe. */}
                  {/* ── De qual conta sai a fatura ──────────────────────── */}
                  {aberta === id && ehFatura && (
                    <div className="px-3 pb-3 pt-2 border-t border-border/30 bg-muted/20 space-y-2">
                      <label className="block text-xs text-muted-foreground" htmlFor={`conta-${id}`}>
                        De qual conta sai o pagamento desta fatura?
                      </label>
                      <select
                        id={`conta-${id}`}
                        value={(contasPagamento || []).find((c) => c.nome === l.carteira)?.id || ''}
                        onChange={async (e) => {
                          await onContaFatura!(l.cartaoId!, e.target.value || null);
                          setAberta(null);
                        }}
                        className="w-full h-11 px-3 rounded-lg bg-background border border-border/50 text-sm"
                      >
                        <option value="">Nenhuma (só em Todas as contas)</option>
                        {(contasPagamento || []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                      <p className="text-[11px] text-muted-foreground">
                        Vale pras próximas faturas deste cartão também — e ela passa a aparecer no extrato dessa conta.
                      </p>
                    </div>
                  )}

                  {/* ── De qual conta sai a PARCELA DA DÍVIDA (migration 182) ──
                      Relato: a parcela do IPVA saía "Sem conta · previsto" e não
                      havia onde mudar isso — o lápis levava ao modal de dívida,
                      que não tinha o campo. Espelha o bloco da fatura acima. */}
                  {aberta === id && ehDivida && (
                    <div className="px-3 pb-3 pt-2 border-t border-border/30 bg-muted/20 space-y-2">
                      <label className="block text-xs text-muted-foreground" htmlFor={`contadiv-${id}`}>
                        De qual conta sai esta parcela?
                      </label>
                      <select
                        id={`contadiv-${id}`}
                        value={(contasPagamento || []).find((c) => c.nome === l.carteira)?.id || ''}
                        onChange={async (e) => {
                          await onContaDivida!(l.dividaId!, e.target.value || null);
                          setAberta(null);
                        }}
                        className="w-full h-11 px-3 rounded-lg bg-background border border-border/50 text-sm"
                      >
                        <option value="">Nenhuma (só em Todas as contas)</option>
                        {(contasPagamento || []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                      <p className="text-[11px] text-muted-foreground">
                        Vale pras próximas parcelas desta dívida também — e ela passa a aparecer no extrato dessa conta.
                      </p>
                    </div>
                  )}

                  {aberta === id && !!l.recorrenciaId && previsto && (
                    <div className="px-3 pb-3 pt-1 border-t border-border/30 bg-muted/20 space-y-2">
                      {/* ⚠️ 2 COLUNAS NO MOBILE, 4 A PARTIR DE sm. Com os quatro
                          botões numa linha só, cada alvo cairia a ~80px num
                          iPhone e o rótulo quebraria no meio. Em 2×2 todos
                          mantêm os 44pt de toque. */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <AcaoBtn
                          icone={<Check size={15} />} rotulo={receita ? 'Recebi' : 'Paguei'}
                          ativo={quitando === id}
                          ocupado={ocupado === l.recorrenciaId}
                          onClick={() => {
                            if (quitando === id) { setQuitando(null); return; }
                            setQuitando(id); setAdiando(null);
                            // ⚠️ Nunca sugere data no futuro: "paguei" é algo que
                            // já aconteceu. Conta que vence depois de hoje e foi
                            // paga adiantada foi paga HOJE (ou antes).
                            const hoje = hojeSP();
                            setQuitacao({ data: l.data > hoje ? hoje : l.data, valor: String(l.valor).replace('.', ',') });
                          }}
                        />
                        <AcaoBtn
                          icone={<CalendarClock size={15} />} rotulo="Adiar"
                          ativo={adiando === id}
                          onClick={() => setAdiando(adiando === id ? null : id)}
                        />
                        <AcaoBtn
                          icone={<SkipForward size={15} />} rotulo="Pular"
                          onClick={() => { onAcao({ linha: l, acao: 'pular' }); setAberta(null); }}
                        />
                        <AcaoBtn
                          icone={<Pencil size={15} />} rotulo="Valor"
                          ativo={ajustando === id}
                          onClick={() => {
                            if (ajustando === id) { setAjustando(null); return; }
                            setAjustando(id); setAdiando(null); setQuitando(null);
                            setValorAjuste(String(l.valor).replace('.', ','));
                          }}
                        />
                      </div>

                      {/* ── QUANTO VAI SER, SÓ NESTE MÊS ───────────────────── */}
                      {ajustando === id && (
                        <div className="rounded-lg border border-border/40 bg-background/60 p-3 space-y-2">
                          <label className="block text-[11px] font-semibold text-muted-foreground"
                                 htmlFor={`vl-${id}`}>
                            Valor desta conta em {nomeMesCurto(l.competencia || l.data)}
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground flex-shrink-0">{simbolo}</span>
                            <input
                              id={`vl-${id}`}
                              type="text" inputMode="decimal" value={valorAjuste}
                              onChange={(e) => setValorAjuste(e.target.value)}
                              /* ⚠️ 16px no mobile: abaixo disso o iOS dá ZOOM ao
                                 focar e a tela salta de lugar. */
                              className="flex-1 min-w-0 h-11 px-3 rounded-lg border border-border/60 bg-background
                                         text-base sm:text-sm tabular outline-none focus:border-primary"
                              placeholder="0,00"
                              autoFocus
                            />
                          </div>
                          {/* Diz o que NÃO vai acontecer — é a dúvida real de quem
                              mexe no valor de uma conta que se repete. */}
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Vale só para este mês. A conta fixa continua em{' '}
                            <b className="text-foreground tabular">{fmt(l.valor)}</b> nos outros.
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={!(parseValorBR(valorAjuste) > 0) || ocupado === l.recorrenciaId}
                              onClick={() => {
                                const v = parseValorBR(valorAjuste);
                                if (!(v > 0)) return;
                                onAcao({ linha: l, acao: 'ajustar-valor', valor: v });
                                setAjustando(null); setAberta(null);
                              }}
                              className="h-11 px-4 rounded-lg text-sm font-bold text-white disabled:opacity-40
                                         active:scale-[0.98] transition-all"
                              style={{ background: 'linear-gradient(135deg, #61D17B, #3FA85A)' }}
                            >
                              {ocupado === l.recorrenciaId ? '...' : 'Salvar valor'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setAjustando(null)}
                              className="h-11 px-3 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── PARA QUANDO ─────────────────────────────────────
                          ⚠️ Atalhos + data livre, nesta ordem. "Adiar" na
                          prática é quase sempre "semana que vem" ou "quando cair
                          o salário" — obrigar a abrir o calendário do sistema
                          pra isso é atrito num gesto que deveria ser um toque.
                          Quem precisa de um dia específico tem o campo ao lado.

                          ⚠️ Diz "Mover para", não "Adiar para": adiantar uma
                          conta é tão legítimo quanto atrasar, e o backend aceita
                          qualquer data. O rótulo do botão continua "Adiar"
                          porque é o caso comum. */}
                      {adiando === id && (
                        <div className="pt-1 space-y-2 animate-[slide-up_250ms_ease-out_both]">
                          <p className="text-[11px] font-medium text-muted-foreground">Mover para</p>
                          <div className="grid grid-cols-3 gap-2">
                            {ATALHOS_ADIAR.map((a) => (
                              <button
                                key={a.dias}
                                type="button"
                                onClick={() => {
                                  onAcao({ linha: l, acao: 'adiar', data: somarDias(l.data, a.dias) });
                                  setAdiando(null); setAberta(null);
                                }}
                                className="h-11 rounded-lg text-[12px] font-semibold bg-background/60 hover:bg-background
                                           border border-border/40 active:scale-[0.97] transition-all"
                              >
                                {a.rotulo}
                              </button>
                            ))}
                          </div>
                          <input
                            type="date"
                            defaultValue={l.data}
                            aria-label="Escolher a data"
                            onChange={(e) => {
                              if (!e.target.value) return;
                              onAcao({ linha: l, acao: 'adiar', data: e.target.value });
                              setAdiando(null); setAberta(null);
                            }}
                            className="w-full h-11 px-3 rounded-lg bg-background border border-border/50 text-sm"
                          />
                        </div>
                      )}

                      {/* ── PAGUEI: a data e o valor REAIS ───────────────────
                          ⚠️ ANTES ESTE BOTÃO NÃO PERGUNTAVA NADA: mandava
                          `data: l.data, valor: l.valor` — os valores
                          PREVISTOS. A rota `/quitar` sempre aceitou os dois
                          campos e é ela que cria a transação com o valor
                          final; só a tela nunca perguntou. O cliente que
                          pediu isto tinha acabado de pagar um plano de saúde
                          por um valor diferente do previsto.

                          ⚠️ O CAMPO DE VALOR SÓ APARECE EM CONTA MANUAL. Em
                          conta do Open Finance quem traz o valor real é o
                          banco, e digitar um aqui criaria uma transação que
                          vai colidir com a do extrato quando ela chegar —
                          exatamente a duplicidade que este fluxo existe pra
                          eliminar. A DATA continua editável nos dois casos:
                          corrigi-la não inventa lançamento nenhum. */}
                      {quitando === id && (
                        <div className="pt-1 space-y-2 animate-[slide-up_250ms_ease-out_both]">
                          <div className={doBanco.has(l.carteira || '') ? '' : 'grid grid-cols-2 gap-2'}>
                            <label className="text-[11px] font-medium text-muted-foreground">
                              {receita ? 'Recebi em' : 'Paguei em'}
                              <input
                                type="date" value={quitacao.data} max={hojeSP()}
                                onChange={(e) => setQuitacao({ ...quitacao, data: e.target.value })}
                                className="mt-1 w-full h-11 px-2 rounded-lg bg-background border border-border/50 text-sm text-foreground"
                              />
                            </label>
                            {!doBanco.has(l.carteira || '') && (
                              <label className="text-[11px] font-medium text-muted-foreground">
                                {receita ? 'Valor recebido' : 'Valor pago'}
                                <input
                                  type="text" inputMode="decimal" value={quitacao.valor}
                                  onChange={(e) => setQuitacao({ ...quitacao, valor: e.target.value })}
                                  className="mt-1 w-full h-11 px-2 rounded-lg bg-background border border-border/50 text-sm text-foreground tabular"
                                />
                              </label>
                            )}
                          </div>
                          {doBanco.has(l.carteira || '') && (
                            <p className="text-[11px] text-muted-foreground">
                              O valor real vem do banco quando a cobrança cair no extrato.
                            </p>
                          )}
                          {/* O `max` do input não impede digitar a data no
                              teclado em todo navegador — o botão é a trava, e
                              o motivo fica escrito ao lado (não só o cinza). */}
                          {quitacao.data > hojeSP() && (
                            <p role="alert" className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                              {receita
                                ? 'A data do recebimento não pode ser no futuro. Se ainda não recebeu, use “Adiar”.'
                                : 'A data do pagamento não pode ser no futuro. Se ainda não pagou, use “Adiar”.'}
                            </p>
                          )}
                          <button
                            type="button"
                            disabled={!quitacao.data || quitacao.data > hojeSP() || ocupado === l.recorrenciaId}
                            onClick={() => {
                              const v = Number(quitacao.valor.replace(/\./g, '').replace(',', '.'));
                              onAcao({
                                linha: l, acao: 'quitar', data: quitacao.data,
                                // Valor inválido/vazio → o previsto, que é o que a
                                // rota já usava. Nunca manda 0: zeraria a despesa.
                                valor: v > 0 ? v : l.valor,
                              });
                              setQuitando(null); setAberta(null);
                            }}
                            className="w-full h-11 rounded-lg text-[12px] font-bold text-white
                                       bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60
                                       active:scale-[0.98] transition-all"
                          >
                            {ocupado === l.recorrenciaId ? '...' : (receita ? 'Confirmar recebimento' : 'Confirmar pagamento')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── CORRIGIR UMA LINHA JÁ LANÇADA ──────────────────────
                      ⚠️ É a resposta à queixa central. No modo "desconta
                      sozinho" o cron afirma, no dia do vencimento, que a conta
                      foi paga — sem saber se foi. Aqui a pessoa corrige a data,
                      o valor, ou diz que ainda NÃO pagou (o único caso que
                      hoje não tem resposta nenhuma e deixa o saldo errado
                      para sempre). */}
                  {aberta === id && !!l.recorrenciaId && !previsto && (
                    <div className="px-3 pb-3 pt-2 border-t border-border/30 bg-muted/20 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          {receita ? 'Recebi em' : 'Paguei em'}
                          <input
                            type="date" defaultValue={l.data} max={hojeSP()}
                            // Linha paga com data no futuro diz que um dinheiro
                            // saiu antes de sair. Pra depois, o caminho é "Ainda
                            // não paguei" + Adiar.
                            onChange={(e) => e.target.value && e.target.value <= hojeSP() && onAcao({ linha: l, acao: 'corrigir', data: e.target.value })}
                            className="mt-1 w-full h-11 px-2 rounded-lg bg-background border border-border/50 text-sm text-foreground"
                          />
                        </label>
                        <label className="text-[11px] font-medium text-muted-foreground">
                          {receita ? 'Valor recebido' : 'Valor pago'}
                          <input
                            type="text" inputMode="decimal" defaultValue={String(l.valor).replace('.', ',')}
                            onBlur={(e) => {
                              const v = Number(e.target.value.replace(/\./g, '').replace(',', '.'));
                              if (v > 0 && Math.abs(v - l.valor) > 0.005) onAcao({ linha: l, acao: 'corrigir', valor: v });
                            }}
                            className="mt-1 w-full h-11 px-2 rounded-lg bg-background border border-border/50 text-sm tabular text-foreground"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        disabled={ocupado === l.recorrenciaId}
                        onClick={() => { onAcao({ linha: l, acao: 'nao-paguei' }); setAberta(null); }}
                        className="w-full flex items-center justify-center gap-2 h-11 rounded-lg text-[13px] font-semibold
                                   text-amber-700 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25
                                   disabled:opacity-50 active:scale-[0.98] transition-all"
                      >
                        <Undo2 size={15} />
                        {ocupado === l.recorrenciaId ? '...' : (receita ? 'Ainda não recebi' : 'Ainda não paguei esta conta')}
                      </button>
                      <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                        {receita
                          ? 'Ela volta a aparecer como prevista e o valor sai do saldo.'
                          : 'Ela volta a aparecer como previsto e o valor é devolvido ao saldo.'}
                        {' '}Em conta conectada ao banco, o saldo continua sendo o do banco.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── A CHAVE DA BAIXA AUTOMÁTICA ───────────────────────────────────
          ⚠️ SÓ APARECE PRA QUEM TEM OPEN FINANCE. Quem não tem dá baixa
          manualmente — que é o caminho principal e completo, não um plano B.
          Mostrar uma opção inútil a esse usuário só geraria dúvida.

          ⚠️ O AVISO FALA DO RISCO REAL. A tentação era escrever "o nome tem de
          ser igual ao do banco" — e seria FALSO: o casamento usa conta, valor e
          data, nunca o nome (ver `services/casarPrevisao.js`). Um aviso errado
          faria a pessoa renomear coisas à toa achando que estava ajudando. */}
      {onBaixaAutomatica && (
        <div className="rounded-2xl border border-border/40 p-4"
             style={{ background: 'hsl(var(--bg-card) / 0.35)' }}>
          <button
            type="button"
            role="switch"
            aria-checked={!!baixaAutomatica}
            onClick={() => onBaixaAutomatica(!baixaAutomatica)}
            className="w-full flex items-start gap-3 text-left min-h-[44px]"
          >
            <span className={`mt-0.5 flex-shrink-0 w-10 h-6 rounded-full p-0.5 transition-colors ${
              baixaAutomatica ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}>
              <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                baixaAutomatica ? 'translate-x-4' : ''
              }`} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold">Dar baixa automática</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                {baixaAutomatica
                  ? 'A Sora quita a previsão sozinha quando o banco confirma a cobrança.'
                  : 'A Sora apenas sugere, e você confirma com um toque. (recomendado)'}
              </span>
            </span>
          </button>

          {baixaAutomatica && (
            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground border-t border-border/30 pt-3">
              <TriangleAlert size={13} className="mt-0.5 flex-shrink-0 text-amber-500" />
              <span>
                Ela casa por <strong>conta, valor e data</strong> — não pelo nome, então
                você não precisa nomear igual ao banco. Mas se tiver{' '}
                <strong>duas contas de valor parecido vencendo na mesma semana</strong>,
                ela pergunta em vez de quitar. Conta de valor variável também sempre pergunta.
              </span>
            </p>
          )}
        </div>
      )}

      {/* ── PULADAS NO PERÍODO ────────────────────────────────────────────
          ⚠️ O "Pular" não tinha volta: a conta sumia do extrato e nenhuma tela
          desfazia (relato: "minha conta fixa não aparece na previsão" — tinha
          sido pulada com um toque). Fora do saldo, mas visível, com volta. */}
      {/* "Qual lançamento pagou esta previsão?" — o mesmo seletor do card de
          contas fixas, agora também aqui. ⚠️ A COMPETÊNCIA É A DA PENDÊNCIA,
          não a de hoje: é isso que amarra um pagamento de outubro à previsão
          de setembro, que é o pedido literal do cliente. */}
      {conciliando && phone && onConciliar && (
        <SeletorPagamento
          phone={phone}
          titulo={conciliando.descricao}
          valorPrevisto={conciliando.valor}
          tipo={conciliando.tipo}
          competencia={conciliando.competencia}
          onEscolher={(txId) => { const p = conciliando; setConciliando(null); onConciliar(p, txId); }}
          onFechar={() => setConciliando(null)}
        />
      )}

      {extrato.puladas.length > 0 && (
        <div className="rounded-2xl border border-border/40 overflow-hidden"
             style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <p className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
            <SkipForward size={12} /> Puladas neste período · fora do saldo
          </p>
          <div className="divide-y divide-border/30">
            {extrato.puladas.map((p) => (
              <div key={p.recorrenciaId + p.competencia} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{p.descricao}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {diaMes(p.data)}{p.carteira ? ` · ${p.carteira}` : ''} · {p.tipo === 'Recebimento' ? '+' : '−'} {fmt(p.valor)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={ocupado === p.recorrenciaId}
                  onClick={() => onAcao({
                    acao: 'despular',
                    linha: {
                      data: p.data, tipo: p.tipo, valor: p.valor, descricao: p.descricao,
                      carteira: p.carteira, origem: 'recorrencia', estado: 'previsto', estimado: false,
                      recorrenciaId: p.recorrenciaId, competencia: p.competencia,
                    },
                  })}
                  className="flex-shrink-0 h-11 px-3 rounded-lg text-[12px] font-semibold inline-flex items-center gap-1.5
                             bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-60 active:scale-[0.97] transition-all"
                >
                  <Undo2 size={14} /> {ocupado === p.recorrenciaId ? '...' : 'Voltar a prever'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!extrato.dias.length && (
        <div className="rounded-2xl border border-border/40 p-8 text-center"
             style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <p className="text-sm text-muted-foreground">
            Nada previsto nesta janela. Cadastre uma conta fixa para ver a
            projeção do seu saldo dia a dia.
          </p>
        </div>
      )}
    </div>
  );
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`flex-shrink-0 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap min-h-[36px] transition-colors ${
        ativo ? 'bg-primary text-white' : 'bg-muted/50 text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function AcaoBtn({ icone, rotulo, onClick, ocupado, ativo }: {
  icone: React.ReactNode; rotulo: string; onClick: () => void; ocupado?: boolean; ativo?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={ocupado}
      aria-expanded={ativo}
      className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg text-[11px] font-medium
                 border min-h-[44px] disabled:opacity-50 active:scale-[0.97] transition-all ${
        ativo ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-background/60 hover:bg-background border-border/40'
      }`}
    >
      {icone}
      {ocupado ? '...' : rotulo}
    </button>
  );
}
