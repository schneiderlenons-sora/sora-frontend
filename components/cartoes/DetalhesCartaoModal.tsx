'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Calendar, CalendarClock, ChevronRight, ChevronLeft, ExternalLink, Loader2, Zap, CreditCard, Trash2 } from 'lucide-react';
import { api, type ParcelaPrevista } from '@/lib/api';
import { getCategoriaTheme, nomeCategoria } from '@/lib/categorias';
import { bancoLogo, loadCartaoMeta, labelVencimento } from './AdicionarCartaoModal';
import { competenciaAtual, competenciaVizinha, cicloPorCompetencia, pertenceAFatura, criterioDaFatura, hojeSP } from '@/lib/ciclo-fatura';
import { somarFatura } from '@/lib/valor-fatura';
import { marcaDe } from '@/components/ui/IconeMarca';
import CategoriaIcon from '@/components/ui/CategoriaIcon';

const BRAND = 'hsl(var(--primary))';
const MES_NOMES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const MES_ABREV = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// (reconhecimento de marca agora vem do sistema oficial em IconeMarca/marcaDe —
//  removido o mapa local de iniciais que mostrava "S"/"N"/"iF" em vez do logo.)

interface Props {
  phone: string;
  cartao: any;
  onClose: () => void;
  onRefresh?: () => void;
  onExcluir?: () => void;
}

export default function DetalhesCartaoModal({ phone, cartao, onClose, onRefresh, onExcluir }: Props) {
  // ⚠️ Começa JÁ na competência da fatura (mês do vencimento), não no mês do
  // calendário: partir do mês errado fazia o modal buscar as transações de DOIS
  // ciclos diferentes ao abrir, e a resposta que chegasse por último ganhava —
  // era por isso que fechar e abrir de novo mostrava valores diferentes.
  const [mesRef, setMesRef] = useState(() => competenciaAtual(cartao));
  const [txs,     setTxs]      = useState<any[]>([]);
  const [loading, setLoading]  = useState(false);
  const [verTudo, setVerTudo]  = useState(false);
  const [antecipando, setAntecipando] = useState(false);
  const [contas, setContas] = useState<any[]>([]);
  const [escolhendoConta, setEscolhendoConta] = useState(false);
  // Quão à frente/atrás do mês atual está a fatura exibida (0 = atual)
  const [offsetMes, setOffsetMes] = useState(0);

  const meta = loadCartaoMeta(cartao.id);
  const logo = bancoLogo(cartao.nome);

  // `mesRef` = competência (YYYY-MM do VENCIMENTO) da fatura exibida. `offsetMes`
  // navega FATURAS pelo ciclo real, não meses do calendário.
  useEffect(() => {
    const atual = competenciaAtual(cartao);
    setMesRef(offsetMes === 0 ? atual : competenciaVizinha(cartao, atual, offsetMes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offsetMes, cartao?.id, cartao?.dia_fechamento, cartao?.dia_vencimento]);

  // ── Fatura já paga → abre na SEGUINTE ────────────────────────────────────
  // Queixa real: o cliente pagou a fatura dia 09, ela tinha fechado dia 08, e o
  // modal continuava parado nela — "atual" é a próxima a VENCER, e ela vence
  // dia 13 mesmo já quitada. Enquanto isso as compras do ciclo novo (que é o
  // que ele queria ver) ficavam escondidas atrás de um clique.
  //
  // ⚠️ Isto é decisão de TELA, não de aritmética: `competenciaAtual` (com eval
  // de 1313 casos) fica intocada — só mudamos de qual fatura o modal ABRE.
  // Só pula com o ciclo FECHADO: fatura em curso, mesmo paga adiantada, ainda
  // recebe compra e é nela que o usuário está mexendo.
  const [pulouParaSeguinte, setPulouParaSeguinte] = useState(false);
  // Parcelas que o BANCO já sabe que vão cair nesta fatura e que a Sora não tem
  // como transação (Mercado Pago manda parcela sem o marcador "N/M", então a 2ª
  // nunca é lançada). Projeção do sync — só existe em fatura FUTURA.
  const [previstas, setPrevistas] = useState<ParcelaPrevista[]>([]);
  const [totalPrevisto, setTotalPrevisto] = useState(0);

  useEffect(() => {
    if (!phone || !cartao?.id || !mesRef) return;
    let cancelado = false;
    setPrevistas([]); setTotalPrevisto(0);
    api.wallets.faturaStatus(phone, cartao.id, mesRef)
      .then((st) => {
        if (cancelado || !st) return;
        setPrevistas(st.parcelas_previstas || []);
        setTotalPrevisto(Number(st.total_previsto) || 0);
        if (pulouParaSeguinte || offsetMes !== 0) return;
        const c = cicloPorCompetencia(cartao, st.competencia);
        const fechada = c.fim < hojeSP();
        const quitada = Number(st.fatura) > 0.01 && Number(st.restante) <= 0.01;
        if (fechada && quitada) setOffsetMes(1);
      })
      .catch(() => { /* informativo — nunca impede o modal de abrir */ })
      .finally(() => { if (!cancelado) setPulouParaSeguinte(true); });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, cartao?.id, mesRef]);

  // Ciclo da fatura exibida — período que agrupa as compras dessa fatura.
  const ciclo = useMemo(
    () => cicloPorCompetencia(cartao, mesRef),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cartao?.dia_fechamento, cartao?.dia_vencimento, mesRef],
  );

  // Carrega contas bancárias (não-crédito) p/ escolher de onde pagar
  useEffect(() => {
    if (!phone) return;
    api.wallets.listar(phone)
      .then(ws => setContas((ws || []).filter((w: any) => w.tipo !== 'Crédito')))
      .catch(() => setContas([]));
  }, [phone]);

  // Antecipar: paga as parcelas em aberto da fatura debitando da conta escolhida
  async function anteciparFatura(contaNome: string) {
    const emAberto = txs.filter(t => t.pago === false);
    if (emAberto.length === 0) return;
    setAntecipando(true);
    try {
      const r = await api.transacoes.anteciparCartao({
        phone, ids: emAberto.map(t => t.id), conta_nome: contaNome,
      });
      setTxs(prev => prev.map(t => ({ ...t, pago: true })));
      setEscolhendoConta(false);
      onRefresh?.();
      alert(`✅ Fatura antecipada: ${fmt(r.debitado)} debitado de ${contaNome}.`);
    } catch (e: any) {
      alert(e.message || 'Erro ao antecipar.');
    } finally {
      setAntecipando(false);
    }
  }

  // Carrega as transações da fatura exibida. O ciclo cruza meses (ex.: 25/06 a
  // 24/07), então busca os DOIS meses que ele toca e filtra pelo intervalo.
  useEffect(() => {
    if (!phone || !cartao?.id) return;
    // Guarda contra corrida: trocar de fatura dispara um fetch novo enquanto o
    // anterior ainda está no ar, e sem isto a resposta ATRASADA sobrescrevia a
    // atual (o modal mostrava o total de outro ciclo, mudando a cada abertura).
    let cancelado = false;
    setLoading(true);
    // ⚠️ ZERA a lista ao trocar de fatura. Sem isto, os lançamentos da fatura
    // ANTERIOR continuavam no estado enquanto a nova carregava — e como o valor
    // exibido é calculado a partir deles, aparecia por um instante o total do
    // ciclo errado (medido: R$ 3.190,81 piscando onde o correto era R$ 287,27).
    // Número de dinheiro que pisca alto e depois cai é pior que um spinner.
    setTxs([]);
    const mesesDoCiclo = Array.from(new Set([ciclo.ini.slice(0, 7), ciclo.fim.slice(0, 7)]));
    const buscas: Promise<any>[] = mesesDoCiclo.map((m) => api.transacoes.listar(phone, { mes: m, limit: 500 }));
    // Compra PARCELADA é lançada com a data da COMPRA, então pode estar meses
    // atrás do ciclo e nem seria carregada pela busca por mês. Quando o banco
    // diz qual fatura está aberta, buscamos também por ela. Best-effort: se a
    // migration 101 ainda não rodou, essa busca falha e as outras seguem.
    const faturaAberta = offsetMes === 0 ? cartao?.of_bill_atual : null;
    if (faturaAberta) {
      buscas.push(
        api.transacoes.listar(phone, { bill_id: faturaAberta, limit: 500 }).catch(() => null),
      );
    }
    Promise.all(buscas)
      .then((rs: any[]) => {
        if (cancelado) return;
        // Dedup: uma transação pode vir pelos dois caminhos (mês e fatura).
        const vistas = new Set<string>();
        const todas = rs.flatMap((r) => r?.transacoes || [])
          .filter((t: any) => (t?.id && vistas.has(t.id) ? false : (vistas.add(t?.id), true)));
        // As transações guardam carteira_nome (string), não wallet_id — match por nome
        const nomeCartao = (cartao.nome || '').trim().toLowerCase();
        const minhas = todas.filter(
          (t: any) => t.wallet_id === cartao.id ||
            (t.carteira_nome || '').trim().toLowerCase() === nomeCartao);
        // Critério UMA vez por fatura (ver criterioDaFatura): por transação,
        // misturava a fatura vinculada com as compras do ciclo novo.
        const criterio = criterioDaFatura(minhas, cartao, offsetMes === 0, ciclo);
        // Inclui os CRÉDITOS (estorno/cashback) do ciclo, não só os Gasto: eles
        // abatem a fatura e o usuário precisa vê-los na lista pra bater com o
        // extrato do banco. Quem decide o sinal é `somarFatura`.
        const doCartao = minhas.filter(
          (t: any) => pertenceAFatura(t, cartao, ciclo, offsetMes === 0, criterio));
        setTxs(doCartao);
      })
      .catch(() => { if (!cancelado) setTxs([]); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, cartao?.id, cartao?.nome, cartao?.of_bill_atual, offsetMes, ciclo]);

  // Métricas
  // Cartão do Open Finance no mês ATUAL: o valor devido vem do banco (saldo
  // negativo = dívida), igual à lista de cartões — antes cada tela calculava o
  // seu e mostravam números diferentes. Somar as transações do mês aqui não dá
  // a fatura: ignora o pagamento da fatura (que não é `tipo: 'Gasto'`) e pega o
  // mês do calendário, não o ciclo. Mês passado segue pela soma.
  // Soma ASSINADA (lib/valor-fatura.ts): compra soma, estorno/crédito ABATE,
  // pagamento de fatura é neutro.
  const somaMes = useMemo(() => somarFatura(txs), [txs]);
  // Fatura: mesma fonte da lista de cartões — cartão do Open Finance no mês
  // atual usa o valor do sync (saldo = −fatura, já sem parcelas a vencer);
  // o resto soma as transações do mês. Ter duas contas diferentes aqui e na
  // lista já fez as duas telas mostrarem números diferentes.
  const valorFatura = useMemo(() => {
    // ⚠️ Saldo ZERO não é "fatura zerada" — é o banco ainda não ter publicado o
    // total do ciclo em aberto (o Mercado Pago manda 0/null o mês inteiro). Só
    // saldo NEGATIVO é valor do banco; sem ele, soma as transações do ciclo.
    const doBanco = offsetMes === 0 && cartao?.of_conta_id && typeof cartao?.saldo === 'number' && cartao.saldo < 0;
    // `totalPrevisto` só é ≠ 0 em fatura FUTURA: na fatura em curso a compra já
    // chegou pelo extrato e somar as duas fontes contaria em dobro.
    return (doBanco ? -(cartao.saldo as number) : somaMes) + totalPrevisto;
  }, [offsetMes, cartao?.of_conta_id, cartao?.saldo, somaMes, totalPrevisto]);
  const pagoFlag = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`sora-fatura-${cartao.id}-${mesRef}`) === 'paga';
  }, [cartao?.id, mesRef]);

  const dataPagamento = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(`sora-fatura-${cartao.id}-${mesRef}-data`) || '';
  }, [cartao?.id, mesRef]);

  // Pagamento mínimo: só o que o BANCO informa (migration 077). Antes era
  // `valorFatura * 0.15` — um chute com cara de dado oficial (mostrava R$211,57
  // enquanto o banco dizia R$31,32). Sem o dado, o campo some.
  const pagamentoMinimo: number | null =
    typeof cartao?.pagamento_minimo === 'number' ? cartao.pagamento_minimo : null;

  // Gastos por categoria — só os Gasto, de propósito: crédito entraria como
  // barra negativa ("Reembolso: −R$ 40") e quebraria a leitura do ranking.
  // O abatimento aparece no TOTAL da fatura, que é onde importa.
  const porCategoria = useMemo(() => {
    const acc: Record<string, number> = {};
    txs.filter(t => t.tipo === 'Gasto').forEach(t => {
      const cat = t.categoria || '📦 Outros';
      acc[cat] = (acc[cat] || 0) + (t.valor || 0);
    });
    return Object.entries(acc)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, total]) => ({ cat, total }));
  }, [txs]);

  const maiorCategoria = porCategoria[0]?.total || 1;

  // Gastos por cartão virtual (Open Finance) — fatura/limite seguem únicos.
  const porCartao = useMemo(() => {
    const acc: Record<string, number> = {};
    // Pluggy grava em `pluggy_card`, Celcoin em `of_card` — aceitar os dois.
    // Só Gasto, mesma razão do ranking por categoria acima.
    txs.filter(t => t.tipo === 'Gasto').forEach(t => {
      const c = t.of_card || t.pluggy_card;
      if (c) acc[c] = (acc[c] || 0) + (t.valor || 0);
    });
    return Object.entries(acc).sort((a, b) => b[1] - a[1]).map(([numero, total]) => ({ numero, total }));
  }, [txs]);
  const maiorCartao = porCartao[0]?.total || 1;
  const topCategorias = porCategoria.slice(0, 5);
  const restantes = porCategoria.length - 5;

  // Data formatada
  const [ano, m] = mesRef.split('-').map(Number);
  const mesNome = MES_NOMES[m - 1];

  function togglePaga() {
    const novoFlag = !pagoFlag;
    if (typeof window === 'undefined') return;
    if (novoFlag) {
      localStorage.setItem(`sora-fatura-${cartao.id}-${mesRef}`, 'paga');
      localStorage.setItem(
        `sora-fatura-${cartao.id}-${mesRef}-data`,
        new Date().toISOString()
      );
    } else {
      localStorage.removeItem(`sora-fatura-${cartao.id}-${mesRef}`);
      localStorage.removeItem(`sora-fatura-${cartao.id}-${mesRef}-data`);
    }
    onRefresh?.();
    // re-renderiza forçado
    setMesRef(mesRef);
  }

  function fmtDataPagto() {
    if (!dataPagamento) return '';
    const d = new Date(dataPagamento);
    return `Pago em ${d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  // Logo de transação — marca conhecida usa o ícone OFICIAL (mesmo sistema do
  // resto do app); sem marca, cai no emoji da categoria.
  function logoTransacao(tx: any) {
    const obs = tx.observacao || '';
    if (marcaDe(obs)) {
      return <CategoriaIcon nome={obs} size={36} rounded="rounded-lg" />;
    }
    const theme = getCategoriaTheme(tx.categoria || '');
    return (
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
        style={{ background: theme.bg, color: theme.color }}
      >
        {theme.emoji}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:justify-end p-0 md:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full md:max-w-md h-[90dvh] md:h-auto md:max-h-[90vh] bg-card rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-fade-in flex flex-col border-t md:border border-border"
        onClick={e => e.stopPropagation()}
      >
        {/* Alça (mobile) */}
        <div className="md:hidden flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <span className="w-10 h-1.5 rounded-full bg-muted-foreground/25" />
        </div>
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-2 pb-4 md:pt-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            {/* Logo oficial da marca (igual ao card da lista); sem marca → inicial. */}
            {marcaDe(cartao.nome) ? (
              <CategoriaIcon nome={cartao.nome} size={48} rounded="rounded-xl" />
            ) : (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-sm flex-shrink-0"
                style={{ background: logo.bg }}
              >
                {logo.text}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground truncate">{cartao.nome}</h2>
              {/* Vencimento pelo helper compartilhado (mesmo mês da lista) e com o
                  dia do BANCO como fonte primária, caindo pro localStorage. */}
              {(cartao.dia_vencimento ?? meta.diaVencimento) ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Calendar size={11} />
                  Vence em {labelVencimento(cartao.dia_vencimento ?? meta.diaVencimento)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">Sem data de vencimento</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors flex-shrink-0">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Conteúdo rolável */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">

          {/* Navegação entre faturas (passadas e futuras com parcelas) */}
          <div className="flex items-center justify-between bg-muted/40 rounded-xl p-1">
            <button onClick={() => setOffsetMes(o => o - 1)}
                    className="p-1.5 rounded-lg hover:bg-card transition-colors" title="Fatura anterior">
              <ChevronLeft size={16} className="text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground capitalize">
              {mesNome} {ano}{offsetMes === 0 ? ' · atual' : offsetMes > 0 ? ' · futura' : ''}
            </span>
            <button onClick={() => setOffsetMes(o => Math.min(12, o + 1))}
                    disabled={offsetMes >= 12}
                    className="p-1.5 rounded-lg hover:bg-card transition-colors disabled:opacity-40" title="Próxima fatura">
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          </div>

          {/* Antecipar parcelas em aberto desta fatura */}
          {txs.some(t => t.pago === false) && !escolhendoConta && (
            <button
              onClick={() => setEscolhendoConta(true)}
              disabled={antecipando}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary font-semibold text-sm hover:bg-primary/15 transition-all disabled:opacity-60"
            >
              {antecipando ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
              Antecipar {txs.filter(t => t.pago === false).length} parcela(s) desta fatura
            </button>
          )}

          {/* Seletor de conta de pagamento */}
          {escolhendoConta && (
            <div className="rounded-2xl border border-border bg-muted/20 p-3 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pagar de qual conta?</p>
                <button onClick={() => setEscolhendoConta(false)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
              </div>
              {contas.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">Nenhuma conta bancária cadastrada.</p>
              ) : contas.map(c => (
                <button
                  key={c.id}
                  onClick={() => anteciparFatura(c.nome)}
                  disabled={antecipando}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-card border border-border hover:border-primary/40 transition-all text-left disabled:opacity-60"
                >
                  <span className="text-sm font-medium text-foreground truncate">{c.nome}</span>
                  <span className="text-xs text-muted-foreground tabular flex-shrink-0">{fmt(c.saldo || 0)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Alerta: data de fechamento não cadastrada.
              O `meta` é só o localStorage do cadastro manual — o cartão do Open
              Finance traz o fechamento do próprio banco em `dia_fechamento`, e
              olhar só o localStorage acusava "não cadastrada" com a data lá. */}
          {!meta.diaFechamento && !cartao?.dia_fechamento && (
            <div className="rounded-2xl p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
                <Calendar size={18} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                  Data de fechamento não cadastrada
                </p>
                <p className="text-xs text-amber-600/80 dark:text-amber-300/80 mt-0.5 leading-relaxed">
                  Configure a data de fechamento do cartão para poder ver faturas mais recentes
                </p>
              </div>
              <ChevronRight size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-2.5" />
            </div>
          )}

          {/* Card: Valor da fatura (ou dívida total, quando vem do banco) */}
          <div className="rounded-2xl p-4 border border-border bg-muted/20">
            <div className="flex items-start justify-between mb-2">
              <p className="text-sm font-semibold text-foreground">Valor da fatura</p>
              <button
                onClick={togglePaga}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1 transition-all ${
                  pagoFlag
                    ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: pagoFlag ? '#16a34a' : '#d97706' }} />
                {pagoFlag ? 'Paga' : 'Em aberto'}
              </button>
            </div>
            <p className="text-3xl font-bold text-foreground tabular tracking-tight">
              {fmt(valorFatura)}
            </p>

            <div className="mt-4 pt-3 border-t border-border/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Valor pago</span>
                <span className="text-xs font-semibold text-green-600 dark:text-green-400 tabular">
                  {pagoFlag ? fmt(valorFatura) : fmt(0)}
                </span>
              </div>
              {pagoFlag && dataPagamento && (
                <p className="text-[11px] text-muted-foreground">
                  {fmtDataPagto()}
                </p>
              )}
              <div className="flex items-center justify-between" hidden={pagamentoMinimo == null}>
                <span className="text-xs text-muted-foreground">Pagamento mínimo</span>
                <span className="text-xs font-semibold text-foreground tabular">
                  {fmt(pagamentoMinimo ?? 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Por cartão virtual (Open Finance) — só quando há mais de um */}
          {porCartao.length > 1 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-foreground">Por cartão virtual</p>
                <span className="text-xs text-muted-foreground">{porCartao.length} cartões · fatura única</span>
              </div>
              <div className="space-y-3">
                {porCartao.map(({ numero, total }, i) => {
                  const cor = `hsl(${(i * 67) % 360} 70% 50%)`;
                  const pct = Math.round((total / maiorCartao) * 100);
                  return (
                    <div key={numero}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-foreground flex items-center gap-2 tabular-nums">
                          <CreditCard size={14} style={{ color: cor }} /> final ••{numero}
                        </span>
                        <span className="text-sm font-semibold text-foreground tabular flex-shrink-0">{fmt(total)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: cor }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Gastos por categoria */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Gastos por categoria</p>
              <span className="text-xs text-muted-foreground">{txs.length} transaç{txs.length === 1 ? 'ão' : 'ões'}</span>
            </div>

            {loading ? (
              <div className="py-6 flex items-center justify-center">
                <Loader2 size={18} className="animate-spin text-muted-foreground" />
              </div>
            ) : porCategoria.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">
                Sem gastos neste mês.
              </p>
            ) : (
              <>
                <div className="space-y-3">
                  {topCategorias.map(({ cat, total }) => {
                    const theme = getCategoriaTheme(cat);
                    const nome = nomeCategoria(cat);
                    const pct = Math.round((total / maiorCategoria) * 100);
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base flex-shrink-0">{theme.emoji}</span>
                            <span className="text-sm text-foreground truncate">{nome}</span>
                          </div>
                          <span className="text-sm font-semibold text-foreground tabular flex-shrink-0">
                            {fmt(total)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: theme.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {restantes > 0 && (
                  <button
                    onClick={() => setVerTudo(v => !v)}
                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-3 mt-1"
                  >
                    +{restantes} categoria{restantes !== 1 ? 's' : ''}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Transações da fatura */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Transações da fatura</p>
              <a
                href={`/transacoes?conta=${cartao.id}&mes=${mesRef}`}
                className="text-xs font-semibold inline-flex items-center gap-1"
                style={{ color: BRAND }}
              >
                Ver todas <ExternalLink size={11} />
              </a>
            </div>

            {loading ? (
              <div className="py-6 flex items-center justify-center">
                <Loader2 size={18} className="animate-spin text-muted-foreground" />
              </div>
            ) : txs.length === 0 && previstas.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">
                Sem transações neste mês.
              </p>
            ) : txs.length === 0 ? null : (
              <div className="space-y-2">
                {(verTudo ? txs : txs.slice(0, 8)).map((tx, i) => {
                  const data = new Date(tx.data).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                  }).replace('.', '');
                  return (
                    <div
                      key={tx.id || i}
                      className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted/40 transition-colors"
                    >
                      {logoTransacao(tx)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {tx.observacao || nomeCategoria(tx.categoria || '')}
                          {tx.parcela_total ? (
                            <span className="ml-1.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400 tabular-nums">
                              {tx.parcela_num}/{tx.parcela_total}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{data}</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground tabular flex-shrink-0">
                        {fmt(tx.valor)}
                      </p>
                    </div>
                  );
                })}
                {!verTudo && txs.length > 8 && (
                  <button
                    onClick={() => setVerTudo(true)}
                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-2"
                  >
                    Mostrar mais {txs.length - 8}
                  </button>
                )}
              </div>
            )}

            {/* ── Previstas pelo banco ──────────────────────────────────────
                Parcelas que o emissor já sabe que vão cair nesta fatura e que
                a Sora não tem como lançamento: o Mercado Pago manda a parcela
                sem o marcador "N/M", então a 2ª nunca vira transação — e a
                fatura de setembro saía R$ 282,27 onde o app mostrava 558,78.

                Fica visualmente SEPARADO (borda tracejada + rótulo com ícone,
                nunca só cor) porque é projeção: entra no total pra bater com o
                banco, mas não é um lançamento que o usuário possa editar. */}
            {previstas.length > 0 && !loading && (
              <div className="mt-4 pt-3 rounded-2xl px-3 py-3"
                   style={{ border: '1px dashed hsl(var(--border))' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <CalendarClock size={13} className="text-muted-foreground flex-shrink-0" />
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Previstas pelo banco
                  </p>
                </div>
                <div className="space-y-1.5">
                  {previstas.map((p, i) => (
                    <div key={`${p.descricao}-${p.parcela_num}-${i}`} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">
                          {p.descricao || 'Compra parcelada'}
                          <span className="ml-1.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400 tabular-nums">
                            {p.parcela_num}/{p.parcela_total}
                          </span>
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-foreground tabular flex-shrink-0">
                        {fmt(p.valor)}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                  Parcelas de compras anteriores que ainda não foram lançadas. Já
                  entram no total desta fatura — o valor final pode variar em
                  centavos no arredondamento da última parcela.
                </p>
              </div>
            )}
          </div>

          {/* Excluir cartão — acessível também no mobile (não só o ícone no card) */}
          {onExcluir && (
            <div className="pt-2 border-t border-border/60">
              <button
                onClick={onExcluir}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 font-semibold text-sm hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                style={{ minHeight: 44 }}
              >
                <Trash2 size={16} /> Excluir cartão
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
