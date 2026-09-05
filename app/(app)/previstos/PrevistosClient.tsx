'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet,
  LineChart, AlertTriangle, Check, Clock, ArrowRight, Sparkles,
  Plus, Pencil, Trash2, Loader2, BellOff,
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
import GraficoMeses, { type BarraMes } from '@/components/previstos/GraficoMeses';
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
    return todos.filter((m) => m.ym <= ymRef).slice(-periodo);
  }, [anoData, anoAntData, anoRef, ymRef, periodo]);

  const barrasReceitas: BarraMes[] = barrasHistoricas.map((m) => ({ ym: m.ym, firme: m.receitas, realizado: true }));
  const barrasDespesas: BarraMes[] = barrasHistoricas.map((m) => ({ ym: m.ym, firme: m.gastos, realizado: true }));
  const barrasCaixa: BarraMes[] = barrasHistoricas.map((m) => ({ ym: m.ym, firme: Math.max(0, m.receitas - m.gastos), realizado: true }));
  const barrasProjecao: BarraMes[] = projecao.map((m, i) => ({
    ym: m.ym,
    firme: Math.max(0, m.despesaFirme),
    estimado: m.despesaEstimada,
    realizado: i === 0,
  }));

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
          barras={barrasProjecao}
          mesSel={mesSel}
          onSelecionar={setMesSel}
          detalhe={mesDetalhe}
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
          onEditar={setFormTarget}
          onNovo={() => setFormTarget('novo')}
          onExcluir={excluir}
          confirmando={confirmando}
          onConfirmar={setConfirmando}
          removendo={removendo}
        />
      )}

      {/* Ponte pro CRUD, que segue morando na aba Transações (fase 1 é leitura). */}
      <Link
        href="/transacoes"
        className="flex items-center justify-between gap-3 card rounded-2xl p-4 hover:border-primary/40 transition-colors"
      >
        <span className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 13%, transparent)' }}>
            <Sparkles size={16} style={{ color: 'hsl(var(--primary))' }} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">Criar ou editar uma conta fixa</span>
            <span className="block text-xs text-muted-foreground">Na aba Transações, em Previstos</span>
          </span>
        </span>
        <ArrowRight size={16} className="text-muted-foreground flex-shrink-0" />
      </Link>
    </div>
  );
}

/* ── Seções históricas (Receitas · Despesas · Caixa) ─────────────────────── */

function SecaoHistorica({
  aba, barras, periodo, onPeriodo, mesSel, onSelecionar, historico, itens, dividas, faturas,
  onEditar, onNovo, onExcluir, confirmando, onConfirmar, removendo,
}: any) {
  const cor = aba === 'receitas' ? VERDE : aba === 'despesas' ? VERMELHO : 'hsl(var(--primary))';
  const doMes = historico.find((m: any) => m.ym === mesSel);
  const total = barras.reduce((s: number, b: BarraMes) => s + b.firme, 0);
  const media = barras.length ? total / barras.length : 0;

  const jaVeio = (i: any) => vezesQueAindaVem(itemPrevistoDe(i)) === 0;
  const passados = itens.filter(jaVeio);
  const futuros  = itens.filter((i: any) => !jaVeio(i));

  return (
    <div className="space-y-5 animate-[fade-in_300ms_ease-out]">
      <section className="card rounded-3xl p-5">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {doMes ? 'No mês escolhido' : `Média de ${barras.length} ${barras.length === 1 ? 'mês' : 'meses'}`}
            </p>
            <p className="text-2xl font-bold tabular mt-0.5" style={{ color: cor }}>
              {fmt(doMes
                ? (aba === 'receitas' ? doMes.receitas : aba === 'despesas' ? doMes.gastos : doMes.receitas - doMes.gastos)
                : media)}
            </p>
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

        <div className="mt-4">
          <GraficoMeses
            barras={barras}
            cor={cor}
            selecionado={mesSel}
            onSelecionar={onSelecionar}
            rotuloAcessivel={`${aba} nos últimos ${barras.length} meses`}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 text-center">
          Toque numa barra para ver o mês
        </p>
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
              titulo={aba === 'receitas' ? 'Ainda vai entrar' : 'Ainda vai sair'}
              icone={<Clock size={13} />}
              itens={futuros}
              cor={cor}
              {...{ onEditar, onExcluir, confirmando, onConfirmar, removendo }}
            />
          )}
          {passados.length > 0 && (
            <Grupo
              titulo={aba === 'receitas' ? 'Já entrou' : 'Já saiu'}
              icone={<Check size={13} />}
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

function Grupo({
  titulo, icone, itens, cor, esmaecido,
  onEditar, onExcluir, confirmando, onConfirmar, removendo,
}: any) {
  return (
    <section className={`card rounded-2xl overflow-hidden ${esmaecido ? 'opacity-70' : ''}`}>
      <div className="px-5 pt-4 pb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
          {icone} {titulo}
        </p>
        <span className="text-[11px] font-bold tabular" style={{ color: cor }}>
          {fmt(itens.reduce((s: number, i: any) => s + (Number(i.valor) || 0), 0))}
        </span>
      </div>
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
                {/* ⚠️ A LINHA INTEIRA abre a edição. Um lápis de 16px como único
                    alvo obrigaria mira fina no celular — a regra é não exigir
                    toque preciso. O ícone fica como PISTA de que dá pra editar. */}
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
                          aviso" é informação, e quem não distingue tom precisa
                          dela também. */}
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
    </section>
  );
}

/* ── Projeção ───────────────────────────────────────────────────────────── */

function SecaoProjecao({ projecao, barras, mesSel, onSelecionar, detalhe }: any) {
  const eventos = projecao.flatMap((m: MesProjetado) =>
    m.eventos.map((e) => ({ ...e, ym: m.ym })));

  return (
    <div className="space-y-5 animate-[fade-in_300ms_ease-out]">
      <section className="card rounded-3xl p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Próximos {MESES_A_FRENTE} meses
        </p>
        <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
          O que já está comprometido — contas fixas, parcelas e faturas. A parte
          listrada é estimativa de conta que muda de valor.
        </p>

        <div className="mt-4">
          <GraficoMeses
            barras={barras}
            cor={VERMELHO}
            selecionado={mesSel}
            onSelecionar={onSelecionar}
            rotuloAcessivel={`Despesas projetadas para os próximos ${MESES_A_FRENTE} meses`}
          />
        </div>

        {detalhe && (
          <div className="mt-4 rounded-2xl p-4 bg-muted/30 animate-[fade-in_250ms_ease-out]">
            <p className="text-sm font-bold text-foreground">
              {MESES[Number(detalhe.ym.split('-')[1]) - 1]} {detalhe.ym.split('-')[0]}
            </p>
            <div className="grid grid-cols-2 gap-3 mt-2.5 text-[12.5px]">
              <span>
                <span className="block text-muted-foreground">Entra</span>
                <span className="block font-bold tabular text-green-600 dark:text-green-400">
                  {fmt(detalhe.receitaFirme + detalhe.receitaEstimada)}
                </span>
              </span>
              <span>
                <span className="block text-muted-foreground">Sai</span>
                <span className="block font-bold tabular text-red-500">
                  {fmt(detalhe.despesaFirme + detalhe.despesaEstimada)}
                </span>
              </span>
            </div>
            <p className="mt-2.5 pt-2.5 border-t border-border/50 text-[12.5px]">
              <span className="text-muted-foreground">Sobra no mês: </span>
              <span className={`font-bold tabular ${detalhe.resultado >= 0 ? 'text-foreground' : 'text-red-500'}`}>
                {fmt(detalhe.resultado)}
              </span>
              {detalhe.aproximado && (
                <span className="text-muted-foreground"> · aproximado</span>
              )}
            </p>
          </div>
        )}
      </section>

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
