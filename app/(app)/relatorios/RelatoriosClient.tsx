'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import BaleiaHumor, { humorPorFinancas } from '@/components/relatorios/BaleiaHumor';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { getCategoriaTheme, nomeCategoria, citrico } from '@/lib/categorias';
import AvatarMembro from '@/components/ui/AvatarMembro';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import ValorAuto from '@/components/ui/ValorAuto';
import { temMarcaConhecida } from '@/components/ui/IconeMarca';
// Conta em moeda estrangeira (migration 144): `saldo_brl` vem pronto do
// backend. O fallback pra `saldo` mantem tudo certo antes da migration e em
// payload antigo no cache do SWR, onde `saldo` ja e BRL.
import { saldoBRL } from '@/lib/moeda';
import { fmtDataBR, diaDoMes } from '@/lib/data-br';
import { aindaVemNoMes, diaHojeSP, calcularSaldoProjetado } from '@/lib/saldo-projetado';
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet,
  Filter, BarChart3, PieChart as PieIcon, LineChart as LineIcon,
  ArrowUpRight, ArrowDownRight, Calendar, RefreshCw,
  CheckCircle2, ClipboardList, Activity, Layers, Users, CalendarClock,
  Target, AlertTriangle, Check as CheckIcon, Gauge,
  CalendarRange, Sparkles, Plus, Trash2, PiggyBank, Lock, Wand2, Pencil, CircleDashed,
} from 'lucide-react';
// recharts sob demanda: os gráficos (e o CategoryDonut, que também usa recharts)
// saem do bundle inicial. Skeleton com altura própria pra não gerar CLS.
const skel = (h: number) => () => <div className="w-full rounded-xl bg-muted/40 animate-pulse" style={{ height: h }} role="status" aria-label="Carregando gráfico" />;
const CategoryDonut       = dynamic(() => import('@/components/relatorios/CategoryDonut'), { ssr: false, loading: skel(200) });
const GraficoFrequencia   = dynamic(() => import('./Graficos').then(m => m.GraficoFrequencia),  { ssr: false, loading: skel(260) });
const GraficoFluxo        = dynamic(() => import('./Graficos').then(m => m.GraficoFluxo),        { ssr: false, loading: skel(340) });
const GraficoComparativo  = dynamic(() => import('./Graficos').then(m => m.GraficoComparativo),  { ssr: false, loading: skel(260) });
const DonutVazio          = dynamic(() => import('./Graficos').then(m => m.DonutVazio),          { ssr: false, loading: skel(180) });
const GraficoPlanejamento = dynamic(() => import('./Graficos').then(m => m.GraficoPlanejamento),  { ssr: false, loading: skel(330) });

const BRAND       = 'hsl(var(--primary))';
const RED         = '#ef4444';
const BLUE        = '#3b82f6';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtCompact = (v: number) => {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$${(v / 1_000).toFixed(0)}k`;
  return `R$${v.toFixed(0)}`;
};

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_CURTO = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

type Tab    = 'graficos' | 'pendentes' | 'fluxo' | 'planejamento';

/** Hoje em fuso LOCAL. `toISOString()` é UTC e depois das 21h no Brasil já
 *  devolve o dia seguinte — uma conta que vence hoje apareceria como atrasada. */
const hojeISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** Situação de um lançamento pendente. Atraso NUNCA é só a cor: vem escrito. */
function situacaoPendente(iso: string) {
  const dia = String(iso || '').slice(0, 10);
  const hoje = hojeISO();
  if (!dia) return null;
  const d = Math.round(
    (new Date(dia + 'T12:00:00').getTime() - new Date(hoje + 'T12:00:00').getTime()) / 86400000,
  );
  if (d < -1) return { txt: `atrasado há ${Math.abs(d)} dias`, cor: '#ef4444', alerta: true };
  if (d === -1) return { txt: 'atrasado 1 dia',                cor: '#ef4444', alerta: true };
  if (d === 0)  return { txt: 'vence hoje',                    cor: '#f97316', alerta: true };
  if (d === 1)  return { txt: 'vence amanhã',                  cor: '#eab308', alerta: false };
  if (d <= 7)   return { txt: `em ${d} dias`,                  cor: '#eab308', alerta: false };
  return { txt: `em ${d} dias`, cor: 'hsl(var(--muted-foreground))', alerta: false };
}

/** Conta que só acontece em alguns meses do ano (IPVA, IPTU, Natal). */
type ContaSazonal = { id: string; nome: string; valor: number; mes: number };

/** Ajuste manual por mês. Só guarda o que foi mexido — o resto segue automático. */
type Ajustes = Record<number, { receita?: number; despesa?: number }>;

// Atalhos do lançamento sazonal — os que quase todo mundo tem, no mês certo.
const SAZONAIS_SUGERIDAS = [
  { nome: 'IPVA', mes: 0 }, { nome: 'IPTU', mes: 1 }, { nome: 'Material escolar', mes: 1 },
  { nome: 'Seguro do carro', mes: 5 }, { nome: 'Férias', mes: 11 }, { nome: 'Natal', mes: 11 },
];

// ─────────────────────────────────────────────────────────────
// TOOLTIP PERSONALIZADO
// ─────────────────────────────────────────────────────────────
// CustomTooltip foi pra app/relatorios/Graficos.tsx (junto dos gráficos) — se
// ficasse aqui, o type de <Tooltip content> puxaria recharts de volta pra página.

// ─────────────────────────────────────────────────────────────
// PÁGINA
// ─────────────────────────────────────────────────────────────
export default function RelatoriosClient({ phoneInicial, initialData }: { phoneInicial?: string; initialData?: any } = {}) {
  const { phone: authPhone, perfil } = useAuth();
  const phone = authPhone || phoneInicial || ''; // SSR: phone do servidor até hidratar
  const hoje = new Date();

  const [tab,      setTab]      = useState<Tab>('graficos');
  const [ano,      setAno]      = useState(hoje.getFullYear());
  const [mes,      setMes]      = useState(hoje.getMonth());

  // Gestão compartilhada: filtro por membro do grupo ('todos' | user_id).
  const [membroFiltro, setMembroFiltro] = useState('todos');
  const compartilhado = !/pessoal/i.test(((perfil?.grupo_ativo as any)?.nome) || '');
  const grupoId = (perfil?.grupo_ativo as any)?.id as string | undefined;
  const criadoPorParam = membroFiltro !== 'todos' ? membroFiltro : undefined;

  const mesRef = `${ano}-${String(mes + 1).padStart(2, '0')}`;
  const mesAntRef = (() => {
    const d = new Date(ano, mes - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  // Dados via SWR — revisita/troca de mês instantânea (cache em memória).
  const { data: rData, isValidating: refreshing, mutate: mR } =
    useApi(phone ? `rel:resumo:${phone}:${mesRef}:${membroFiltro}` : null, () => api.transacoes.resumo(phone, mesRef, { criado_por: criadoPorParam }), { fallbackData: initialData?.resumo });
  const { data: rAntData, mutate: mRAnt } =
    useApi(phone ? `rel:resumoAnt:${phone}:${mesAntRef}` : null, () => api.transacoes.resumo(phone, mesAntRef), { fallbackData: initialData?.resumoAnt });
  const { data: tData, mutate: mT } =
    useApi(phone ? `rel:txs:${phone}:${mesRef}:${membroFiltro}` : null, () => api.transacoes.listar(phone, { mes: mesRef, limit: 500, criado_por: criadoPorParam }), { fallbackData: initialData?.txs });
  const { data: wData, mutate: mW } =
    useApi(phone ? `rel:wallets:${phone}` : null, () => api.wallets.listar(phone), { fallbackData: initialData?.wallets });
  const { data: cData, mutate: mC } =
    useApi(phone ? `rel:cats:${phone}` : null, () => api.categorias.listar(phone), { fallbackData: initialData?.cats });
  // Membros do grupo (só em gestão compartilhada) — pro seletor de membro.
  const { data: membrosData } =
    useApi(compartilhado && grupoId ? `rel:membros:${grupoId}` : null, () => api.grupos.membros(grupoId!));
  const membros: any[] = Array.isArray(membrosData) ? membrosData : [];

  // ── O QUE FALTAVA NA ABA DE PENDENTES ──────────────────────────────────
  //
  // RELATO: "não mostra nenhuma receita a receber e nenhum gasto a pagar,
  // sendo que tenho várias contas a pagar em previstos e conta a receber
  // amanhã". A aba não estava quebrada — ela respondia OUTRA pergunta.
  //
  // "Pendente" aqui sempre significou `transacoes` com `pago = false`. Só que
  // conta fixa em modo "não lançar" NÃO CRIA TRANSAÇÃO NENHUMA (é o desenho:
  // ver jobs/index.js — o modo existe pra quem tem Open Finance e recebe a
  // cobrança real pelo banco). Medido na conta do relato: 8 recorrências
  // ativas, TODAS em `nao_lancar` — daí a tela vazia com o card "Previstos do
  // mês" cheio, na aba ao lado.
  //
  // Duas telas do mesmo app respondendo diferente à mesma pergunta lê como
  // bug mesmo quando cada uma está certa isolada. Agora esta aba soma as duas
  // fontes, com a MESMA regra do card (`aindaVemNoMes`, lib/saldo-projetado).
  //
  // ⚠️ Só busca na aba de pendentes (key null nas outras): as demais abas não
  // usam nada disso, e a chamada extra sairia de graça no caminho do LCP.
  const ehPendentes = tab === 'pendentes';
  const { data: recData } = useApi(
    phone && ehPendentes ? `rel:rec:${phone}` : null, () => api.recorrencias.listar(phone));
  const { data: divData } = useApi(
    phone && ehPendentes ? `rel:div:${phone}` : null, () => api.dividas.listar(phone));
  const { data: fatData } = useApi(
    phone && ehPendentes ? `rel:fat:${phone}` : null, () => api.wallets.faturas(phone, 0));

  // Os 12 meses REAIS do ano — alimentam o gráfico de fluxo E a média/projeção.
  // Não busca na aba de pendentes, que não usa nada disso. Como a key do SWR é
  // a mesma nas duas abas, trocar entre elas não refaz a chamada.
  const { data: anualData } = useApi(
    phone && tab !== 'pendentes' ? `rel:anual:${phone}:${ano}:${membroFiltro}` : null,
    () => api.transacoes.anual(phone, ano, { criado_por: criadoPorParam }),
  );

  // Limites por categoria do mês (mesma fonte da aba Categorias).
  const { data: limitesData } = useApi(
    phone ? `rel:limites:${phone}:${mesRef}` : null,
    () => api.limites.listar(phone, mesRef),
  );

  /* ── Contas sazonais do planejamento ───────────────────────────────────
     O único pedaço do plano que a pessoa digita: IPVA, IPTU, Natal. O
     histórico não tem como saber que janeiro tem IPVA se o app só existe
     desde maio.

     ⚠️ MESMA CHAVE da página /planejamento, e o resto do objeto é preservado
     ao salvar — as duas telas coexistem e quem já lançou o IPVA por lá não
     perde nada aqui. Ainda é localStorage (por aparelho); levar pro banco
     precisa de migration e fica pra uma próxima. */
  const [sazonais, setSazonais] = useState<ContaSazonal[]>([]);
  // Ajustes manuais por mês: { 9: { receita: 8000 } }. Guardar SÓ o que foi
  // mexido (e não os 12 meses) é o que permite o valor automático continuar
  // valendo — e continuar mudando — em tudo que a pessoa não tocou.
  const [ajustes, setAjustes] = useState<Ajustes>({});
  const chavePlano = `sora_planejamento_${(perfil as any)?.id || 'anon'}_${ano}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(chavePlano);
      const obj = raw ? JSON.parse(raw) : {};
      setSazonais(obj.contas ?? []);

      // ⚠️ IMPORTA O QUE FOI DIGITADO NA PÁGINA /planejamento ANTIGA.
      // Ela guardava `meses: [{receita, despesa}, …]` na MESMA chave. Como
      // aquela tela saiu do menu, quem tinha preenchido os 12 meses à mão
      // perderia o trabalho sem isto — os valores viram ajustes manuais aqui,
      // que é exatamente o que eles são.
      // Só roda quando ainda não há ajuste nenhum: depois disso o que vale é o
      // desta tela, e reimportar apagaria edição nova por cima.
      const jaTem = obj.ajustes && Object.keys(obj.ajustes).length > 0;
      if (!jaTem && Array.isArray(obj.meses)) {
        const importados: Ajustes = {};
        obj.meses.forEach((m: any, i: number) => {
          const doMes: { receita?: number; despesa?: number } = {};
          if (m?.receita > 0) doMes.receita = m.receita;
          if (m?.despesa > 0) doMes.despesa = m.despesa;
          if (Object.keys(doMes).length) importados[i] = doMes;
        });
        if (Object.keys(importados).length) {
          setAjustes(importados);
          const atual = raw ? JSON.parse(raw) : {};
          localStorage.setItem(chavePlano, JSON.stringify({ ...atual, ajustes: importados }));
          return;
        }
      }
      setAjustes(obj.ajustes ?? {});
    } catch { setSazonais([]); setAjustes({}); }
  }, [chavePlano]);

  /** Grava preservando o resto do objeto — a página /planejamento antiga usa a
   *  MESMA chave e guarda `meses` ali. */
  const gravarPlano = useCallback((patch: { contas?: ContaSazonal[]; ajustes?: Ajustes }) => {
    try {
      const raw = localStorage.getItem(chavePlano);
      const atual = raw ? JSON.parse(raw) : {};
      localStorage.setItem(chavePlano, JSON.stringify({ ...atual, ...patch }));
    } catch { /* modo privado / quota */ }
  }, [chavePlano]);

  const salvarSazonais = useCallback((novas: ContaSazonal[]) => {
    setSazonais(novas);
    gravarPlano({ contas: novas });
  }, [gravarPlano]);

  /** `valor === null` remove o ajuste e o mês volta ao automático. */
  const ajustarMes = useCallback((mesIx: number, campo: 'receita' | 'despesa', valor: number | null) => {
    setAjustes(prev => {
      const doMes = { ...(prev[mesIx] || {}) };
      if (valor === null) delete doMes[campo];
      else doMes[campo] = valor;
      const novo = { ...prev };
      // Mês sem nenhum campo ajustado sai do objeto — assim `qtdAjustes` conta
      // o que a pessoa realmente mexeu, e não chaves vazias esquecidas.
      if (Object.keys(doMes).length === 0) delete novo[mesIx];
      else novo[mesIx] = doMes;
      gravarPlano({ ajustes: novo });
      return novo;
    });
  }, [gravarPlano]);

  /** Preenchimento rápido: aplica uma média manual em TODO mês ainda aberto. */
  const preencherAberto = useCallback((rec: number | null, des: number | null, linhas: any[]) => {
    setAjustes(prev => {
      const novo = { ...prev };
      for (const l of linhas) {
        // ⚠️ Só mês que AINDA VEM. Editar um mês passado é escolha deliberada,
        // card a card; uma média jogada por cima de tudo apagaria em massa o
        // que a pessoa preencheu à mão do histórico dela.
        if (l.estado === 'realizado') continue;
        const doMes = { ...(novo[l.i] || {}) };
        if (rec !== null) doMes.receita = rec;
        if (des !== null) doMes.despesa = des;
        if (Object.keys(doMes).length) novo[l.i] = doMes;
      }
      gravarPlano({ ajustes: novo });
      return novo;
    });
  }, [gravarPlano]);

  const limparAjustes = useCallback(() => {
    setAjustes({});
    gravarPlano({ ajustes: {} });
  }, [gravarPlano]);

  const resumo: any       = (rData as any)    ?? { receitas: 0, gastos: 0, por_categoria: [], por_membro: [] };
  const resumoAnt: any    = (rAntData as any) ?? { receitas: 0, gastos: 0, por_categoria: [] };
  const txs: any[]        = (tData as any)?.transacoes ?? [];
  const wallets: any[]    = (wData as any) ?? [];
  const categorias: any[] = (cData as any) ?? [];
  const carregar = useCallback(() => Promise.all([mR(), mRAnt(), mT(), mW(), mC()]), [mR, mRAnt, mT, mW, mC]);

  function navMes(dir: number) {
    let nm = mes + dir;
    let na = ano;
    if (nm < 0)  { nm = 11; na--; }
    if (nm > 11) { nm = 0;  na++; }
    setMes(nm); setAno(na);
  }


  // ── Métricas derivadas ─────────────────────────────────────
  const saldo       = (resumo?.receitas || 0) - (resumo?.gastos || 0);
  const saldoBanco  = wallets.filter(w => w.tipo !== 'Crédito').reduce((s, w) => s + (saldoBRL(w) ?? 0), 0);

  // Humor da baleia: com receita lançada → taxa de economia; sem receita →
  // quanto do saldo disponível do banco já foi gasto no mês (fica triste se
  // passar do saldo).
  const humorBaleia = humorPorFinancas({
    receitas:   resumo?.receitas || 0,
    gastos:     resumo?.gastos || 0,
    saldoBanco,
  });

  const varReceitas = (() => {
    const ant = resumoAnt?.receitas || 0;
    if (!ant) return 0;
    return Math.round(((resumo?.receitas - ant) / ant) * 100);
  })();
  const varGastos = (() => {
    const ant = resumoAnt?.gastos || 0;
    if (!ant) return 0;
    return Math.round(((resumo?.gastos - ant) / ant) * 100);
  })();

  // ── Pendentes ──────────────────────────────────────────────
  //
  // ⚠️ ORDENA POR DATA CRESCENTE, o contrário da lista de transações. Ali o
  // mais recente vem primeiro porque é o que acabou de acontecer; aqui o que
  // importa é o mais ANTIGO — ele é o mais atrasado, o que já devia ter sido
  // pago. Com a ordem herdada (mais novo no topo), a conta vencida há duas
  // semanas ficava no fim da lista.
  // ⚠️ GASTO EM CARTÃO NÃO É PENDENTE INDIVIDUAL, e este é o filtro que mais
  // muda a tela. A compra no crédito entra na FATURA, e quem se paga é a
  // fatura — listar cada parcela como "despesa a pagar" pede pra pessoa
  // resolver duas vezes a mesma coisa.
  //
  // Pior: `normalizeTxCartao` grava `pago: !(data > hoje)` pra parcela ainda
  // não cobrada contar como prevista. Isso é verdade NO DIA em que a linha é
  // escrita — e como o sync nunca reescreve linha existente, quando a data
  // passa o `pago=false` fica lá pra sempre. Medido na base: das 1.000
  // transações com `pago=false`, **969 são de cartão**, e 204 já venceram,
  // somando R$ 21.433,88 de falso pendente.
  //
  // A migration 141 limpa o histórico; este filtro impede que volte.
  const nomesCartao = useMemo(
    () => new Set(wallets.filter(w => w.tipo === 'Crédito')
      .map(w => String(w.nome || '').trim().toLowerCase())),
    [wallets],
  );
  const pendentes = useMemo(
    () => txs
      .filter(t => !t.pago)
      .filter(t => !nomesCartao.has(String(t.carteira_nome || t.wallet_nome || '').trim().toLowerCase()))
      // ⚠️ "[Previsto]" NÃO é filtrado aqui, e isso é decisão. O previsto de
      // conta VARIÁVEL (luz, água) é pendente de verdade — falta a pessoa
      // confirmar o valor real. Quem não deveria existir é só o previsto de
      // recorrência em modo "não lançar", e esse a migration 141 apaga na
      // origem. Filtrar por prefixo aqui esconderia os dois.
      .slice()
      .sort((a, b) => String(a.data || '').localeCompare(String(b.data || ''))),
    [txs, nomesCartao],
  );
  const recebPendentes = pendentes.filter(t => t.tipo === 'Recebimento');
  const gastoPendentes = pendentes.filter(t => t.tipo === 'Gasto');
  // Quantos já passaram da data — é o número que decide se a tela é um alerta
  // ou só uma lista.
  const atrasados = useMemo(
    () => pendentes.filter(t => String(t.data || '').slice(0, 10) < hojeISO()).length,
    [pendentes],
  );

  /** Dar baixa direto da lista. Otimista: a linha some na hora e a chamada vai
   *  em segundo plano — reverter é barato (ela volta se falhar) e esperar o
   *  servidor pra ver o item sair da lista deixa o clique com cara de travado. */
  const darBaixa = useCallback(async (tx: any) => {
    try {
      await mT(
        async () => { await api.transacoes.editar(tx.id, { pago: true }); return undefined; },
        {
          optimisticData: (cur: any) => ({
            ...(cur || {}),
            transacoes: (cur?.transacoes || []).map((x: any) => x.id === tx.id ? { ...x, pago: true } : x),
          }),
          rollbackOnError: true, populateCache: false, revalidate: false,
        },
      );
      // O resumo do mês não muda com isto (pendente já conta no total), mas o
      // saldo previsto e os cards de conta sim — revalida em silêncio.
      mR();
    } catch (e: any) { alert(e?.message || 'Não consegui dar baixa.'); }
  }, [mT, mR]);
  // ── PREVISTOS: o que ainda vence e NÃO virou transação ──────────────────
  //
  // Mesma regra do card "Previstos do mês" (`aindaVemNoMes`), de propósito:
  // era a divergência entre as duas telas que fazia esta aba parecer quebrada.
  //
  // ⚠️ O CUIDADO QUE IMPEDE CONTAR EM DOBRO é o `modo_lancamento`. Recorrência
  // em "lançar" ou "só prever" VIRA transação no dia do vencimento — e essa
  // transação já aparece na lista de pendentes logo acima. Somar as duas
  // mostraria a mesma conta duas vezes. Então:
  //   · `nao_lancar`      → nunca cria nada  → entra a partir de HOJE;
  //   · `lancar`/`prever` → cria no dia      → entra só se ainda FALTAM dias.
  // No dia do vencimento o cron já rodou e quem responde é a transação.
  const previstosFixos = useMemo(() => {
    const lista = Array.isArray(recData) ? recData : [];
    const diaHoje = diaHojeSP();
    return lista
      .filter((r: any) => (r.modo_lancamento || 'lancar') === 'nao_lancar'
        ? aindaVemNoMes({ tipo: r.tipo, valor: r.valor, dia_vencimento: r.dia_vencimento })
        : Number(r.dia_vencimento) > diaHoje)
      .map((r: any) => ({
        chave: `rec:${r.id}`,
        titulo: r.descricao || r.categoria || 'Conta fixa',
        tipo: r.tipo as string,
        valor: Number(r.valor) || 0,
        dia: Number(r.dia_vencimento) || 0,
        variavel: !!r.valor_variavel,
        origem: 'Conta fixa',
      }));
  }, [recData]);

  // Parcela de dívida e fatura de cartão também são saída prevista do mês —
  // as duas já entram no card da aba Transações, e ficar de fora aqui
  // reproduziria a mesma divergência que este bloco existe pra fechar.
  // `nos_previstos !== false` (migrations 115 e 123) respeita quem tirou o
  // item da previsão; `!== false` e não `=== true` porque antes da migration
  // a coluna não vem e o certo é MOSTRAR.
  const previstosDivida = useMemo(() => {
    const lista = (divData as any)?.dividas || [];
    return lista
      .filter((d: any) => d.status !== 'quitada' && Number(d.valor_parcela) > 0
        && d.nos_previstos !== false
        && aindaVemNoMes({ tipo: 'Gasto', valor: d.valor_parcela, dia_vencimento: d.dia_vencimento }))
      .map((d: any) => ({
        chave: `div:${d.id}`,
        titulo: d.titulo || 'Dívida',
        tipo: 'Gasto',
        valor: Number(d.valor_parcela) || 0,
        dia: Number(d.dia_vencimento) || 0,
        variavel: false,
        origem: 'Parcela de dívida',
      }));
  }, [divData]);

  const previstosFatura = useMemo(() => {
    const lista = (fatData as any)?.faturas || [];
    return lista
      .filter((f: any) => Number(f.restante) > 0.01 && f.nos_previstos !== false
        // A data INTEIRA manda: o ciclo do cartão cruza meses, e reduzido ao
        // dia um vencimento 13/10 viraria "13" e seria lido como já vencido.
        && aindaVemNoMes({ tipo: 'Gasto', valor: f.restante, dia_vencimento: 0, venc: f.venc }))
      .map((f: any) => ({
        chave: `fat:${f.cartao_id}`,
        titulo: `Fatura ${f.nome || 'do cartão'}`,
        tipo: 'Gasto',
        valor: Number(f.restante) || 0,
        dia: parseInt(String(f.venc || "").slice(8, 10), 10) || 0,
        variavel: false,
        origem: 'Fatura de cartão',
      }));
  }, [fatData]);

  const previstos = useMemo(
    () => [...previstosFixos, ...previstosDivida, ...previstosFatura]
      .sort((a, b) => a.dia - b.dia),
    [previstosFixos, previstosDivida, previstosFatura],
  );
  const prevReceber = previstos.filter((i) => i.tipo === "Recebimento");
  const prevPagar   = previstos.filter((i) => i.tipo === "Gasto");
  const somaPrev = (l: any[]) => l.reduce((s, i) => s + (i.valor || 0), 0);

  // Os cards somam AS DUAS fontes — é o total que a pergunta "quanto tenho a
  // receber?" espera. A composição fica escrita logo abaixo do número, pra
  // ninguém precisar adivinhar de onde veio.
  const lancReceber  = recebPendentes.reduce((s, t) => s + (t.valor || 0), 0);
  const lancPagar    = gastoPendentes.reduce((s, t) => s + (t.valor || 0), 0);
  const totalReceber = lancReceber + somaPrev(prevReceber);
  const totalPagar   = lancPagar + somaPrev(prevPagar);
  // ── SALDO PREVISTO: mesma definição do card "Previstos do mês" ──────────
  //
  // Era `receitas − gastos do mês + saldo em conta`, que responde "como o mês
  // se comportou", NÃO "como eu termino o mês". Duas diferenças concretas:
  // contava o que JÁ aconteceu (receita que caiu, gasto que saiu — dinheiro
  // que o saldo em conta já reflete, então entrava duas vezes) e ignorava o
  // que ainda vai vencer.
  //
  // Agora é a mesma pergunta da aba Transações: saldo de hoje + o que ainda
  // entra − o que ainda sai. E os dois termos são EXATAMENTE os números dos
  // dois cards ao lado, então dá pra conferir a conta na própria tela.
  //
  // ⚠️ A aritmética vem de `calcularSaldoProjetado` (lib/saldo-projetado.ts,
  // com eval próprio) em vez de somada à mão aqui — era ter duas contas pro
  // mesmo nome que gerou a divergência que este bloco corrige.
  //
  // ⚠️ Os itens entram com `dia_vencimento: 0`, que o helper trata como
  // "ainda vem". É de propósito: `totalReceber`/`totalPagar` JÁ aplicaram a
  // regra de data — os previstos filtrados por `aindaVemNoMes` e os
  // lançamentos pendentes INCLUINDO os atrasados, que continuam tendo de ser
  // pagos. Refiltrar aqui derrubaria justamente a conta vencida.
  const saldoPrevisto = useMemo(() => calcularSaldoProjetado(
    // ⚠️ NORMALIZADO EM BRL antes de entrar. O helper soma `saldo` cru, e esta
    // aba mostra `saldoBRL(w)` logo acima, no mesmo card: com conta em moeda
    // estrangeira os dois números discordariam a um centímetro um do outro.
    wallets.map((w: any) => ({ tipo: w.tipo, saldo: saldoBRL(w) ?? 0 })),
    [{ tipo: 'Recebimento' as const, valor: totalReceber, dia_vencimento: 0 },
     { tipo: 'Gasto' as const, valor: totalPagar, dia_vencimento: 0 }],
  ).projetado, [wallets, totalReceber, totalPagar]);

  // ── Dados para gráficos ────────────────────────────────────

  // ⚠️ O RESTO VIRA UMA FATIA "OUTRAS" — NÃO PODE SUMIR.
  //
  // BUG QUE ISTO CORRIGE: o donut mostrava só as 7 maiores e o miolo dizia
  // "TOTAL" com a soma DELAS. Medido numa conta real: card de despesas
  // R$ 3.645,84 e donut "TOTAL R$ 3.113,51" — R$ 532,33 em 10 categorias
  // sumiam sem aviso, e as porcentagens saíam infladas (Facebook Ads aparecia
  // com 44% quando era 37,6% do gasto do mês).
  //
  // 7 fatias continua sendo o limite de LEITURA (mais que isso vira confete),
  // mas o que passa disso é agrupado, não descartado. Cinza neutro de
  // propósito: "Outras" não é uma categoria, é um resto — não deve competir
  // por atenção com as reais.
  const TOPO = 7;
  const comOutras = useCallback((lista: { categoria: string; total: number }[]) => {
    const topo = lista.slice(0, TOPO);
    const resto = lista.slice(TOPO);
    const fatias = topo.map((c) => {
      const theme = getCategoriaTheme(c.categoria || '', categorias);
      return {
        name:  nomeCategoria(c.categoria || ''),
        value: c.total || 0,
        color: citrico(theme.color),
        emoji: theme.emoji,
      };
    });
    if (resto.length) {
      fatias.push({
        // ⚠️ "Demais categorias", NUNCA "Outras": existe categoria de verdade
        // chamada "Outros" na taxonomia, e as duas caíam na mesma legenda com
        // valores diferentes — relato real de cliente. Uma é dado, a outra é o
        // resto do gráfico.
        name:  `Demais categorias (${resto.length})`,
        value: resto.reduce((s, c) => s + (c.total || 0), 0),
        color: '#71717A',
        emoji: '•',
      });
    }
    return fatias;
  }, [categorias]);

  // Pizza por categoria — cor customizada do usuário > catálogo > hash
  const dadosPie = useMemo(
    () => comOutras((resumo?.por_categoria || []) as { categoria: string; total: number }[]),
    [resumo, comOutras],
  );

  // Pizza receitas — usa o agregado do SERVIDOR (mesma fonte/regra do total de
  // receitas), igual ao gráfico de despesas. Antes filtrava os `txs` no cliente,
  // que vêm capados em 500 → com Open Finance as receitas caíam fora do corte e
  // o gráfico zerava mesmo com receita lançada. Fallback pro cálculo antigo
  // enquanto o backend novo (por_categoria_receitas) não redeploya.
  const dadosPieReceitas = useMemo(() => {
    const serverCats = resumo?.por_categoria_receitas as { categoria: string; total: number }[] | undefined;
    const base = serverCats
      ? serverCats.map(c => ({ cat: c.categoria || 'Outros', val: c.total || 0 }))
      : (() => {
          const grupos: Record<string, number> = {};
          txs.filter(t => t.tipo === 'Recebimento').forEach(t => {
            const cat = t.categoria || 'Outros';
            grupos[cat] = (grupos[cat] || 0) + (t.valor || 0);
          });
          return Object.entries(grupos).map(([cat, val]) => ({ cat, val }));
        })();
    // Mesma regra do donut de despesas: o que passa das 7 vira "Outras", nunca
    // some — senão o TOTAL do miolo mente sobre a receita do mês.
    return comOutras(
      base.sort((a, b) => b.val - a.val).map(({ cat, val }) => ({ categoria: cat, total: val })),
    );
  }, [resumo, txs, comOutras]);

  // Receitas x Despesas — frequência por dia/mês
  const dadosFrequencia = useMemo(() => {
    const dim = new Date(ano, mes + 1, 0).getDate();
    const byDay: Record<number, { rec: number; gas: number }> = {};

    for (let d = 1; d <= dim; d++) byDay[d] = { rec: 0, gas: 0 };

    txs.forEach(t => {
      const dia = diaDoMes(t.data);
      if (!byDay[dia]) byDay[dia] = { rec: 0, gas: 0 };
      if (t.tipo === 'Recebimento') byDay[dia].rec += t.valor || 0;
      else byDay[dia].gas += t.valor || 0;
    });

    return Array.from({ length: dim }, (_, i) => ({
      name: `${i + 1}`,
      Receitas: byDay[i + 1]?.rec || 0,
      Despesas: byDay[i + 1]?.gas || 0,
    }));
  }, [txs, ano, mes]);

  // Fluxo de caixa — 12 meses (com base no atual)
  // ⚠️ DADO REAL, VINDO DO BANCO — não invente mês.
  //
  // Isto aqui era uma SENOIDE: `0.6 + Math.sin((i + ano) * 0.7) * 0.3` aplicada
  // ao valor do mês atual, com o comentário "simulação suave". Os 12 meses do
  // gráfico não tinham relação nenhuma com o histórico da pessoa, e os cards
  // diziam "Receitas no ano" mostrando `mês × 12 × 0,6`. Medido numa conta
  // real: exibia R$ 29.501,86 de despesa no ano onde o verdadeiro é
  // R$ 7.644,67 — quase 4× pra cima. Numa tela de dinheiro isso não é
  // enfeite de placeholder, é número errado que a pessoa usa pra decidir.
  //
  // Agora vem de `GET /api/transacoes/:phone/anual`, que roda a MESMA regra do
  // resumo mensal (fonte única no backend) — conferido: agosto do anual bate ao
  // centavo com o card do mês.
  const dadosFluxo = useMemo(() => {
    const meses = anualData?.meses;
    return Array.from({ length: 12 }, (_, i) => {
      const m = meses?.[i];
      return {
        name: MESES_CURTO[i],
        Receitas: m?.receitas || 0,
        Despesas: m?.gastos || 0,
        Saldo: m?.saldo || 0,
      };
    });
  }, [anualData]);
  const anualCarregando = tab === 'fluxo' && anualData === undefined;

  /* ══════════════════════════════════════════════════════════════════════
     PLANEJAMENTO ANUAL QUE SE PREENCHE SOZINHO
     ══════════════════════════════════════════════════════════════════════

     Cada mês do ano está num de três estados, e o estado sai do CALENDÁRIO —
     ninguém precisa "fechar" nada à mão. Quando setembro vira outubro, setembro
     deixa de ser estimativa e passa a entrar na média que estima novembro. O
     plano se corrige sozinho, que é o ponto:

       realizado  mês passado    → número REAL do banco, imutável
       em curso   mês atual      → o que já saiu + projeção até o fim do mês
       previsto   mês futuro     → estimativa

     ⚠️ A ESTIMATIVA DO MÊS FUTURO É `max(média, já lançado) + sazonais`, e cada
     pedaço tem um porquê:

     · `já lançado` é o que JÁ EXISTE no banco com data naquele mês — parcela de
       compra, recorrência materializada. O endpoint anual traz isso porque
       varre o ano inteiro, sem cortar em "hoje". Ignorá-lo faria a Sora prever
       um outubro tranquilo quando já há três parcelas marcadas ali.
     · `média` cobre o que ainda nem existe: o mercado, a gasolina, o padrão.
     · `max` e não soma: a média dos meses fechados JÁ CONTÉM as parcelas e
       recorrências daqueles meses. Somar as duas contaria o hábito duas vezes.
     · `sazonais` são somadas de verdade porque são one-offs que a média não
       viu — IPVA em janeiro não aconteceu em maio, junho nem julho. É o único
       pedaço que a pessoa digita, porque é o único que o histórico não sabe. */
  const plano = useMemo(() => {
    const meses = anualData?.meses;
    if (!meses) return null;

    const ehAnoAtual = ano === hoje.getFullYear();
    const mesHoje = hoje.getMonth();
    const ultimoFechado = ano < hoje.getFullYear() ? 11 : mesHoje - 1;

    const estadoDe = (i: number): 'realizado' | 'emCurso' | 'previsto' =>
      ano < hoje.getFullYear() ? 'realizado'
      : ano > hoje.getFullYear() ? 'previsto'
      : i < mesHoje ? 'realizado' : i === mesHoje ? 'emCurso' : 'previsto';

    // Valor EFETIVO de um mês: o ajuste manual quando existe, senão o real.
    const efetivo = (m: any, i: number) => ({
      receitas: ajustes[i]?.receita ?? m.receitas,
      gastos:   ajustes[i]?.despesa ?? m.gastos,
    });

    // Base da média = mês PASSADO com movimento — mesma regra do "Ritmo do mês".
    //
    // ⚠️ CADA SÉRIE TEM O PRÓPRIO DIVISOR. Um divisor comum ("meses com
    // qualquer movimento") deixa entrar mês que teve receita e ZERO despesa:
    // ele soma nada na despesa e mesmo assim aumenta o denominador. Medido
    // nesta conta — fevereiro, março e abril têm R$ 0,17, R$ 0,24 e R$ 0,10 de
    // rendimento e nenhuma despesa; com divisor comum a média de despesa caía
    // de R$ 1.155,78 pra R$ 577,89, exatamente metade, e o plano previa um ano
    // barato que não existe.
    //
    // ⚠️ MÊS FECHADO PREENCHIDO À MÃO ENTRA NA MÉDIA. Quem digita janeiro está
    // dizendo "foi isto que aconteceu, o app é que não estava aqui" — é
    // informação melhor que a ausência dela.
    // Já o ajuste de mês FUTURO fica de fora, e isso é proposital: ele é
    // previsão, e deixá-lo alimentar a média que prevê os outros meses
    // futuros criaria um laço — a previsão de outubro puxando a de novembro,
    // que puxa a de dezembro, sem nenhum fato no meio.
    const fechadosEf = meses.map((m, i) => ({ ...efetivo(m, i), i })).filter(x => x.i <= ultimoFechado);
    const baseRec = fechadosEf.filter(x => x.receitas > 0);
    const baseDes = fechadosEf.filter(x => x.gastos > 0);
    const mediaRec = baseRec.length ? baseRec.reduce((s, m) => s + m.receitas, 0) / baseRec.length : 0;
    const mediaDes = baseDes.length ? baseDes.reduce((s, m) => s + m.gastos, 0) / baseDes.length : 0;
    const fechados = baseDes.length >= baseRec.length ? baseDes : baseRec;

    // Projeção do mês em curso — mesma aritmética do card de ritmo.
    const diaHoje = hoje.getDate();
    const diasNoMes = new Date(ano, mesHoje + 1, 0).getDate();
    const fator = diaHoje >= 3 ? diasNoMes / diaHoje : null;

    const extras: number[] = Array(12).fill(0);
    for (const c of sazonais) extras[c.mes] = (extras[c.mes] || 0) + (c.valor || 0);

    let acumulado = 0;
    const linhas = meses.map((m, i) => {
      const estado = estadoDe(i);

      // 1) O valor AUTOMÁTICO — o que a Sora estima sozinha.
      let autoRec = m.receitas;
      let autoDes = m.gastos;
      if (estado === 'emCurso' && fator) {
        autoRec = m.receitas * fator;
        autoDes = m.gastos * fator;
      } else if (estado === 'previsto') {
        autoRec = Math.max(mediaRec, m.receitas);
        autoDes = Math.max(mediaDes, m.gastos) + extras[i];
      }

      // 2) O AJUSTE MANUAL por cima, quando existe — em QUALQUER mês.
      //
      // ⚠️ MÊS FECHADO TAMBÉM É EDITÁVEL. Eu tinha travado, com o argumento de
      // que mês passado é fato. O argumento não se sustenta: mês anterior à
      // chegada da pessoa na Sora não é "fato zero", é AUSÊNCIA DE DADO — nesta
      // conta, janeiro a abril aparecem com R$ 0,00 só porque o app ainda não
      // existia ali. Travar a edição obrigava a planejar o ano com quatro meses
      // fantasmas.
      //
      // O que continua valendo: isto vive SÓ no planejamento. Não cria, não
      // altera e não apaga transação nenhuma — dashboard, categorias, fluxo de
      // caixa e o resumo do mês seguem lendo o banco, intocados.
      const aj = ajustes[i];
      const receita = aj?.receita != null ? aj.receita : autoRec;
      const despesa = aj?.despesa != null ? aj.despesa : autoDes;

      const saldo = receita - despesa;
      acumulado += saldo;
      return {
        i, name: MESES_CURTO[i], nomeLongo: MESES[i], estado,
        Receitas: receita, Despesas: despesa,
        autoRec, autoDes,
        manualRec: aj?.receita != null,
        manualDes: aj?.despesa != null,
        // Mês passado sem nenhum lançamento — quase sempre "o app ainda não
        // estava aqui". A tela convida a preencher em vez de mostrar um zero
        // que parece dado.
        semDados: estado === 'realizado' && m.receitas === 0 && m.gastos === 0,
        saldo, acumulado,
        jaLancado: m.gastos,          // o que o banco já conhece daquele mês
        sazonais: estado === 'previsto' ? extras[i] : 0,
        // Duas séries pra linha do acumulado quebrar no "hoje". O ponto de
        // fronteira entra nas DUAS, senão fica um buraco entre elas.
        AcumuladoReal: estado === 'realizado' || estado === 'emCurso' ? acumulado : null,
        AcumuladoPrev: estado === 'previsto' || estado === 'emCurso' ? acumulado : null,
      };
    });

    const totalRec = linhas.reduce((s, l) => s + l.Receitas, 0);
    const totalDes = linhas.reduce((s, l) => s + l.Despesas, 0);
    // Mês mais apertado = menor acumulado. É a pergunta que o planejamento
    // existe pra responder: "quando o caixa aperta?".
    const pior = linhas.reduce((p, l) => (l.acumulado < p.acumulado ? l : p), linhas[0]);
    const primeiroNegativo = linhas.find(l => l.acumulado < 0) || null;

    return {
      linhas, totalRec, totalDes, saldoAno: totalRec - totalDes, pior, primeiroNegativo,
      mediaRec, mediaDes, mesesNaBase: fechados.length,
      mesesRec: baseRec.length, mesesDes: baseDes.length,
      qtdAjustes: linhas.filter(l => l.manualRec || l.manualDes).length,
      mesAtualIx: ehAnoAtual ? mesHoje : null,
      temHistorico: fechados.length > 0,
    };
    // ⚠️ `ajustes` PRECISA estar aqui. Sem ele o memo não recalcula e digitar
    // um valor não mudava nada na tela — o número voltava sozinho.
  }, [anualData, ano, hoje, sazonais, ajustes]);

  /* ══════════════════════════════════════════════════════════════════════
     CATEGORIA × LIMITE
     ══════════════════════════════════════════════════════════════════════ */
  //
  // ⚠️ O GASTO DE UMA CATEGORIA-PAI INCLUI AS FILHAS. Limite em "Encomendas"
  // tem de contar o que foi gasto em "Shein" e "Aliexpress" — foi exatamente a
  // queixa que originou isto ("tenho 215,19 numa subcategoria e o limite do pai
  // não conta"). Mesma soma que a aba Categorias faz na árvore.
  const limitesCats = useMemo(() => {
    const arr = Array.isArray(limitesData)
      ? limitesData
      : ((limitesData as any)?.categorias ?? []);
    return arr as { categoria?: string; limite_mensal?: number; ativo?: boolean }[];
  }, [limitesData]);

  const gastoPorNome = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of (resumo?.por_categoria || []) as any[]) {
      m[nomeCategoria(c.categoria || '').toLowerCase()] = c.total || 0;
    }
    return m;
  }, [resumo]);

  const usoDosLimites = useMemo(() => {
    return limitesCats
      .filter(l => (l.limite_mensal || 0) > 0 && l.ativo !== false)
      .map(l => {
        const nome = nomeCategoria(l.categoria || '');
        const chave = nome.toLowerCase();
        // Gasto próprio + o das filhas desta categoria.
        const pai = categorias.find((c: any) => nomeCategoria(c.nome).toLowerCase() === chave);
        const filhas = pai ? categorias.filter((c: any) => c.parent_id === pai.id) : [];
        const gasto = (gastoPorNome[chave] || 0)
          + filhas.reduce((s: number, f: any) => s + (gastoPorNome[nomeCategoria(f.nome).toLowerCase()] || 0), 0);
        const limite = l.limite_mensal || 0;
        return {
          nome, limite, gasto,
          filhas: filhas.length,
          pct: limite > 0 ? (gasto / limite) * 100 : 0,
          theme: getCategoriaTheme(l.categoria || '', categorias),
        };
      })
      // O que está pior primeiro: é o que exige ação.
      .sort((a, b) => b.pct - a.pct);
  }, [limitesCats, categorias, gastoPorNome]);

  /* ══════════════════════════════════════════════════════════════════════
     MÉDIA MENSAL E PROJEÇÃO DO MÊS
     ══════════════════════════════════════════════════════════════════════ */
  const mediaEProjecao = useMemo(() => {
    const meses = anualData?.meses;
    if (!meses) return null;

    const ehMesAtual = mes === hoje.getMonth() && ano === hoje.getFullYear();
    const gastoDoMes = meses[mes]?.gastos || 0;

    // ⚠️ A MÉDIA SÓ OLHA MÊS PASSADO, FECHADO E COM MOVIMENTO. Três cortes,
    // cada um por um motivo medido numa conta real:
    //
    //  · O MÊS EM CURSO fica fora: incompleto, ele puxaria a média pra baixo e
    //    a comparação "estou acima da média" mentiria a favor do usuário.
    //  · MÊS FUTURO fica fora: parcela lançada com data à frente faz setembro
    //    existir com R$ 79,86 em agosto. Entrando na conta, ele derrubava a
    //    média de R$ 1.155,78 pra R$ 886,80.
    //  · MÊS ZERADO fica fora: quem começou a usar a Sora em julho tem seis
    //    deles, e dividir por 12 dava R$ 322,47 — 3,6× menos que o real, o que
    //    faria qualquer mês normal parecer um descontrole.
    const ultimoFechado = ano < hoje.getFullYear() ? 11 : hoje.getMonth() - 1;
    const base = meses.filter((m, i) => i <= ultimoFechado && i !== mes && m.gastos > 0);
    const media = base.length ? base.reduce((s, m) => s + m.gastos, 0) / base.length : 0;

    // Projeção: só faz sentido pro mês em curso e a partir do 3º dia — no dia 1
    // um almoço viraria "projeção de R$ 3.000 no mês".
    const diaHoje = hoje.getDate();
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    const podeProjetar = ehMesAtual && diaHoje >= 3 && gastoDoMes > 0;
    const projecao = podeProjetar ? (gastoDoMes / diaHoje) * diasNoMes : null;

    return {
      media, mesesNaMedia: base.length, gastoDoMes, projecao, ehMesAtual,
      diaHoje, diasNoMes,
      // Comparação contra a média usa a PROJEÇÃO quando existe (mês incompleto
      // contra média de meses fechados seria comparar coisas diferentes).
      refComparacao: projecao ?? gastoDoMes,
      variacao: media > 0 ? (((projecao ?? gastoDoMes) - media) / media) * 100 : null,
    };
  }, [anualData, mes, ano, hoje]);

  return (
    <>
      <div className="max-w-7xl mx-auto pb-20 space-y-6">

        {/* ═══════════════════════════════════════════════════════
            HERO HEADER
        ═══════════════════════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 animate-fade-in border border-border/60"
             style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}>

          <div className="absolute inset-0 pointer-events-none opacity-60"
               style={{ background: 'radial-gradient(ellipse at top right, hsl(var(--primary) / .12) 0%, transparent 60%), radial-gradient(ellipse at bottom left, hsl(var(--primary) / .10) 0%, transparent 60%)' }} />

          <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 mb-3">
                <BarChart3 size={12} className="text-primary" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                  Análise Financeira
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
                Relatórios
              </h1>
              <p className="text-muted-foreground text-sm mt-2 max-w-md">
                Visualize gráficos, lançamentos pendentes e seu fluxo de caixa em tempo real
              </p>
            </div>

            <div className="flex items-center gap-4 self-end sm:self-auto">
              <BaleiaHumor estado={humorBaleia} />
              <button
                onClick={carregar}
                className="btn-outline px-3 py-2 text-sm gap-2"
                disabled={refreshing}
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                Atualizar
              </button>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            TABS
        ═══════════════════════════════════════════════════════ */}
        <div className="flex items-center gap-1 bg-muted/40 rounded-2xl p-1.5 w-fit animate-fade-in" style={{ animationDelay: '60ms' }}>
          {([
            { v: 'graficos',  l: 'Gráficos',              icon: BarChart3   },
            { v: 'pendentes', l: 'Lançamentos pendentes', icon: ClipboardList },
            { v: 'fluxo',     l: 'Fluxo de caixa',        icon: Activity    },
            { v: 'planejamento', l: 'Planejamento anual', icon: CalendarRange },
          ] as { v: Tab; l: string; icon: any }[]).map(({ v, l, icon: Icon }) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === v
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{l}</span>
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════
            BARRA DE PERÍODO
        ═══════════════════════════════════════════════════════ */}
        <div className="card rounded-2xl p-3 flex flex-wrap items-center gap-2 animate-fade-in" style={{ animationDelay: '120ms' }}>
          {/* Navegação de mês */}
          <div className="flex items-center bg-muted/40 rounded-xl px-1 py-1">
            <button onClick={() => navMes(-1)}
                    className="p-1.5 rounded-lg hover:bg-card transition-colors">
              <ChevronLeft size={14} className="text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground px-3 min-w-[110px] text-center">
              {MESES[mes]}
            </span>
            <button onClick={() => navMes(1)}
                    className="p-1.5 rounded-lg hover:bg-card transition-colors">
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
          </div>

          {/* Seletor de ANO — a navegação de mês sozinha exigia 12 cliques
              pra trocar de ano. */}
          <div className="flex items-center bg-muted/40 rounded-xl px-1 py-1">
            <button onClick={() => setAno(a => a - 1)} aria-label="Ano anterior"
                    className="p-1.5 rounded-lg hover:bg-card transition-colors">
              <ChevronLeft size={14} className="text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground px-2 tabular">{ano}</span>
            <button onClick={() => setAno(a => a + 1)} aria-label="Próximo ano"
                    className="p-1.5 rounded-lg hover:bg-card transition-colors">
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
          </div>

          {/* ⚠️ AQUI HAVIA 4 CHIPS MORTOS: "Hoje", "7 dias", "Este mês" e
              "Este ano" acendiam e NÃO filtravam nada — o estado `periodo` só
              era lido no `className` do próprio botão. A tela inteira é
              mensal (resumo e lista vêm por `mesRef`), então "Hoje" e "7 dias"
              não tinham como funcionar sem refazer a busca, e "Este ano" só
              pulava pra janeiro. Controle que finge filtrar é pior que
              controle nenhum: a pessoa lê o número achando que é de hoje.
              No lugar ficou o que de fato funciona — e o botão de voltar só
              aparece quando você NÃO está no mês atual. */}
          {(mes !== hoje.getMonth() || ano !== hoje.getFullYear()) && (
            <button
              onClick={() => { setMes(hoje.getMonth()); setAno(hoje.getFullYear()); }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors inline-flex items-center gap-1.5"
            >
              <Calendar size={12} /> Voltar pra hoje
            </button>
          )}

          {/* Filtro por membro — só em gestão compartilhada com 2+ membros */}
          {compartilhado && membros.length > 1 && (
            <select
              value={membroFiltro}
              onChange={e => setMembroFiltro(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/40 text-foreground border border-border focus:outline-none focus:border-primary cursor-pointer"
              title="Filtrar o relatório por um membro do grupo"
            >
              <option value="todos">👥 Todos os membros</option>
              {membros.map(m => {
                const id = m.user_id || m.users?.id;
                return <option key={id} value={id}>{m.users?.name || 'Membro'}</option>;
              })}
            </select>
          )}

          <div className="hidden sm:flex items-center gap-2 ml-auto text-xs text-muted-foreground">
            <Calendar size={13} />
            <span className="tabular">
              01/{String(mes + 1).padStart(2, '0')}/{ano} – {String(new Date(ano, mes + 1, 0).getDate())}/{String(mes + 1).padStart(2, '0')}/{ano}
            </span>
          </div>
        </div>

        {/* Chip do filtro de membro ativo */}
        {membroFiltro !== 'todos' && (
          <div className="flex items-center gap-2 animate-fade-in">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30">
              <span className="text-[11px] font-semibold text-primary">
                👤 {membros.find(m => (m.user_id || m.users?.id) === membroFiltro)?.users?.name || 'Membro'}
              </span>
              <button onClick={() => setMembroFiltro('todos')} className="text-primary hover:text-primary/70 -mr-0.5">×</button>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Só os lançamentos desse membro · <strong className="text-foreground tabular">{txs.length}</strong> no mês
            </span>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB: GRÁFICOS
        ═══════════════════════════════════════════════════════ */}
        {tab === 'graficos' && (
          <div className="space-y-5 animate-fade-in">

            {/* Cards de resumo (4) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <PremiumStatCard
                label="Receitas"
                value={resumo?.receitas || 0}
                change={varReceitas}
                icon={TrendingUp}
                hue={142}
                positive
                delay={0}
              />
              <PremiumStatCard
                label="Despesas"
                value={resumo?.gastos || 0}
                change={varGastos}
                icon={TrendingDown}
                hue={0}
                negative
                delay={60}
              />
              <PremiumStatCard
                label="Saldo do mês"
                value={saldo}
                icon={Wallet}
                hue={saldo >= 0 ? 134 : 0}
                accent
                delay={120}
              />
              <PremiumStatCard
                label="Maior gasto"
                value={resumo?.por_categoria?.[0]?.total || 0}
                sub={nomeCategoria(resumo?.por_categoria?.[0]?.categoria || '—')}
                icon={Filter}
                hue={28}
                delay={180}
              />
            </div>

            {/* Grid 3 colunas: Despesas / Receitas / Frequência */}
            <div className="grid lg:grid-cols-3 gap-5">

              <ChartCard
                title="Despesas por categoria"
                subtitle={`${MESES_CURTO[mes]} ${ano}`}
                icon={<PieIcon size={14} className="text-red-500" />}
                badgeColor="red"
              >
                {dadosPie.length > 0 ? (
                  <CategoryDonut data={dadosPie} />
                ) : (
                  <EmptyDonut label="Despesas" />
                )}
              </ChartCard>

              <ChartCard
                title="Receitas por categoria"
                subtitle={`${MESES_CURTO[mes]} ${ano}`}
                icon={<PieIcon size={14} className="text-green-500" />}
                badgeColor="green"
              >
                {dadosPieReceitas.length > 0 ? (
                  <CategoryDonut data={dadosPieReceitas} />
                ) : (
                  <EmptyDonut label="Receitas" />
                )}
              </ChartCard>

              <ChartCard
                title="Frequência diária"
                subtitle="Receitas x Despesas"
                icon={<LineIcon size={14} className="text-blue-500" />}
                badgeColor="blue"
              >
                <GraficoFrequencia data={dadosFrequencia} />
                <ChartLegend items={[
                  { label: 'Receitas', color: '#22c55e' },
                  { label: 'Despesas', color: '#fb7185' },
                ]} />
              </ChartCard>
            </div>

            {/* Barras horizontais — top categorias */}
            {dadosPie.length > 0 && (
              <ChartCard
                title="Top categorias de gastos"
                subtitle="Detalhamento por valor"
                icon={<Layers size={14} className="text-purple-500" />}
                badgeColor="purple"
                fullWidth
              >
                <div className="space-y-3 mt-2">
                  {dadosPie.map((cat: any, i: number) => {
                    const total = dadosPie.reduce((s: number, c: any) => s + c.value, 0);
                    const pct = total ? (cat.value / total) * 100 : 0;
                    return (
                      <div key={i} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            {temMarcaConhecida(cat.name)
                              ? <CategoriaIcon nome={cat.name} icone={cat.emoji} color={cat.color} size={22} />
                              : <span className="text-base">{cat.emoji}</span>}
                            <span className="text-sm font-medium text-foreground">{cat.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular"
                                  style={{ background: `color-mix(in srgb, ${cat.color} 13%, transparent)`, color: cat.color }}>
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                          <span className="text-sm font-bold text-foreground tabular">{fmt(cat.value)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${pct}%`,
                              background: `linear-gradient(90deg, ${cat.color}, color-mix(in srgb, ${cat.color} 87%, transparent))`,
                              boxShadow: `0 0 12px color-mix(in srgb, ${cat.color} 25%, transparent)`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ChartCard>
            )}

            {/* Média mensal + projeção do mês */}
            {mediaEProjecao && mediaEProjecao.mesesNaMedia > 0 && (
              <ChartCard
                title="Ritmo do mês"
                subtitle={`Comparado à sua média de ${mediaEProjecao.mesesNaMedia} ${mediaEProjecao.mesesNaMedia === 1 ? 'mês' : 'meses'} em ${ano}`}
                icon={<Activity size={14} className="text-indigo-500" />}
                badgeColor="blue"
                fullWidth
              >
                <RitmoDoMes {...mediaEProjecao} mesLabel={MESES[mes]} />
              </ChartCard>
            )}

            {/* Categoria × limite */}
            {usoDosLimites.length > 0 && (
              <ChartCard
                title="Limites por categoria"
                subtitle={`Quanto já foi usado do limite de ${MESES_CURTO[mes]}`}
                icon={<Target size={14} className="text-amber-500" />}
                badgeColor="purple"
                fullWidth
              >
                <div className="space-y-3.5 mt-2">
                  {usoDosLimites.map((l, i) => <LinhaLimite key={l.nome} {...l} i={i} />)}
                </div>
              </ChartCard>
            )}

            {/* Por membro — gastos, receitas e saldo de cada um (só grupo 2+
                membros e sem filtro por membro ativo) */}
            {membroFiltro === 'todos' && (resumo?.por_membro || []).length >= 2 && (
              <ChartCard
                title="Por membro"
                subtitle="Gastos, receitas e saldo de cada um neste mês"
                icon={<Users size={16} className="text-foreground" />}
              >
                <div className="space-y-4">
                  {(resumo.por_membro as any[]).map((m, i) => {
                    const totalGastos = resumo.gastos || 1;
                    const gasto = m.gastos ?? m.total ?? 0;
                    const receita = m.receitas ?? 0;
                    const saldo = m.saldo ?? (receita - gasto);
                    const pct = totalGastos > 0 ? (gasto / totalGastos) * 100 : 0;
                    const cor = `hsl(${(m.user_id || m.name).split('').reduce((h: number, c: string) => c.charCodeAt(0) + ((h << 5) - h), 0) % 360} 65% 50%)`;
                    return (
                      <div key={m.user_id || i} className="animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                        <div className="flex items-center justify-between mb-1.5 gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <AvatarMembro name={m.name} size="sm" />
                            <span className="text-sm font-semibold text-foreground truncate">{m.name}</span>
                          </div>
                          <span className="text-sm font-bold text-red-500 dark:text-red-400 tabular flex-shrink-0">−{fmt(gasto)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                               style={{ width: `${Math.min(pct, 100)}%`, background: cor }} />
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] tabular">
                          <span className="text-green-600 dark:text-green-400">Receitas +{fmt(receita)}</span>
                          <span className={saldo >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
                            Saldo {saldo >= 0 ? '+' : '−'}{fmt(Math.abs(saldo))}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ChartCard>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB: LANÇAMENTOS PENDENTES
        ═══════════════════════════════════════════════════════ */}
        {tab === 'pendentes' && (
          <div className="space-y-5 animate-fade-in">

            {/* Atraso primeiro. Sem esta faixa o dado existia — na data de cada
                linha — mas ninguém o encontrava: era preciso comparar 12 datas
                com o calendário mental pra descobrir que 3 já venceram. */}
            {atrasados > 0 && (
              <div className="rounded-2xl p-4 flex items-start gap-3"
                   style={{ background: 'color-mix(in srgb, #ef4444 10%, transparent)',
                            border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)' }}>
                <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    {atrasados === 1 ? '1 lançamento já passou da data' : `${atrasados} lançamentos já passaram da data`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Estão no topo das listas abaixo. Se já foram pagos, use o{' '}
                    <CheckCircle2 size={11} className="inline align-text-bottom" /> pra dar baixa.
                  </p>
                </div>
              </div>
            )}

            {/* 3 cards horizontais maiores */}
            <div className="grid lg:grid-cols-3 gap-4">

              {/* Total a receber */}
              <div className="card rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-40"
                     style={{ background: 'radial-gradient(circle, hsl(142 71% 50% / .25) 0%, transparent 70%)' }} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-green-600 dark:text-green-400 flex items-center gap-1.5">
                      <ArrowUpRight size={11} /> Total a receber
                    </span>
                  </div>
                  <ValorAuto max="1.875rem" className="font-bold text-green-600 dark:text-green-400 tracking-tight">
                    {fmt(totalReceber)}
                  </ValorAuto>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {recebPendentes.length > 0 && prevReceber.length > 0
                      ? `${recebPendentes.length} lançado${recebPendentes.length !== 1 ? 's' : ''} · ${prevReceber.length} conta${prevReceber.length !== 1 ? 's' : ''} a vencer`
                      : prevReceber.length > 0
                        ? `${prevReceber.length} conta${prevReceber.length !== 1 ? 's' : ''} fixa${prevReceber.length !== 1 ? 's' : ''} a vencer`
                        : `${recebPendentes.length} lançamento${recebPendentes.length !== 1 ? 's' : ''} pendente${recebPendentes.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>

              {/* Total a pagar */}
              <div className="card rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-40"
                     style={{ background: 'radial-gradient(circle, hsl(0 72% 55% / .25) 0%, transparent 70%)' }} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-red-500 flex items-center gap-1.5">
                      <ArrowDownRight size={11} /> Total a pagar
                    </span>
                  </div>
                  <ValorAuto max="1.875rem" className="font-bold text-red-500 tracking-tight">{fmt(totalPagar)}</ValorAuto>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {gastoPendentes.length > 0 && prevPagar.length > 0
                      ? `${gastoPendentes.length} lançado${gastoPendentes.length !== 1 ? 's' : ''} · ${prevPagar.length} conta${prevPagar.length !== 1 ? 's' : ''} a vencer`
                      : prevPagar.length > 0
                        ? `${prevPagar.length} conta${prevPagar.length !== 1 ? 's' : ''} fixa${prevPagar.length !== 1 ? 's' : ''} a vencer`
                        : `${gastoPendentes.length} lançamento${gastoPendentes.length !== 1 ? 's' : ''} pendente${gastoPendentes.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>

              {/* Saldos */}
              <div className="rounded-2xl p-5 relative overflow-hidden"
                   style={{ background: 'linear-gradient(135deg, #0a1f12 0%, #1a3d28 100%)' }}>
                <div className="absolute inset-0 opacity-30"
                     style={{ background: `radial-gradient(circle at 80% 20%, ${BRAND} 0%, transparent 60%)` }} />
                <div className="relative space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-white/60 mb-1">Saldo disponível</p>
                    <ValorAuto max="1.25rem" className="font-bold text-white">{fmt(saldoBanco)}</ValorAuto>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-white/60 mb-1 flex items-center gap-1">
                      Saldo previsto
                    </p>
                    <ValorAuto max="1.25rem" className={`font-bold ${saldoPrevisto >= 0 ? 'text-white' : 'text-red-300'}`}>
                      {fmt(saldoPrevisto)}
                    </ValorAuto>
                    {/* O "(?)" que ficava no rótulo não explicava nada — e o
                        número mudou de definição, então agora ele se explica.
                        Os dois termos são os cards ao lado: dá pra conferir a
                        conta sem sair da tela. */}
                    <p className="text-[10px] text-white/50 mt-1 leading-relaxed">
                      Saldo de hoje + a receber − a pagar
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Listas 2 colunas */}
            <div className="grid lg:grid-cols-2 gap-4">
              <PendentesList
                title="Receitas pendentes"
                subtitle="Lançamentos a receber"
                badgeText="Receita"
                badgeColor="green"
                items={recebPendentes}
                empty="Nenhuma receita pendente"
                compartilhado={compartilhado}
                onBaixar={darBaixa}
                positive
              />
              <PendentesList
                title="Despesas pendentes"
                subtitle="Lançamentos a pagar"
                badgeText="Despesa"
                badgeColor="red"
                items={gastoPendentes}
                empty="Nenhuma despesa pendente"
                compartilhado={compartilhado}
                onBaixar={darBaixa}
              />
            </div>

            {/* ── Contas fixas que ainda vencem ──────────────────────────
                Fica FORA das duas listas de propósito: aqui não existe "dar
                baixa". Estes itens não são transações — são compromissos que
                ainda vão virar uma, ou que a Sora nunca lança (modo "não
                lançar", de quem recebe a cobrança pelo banco). Misturar com
                a lista acionável convidaria a um clique que não existe.

                ⚠️ E o bloco só aparece quando há item: seção vazia num lugar
                onde antes não havia nada seria ruído puro. */}
            {previstos.length > 0 && (
              <div className="card rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border/60 flex items-start gap-3">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 13%, transparent)' }}>
                    <CalendarClock size={16} style={{ color: BRAND }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground leading-tight">Ainda vence este mês</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Contas fixas, parcelas e faturas com data à frente. Não são lançamentos —
                      entram sozinhas quando chegar o dia.
                    </p>
                  </div>
                </div>

                <ul className="divide-y divide-border/50">
                  {previstos.map((i) => (
                    <li key={i.chave} className="px-5 py-3 flex items-center gap-3">
                      {/* Dia como âncora visual: a pergunta aqui é "quando", */}
                      {/* e ele é o que ordena a lista. */}
                      <span className="w-9 flex-shrink-0 text-center">
                        <span className="block text-[10px] uppercase tracking-wider text-muted-foreground leading-none">dia</span>
                        <span className="block text-sm font-bold text-foreground tabular leading-tight">{i.dia || "—"}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{i.titulo}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {i.origem}
                          {/* Valor que muda (luz, água) é aproximação — dizer isso */}
                          {/* evita que o total pareça uma promessa exata. */}
                          {i.variavel ? ' · valor estimado' : ''}
                        </p>
                      </div>
                      <span className={`text-sm font-bold tabular whitespace-nowrap ${
                        i.tipo === 'Recebimento' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                        {i.tipo === 'Recebimento' ? '+' : '−'}{fmt(i.valor)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB: FLUXO DE CAIXA
        ═══════════════════════════════════════════════════════ */}
        {tab === 'fluxo' && (
          <div className="space-y-5 animate-fade-in">

            {/* Big stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Rótulo com o ANO explícito: "Receitas no ano" sozinho, com o
                  seletor de mês logo acima, dava pra ler como "no mês". */}
              <PremiumStatCard
                label={`Receitas em ${ano}`}
                value={anualData?.receitas || 0}
                icon={TrendingUp}
                hue={142}
                positive
                delay={0}
              />
              <PremiumStatCard
                label={`Despesas em ${ano}`}
                value={anualData?.gastos || 0}
                icon={TrendingDown}
                hue={0}
                negative
                delay={60}
              />
              <PremiumStatCard
                label="Saldo acumulado"
                value={saldoBanco}
                icon={Wallet}
                hue={saldoBanco >= 0 ? 134 : 0}
                accent
                delay={120}
              />
            </div>

            {/* Gráfico principal - Receitas x Despesas x Saldo no ano */}
            <ChartCard
              title="Fluxo de caixa anual"
              subtitle="Evolução de receitas, despesas e saldo ao longo do ano"
              icon={<Activity size={14} className="text-blue-500" />}
              badgeColor="blue"
              fullWidth
            >
              {/* ⚠️ Skeleton de altura IGUAL à do gráfico. Antes o dado era
                  fabricado e sempre existia; agora ele vem da rede, e um
                  bloco de altura diferente daria salto de layout quando
                  chegasse. */}
              {anualCarregando ? (
                <div className="h-[340px] rounded-xl bg-muted/40 animate-pulse"
                     role="status" aria-label="Carregando o fluxo do ano" />
              ) : (
                <>
                  <GraficoFluxo data={dadosFluxo} />
                  <ChartLegend items={[
                    { label: 'Receitas', color: BRAND },
                    { label: 'Despesas', color: RED },
                    { label: 'Saldo',    color: BLUE, dashed: true },
                  ]} />
                </>
              )}
            </ChartCard>

            {/* Resumo mensal em barras */}
            <ChartCard
              title="Comparativo mensal"
              subtitle="Receitas vs Despesas por mês"
              icon={<BarChart3 size={14} className="text-emerald-500" />}
              badgeColor="green"
              fullWidth
            >
              {anualCarregando
                ? <div className="h-[260px] rounded-xl bg-muted/40 animate-pulse"
                       role="status" aria-label="Carregando o comparativo mensal" />
                : <GraficoComparativo data={dadosFluxo} />}
            </ChartCard>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB: PLANEJAMENTO ANUAL
        ═══════════════════════════════════════════════════════ */}
        {tab === 'planejamento' && (
          <div className="space-y-5 animate-fade-in">
            {!plano ? (
              <div className="space-y-5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[0, 1, 2, 3].map(i => <div key={i} className="h-[92px] rounded-2xl bg-muted/40 animate-pulse" />)}
                </div>
                <div className="h-[330px] rounded-2xl bg-muted/40 animate-pulse"
                     role="status" aria-label="Montando o planejamento do ano" />
              </div>
            ) : !plano.temHistorico ? (
              <SemHistorico ano={ano} />
            ) : (
              <>
                <ResumoPlano plano={plano} ano={ano} />

                <ChartCard
                  title={`Planejamento de ${ano}`}
                  subtitle="Barra sólida é o que já aconteceu · hachurada é estimativa"
                  icon={<CalendarRange size={14} className="text-indigo-500" />}
                  badgeColor="blue"
                  fullWidth
                >
                  <GraficoPlanejamento data={plano.linhas} mesAtual={plano.mesAtualIx} />
                  <LegendaPlano />
                  <ComoFoiCalculado {...plano} />
                </ChartCard>

                <PreenchimentoRapido
                  plano={plano}
                  onAplicar={(r: number | null, d: number | null) => preencherAberto(r, d, plano.linhas)}
                  onLimpar={limparAjustes}
                />

                <GradeMeses linhas={plano.linhas} onAjustar={ajustarMes} />

                <ContasSazonais
                  contas={sazonais}
                  onSalvar={salvarSazonais}
                  linhas={plano.linhas}
                />
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTES
// ─────────────────────────────────────────────────────────────

function PremiumStatCard({
  label, value, change, sub, icon: Icon, hue, positive, negative, accent, delay = 0,
}: any) {
  return (
    <div className="card rounded-2xl p-5 relative overflow-hidden animate-fade-in" style={{ animationDelay: `${delay}ms` }}>
      <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full pointer-events-none opacity-40"
           style={{ background: `radial-gradient(circle, hsl(${hue} 80% 55% / .2) 0%, transparent 70%)` }} />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{label}</span>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
               style={{ background: `hsl(${hue} 80% 55% / 0.12)` }}>
            <Icon size={14} style={{ color: `hsl(${hue} 65% 50%)` }} />
          </div>
        </div>
        {/* ValorAuto: no mobile o card tem ~2 colunas e o valor negativo
            ("-R$ 2.529,92") quebrava a linha depois do hífen. Agora fica em
            uma linha só e a fonte encolhe só o quanto for preciso. */}
        <ValorAuto
          max="1.5rem"
          className={`font-bold tracking-tight ${
            accent ? (value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500') :
            positive ? 'text-foreground' :
            negative ? 'text-foreground' :
                       'text-foreground'
          }`}
        >
          {fmt(value)}
        </ValorAuto>
        {sub && <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>}
        {change !== undefined && (
          <div className="flex items-center gap-1 mt-1.5">
            <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
              (positive ? change >= 0 : change <= 0)
                ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
            }`}>
              {change >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {Math.abs(change)}%
            </span>
            <span className="text-[10px] text-muted-foreground">vs mês anterior</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PLANEJAMENTO ANUAL — peças da tela
   ═══════════════════════════════════════════════════════════════════════ */

function SemHistorico({ ano }: { ano: number }) {
  return (
    <div className="card rounded-2xl p-10 text-center">
      <CalendarRange size={28} className="mx-auto text-muted-foreground/50 mb-3" />
      <p className="text-sm font-semibold text-foreground">Ainda não dá pra planejar {ano}.</p>
      <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">
        O planejamento se monta a partir dos seus meses já fechados, e {ano} ainda não tem nenhum.
        Depois do primeiro mês completo os números aparecem aqui sozinhos — você não precisa
        digitar nada.
      </p>
    </div>
  );
}

function ResumoPlano({ plano, ano }: any) {
  const { totalRec, totalDes, saldoAno, pior, primeiroNegativo } = plano;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <PremiumStatCard label={`Receitas em ${ano}`} value={totalRec} icon={TrendingUp} hue={142} positive delay={0} />
      <PremiumStatCard label={`Despesas em ${ano}`} value={totalDes} icon={TrendingDown} hue={0} negative delay={60} />
      <PremiumStatCard label="Sobra no ano" value={saldoAno} icon={PiggyBank}
                       hue={saldoAno >= 0 ? 134 : 0} accent delay={120} />
      {/* ⚠️ "Pior acumulado", NÃO "caixa fica negativo". O acumulado aqui é o
          resultado do ANO somado mês a mês, começando do zero em janeiro — não
          é o saldo da sua conta. Dizer "caixa negativo" faria a pessoa achar
          que vai ficar sem dinheiro no banco, quando pode ter reserva de
          sobra. */}
      <PremiumStatCard
        label="Pior acumulado do ano"
        value={pior?.acumulado || 0}
        sub={`${pior?.name}${primeiroNegativo ? ` · fica negativo em ${primeiroNegativo.name}` : ''}`}
        icon={AlertTriangle} hue={(pior?.acumulado || 0) < 0 ? 0 : 28} delay={180}
      />
    </div>
  );
}

function LegendaPlano() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-4 pt-3 border-t border-border/50">
      {[
        { l: 'Receitas', cor: BRAND },
        { l: 'Despesas', cor: RED },
      ].map(x => (
        <span key={x.l} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: x.cor }} /> {x.l}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {/* A amostra da hachura, no mesmo desenho do gráfico — legenda que
            descreve o padrão em palavras exige tradução mental. */}
        <span className="w-2.5 h-2.5 rounded-sm border border-border"
              style={{ backgroundImage: `repeating-linear-gradient(45deg, ${BRAND} 0 2px, transparent 2px 4px)` }} />
        Estimativa
      </span>
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="w-4 h-0 border-t-2 border-dashed" style={{ borderColor: BLUE }} /> Acumulado
      </span>
    </div>
  );
}

/** O plano se explicando. Estimativa sem memória de cálculo vira palpite. */
function ComoFoiCalculado({ mediaRec, mediaDes, mesesRec, mesesDes }: any) {
  return (
    <p className="text-[11px] text-muted-foreground mt-3 flex items-start gap-1.5 leading-relaxed">
      <Sparkles size={11} className="flex-shrink-0 mt-0.5" />
      <span>
        Os meses futuros usam a sua média de <strong className="text-foreground tabular">{fmt(mediaDes)}</strong> de
        despesa ({mesesDes} {mesesDes === 1 ? 'mês' : 'meses'}) e{' '}
        <strong className="text-foreground tabular">{fmt(mediaRec)}</strong> de receita
        ({mesesRec} {mesesRec === 1 ? 'mês' : 'meses'}) — ou o que já estiver lançado no mês, quando
        for maior. Cada mês que fecha entra na média e corrige os seguintes, sem você mexer em nada.
      </span>
    </p>
  );
}

/* ── Preenchimento rápido ────────────────────────────────────────────────
   ⚠️ Só mexe em mês ABERTO. A versão antiga preenchia os 12 e passava por
   cima do que de fato aconteceu; aqui os fechados são fato e ficam de fora. */
function PreenchimentoRapido({ plano, onAplicar, onLimpar }: any) {
  const [rec, setRec] = useState('');
  const [des, setDes] = useState('');
  const abertos = plano.linhas.filter((l: any) => l.estado !== 'realizado').length;
  const num = (s: string) => {
    const v = parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(v) ? v : null;
  };

  return (
    <div className="card rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Wand2 size={15} className="text-primary" />
          <h3 className="font-semibold text-foreground">Preenchimento rápido</h3>
        </div>
        {plano.qtdAjustes > 0 && (
          <button onClick={onLimpar}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 h-11 px-3 rounded-lg hover:bg-muted transition-colors">
            <RefreshCw size={12} /> Voltar tudo ao automático ({plano.qtdAjustes})
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4 max-w-xl leading-relaxed">
        Sabe que vai ganhar ou gastar diferente do que a Sora estimou? Defina uma média sua para os{' '}
        <strong className="text-foreground">{abertos}</strong> {abertos === 1 ? 'mês que ainda vem' : 'meses que ainda vêm'}.
        Meses passados ficam de fora daqui — se quiser preencher algum, edite o card dele lá embaixo.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[130px]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Receita por mês</span>
          <input inputMode="decimal" value={rec} onChange={e => setRec(e.target.value)}
                 placeholder={fmt(plano.mediaRec)} className="input tabular" />
        </label>
        <label className="flex-1 min-w-[130px]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Despesa por mês</span>
          <input inputMode="decimal" value={des} onChange={e => setDes(e.target.value)}
                 placeholder={fmt(plano.mediaDes)} className="input tabular" />
        </label>
        <button
          onClick={() => { onAplicar(num(rec), num(des)); setRec(''); setDes(''); }}
          disabled={num(rec) === null && num(des) === null}
          className="inline-flex items-center gap-1.5 px-4 h-11 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">
          <Wand2 size={14} /> Aplicar
        </button>
      </div>
      {/* O placeholder mostra a média automática: assim dá pra ver do que se
          está discordando antes de digitar. */}
      <p className="text-[11px] text-muted-foreground mt-2">
        Em branco = mantém o automático. Deixe só um dos dois preenchido pra ajustar apenas ele.
      </p>
    </div>
  );
}

/* ── Grade dos 12 meses, editável ────────────────────────────────────── */
function GradeMeses({ linhas, onAjustar }: any) {
  return (
    <div>
      <div className="mb-3 px-1">
        <h3 className="font-semibold text-foreground">Mês a mês</h3>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl leading-relaxed">
          Todo mês aceita valor digitado — inclusive os que passaram antes de você usar a Sora e
          por isso aparecem sem registro.{' '}
          {/* A garantia que o usuário pediu, dita onde a dúvida nasce. */}
          <strong className="text-foreground">O que você escreve aqui fica só no planejamento</strong>{' '}
          e não cria nem altera lançamento nenhum — dashboard, categorias e relatórios continuam
          mostrando o que está no banco.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {linhas.map((l: any) => <CardMes key={l.i} l={l} onAjustar={onAjustar} />)}
      </div>
    </div>
  );
}

function CardMes({ l, onAjustar }: any) {
  const manual = l.manualRec || l.manualDes;
  const borda = manual ? 'color-mix(in srgb, #6366f1 45%, transparent)'
    : l.estado === 'realizado' ? 'hsl(var(--border) / 0.6)'
    : 'hsl(var(--border))';

  return (
    <div className="rounded-2xl border bg-card p-4 animate-[slide-up_400ms_ease-out_both]"
         style={{ borderColor: borda, animationDelay: `${l.i * 25}ms` }}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold text-foreground">{l.name}</span>
          <SeloEstado l={l} manual={manual} />
        </div>
        <span className={`text-sm font-bold tabular flex-shrink-0 ${l.saldo >= 0 ? 'text-primary' : 'text-red-500'}`}>
          {fmt(l.saldo)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <CampoMes rotulo="Receita" valor={l.Receitas} auto={l.autoRec} manual={l.manualRec}
                  mes={l.nomeLongo} vazio={l.semDados}
                  onMudar={(v: number | null) => onAjustar(l.i, 'receita', v)} />
        <CampoMes rotulo="Despesa" valor={l.Despesas} auto={l.autoDes} manual={l.manualDes}
                  mes={l.nomeLongo} vazio={l.semDados}
                  onMudar={(v: number | null) => onAjustar(l.i, 'despesa', v)} />
      </div>

      {l.sazonais > 0 && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
          <Target size={9} /> inclui {fmt(l.sazonais)} de conta sazonal
        </p>
      )}
      {/* Só aparece quando o banco já conhece algo daquele mês futuro — é a
          informação que explica uma previsão acima da média. */}
      {l.estado === 'previsto' && l.jaLancado > 0 && (
        <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
          <Lock size={9} /> {fmt(l.jaLancado)} já lançado (parcelas, recorrências)
        </p>
      )}

      <div className="mt-2.5 pt-2.5 border-t border-border/40 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Acumulado no ano</span>
        <span className={`tabular font-semibold ${l.acumulado >= 0 ? 'text-foreground' : 'text-red-500'}`}>
          {fmt(l.acumulado)}
        </span>
      </div>
    </div>
  );
}

function SeloEstado({ l, manual }: any) {
  // Ícone + palavra: o estado do mês nunca depende só de cor.
  const cfg = manual
    ? { Icone: Pencil, txt: 'manual',  cor: '#6366f1' }
    // "sem registro" e não "fechado": o mês passou, mas a Sora não tem nada
    // dele. Chamar isso de fechado sugere que o zero é resultado apurado.
    : l.semDados               ? { Icone: CircleDashed, txt: 'sem registro', cor: 'hsl(var(--fg-muted))' }
    : l.estado === 'realizado' ? { Icone: Lock, txt: 'fechado', cor: 'hsl(var(--fg-muted))' }
    : l.estado === 'emCurso'   ? { Icone: Gauge, txt: 'em curso', cor: '#f59e0b' }
    : { Icone: Sparkles, txt: 'previsto', cor: '#6366f1' };
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ color: cfg.cor, background: `color-mix(in srgb, ${cfg.cor} 12%, transparent)` }}>
      <cfg.Icone size={9} /> {cfg.txt}
    </span>
  );
}

function CampoMes({ rotulo, valor, auto, manual, mes, vazio, onMudar }: any) {
  const [txt, setTxt] = useState('');
  const [focado, setFocado] = useState(false);

  const confirmar = () => {
    setFocado(false);
    const t = txt.trim();
    if (t === '') { setTxt(''); return; }               // saiu sem mexer
    const v = parseFloat(t.replace(/\./g, '').replace(',', '.'));
    onMudar(Number.isFinite(v) && v >= 0 ? v : null);
    setTxt('');
  };

  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-between gap-1">
        {rotulo}
        {manual && (
          <button type="button" onClick={() => onMudar(null)}
                  title={`Voltar ${rotulo.toLowerCase()} de ${mes} ao valor automático (${fmt(auto)})`}
                  aria-label={`Voltar ${rotulo.toLowerCase()} de ${mes} ao automático`}
                  className="normal-case tracking-normal text-[10px] font-semibold text-indigo-500 hover:underline -my-2 py-2 px-1">
            desfazer
          </button>
        )}
      </span>
      {/* ⚠️ Mês passado sem lançamento nenhum mostra PLACEHOLDER, não "R$ 0,00".
          Zero desenhado como valor lê-se "não gastei nada"; o certo ali é "a
          Sora não estava aqui pra saber" — e o campo vazio convida a preencher
          em vez de afirmar. */}
      <input
        inputMode="decimal"
        value={focado ? txt : (vazio && !manual ? '' : fmt(valor))}
        placeholder={vazio && !manual ? 'não registrado' : undefined}
        onFocus={(e) => { setFocado(true); setTxt(valor ? String(valor.toFixed(2)).replace('.', ',') : ''); requestAnimationFrame(() => e.target.select()); }}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setTxt(''); setFocado(false); } }}
        aria-label={`${rotulo} de ${mes}`}
        className="input tabular text-sm placeholder:text-muted-foreground/60 placeholder:text-xs"
        style={{ minHeight: 44, borderColor: manual ? 'color-mix(in srgb, #6366f1 50%, transparent)' : undefined }}
      />
    </div>
  );
}

function ContasSazonais({ contas, onSalvar, linhas }: any) {
  const [nome, setNome]   = useState('');
  const [valor, setValor] = useState('');
  const [mes, setMes]     = useState(0);

  const add = () => {
    const v = parseFloat(String(valor).replace(',', '.'));
    if (!nome.trim() || !Number.isFinite(v) || v <= 0) return;
    onSalvar([...contas, { id: Math.random().toString(36).slice(2), nome: nome.trim(), valor: v, mes }]);
    setNome(''); setValor('');
  };
  const del = (id: string) => onSalvar(contas.filter((c: any) => c.id !== id));
  // Lançar sazonal num mês que já fechou não muda nada — o mês fechado usa o
  // número real. Dizer isso evita a pessoa achar que a conta "sumiu".
  const mesJaFechado = linhas[mes]?.estado === 'realizado';

  return (
    <div className="card rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <Target size={15} className="text-amber-500" />
        <h3 className="font-semibold text-foreground">Contas que só caem em alguns meses</h3>
      </div>
      <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-xl leading-relaxed">
        IPVA, IPTU, seguro, Natal. A média não enxerga isso — se o app só conhece maio a julho,
        ele não tem como saber que janeiro tem IPVA. Lance aqui e o mês previsto já soma.
      </p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {SAZONAIS_SUGERIDAS.map(s => (
          <button key={s.nome} type="button"
                  onClick={() => { setNome(s.nome); setMes(s.mes); }}
                  className="text-xs px-3 h-9 rounded-full border border-border bg-muted/20 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
            + {s.nome}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[140px]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Nome</span>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: IPVA" className="input" />
        </label>
        <label className="w-32">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Valor</span>
          <input inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" className="input tabular" />
        </label>
        <label className="w-28">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Mês</span>
          <select value={mes} onChange={e => setMes(Number(e.target.value))} className="input">
            {MESES_CURTO.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </label>
        <button onClick={add} disabled={!nome.trim() || !valor}
                className="inline-flex items-center gap-1.5 px-4 h-11 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">
          <Plus size={15} /> Lançar
        </button>
      </div>

      {mesJaFechado && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1.5">
          <AlertTriangle size={11} /> {MESES[mes]} já fechou — o valor real dele manda, então lançar aqui não muda o gráfico.
        </p>
      )}

      {contas.length > 0 && (
        <ul className="mt-5 space-y-2">
          {[...contas].sort((a: any, b: any) => a.mes - b.mes).map((c: any) => (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-[10px] font-bold uppercase text-primary w-8 flex-shrink-0">{MESES_CURTO[c.mes]}</span>
                <span className="text-sm text-foreground truncate">{c.nome}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-semibold tabular text-foreground">{fmt(c.valor)}</span>
                <button onClick={() => del(c.id)} aria-label={`Remover ${c.nome}`}
                        className="w-11 h-11 flex items-center justify-center rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-muted-foreground mt-4">
        Salvo neste aparelho. Sincronizar entre dispositivos ainda está por fazer.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   RITMO DO MÊS — média × mês atual × projeção
   ═══════════════════════════════════════════════════════════════════════ */
function RitmoDoMes({
  media, mesesNaMedia, gastoDoMes, projecao, ehMesAtual, diaHoje, diasNoMes,
  variacao, mesLabel,
}: any) {
  const acima = (variacao ?? 0) > 0;
  // Faixa morta de ±5%: variação de 2% não é "acima da média", é ruído — e
  // apontar isso como sinal treina a pessoa a ignorar o card.
  const relevante = variacao !== null && Math.abs(variacao) >= 5;
  const cor = !relevante ? 'hsl(var(--muted-foreground))' : acima ? RED : BRAND;

  return (
    <div className="space-y-4 mt-1">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <BlocoNum label={`Média mensal`} valor={media}
                  sub={`${mesesNaMedia} ${mesesNaMedia === 1 ? 'mês fechado' : 'meses fechados'}`} />
        <BlocoNum label={`${mesLabel} até agora`} valor={gastoDoMes}
                  sub={ehMesAtual ? `dia ${diaHoje} de ${diasNoMes}` : 'mês fechado'} />
        {projecao !== null && (
          <BlocoNum label="Projeção do mês" valor={projecao} cor={cor} destaque
                    sub="se o ritmo continuar" />
        )}
      </div>

      {/* A frase é o produto do card: o número sozinho não diz o que fazer. */}
      {relevante && (
        <div className="flex items-start gap-2.5 rounded-xl p-3"
             style={{ background: `color-mix(in srgb, ${cor} 10%, transparent)` }}>
          {acima ? <AlertTriangle size={15} style={{ color: cor }} className="flex-shrink-0 mt-0.5" />
                 : <CheckIcon size={15} style={{ color: cor }} className="flex-shrink-0 mt-0.5" />}
          <p className="text-xs text-foreground leading-relaxed">
            {projecao !== null ? 'No ritmo atual, ' : ''}
            {mesLabel} {projecao !== null ? 'deve fechar' : 'fechou'}{' '}
            <strong style={{ color: cor }}>{Math.abs(variacao).toFixed(0)}% {acima ? 'acima' : 'abaixo'}</strong>{' '}
            da sua média — {fmt(Math.abs((projecao ?? gastoDoMes) - media))}{' '}
            {acima ? 'a mais' : 'a menos'} que os {fmt(media)} de sempre.
          </p>
        </div>
      )}

      {/* ⚠️ A projeção é ESTIMATIVA e diz isso na cara. Foi um número inventado
          apresentado como fato que quebrou esta aba antes; um rótulo honesto é
          o que separa as duas coisas. */}
      {projecao !== null && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Gauge size={11} />
          Projeção = o que já saiu ({fmt(gastoDoMes)}) dividido por {diaHoje} dias, vezes {diasNoMes}.
          Não considera contas que ainda vão vencer.
        </p>
      )}
    </div>
  );
}

function BlocoNum({ label, valor, sub, cor, destaque }: any) {
  return (
    <div className={`rounded-xl p-3 ${destaque ? 'ring-1' : ''} bg-muted/30`}
         style={destaque ? { ['--tw-ring-color' as any]: cor, background: `color-mix(in srgb, ${cor} 7%, transparent)` } : undefined}>
      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular mt-0.5" style={cor ? { color: cor } : undefined}>{fmt(valor)}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   LINHA DE LIMITE
   ═══════════════════════════════════════════════════════════════════════ */
function LinhaLimite({ nome, limite, gasto, pct, filhas, theme, i }: any) {
  const estourou = pct > 100;
  const perto    = pct >= 80 && pct <= 100;
  // Status é ÍCONE + TEXTO, nunca a cor sozinha.
  const cor = estourou ? RED : perto ? '#f59e0b' : BRAND;
  const restante = limite - gasto;

  return (
    <div className="animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {temMarcaConhecida(nome)
            ? <CategoriaIcon nome={nome} icone={theme.emoji} color={theme.color} size={22} />
            : <span className="text-base flex-shrink-0">{theme.emoji}</span>}
          <span className="text-sm font-medium text-foreground truncate">{nome}</span>
          {/* Diz que o número inclui as filhas — sem isso o usuário estranha
              um gasto maior do que ele lançou naquela categoria. */}
          {filhas > 0 && (
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              +{filhas} sub
            </span>
          )}
        </div>
        <span className="text-xs font-bold tabular whitespace-nowrap flex-shrink-0" style={{ color: cor }}>
          {fmt(gasto)} <span className="text-muted-foreground font-medium">/ {fmt(limite)}</span>
        </span>
      </div>

      <div className="h-2 rounded-full bg-muted/60 overflow-hidden"
           role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}
           aria-label={`${nome}: ${Math.round(pct)}% do limite usado`}>
        <div className="h-full rounded-full transition-all duration-700"
             style={{ width: `${Math.min(pct, 100)}%`, background: cor }} />
      </div>

      <p className="text-[11px] mt-1 flex items-center gap-1.5" style={{ color: estourou || perto ? cor : undefined }}>
        {estourou ? <><AlertTriangle size={10} /> Estourou {fmt(-restante)} ({pct.toFixed(0)}%)</>
          : perto ? <><AlertTriangle size={10} /> Faltam {fmt(restante)} ({pct.toFixed(0)}% usado)</>
          : <span className="text-muted-foreground"><CheckIcon size={10} className="inline mr-1" />Sobram {fmt(restante)} ({pct.toFixed(0)}% usado)</span>}
      </p>
    </div>
  );
}

function ChartCard({
  title, subtitle, icon, badgeColor, fullWidth, children,
}: {
  title:    string;
  subtitle?:string;
  icon?:    React.ReactNode;
  badgeColor?: 'green' | 'red' | 'blue' | 'purple';
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  const bgs: Record<string, string> = {
    green:  'bg-green-500/10',
    red:    'bg-red-500/10',
    blue:   'bg-blue-500/10',
    purple: 'bg-purple-500/10',
  };

  return (
    <div className={`card rounded-2xl p-5 ${fullWidth ? '' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            {icon && <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${badgeColor ? bgs[badgeColor] : 'bg-muted'}`}>{icon}</div>}
            <h3 className="font-semibold text-foreground">{title}</h3>
          </div>
          {subtitle && <p className="text-xs text-muted-foreground mt-1 ml-9">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyDonut({ label }: { label: string }) {
  return (
    <div className="relative flex flex-col items-center py-4">
      <DonutVazio />
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none top-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Total</p>
        <p className="text-lg font-bold text-muted-foreground tabular">R$ 0,00</p>
      </div>
      <p className="text-xs text-muted-foreground mt-4">Nenhuma {label.toLowerCase()} no período</p>
    </div>
  );
}

function ChartLegend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-3 pt-3 border-t border-border/40">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {it.dashed ? (
            <div className="w-5 border-t-2 border-dashed" style={{ borderColor: it.color }} />
          ) : (
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: it.color }} />
          )}
          <span className="text-xs text-muted-foreground">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function PendentesList({
  title, subtitle, badgeText, badgeColor, items, empty, positive, compartilhado, onBaixar,
}: {
  title:      string;
  subtitle:   string;
  badgeText:  string;
  badgeColor: 'green' | 'red';
  items:      any[];
  empty:      string;
  positive?:  boolean;
  compartilhado?: boolean;
  onBaixar?:  (tx: any) => void;
}) {
  const badgeBg = badgeColor === 'green'
    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
    : 'bg-red-500/10 text-red-500';

  return (
    <div className="card rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${badgeBg}`}>
          {badgeText}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-12 px-6">
          <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-3">
            <CheckCircle2 size={22} className="text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{empty}</p>
        </div>
      ) : (
        <div className="divide-y divide-border/40 max-h-[400px] overflow-y-auto">
          {items.map((tx, i) => {
            const theme = getCategoriaTheme(tx.categoria || '');
            const catNome = nomeCategoria(tx.categoria);
            // Ícone: prioriza a marca da descrição (ex.: "Shopee", "Spotify")
            const iconeNome = tx.observacao && temMarcaConhecida(tx.observacao) ? tx.observacao : catNome;
            return (
              <div key={tx.id || i}
                   className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors animate-fade-in"
                   // content-visibility: pula render das linhas fora da tela (lista longa).
                   style={{ animationDelay: `${i * 30}ms`, contentVisibility: 'auto', containIntrinsicSize: 'auto 60px' }}>
                <CategoriaIcon
                  nome={iconeNome}
                  icone={theme.emoji}
                  bg={theme.bg}
                  color={theme.color}
                  size={36}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {tx.observacao || nomeCategoria(tx.categoria)}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground tabular">
                      {fmtDataBR(tx.data, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                    {/* ⚠️ O ATRASO ERA INVISÍVEL. A linha mostrava só a data
                        crua, em cinza: uma conta vencida há duas semanas ficava
                        idêntica a uma que vence mês que vem. Ícone + texto,
                        nunca só a cor. */}
                    {(() => {
                      const s = situacaoPendente(tx.data);
                      if (!s) return null;
                      return (
                        <span className="text-[10px] font-bold inline-flex items-center gap-1"
                              style={{ color: s.cor }}>
                          {s.alerta && <AlertTriangle size={9} />}
                          {s.txt}
                        </span>
                      );
                    })()}
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-[10px] font-medium" style={{ color: theme.color }}>
                      {nomeCategoria(tx.categoria)}
                    </span>
                    {compartilhado && tx.criador && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground min-w-0">
                          <AvatarMembro name={tx.criador.name} src={tx.criador.avatar_url} preset={tx.criador.avatar_preset} cor={tx.criador.avatar_cor} size="sm" />
                          <span className="truncate">{(tx.criador.name || '').split(' ')[0]}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <p className={`text-sm font-bold tabular flex-shrink-0 ${
                  positive ? 'text-green-600 dark:text-green-400' : 'text-red-500'
                }`}>
                  {positive ? '+' : '−'}{fmt(tx.valor)}
                </p>
                {/* A ação que faltava: a tela listava o que está pendente e não
                    deixava resolver — pra dar baixa era preciso ir até
                    Transações, achar a linha e editar. */}
                {onBaixar && (
                  <button
                    onClick={() => onBaixar(tx)}
                    aria-label={`Marcar "${tx.observacao || nomeCategoria(tx.categoria)}" como ${positive ? 'recebido' : 'pago'}`}
                    title={positive ? 'Marcar como recebido' : 'Marcar como pago'}
                    className="w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0
                               text-muted-foreground hover:text-green-600 hover:bg-green-500/10 transition-colors active:scale-90"
                  >
                    <CheckCircle2 size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
