'use client';

import { useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet,
  LineChart, AlertTriangle,
  Plus, Pencil, Trash2, Loader2, BellOff, ShoppingCart, Banknote,
  ChevronDown, ClipboardList, ArrowDownToLine, ArrowUpFromLine,
  CalendarDays, Landmark, CreditCard,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { api } from '@/lib/api';
import { saldoBRL } from '@/lib/moeda';
import {
  aindaVemNoMes, calcularSaldoProjetado, itemPrevistoDe, vezesQueAindaVem,
} from '@/lib/saldo-projetado';
import {
  projetarMeses, primeiroMesNoVermelho, ymHojeSP, somarMeses, type MesProjetado,
} from '@/lib/previstos';
import GraficoMeses, { BarraDividida, type BarraMes } from '@/components/previstos/GraficoMeses';
import FormRecorrencia, { type RecorrenciaForm } from '@/components/previstos/FormRecorrencia';
import { descreveQuando, descreveFim } from '@/lib/frequencia-recorrencia';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import SectionSkeleton from '@/components/ui/SectionSkeleton';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const VERDE = '#22c55e';
const VERMELHO = '#ef4444';
/** Roxo da projeção e do caixa — o mesmo violeta do Grow, pra "o que ainda
 *  não aconteceu" ter uma cor própria e não disputar com o verde/vermelho
 *  de receita e despesa, que ali significam outra coisa. */
const ROXO = '#7c3aed';

/** Quantos meses o gráfico das seções históricas mostra. */
const PERIODOS = [
  { id: 3,  label: '3 meses' },
  { id: 6,  label: '6 meses' },
  { id: 12, label: '1 ano' },
] as const;

/** Quantos meses a Projeção enxerga à frente. */
const MESES_A_FRENTE = 6;

type Aba = 'receitas' | 'despesas' | 'caixa' | 'projecao';

export default function PrevistosClient({ phoneInicial }: { phoneInicial?: string }) {
  const { phone: authPhone } = useAuth();
  const phone = authPhone || phoneInicial || '';

  const [aba, setAba] = useState<Aba>('caixa');
  const [periodo, setPeriodo] = useState<number>(6);
  const [mesSel, setMesSel] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);           // navegação de mês

  const ymHoje = ymHojeSP();
  const ymRef = somarMeses(ymHoje, offset);
  const [anoRef, mesRef] = ymRef.split('-').map(Number);

  // ── Dados ────────────────────────────────────────────────────────────────
  const {
    data: recData, mutate: recarregarRec,
  } = useApi(phone ? `prev:rec:${phone}` : null, () => api.recorrencias.listar(phone));
  const { data: divData }  = useApi(phone ? `prev:div:${phone}` : null, () => api.dividas.listar(phone));
  const { data: fatData }  = useApi(phone ? `prev:fat:${phone}` : null, () => api.wallets.faturas(phone, 0));
  const { data: walData }  = useApi(phone ? `prev:wal:${phone}` : null, () => api.wallets.listar(phone));
  const { data: resData }  = useApi(phone ? `prev:res:${phone}:${ymRef}` : null, () => api.transacoes.resumo(phone, ymRef));
  // O ano inteiro alimenta os gráficos históricos — mesma fonte do Relatórios,
  // pra os dois nunca divergirem no mesmo mês.
  const { data: anoData }  = useApi(phone ? `prev:ano:${phone}:${anoRef}` : null, () => api.transacoes.anual(phone, anoRef));
  const { data: anoAntData } = useApi(
    phone && periodo > mesRef ? `prev:ano:${phone}:${anoRef - 1}` : null,
    () => api.transacoes.anual(phone, anoRef - 1),
  );

  const recorrencias = useMemo(() => (Array.isArray(recData) ? recData : []), [recData]);
  const dividas  = useMemo(() => (divData as any)?.dividas || [], [divData]);
  const faturas  = useMemo(() => (fatData as any)?.faturas || [], [fatData]);
  const wallets  = useMemo(() => (Array.isArray(walData) ? walData : []), [walData]);
  const resumo   = (resData as any) || null;

  // ⚠️ SEM `phone` AS KEYS DO SWR SÃO `null` E O DADO NUNCA CHEGA. Sem esta
  // distinção o skeleton ficava pra sempre — visto na bancada. Um estado que
  // nunca sai do carregando é pior que um erro: ninguém sabe o que fazer.
  const semSessao = !phone;
  const carregando = !semSessao && (!recData || !divData || !walData);

  // ── Projeção ─────────────────────────────────────────────────────────────
  const saldoHoje = useMemo(
    () => wallets.filter((w: any) => w.tipo !== 'Crédito')
      .reduce((s: number, w: any) => s + (saldoBRL(w) ?? 0), 0),
    [wallets],
  );

  const projecao = useMemo<MesProjetado[]>(() => projetarMeses({
    inicio: ymHoje,
    quantidade: MESES_A_FRENTE,
    saldoInicial: saldoHoje,
    recorrencias,
    dividas,
    faturas,
    realizado: resumo && offset === 0
      ? { receitas: resumo.receitas || 0, gastos: resumo.gastos || 0 }
      : undefined,
  }), [ymHoje, saldoHoje, recorrencias, dividas, faturas, resumo, offset]);

  const vermelho = useMemo(() => primeiroMesNoVermelho(projecao), [projecao]);

  // ── Fecha o mês em… (a manchete) ─────────────────────────────────────────
  //
  // ⚠️ SAI DO MESMO `calcularSaldoProjetado` do card da aba Transações e do
  // Relatórios. Três telas respondendo "quanto sobra" com contas diferentes foi
  // o defeito que a gente acabou de corrigir — não vou reintroduzi-lo aqui.
  const previstosDoMes = useMemo(() => {
    // ⚠️ `itemPrevistoDe` em vez de escolher campo a campo: montado à mão,
    // o objeto perdia frequência e duração (migration 157) sem avisar, e a
    // conta anual voltava a ser cobrada todo mês.
    const itens = recorrencias
      .map((r: any) => itemPrevistoDe(r))
      .filter((i) => vezesQueAindaVem(i) > 0);
    const parc = dividas
      .filter((d: any) => d.status !== 'quitada' && Number(d.valor_parcela) > 0 && d.nos_previstos !== false
        && aindaVemNoMes({ tipo: 'Gasto', valor: d.valor_parcela, dia_vencimento: d.dia_vencimento }))
      .map((d: any) => ({ tipo: 'Gasto' as const, valor: d.valor_parcela, dia_vencimento: d.dia_vencimento }));
    const fat = faturas
      .filter((f: any) => Number(f.restante) > 0.01 && f.nos_previstos !== false
        && aindaVemNoMes({ tipo: 'Gasto', valor: f.restante, dia_vencimento: 0, venc: f.venc }))
      .map((f: any) => ({ tipo: 'Gasto' as const, valor: f.restante, dia_vencimento: 0, venc: f.venc }));
    return { itens, extras: [...parc, ...fat] };
  }, [recorrencias, dividas, faturas]);

  const proj = useMemo(
    () => calcularSaldoProjetado(
      wallets.map((w: any) => ({ tipo: w.tipo, saldo: saldoBRL(w) ?? 0 })),
      previstosDoMes.itens,
      previstosDoMes.extras,
    ),
    [wallets, previstosDoMes],
  );

  // ── Barras dos gráficos históricos ───────────────────────────────────────
  const barrasHistoricas = useMemo(() => {
    const doAno = (d: any) => (d?.meses || []) as { mes: number; receitas: number; gastos: number; saldo: number }[];
    const todos: { ym: string; receitas: number; gastos: number; saldo: number }[] = [];
    for (const m of doAno(anoAntData)) todos.push({ ym: `${anoRef - 1}-${String(m.mes).padStart(2, '0')}`, ...m });
    for (const m of doAno(anoData))    todos.push({ ym: `${anoRef}-${String(m.mes).padStart(2, '0')}`, ...m });
    // Só até o mês de referência: mês futuro no gráfico "histórico" viria zerado
    // e leria como "você não gastou nada", que é falso.
    const ate = todos.filter((m) => m.ym <= ymRef);

    // ⚠️ E CORTA O QUE VEM ANTES DO PRIMEIRO MÊS COM MOVIMENTO. Quem abriu
    // a conta em julho via abril, maio e junho zerados no gráfico — e mês
    // vazio não lê como "não existe", lê como "não gastei nada", que é uma
    // afirmação. De quebra, os zeros puxavam a média pra baixo.
    const primeiro = ate.findIndex((m) => (m.receitas || 0) > 0 || (m.gastos || 0) > 0);
    return (primeiro < 0 ? ate : ate.slice(primeiro)).slice(-periodo);
  }, [anoData, anoAntData, anoRef, ymRef, periodo]);

  // ⚠️ O MÊS CORRENTE É O ÚNICO QUE SE PARTE EM DOIS, e é essa divisão que
  // dá sentido ao gráfico: mês passado já fechou (tudo realizado) e mês
  // futuro ainda não começou (tudo previsto). Só o mês de hoje tem as duas
  // metades — e é justamente ele que a pessoa está tentando ler.
  //
  // ⚠️ O "previsto" sai do MESMO `proj` da manchete lá em cima. Calcular a
  // parte de cima da barra por outro caminho faria a barra e o número do
  // topo da tela discordarem a três centímetros um do outro.
  const parte = (m: { ym: string }, realizado: number, previsto: number): BarraMes => (
    m.ym === ymHoje
      ? { ym: m.ym, realizado: Math.max(0, realizado), previsto: Math.max(0, previsto) }
      : { ym: m.ym, realizado: Math.max(0, realizado) }
  );

  const barrasReceitas: BarraMes[] = barrasHistoricas.map((m) => parte(m, m.receitas, proj.aReceber));
  const barrasDespesas: BarraMes[] = barrasHistoricas.map((m) => parte(m, m.gastos, proj.aPagar));
  // ⚠️ LIMITE CONHECIDO, herdado: mês em que saiu mais do que entrou vira uma
  // barra VAZIA (o clamp em 0), e barra vazia lê como "não aconteceu nada".
  // Desenhar abaixo do zero pediria um eixo com metade negativa e mudaria os
  // outros três gráficos junto. Enquanto isso, quem dá o número certo é a
  // manchete logo acima, que mostra o valor com sinal.
  const barrasCaixa: BarraMes[] = barrasHistoricas.map(
    (m) => parte(m, m.receitas - m.gastos, proj.aReceber - proj.aPagar),
  );

  // Na projeção o mês 0 já vem com o realizado no lugar da previsão (ver
  // `projetarMeses`), então ele é o único que tem as duas partes. Nos meses
  // seguintes tudo é previsão, e a fatia ESTIMADA (conta de valor variável)
  // ganha listra em vez de virar mais um tom de vermelho.
  const barrasProjecao: BarraMes[] = projecao.map((m, i) => (i === 0
    ? { ym: m.ym, realizado: Math.max(0, m.despesaFirme), previsto: Math.max(0, proj.aPagar) }
    : { ym: m.ym, previsto: Math.max(0, m.despesaFirme + m.despesaEstimada), estimado: m.despesaEstimada }
  ));

  const mesDetalhe = useMemo(
    () => projecao.find((m) => m.ym === mesSel) || null,
    [projecao, mesSel],
  );

  if (carregando) return <SectionSkeleton />;

  if (semSessao) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <p className="text-base font-semibold text-foreground">Entre para ver seus previstos</p>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            Esta aba mostra o que ainda vai entrar e sair da sua conta.
          </p>
        </div>
      </div>
    );
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────
  // 'novo' = criando · um item = editando ESSE item · null = fechado.
  const [formTarget, setFormTarget] = useState<'novo' | RecorrenciaForm | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [removendo, setRemovendo]     = useState<string | null>(null);

  async function excluir(id: string) {
    setRemovendo(id);
    try {
      await api.recorrencias.cancelar(id, phone);
      // ⚠️ Revalida em vez de tirar da lista na mão: a mesma recorrência
      // alimenta a projeção, os gráficos e o "fecha o mês em" — sumir da
      // lista com os números velhos ao lado seria o pior dos dois mundos.
      await recarregarRec();
    } finally {
      setRemovendo(null);
      setConfirmando(null);
    }
  }

  // ── De onde vem / pra onde vai ───────────────────────────────────────────
  //
  // As linhas que compõem o que ainda entra e o que ainda sai neste mês.
  // ⚠️ Cada uma leva o `rec` original quando é recorrência: é o que permite
  // editar dali mesmo, sem mandar a pessoa pra outra aba (era o que o atalho
  // pra /transacoes fazia, e ele saiu junto com esta mudança).
  const fontes = useMemo(() => {
    const vezes = (r: any) => vezesQueAindaVem(itemPrevistoDe(r));

    const daRecorrencia = (r: any) => ({
      id: `rec:${r.id}`,
      titulo: r.descricao || r.categoria || 'Conta fixa',
      valor: (Number(r.valor) || 0) * vezes(r),
      legenda: [
        descreveQuando(r),
        vezes(r) > 1 ? `${vezes(r)}x ainda neste mês` : '',
        r.valor_variavel ? 'valor estimado' : '',
      ].filter(Boolean).join(' · '),
      icone: '🔁',
      rec: r,
    });

    const vem = recorrencias
      .filter((r: any) => r.tipo === 'Recebimento' && vezes(r) > 0)
      .map(daRecorrencia);

    const vai = [
      ...recorrencias.filter((r: any) => r.tipo === 'Gasto' && vezes(r) > 0).map(daRecorrencia),
      ...dividas
        .filter((d: any) => d.status !== 'quitada' && Number(d.valor_parcela) > 0 && d.nos_previstos !== false
          && aindaVemNoMes({ tipo: 'Gasto', valor: d.valor_parcela, dia_vencimento: d.dia_vencimento }))
        .map((d: any) => ({
          id: `div:${d.id}`,
          titulo: d.titulo || 'Parcela',
          valor: Number(d.valor_parcela) || 0,
          legenda: `parcela · vence dia ${d.dia_vencimento}`,
          icone: '🏦',
        })),
      ...faturas
        .filter((f: any) => Number(f.restante) > 0.01 && f.nos_previstos !== false
          && aindaVemNoMes({ tipo: 'Gasto', valor: f.restante, dia_vencimento: 0, venc: f.venc }))
        .map((f: any) => ({
          id: `fat:${f.cartao_id}`,
          titulo: `Fatura ${f.nome || 'do cartão'}`,
          valor: Number(f.restante) || 0,
          legenda: `fatura · vence ${String(f.venc || '').slice(8, 10)}/${String(f.venc || '').slice(5, 7)}`,
          icone: '💳',
        })),
    ].sort((a, b) => b.valor - a.valor);

    return { vem, vai };
  }, [recorrencias, dividas, faturas]);

  // ── Patrimônio: passado reconstruído + futuro projetado ──────────────────
  //
  // ⚠️ O PASSADO É RECONSTRUÍDO PRA TRÁS a partir do saldo de HOJE, subtraindo
  // o resultado de cada mês. Não existe histórico de saldo guardado — o que
  // existe é o saldo atual das carteiras e o fluxo de cada mês. É aritmética
  // sobre dado que temos, não estimativa: nada aqui é inventado.
  //
  // ⚠️ Ela PARA no primeiro mês que daria negativo. Antes de a pessoa usar a
  // Sora não há fluxo registrado, então continuar subtraindo produziria um
  // patrimônio negativo que nunca existiu — e o gráfico afirmaria dívida.
  const barrasPatrimonio: BarraMes[] = useMemo(() => {
    const passado: BarraMes[] = [];
    let saldo = proj.saldoHoje;
    const hist = barrasHistoricas.filter((m) => m.ym <= ymHoje);

    for (let i = hist.length - 1; i >= 0; i -= 1) {
      const m = hist[i];
      if (saldo < 0) break;
      passado.unshift(m.ym === ymHoje
        // O mês corrente é o único partido: o que já se tem × o que a
        // projeção acrescenta até o fim dele.
        ? { ym: m.ym, realizado: saldo, previsto: Math.max(0, (projecao[0]?.saldoAcumulado ?? saldo) - saldo) }
        : { ym: m.ym, realizado: saldo });
      saldo -= (Number(m.receitas) || 0) - (Number(m.gastos) || 0);
    }

    const futuro: BarraMes[] = projecao.slice(1).map((m) => ({
      ym: m.ym,
      previsto: Math.max(0, m.saldoAcumulado),
    }));

    return [...passado, ...futuro];
  }, [barrasHistoricas, projecao, proj.saldoHoje, ymHoje]);

  // ── Listas ───────────────────────────────────────────────────────────────
  const receitas = recorrencias.filter((r: any) => r.tipo === 'Recebimento');
  const despesas = recorrencias.filter((r: any) => r.tipo === 'Gasto');

  return (
    <div className="pb-24 space-y-5">

      {/* ── Manchete ────────────────────────────────────────────────────── */}
      <section className="card rounded-3xl p-5 sm:p-6 relative overflow-hidden">
        <div
          className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-40 pointer-events-none"
          style={{ background: 'radial-gradient(circle, hsl(var(--primary) / .22) 0%, transparent 70%)' }}
          aria-hidden
        />
        <div className="relative">
          <div className="flex items-center justify-between gap-3 mb-4">
            <button
              type="button" onClick={() => setOffset((o) => o - 1)} aria-label="Mês anterior"
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-muted/50 hover:bg-muted transition-colors"
              style={{ minHeight: 44, minWidth: 44 }}
            >
              <ChevronLeft size={17} />
            </button>
            <span className="text-sm font-bold text-foreground">
              {MESES[mesRef - 1]} {anoRef}
            </span>
            <button
              type="button" onClick={() => setOffset((o) => o + 1)} aria-label="Próximo mês"
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-muted/50 hover:bg-muted transition-colors"
              style={{ minHeight: 44, minWidth: 44 }}
            >
              <ChevronRight size={17} />
            </button>
          </div>

          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Fecha o mês em
          </p>
          <p className={`text-4xl font-bold tabular tracking-tight mt-1 ${
            proj.projetado >= 0 ? 'text-foreground' : 'text-red-500'
          }`}>
            {fmt(proj.projetado)}
          </p>
          {/* A conta escrita, pra o número não precisar de fé. */}
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {fmt(proj.saldoHoje)} hoje + {fmt(proj.aReceber)} a entrar − {fmt(proj.aPagar)} a sair
            {proj.aproximado && ' · aproximado'}
          </p>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-2xl p-3.5 bg-muted/30">
              <p className="text-[10px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400 flex items-center gap-1.5">
                <TrendingUp size={11} /> Entrou
              </p>
              <p className="text-lg font-bold tabular mt-1">{fmt(resumo?.receitas || 0)}</p>
              <p className="text-[11px] text-muted-foreground">+{fmt(proj.aReceber)} a entrar</p>
            </div>
            <div className="rounded-2xl p-3.5 bg-muted/30">
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 flex items-center gap-1.5">
                <TrendingDown size={11} /> Saiu
              </p>
              <p className="text-lg font-bold tabular mt-1">{fmt(resumo?.gastos || 0)}</p>
              <p className="text-[11px] text-muted-foreground">+{fmt(proj.aPagar)} a sair</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Alerta de furo no caixa ─────────────────────────────────────────
          Ícone + texto, nunca a cor sozinha. E só aparece quando existe furo:
          alerta que aparece sempre vira decoração em duas semanas. */}
      {vermelho && (
        <div
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{
            background: 'color-mix(in srgb, #ef4444 10%, transparent)',
            border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)',
          }}
          role="status"
        >
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">
              Seu caixa fica negativo em {MESES[Number(vermelho.ym.split('-')[1]) - 1].toLowerCase()}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Projeção de {fmt(vermelho.saldoAcumulado)} mantendo o ritmo atual de contas fixas e parcelas.
            </p>
          </div>
        </div>
      )}

      {/* ── Ação principal ───────────────────────────────────────────────
          ⚠️ Botão COM RÓTULO no topo, nunca um FAB no canto inferior
          direito: ali mora o "+" global da barra do celular, e dois botões
          redondos no mesmo canto já geraram o relato "o + aparece
          duplicado". (Regra registrada no CLAUDE.md.) */}
      <button
        type="button"
        onClick={() => setFormTarget('novo')}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 rounded-2xl
                   text-sm font-bold text-white shadow-sm transition-all duration-200
                   motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.99]"
        style={{ height: 48, background: 'linear-gradient(135deg, hsl(var(--primary)), #3FA85A)' }}
      >
        <Plus size={16} /> Nova conta fixa
      </button>

      {formTarget && (
        <FormRecorrencia
          phone={phone}
          contas={wallets}
          editItem={formTarget === 'novo' ? null : formTarget}
          onCancel={() => setFormTarget(null)}
          onSaved={() => { setFormTarget(null); recarregarRec(); }}
        />
      )}

      {/* ── Sub-abas ───────────────────────────────────────────────────────
          Rolagem horizontal só nelas, nunca na página. */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0" role="tablist">
        {([
          ['receitas', 'Receitas', TrendingUp],
          ['despesas', 'Despesas', TrendingDown],
          ['caixa',    'Caixa',    Wallet],
          ['projecao', 'Projeção', LineChart],
        ] as const).map(([id, label, Icone]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            onClick={() => { setAba(id); setMesSel(null); }}
            className={`inline-flex items-center gap-1.5 px-4 h-11 rounded-2xl text-[13.5px] font-bold whitespace-nowrap transition-colors ${
              aba === id ? 'bg-primary text-white' : 'bg-muted/50 text-muted-foreground hover:text-foreground'
            }`}
            style={{ minHeight: 44 }}
          >
            <Icone size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Conteúdo ───────────────────────────────────────────────────── */}
      {aba === 'projecao' ? (
        <SecaoProjecao
          projecao={projecao}
          barras={barrasPatrimonio}
          mesSel={mesSel}
          onSelecionar={setMesSel}
          detalhe={mesDetalhe}
          saldoHoje={proj.saldoHoje}
          ymHoje={ymHoje}
        />
      ) : aba === 'caixa' ? (
        <SecaoCaixa
          barras={barrasCaixa}
          periodo={periodo}
          onPeriodo={setPeriodo}
          mesSel={mesSel}
          onSelecionar={setMesSel}
          ymHoje={ymHoje}
          entrou={resumo?.receitas || 0}
          saiu={resumo?.gastos || 0}
          aEntrar={proj.aReceber}
          aSair={proj.aPagar}
          fontes={fontes}
          onEditar={setFormTarget}
        />
      ) : (
        <SecaoHistorica
          aba={aba}
          barras={aba === 'receitas' ? barrasReceitas : aba === 'despesas' ? barrasDespesas : barrasCaixa}
          periodo={periodo}
          onPeriodo={setPeriodo}
          mesSel={mesSel}
          onSelecionar={setMesSel}
          historico={barrasHistoricas}
          itens={aba === 'receitas' ? receitas : aba === 'despesas' ? despesas : []}
          dividas={aba === 'despesas' ? dividas : []}
          faturas={aba === 'despesas' ? faturas : []}
          ymRef={ymRef}
          ymHoje={ymHoje}
          onEditar={setFormTarget}
          onNovo={() => setFormTarget('novo')}
          onExcluir={excluir}
          confirmando={confirmando}
          onConfirmar={setConfirmando}
          removendo={removendo}
        />
      )}

    </div>
  );
}

/* ── Seções históricas (Receitas · Despesas · Caixa) ─────────────────────── */

function SecaoHistorica({
  aba, barras, periodo, onPeriodo, mesSel, onSelecionar, historico, itens, dividas, faturas,
  ymRef, ymHoje,
  onEditar, onNovo, onExcluir, confirmando, onConfirmar, removendo,
}: any) {
  const cor = aba === 'receitas' ? VERDE : aba === 'despesas' ? VERMELHO : 'hsl(var(--primary))';

  // O mês em foco é o tocado no gráfico; sem toque, o do seletor do topo.
  // Assim o cabeçalho NUNCA fica sem assunto — "média de 6 meses" como
  // manchete é um número que ninguém pediu.
  const foco: BarraMes | undefined = barras.find((b: BarraMes) => b.ym === (mesSel || ymRef))
    || barras[barras.length - 1];
  const realizadoFoco = foco?.realizado || 0;
  const previstoFoco = foco?.previsto || 0;

  // ⚠️ MÉDIA SÓ DOS MESES COM MOVIMENTO. Somar e dividir por 6 quando três
  // deles são zero (conta nova, ou período que pega meses antes do cadastro)
  // devolve metade do gasto real e a pessoa acha que está gastando pouco.
  const comValor = barras.filter((b: BarraMes) => ((b.realizado || 0) + (b.previsto || 0)) > 0);
  const media = comValor.length
    ? comValor.reduce((s: number, b: BarraMes) => s + (b.realizado || 0) + (b.previsto || 0), 0) / comValor.length
    : 0;

  const ehHoje = foco?.ym === ymHoje;
  const Icone = aba === 'receitas' ? Banknote : aba === 'despesas' ? ShoppingCart : Wallet;
  const verbo = aba === 'receitas' ? 'Recebido' : aba === 'despesas' ? 'Gasto' : 'Sobrou';
  const [anoFoco, mesFoco] = String(foco?.ym || ymRef).split('-').map(Number);

  const jaVeio = (i: any) => vezesQueAindaVem(itemPrevistoDe(i)) === 0;
  const passados = itens.filter(jaVeio);
  const futuros  = itens.filter((i: any) => !jaVeio(i));

  return (
    <div className="space-y-5 animate-[fade-in_300ms_ease-out]">
      <section className="card rounded-3xl p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            {/* Manchete no formato "assunto → número": o título diz DE QUE
                mês é o valor logo abaixo. Sem ele, um número grande sozinho
                obriga a olhar o seletor no topo pra saber o que está lendo. */}
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
              <Icone size={12} className="flex-shrink-0" />
              {verbo} em {MESES[mesFoco - 1]} {anoFoco}
            </p>
            <div className="flex items-baseline gap-2 flex-wrap mt-1">
              <p className="text-[28px] sm:text-3xl font-bold tabular tracking-tight leading-none text-foreground">
                {fmt(realizadoFoco)}
              </p>
              {/* ⚠️ O previsto vem AO LADO do realizado, não somado a ele: o
                  que já saiu é fato e o que falta é estimativa, e um total
                  único apaga a diferença bem no número mais visível da tela. */}
              {previstoFoco > 0 && (
                <p className="text-sm font-bold tabular leading-none" style={{ color: cor }}>
                  +{fmt(previstoFoco)} previsto
                </p>
              )}
            </div>
          </div>

          {/* Filtro de período: pílulas, não uma folha. Com três opções, abrir
              um modal custa dois toques a mais pra escolher entre três coisas
              que cabem na tela. */}
          <div className="flex gap-1 p-1 rounded-2xl bg-muted/50 flex-shrink-0">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPeriodo(p.id)}
                aria-pressed={periodo === p.id}
                className={`px-2.5 h-9 rounded-xl text-[12px] font-bold transition-colors ${
                  periodo === p.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
                style={{ minHeight: 36 }}
              >
                {p.id === 12 ? '1 ano' : `${p.id}m`}
              </button>
            ))}
          </div>
        </div>

        <GraficoMeses
          barras={barras}
          cor={cor}
          selecionado={mesSel}
          onSelecionar={onSelecionar}
          titulo={`${verbo} · ${barras.length} ${barras.length === 1 ? 'mês' : 'meses'}`}
          rotuloRealizado={aba === 'receitas' ? 'recebido' : aba === 'despesas' ? 'gasto' : 'sobrou'}
          rotuloPrevisto="previsto"
          divisorApos={ehHoje ? undefined : ymHoje}
          destaque={foco?.ym}
          rotuloAcessivel={`${aba} nos últimos ${barras.length} meses`}
        />

        <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
          <p className="text-[11.5px] text-muted-foreground">
            média <strong className="font-bold text-foreground tabular-nums">{fmt(media)}</strong>/mês
            {comValor.length !== barras.length ? ' nos meses com movimento' : ''}
          </p>
          <p className="text-[11px] text-muted-foreground/70">Toque numa barra</p>
        </div>

        {/* ⚠️ A BARRA "já × ainda" NÃO MORA MAIS AQUI. Debaixo do gráfico de
            seis meses ela lia como legenda dele; a pergunta que ela responde
            ("quanto disto já aconteceu") é sobre a LISTA do mês, então ela
            desceu pro card "Ainda vai sair/entrar". */}
      </section>

      {/* ⚠️ Vazio com AÇÃO. "Nada por aqui" é um beco sem saída: quem chega
          nesta aba sem nenhuma conta fixa cadastrada é exatamente quem mais
          precisa cadastrar uma, e o botão do topo pode já ter rolado. */}
      {itens.length === 0 && aba !== 'caixa' && (
        <section className="card rounded-2xl p-6 text-center">
          <p className="text-sm font-bold text-foreground">
            {aba === 'receitas' ? 'Nenhuma receita fixa ainda' : 'Nenhuma conta fixa ainda'}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
            {aba === 'receitas'
              ? 'Cadastre salário, aluguel recebido ou qualquer entrada que se repita — a projeção passa a contar com ela.'
              : 'Cadastre aluguel, assinaturas, IPVA… e a Sora passa a saber quanto do mês já está comprometido.'}
          </p>
          <button
            type="button"
            onClick={onNovo}
            className="mt-4 inline-flex items-center justify-center gap-2 px-5 rounded-2xl text-sm font-bold
                       text-white shadow-sm transition-all duration-200 motion-safe:active:scale-[0.98]"
            style={{ height: 48, background: 'linear-gradient(135deg, hsl(var(--primary)), #3FA85A)' }}
          >
            <Plus size={16} /> Nova conta fixa
          </button>
        </section>
      )}

      {itens.length > 0 && (
        <>
          {futuros.length > 0 && (
            <Grupo
              titulo={aba === 'receitas' ? 'De onde o dinheiro vem' : 'Para onde o dinheiro vai'}
              itens={futuros}
              cor={cor}
              // ⚠️ O total do cabeçalho é do MÊS (o que já aconteceu mais o
              // que ainda vem), e a lista é só do que ainda vem — por isso a
              // legenda diz "ainda", e não "no mês". Dizer "3 linhas no mês"
              // com um total maior que a soma delas seria conta que não bate.
              realizado={realizadoFoco}
              previsto={previstoFoco}
              legenda={`${futuros.length} ${futuros.length === 1 ? 'linha ainda vem' : 'linhas ainda vêm'}`}
              rotuloRealizado={aba === 'receitas' ? 'já entrou' : 'já saiu'}
              rotuloPrevisto={aba === 'receitas' ? 'ainda entra' : 'ainda sai'}
              rotuloLista={aba === 'receitas' ? 'Ainda vai entrar' : 'Ainda vai sair'}
              {...{ onEditar, onExcluir, confirmando, onConfirmar, removendo }}
            />
          )}
          {passados.length > 0 && (
            <Grupo
              titulo={aba === 'receitas' ? 'Já entrou' : 'Já saiu'}
              itens={passados}
              cor={cor}
              esmaecido
              {...{ onEditar, onExcluir, confirmando, onConfirmar, removendo }}
            />
          )}
        </>
      )}

      {aba === 'despesas' && (dividas.length > 0 || faturas.length > 0) && (
        <section className="card rounded-2xl overflow-hidden">
          <p className="px-5 pt-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Parcelas e faturas
          </p>
          <ul className="divide-y divide-border/50">
            {dividas.filter((d: any) => d.status !== 'quitada' && Number(d.valor_parcela) > 0).map((d: any) => (
              <li key={d.id} className="px-5 py-3 flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground truncate">{d.titulo}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {d.parcelas_total ? `${d.parcelas_pagas || 0} de ${d.parcelas_total} · ` : ''}vence dia {d.dia_vencimento}
                  </span>
                </span>
                <span className="text-sm font-bold tabular text-red-500 whitespace-nowrap">
                  −{fmt(d.valor_parcela)}
                </span>
              </li>
            ))}
            {faturas.filter((f: any) => Number(f.restante) > 0.01).map((f: any) => (
              <li key={f.cartao_id} className="px-5 py-3 flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground truncate">Fatura {f.nome}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    vence {String(f.venc || '').slice(8, 10)}/{String(f.venc || '').slice(5, 7)}
                  </span>
                </span>
                <span className="text-sm font-bold tabular text-red-500 whitespace-nowrap">
                  −{fmt(f.restante)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Cabeçalho dos cards de fluxo — total, contagem, o botão de abrir e a barra
 * realizado × previsto.
 *
 * ⚠️ Um só, usado pelo card do Caixa E pelos grupos de Receitas/Despesas. As
 * duas telas mostram a mesma ideia ("disto aqui, tanto já aconteceu e tanto
 * ainda vem"), e duas implementações dela divergiriam no primeiro ajuste — foi
 * o que aconteceu com o formulário de conta fixa antes de virar folha única.
 */
function CabecalhoFluxo({
  titulo, total, legenda, aberto, onToggle,
  realizado, previsto, cor, rotuloRealizado, rotuloPrevisto,
}: any) {
  const temBarra = (Number(realizado) || 0) + (Number(previsto) || 0) > 0;
  return (
    <>
      <p className="px-5 pt-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {titulo}
      </p>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={aberto}
        className="w-full px-5 pt-2 pb-4 text-left transition-colors hover:bg-muted/25
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-2xl font-bold tabular tracking-tight text-foreground leading-none">
              {fmt(total)}
            </p>
            <p className="text-[12px] text-muted-foreground mt-1.5">{legenda}</p>
          </div>
          <ChevronDown
            size={18}
            className={`flex-shrink-0 text-muted-foreground transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </div>

        {/* ⚠️ A BARRA MORA AQUI, não embaixo do gráfico. Ela responde "quanto
            disto já aconteceu" — que é uma pergunta sobre ESTA lista, não sobre
            o gráfico de doze meses logo acima. Debaixo do gráfico ela parecia
            legenda dele. */}
        {temBarra && (
          <div className="mt-3.5">
            <BarraDividida
              realizado={Number(realizado) || 0}
              previsto={Number(previsto) || 0}
              cor={cor}
              rotuloRealizado={rotuloRealizado}
              rotuloPrevisto={rotuloPrevisto}
            />
          </div>
        )}
      </button>
    </>
  );
}

/**
 * Lista de contas fixas de um lado do mês, com o cabeçalho de fluxo em cima.
 *
 * ⚠️ NASCE RECOLHIDO. São duas listas que podem ter dez linhas cada; abertas de
 * saída, empurram o gráfico pra fora da tela no celular e a pessoa perde a
 * visão geral que veio buscar. Fechado, o card ainda responde o essencial — o
 * total e a divisão — na barra.
 */
function Grupo({
  titulo, itens, cor, esmaecido, legenda,
  realizado, previsto, rotuloRealizado, rotuloPrevisto, rotuloLista,
  onEditar, onExcluir, confirmando, onConfirmar, removendo,
}: any) {
  const [aberto, setAberto] = useState(false);
  const somaItens = itens.reduce((s: number, i: any) => s + (Number(i.valor) || 0), 0);
  // Sem realizado/previsto informados, o card é sobre a própria lista.
  const total = realizado === undefined && previsto === undefined ? somaItens
    : (Number(realizado) || 0) + (Number(previsto) || 0);

  return (
    <section className={`card rounded-2xl overflow-hidden ${esmaecido ? 'opacity-70' : ''}`}>
      <CabecalhoFluxo
        titulo={titulo}
        total={total}
        legenda={legenda ?? `${itens.length} ${itens.length === 1 ? 'linha' : 'linhas'} no mês`}
        aberto={aberto}
        onToggle={() => setAberto((v: boolean) => !v)}
        realizado={realizado}
        previsto={previsto}
        cor={cor}
        rotuloRealizado={rotuloRealizado}
        rotuloPrevisto={rotuloPrevisto}
      />

      {aberto && (
        <div className="border-t border-border/50 motion-safe:animate-[fade-in_200ms_ease-out]">
          {rotuloLista && (
            <div className="flex items-center justify-between gap-2 px-5 pt-3.5 pb-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {rotuloLista}
              </p>
              <p className="text-[10px] font-bold text-muted-foreground tabular-nums">
                {itens.length} de {itens.length}
              </p>
            </div>
          )}
          <ul className="divide-y divide-border/50">
            {itens.map((i: any, idx: number) => {
              const confirmandoEste = confirmando === i.id;
              const saindo = removendo === i.id;
              return (
                <li
                  key={i.id}
                  className="relative motion-safe:animate-[fade-in_320ms_ease-out_both]"
                  style={{ animationDelay: `${Math.min(idx * 35, 210)}ms`, opacity: saindo ? 0.45 : undefined }}
                >
                  <div className="flex items-center gap-2 pl-2 pr-2 sm:pr-3">
                    {/* ⚠️ A LINHA INTEIRA abre a edição. Um lápis de 16px como
                        único alvo obrigaria mira fina no celular — a regra é não
                        exigir toque preciso. O ícone fica como PISTA. */}
                    <button
                      type="button"
                      onClick={() => onEditar?.(i)}
                      className="group min-w-0 flex-1 flex items-center gap-3 px-3 py-3 rounded-xl text-left
                                 transition-colors hover:bg-muted/40 focus-visible:outline-none
                                 focus-visible:ring-2 focus-visible:ring-primary/50"
                      style={{ minHeight: 56 }}
                      aria-label={`Editar ${i.descricao || i.categoria || 'conta fixa'}`}
                    >
                      <CategoriaIcon nome={i.descricao || i.categoria} icone="🔁" size={34} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                            {i.descricao || i.categoria || 'Conta fixa'}
                          </span>
                          {/* ⚠️ Ícone + rótulo acessível, nunca só a cor: "não te
                              aviso" é informação, e quem não distingue tom
                              precisa dela também. */}
                          {i.lembrete === false && (
                            <BellOff size={11} className="flex-shrink-0 text-muted-foreground" aria-label="sem aviso" />
                          )}
                        </span>
                        <span className="block text-[11px] text-muted-foreground truncate">
                          {descreveQuando(i)}
                          {descreveFim(i.data_fim) ? ` · ${descreveFim(i.data_fim)}` : ''}
                          {i.valor_variavel ? ' · valor estimado' : ''}
                          {i.carteira ? ` · ${i.carteira}` : ''}
                        </span>
                      </span>
                      <span className="text-sm font-bold tabular whitespace-nowrap" style={{ color: cor }}>
                        {fmt(i.valor)}
                      </span>
                      <Pencil
                        size={13}
                        className="flex-shrink-0 text-muted-foreground/45 transition-colors group-hover:text-muted-foreground"
                        aria-hidden
                      />
                    </button>

                    {/* ⚠️ Excluir NÃO é ícone escondido em hover: no celular não
                        existe hover, e a ação simplesmente não existiria. */}
                    <button
                      type="button"
                      onClick={() => onConfirmar?.(confirmandoEste ? null : i.id)}
                      aria-label={`Excluir ${i.descricao || 'conta fixa'}`}
                      aria-expanded={confirmandoEste}
                      className={`flex-shrink-0 grid place-items-center rounded-xl transition-colors ${
                        confirmandoEste ? 'text-red-500 bg-red-500/10' : 'text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10'
                      }`}
                      style={{ width: 44, height: 44 }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Confirmação IN LOCO: dá pra ler o nome do que vai sumir sem
                      perder a linha de vista, e um toque fora cancela. */}
                  {confirmandoEste && (
                    <div className="flex flex-wrap items-center gap-2 px-4 pb-3 -mt-1 motion-safe:animate-[fade-in_180ms_ease-out]">
                      <p className="text-xs text-muted-foreground flex-1 min-w-[9rem]" role="status">
                        Parar de prever <strong className="text-foreground">{i.descricao || 'esta conta'}</strong>?
                        {' '}Os lançamentos já feitos ficam.
                      </p>
                      <button
                        type="button"
                        onClick={() => onExcluir?.(i.id)}
                        disabled={saindo}
                        className="inline-flex items-center gap-1.5 px-3.5 rounded-xl text-xs font-bold
                                   text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
                        style={{ height: 40 }}
                      >
                        {saindo ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        Excluir
                      </button>
                      <button
                        type="button"
                        onClick={() => onConfirmar?.(null)}
                        className="px-3.5 rounded-xl text-xs font-semibold text-muted-foreground
                                   hover:text-foreground hover:bg-muted/60 transition-colors"
                        style={{ height: 40 }}
                      >
                        Manter
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ── Caixa ──────────────────────────────────────────────────────────────────
 *
 * Responde duas perguntas que o gráfico sozinho não responde: PARA ONDE o
 * dinheiro vai e DE ONDE ele vem. O gráfico mostra o resultado; estes dois
 * cards mostram a composição — e é a composição que a pessoa consegue mudar.
 */

function SecaoCaixa({
  barras, periodo, onPeriodo, mesSel, onSelecionar, ymHoje,
  entrou, saiu, aEntrar, aSair, fontes, onEditar,
}: any) {
  return (
    <div className="space-y-5 animate-[fade-in_300ms_ease-out]">
      <section className="card rounded-3xl p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
              <Wallet size={12} className="flex-shrink-0" /> Fluxo de caixa
            </p>
            <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
              Quanto sobrou em cada mês — o que entrou menos o que saiu.
            </p>
          </div>
          <FiltroPeriodo periodo={periodo} onPeriodo={onPeriodo} />
        </div>

        <GraficoMeses
          barras={barras}
          cor={ROXO}
          selecionado={mesSel}
          onSelecionar={onSelecionar}
          titulo={`Sobrou · ${barras.length} ${barras.length === 1 ? 'mês' : 'meses'}`}
          rotuloRealizado="sobrou"
          rotuloPrevisto="previsto"
          divisorApos={barras.some((b: BarraMes) => b.ym === ymHoje) ? ymHoje : undefined}
          destaque={ymHoje}
          rotuloAcessivel={`Fluxo de caixa dos últimos ${barras.length} meses`}
        />
      </section>

      {/* ⚠️ SAÍDAS PRIMEIRO. É a lista que a pessoa consegue mexer hoje: cortar
          uma assinatura é uma decisão de agora, arrumar mais receita não é. */}
      <CardFluxo
        titulo="Para onde o dinheiro vai"
        realizado={saiu}
        previsto={aSair}
        itens={fontes.vai}
        cor={VERMELHO}
        sinal="−"
        rotuloRealizado="já saiu"
        rotuloPrevisto="ainda sai"
        rotuloLista="Ainda vai sair"
        vazio="Nenhuma saída prevista para este mês."
        onEditar={onEditar}
      />

      <CardFluxo
        titulo="De onde o dinheiro vem"
        realizado={entrou}
        previsto={aEntrar}
        itens={fontes.vem}
        cor={VERDE}
        sinal="+"
        rotuloRealizado="já entrou"
        rotuloPrevisto="ainda entra"
        rotuloLista="Ainda vai entrar"
        vazio="Nenhuma entrada prevista para este mês."
        onEditar={onEditar}
      />
    </div>
  );
}

/** Pílulas de período — as mesmas em toda seção que tem gráfico histórico. */
function FiltroPeriodo({ periodo, onPeriodo }: any) {
  return (
    <div className="flex gap-1 p-1 rounded-2xl bg-muted/50 flex-shrink-0">
      {PERIODOS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPeriodo(p.id)}
          aria-pressed={periodo === p.id}
          className={`px-2.5 h-9 rounded-xl text-[12px] font-bold transition-colors ${
            periodo === p.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
          }`}
          style={{ minHeight: 36 }}
        >
          {p.id === 12 ? '1 ano' : `${p.id}m`}
        </button>
      ))}
    </div>
  );
}

/**
 * Card "para onde vai" / "de onde vem": total, a divisão realizado × previsto
 * e — ao abrir — de que linhas ele é feito.
 *
 * ⚠️ FECHADO POR PADRÃO. São dois cards com listas que podem ter dez linhas
 * cada; abertos de saída, empurram o gráfico pra fora da tela no celular e a
 * pessoa perde a visão geral que veio buscar.
 */
function CardFluxo({
  titulo, realizado, previsto, itens, cor, sinal,
  rotuloRealizado, rotuloPrevisto, rotuloLista, vazio, onEditar,
}: any) {
  const [aberto, setAberto] = useState(false);
  const total = (Number(realizado) || 0) + (Number(previsto) || 0);

  return (
    <section className="card rounded-2xl overflow-hidden">
      <CabecalhoFluxo
        titulo={titulo}
        total={total}
        legenda={`${itens.length} ${itens.length === 1 ? 'linha ainda vem' : 'linhas ainda vêm'}`}
        aberto={aberto}
        onToggle={() => setAberto((v) => !v)}
        realizado={realizado}
        previsto={previsto}
        cor={cor}
        rotuloRealizado={rotuloRealizado}
        rotuloPrevisto={rotuloPrevisto}
      />

      {aberto && (
        <div className="border-t border-border/50 motion-safe:animate-[fade-in_200ms_ease-out]">
          {itens.length === 0 ? (
            <p className="px-5 py-5 text-xs text-muted-foreground text-center">{vazio}</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 px-5 pt-3.5 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {rotuloLista}
                </p>
                <p className="text-[10px] font-bold text-muted-foreground tabular-nums">
                  {itens.length} de {itens.length}
                </p>
              </div>
              <ul className="divide-y divide-border/50">
                {itens.map((it: any, idx: number) => {
                  // ⚠️ Só recorrência abre o formulário. Parcela de dívida e
                  // fatura de cartão têm campos que este form não tem (nº de
                  // parcelas, credor, juros) — abrir o de conta fixa pra elas
                  // ofereceria salvar um objeto que não é o delas.
                  const editavel = !!it.rec && !!onEditar;
                  const Tag: any = editavel ? 'button' : 'div';
                  return (
                    <li key={it.id} className="motion-safe:animate-[fade-in_260ms_ease-out_both]"
                        style={{ animationDelay: `${Math.min(idx * 35, 210)}ms` }}>
                      <Tag
                        {...(editavel ? {
                          type: 'button',
                          onClick: () => onEditar(it.rec),
                          'aria-label': `Editar ${it.titulo}`,
                        } : {})}
                        className={`w-full flex items-center gap-3 px-5 py-3 text-left ${
                          editavel ? 'transition-colors hover:bg-muted/30 cursor-pointer' : ''
                        }`}
                        style={{ minHeight: 56 }}
                      >
                        <CategoriaIcon nome={it.titulo} icone={it.icone || '🔁'} size={34} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-foreground truncate">
                            {it.titulo}
                          </span>
                          <span className="block text-[11px] text-muted-foreground truncate">
                            {it.legenda}
                          </span>
                        </span>
                        <span className="text-sm font-bold tabular whitespace-nowrap" style={{ color: cor }}>
                          {sinal}{fmt(it.valor)}
                        </span>
                        {editavel && (
                          <Pencil size={13} className="flex-shrink-0 text-muted-foreground/45" aria-hidden />
                        )}
                      </Tag>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
/* ── Projeção ───────────────────────────────────────────────────────────── */

function SecaoProjecao({ projecao, barras, mesSel, onSelecionar, detalhe, saldoHoje, ymHoje }: any) {
  const eventos = projecao.flatMap((m: MesProjetado) =>
    m.eventos.map((e) => ({ ...e, ym: m.ym })));

  const alvo: MesProjetado | undefined = detalhe || projecao[projecao.length - 1];
  const [anoAlvo, mesAlvo] = String(alvo?.ym || ymHoje).split('-').map(Number);

  return (
    <div className="space-y-5 animate-[fade-in_300ms_ease-out]">
      <section className="card rounded-3xl p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
          <TrendingUp size={12} className="flex-shrink-0" /> Patrimônio hoje
        </p>
        <p className="text-[28px] sm:text-3xl font-bold tabular tracking-tight leading-none text-foreground mt-1">
          {fmt(saldoHoje)}
        </p>
        {alvo && (
          <p className="text-[12.5px] text-muted-foreground mt-1.5">
            projetado para {MESES[mesAlvo - 1].toLowerCase()} &apos;{String(anoAlvo).slice(2)}:{' '}
            <strong className="font-bold tabular" style={{ color: ROXO }}>{fmt(alvo.saldoAcumulado)}</strong>
          </p>
        )}

        <div className="mt-4">
          <GraficoMeses
            barras={barras}
            cor={ROXO}
            selecionado={mesSel}
            onSelecionar={onSelecionar}
            titulo={`Patrimônio · ${barras.length} ${barras.length === 1 ? 'mês' : 'meses'}`}
            rotuloRealizado="realizado"
            rotuloPrevisto="previsto"
            // A tracejada vertical separa o que aconteceu do que é conta: sem
            // ela, a barra de hoje e a de dezembro leem com a mesma confiança.
            divisorApos={ymHoje}
            destaque={ymHoje}
            linhaReferencia={saldoHoje}
            rotuloAcessivel={`Patrimônio ao longo de ${barras.length} meses`}
          />

          {/* ⚠️ A amostra da linha é INLINE, não um item de flex: em flex com
              `flex-wrap` ela ganhava a primeira linha só pra si e ficava
              parecendo um tracinho solto no meio do card. */}
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            <span
              className="inline-block w-5 align-middle mr-1.5"
              style={{ borderTop: `1.5px dashed color-mix(in srgb, ${ROXO} 70%, transparent)` }}
              aria-hidden
            />
            a tracejada marca o patrimônio de hoje — o que passa dela é o que a
            projeção acrescenta.
          </p>
        </div>
      </section>

      {/* ── Visão do mês ────────────────────────────────────────────────────
          O extrato do mês escolhido: com que saldo ele começa, o que entra, o
          que sai (aberto por origem) e com quanto termina. */}
      {alvo && <VisaoDoMes mes={alvo} ymHoje={ymHoje} />}

      {/* ⚠️ A LINHA DO TEMPO É O MIOLO DA ABA. Um gráfico de barras quase iguais
          não informa nada; o que muda decisão é "em dezembro a parcela do sofá
          acaba e sobram R$ 200 por mês". */}
      {eventos.length > 0 ? (
        <section className="card rounded-2xl overflow-hidden">
          <p className="px-5 pt-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            O que muda pela frente
          </p>
          <ul className="divide-y divide-border/50">
            {eventos.map((e: any, i: number) => (
              <li key={`${e.ym}-${i}`} className="px-5 py-3.5 flex items-center gap-3">
                <span className="w-12 flex-shrink-0 text-center">
                  <span className="block text-[10px] uppercase tracking-wider text-muted-foreground leading-none">
                    {MESES[Number(e.ym.split('-')[1]) - 1].slice(0, 3)}
                  </span>
                  <span className="block text-[11px] font-bold text-foreground tabular">
                    {e.ym.split('-')[0].slice(2)}
                  </span>
                </span>
                <span className="min-w-0 flex-1 text-sm text-foreground">{e.texto}</span>
                <span className={`text-sm font-bold tabular whitespace-nowrap ${
                  e.efeito >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'
                }`}>
                  {e.efeito >= 0 ? '+' : '−'}{fmt(Math.abs(e.efeito))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="card rounded-2xl p-6 text-center">
          <p className="text-sm font-semibold text-foreground">Nada muda nos próximos meses</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Nenhuma parcela termina e nenhuma fatura vence no período. Cadastre
            suas dívidas para a projeção saber quando elas acabam.
          </p>
        </section>
      )}
    </div>
  );
}

/**
 * O mês projetado, linha a linha.
 *
 * ⚠️ A LINHA DE DESPESAS ABRE E O DETALHE TEM DE FECHAR COM ELA. Por isso o
 * `detalhe` de `projetarMeses` é a soma AGENDADA por origem: contas fixas +
 * parcelas + faturas. No mês CORRENTE os totais acima são o que já aconteceu
 * (o realizado substitui a previsão), e aí os dois não fecham — então ali o
 * detalhe não abre e a tela diz por quê, em vez de mostrar uma conta que não
 * bate.
 */
function VisaoDoMes({ mes, ymHoje }: { mes: MesProjetado; ymHoje: string }) {
  const [abertoDespesas, setAberto] = useState(false);
  const [ano, m] = mes.ym.split('-').map(Number);
  const emCurso = mes.ym === ymHoje;

  const receitas = mes.receitaFirme + mes.receitaEstimada;
  const despesas = mes.despesaFirme + mes.despesaEstimada;
  // Quanto das receitas as despesas comem. `null` quando não há receita — 0%
  // e "sem receita" são coisas diferentes, e mostrar 0% mentiria.
  const pct = receitas > 0 ? Math.round((despesas / receitas) * 100) : null;

  const linhas = [
    { id: 'fixas',   rotulo: 'Contas fixas',      valor: mes.detalhe.contasFixas, Icone: CalendarDays },
    { id: 'parc',    rotulo: 'Parcelas de dívida', valor: mes.detalhe.parcelas,    Icone: Landmark },
    { id: 'fatura',  rotulo: 'Faturas de cartão',  valor: mes.detalhe.faturas,     Icone: CreditCard },
  ].filter((l) => l.valor > 0);

  const podeAbrir = !emCurso && linhas.length > 0;

  return (
    <section className="card rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <p className="text-base font-bold text-foreground">
          {MESES[m - 1]} de {ano}
        </p>
        <span
          className="text-[11px] font-bold px-2.5 h-7 inline-flex items-center rounded-full"
          style={{
            background: `color-mix(in srgb, ${emCurso ? VERDE : ROXO} 12%, transparent)`,
            color: emCurso ? VERDE : ROXO,
          }}
        >
          {emCurso ? 'em curso' : 'previsto'}
        </span>
      </div>

      <div className="divide-y divide-border/50 border-t border-border/50">
        <Linha
          Icone={ClipboardList}
          rotulo="Saldo inicial"
          valor={fmt(mes.saldoInicial)}
          corValor="text-foreground"
        />
        <Linha
          Icone={ArrowDownToLine}
          rotulo="Receitas"
          extra={receitas > 0 ? '100%' : undefined}
          valor={`+${fmt(receitas)}`}
          corValor="text-green-600 dark:text-green-400"
          corIcone={VERDE}
        />
        <div>
          <Linha
            Icone={ArrowUpFromLine}
            rotulo="Despesas"
            extra={pct !== null ? `${pct}% das receitas` : undefined}
            valor={`−${fmt(despesas)}`}
            corValor="text-red-500"
            corIcone={VERMELHO}
            aberto={podeAbrir ? abertoDespesas : undefined}
            onToggle={podeAbrir ? () => setAberto((v) => !v) : undefined}
          />
          {podeAbrir && abertoDespesas && (
            <ul className="bg-muted/25 motion-safe:animate-[fade-in_200ms_ease-out]">
              {linhas.map(({ id, rotulo, valor, Icone }) => (
                <li key={id} className="flex items-center gap-3 pl-14 pr-5 py-2.5">
                  <Icone size={14} className="flex-shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 text-[13px] text-foreground truncate">{rotulo}</span>
                  <span className="text-[13px] font-bold tabular text-red-500 whitespace-nowrap">
                    −{fmt(valor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-border/50">
        <p className="text-sm font-bold text-foreground">
          {emCurso ? 'Fecha o mês em' : 'Saldo projetado'}
        </p>
        <p className={`text-lg font-bold tabular ${mes.saldoAcumulado >= 0 ? 'text-foreground' : 'text-red-500'}`}>
          {fmt(mes.saldoAcumulado)}
        </p>
      </div>

      {mes.aproximado && (
        <p className="px-5 pb-4 -mt-2 text-[11px] text-muted-foreground">
          Contém conta de valor variável — o número é aproximado.
        </p>
      )}
    </section>
  );
}

/** Uma linha da Visão do mês. Vira botão só quando há o que abrir. */
function Linha({
  Icone, rotulo, extra, valor, corValor, corIcone, aberto, onToggle,
}: any) {
  const Tag: any = onToggle ? 'button' : 'div';
  return (
    <Tag
      {...(onToggle ? { type: 'button', onClick: onToggle, 'aria-expanded': aberto } : {})}
      className={`w-full flex items-center gap-3 px-5 py-3.5 text-left ${
        onToggle ? 'transition-colors hover:bg-muted/30 cursor-pointer' : ''
      }`}
      style={{ minHeight: 56 }}
    >
      {/* ⚠️ O chevron ocupa lugar fixo mesmo quando não há o que abrir: sem
          isso, as linhas com e sem detalhe desalinham e a coluna de valores
          ganha um degrau. */}
      <span className="w-4 flex-shrink-0">
        {onToggle && (
          <ChevronDown
            size={16}
            className={`text-muted-foreground transition-transform duration-200 ${aberto ? 'rotate-180' : '-rotate-90'}`}
            aria-hidden
          />
        )}
      </span>
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `color-mix(in srgb, ${corIcone || 'hsl(var(--muted-foreground))'} 12%, transparent)` }}
      >
        <Icone size={16} style={{ color: corIcone || 'hsl(var(--muted-foreground))' }} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground truncate">{rotulo}</span>
        {extra && <span className="block text-[11px] text-muted-foreground">{extra}</span>}
      </span>
      <span className={`text-sm font-bold tabular whitespace-nowrap ${corValor}`}>{valor}</span>
    </Tag>
  );
}
