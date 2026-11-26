'use client';

// =============================================================================
// ABA "CONTAS" DOS PREVISTOS — contas a pagar e a receber do mês.
//
// Pedido de cliente (Fábio, nov/2026), vindo do Gestor Money. Decisões do dono:
// aba dentro de Previstos, abre no mês atual, entram fatura e parcela de dívida,
// com opção de esconder as faturas.
//
// ⚠️ A LISTA SAI DE `lib/contas-do-mes.ts` (eval:contas-do-mes), que usa o
// MESMO motor do Extrato Futuro. E cada "Paguei" abre o fluxo que JÁ existe pra
// aquele tipo — nenhuma regra nova de saldo:
//   · conta fixa → a baixa dos Previstos (`acaoExtrato`: quitar/pular); em conta
//     do banco que só prevê, aponta o lançamento (SeletorPagamento);
//   · fatura → o "Pagar fatura" de Cartões;
//   · parcela de dívida → o "Pagar parcela" de Dívidas;
//   · lançamento pendente → marca como pago (o PUT já acerta o saldo).
// =============================================================================

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import useSWR, { useSWRConfig } from 'swr';
import {
  ChevronLeft, ChevronRight, Search, X, Receipt, CreditCard, Landmark, CalendarDays,
  Check, Loader2, SkipForward, Plus, AlertTriangle, Eye, EyeOff, Clock,
} from 'lucide-react';
import { api, type FaturaCartao } from '@/lib/api';
import { chave } from '@/lib/chaves-swr';
import { useDinheiro, useMoedaBase } from '@/lib/moeda-base';
import { faturaNaBase } from '@/lib/moeda';
import { hojeSP } from '@/lib/frequencia-recorrencia';
import { parseNumeroDigitado } from '@/lib/formato-br';
import { somarMeses, ymHojeSP } from '@/lib/previstos';
import { pendenciasAnteriores, MESES_PADRAO as MESES_ATRASADOS } from '@/lib/previstos-atrasados';
import {
  montarContasDoMes, filtrarContas, totaisContas, type ItemConta, type FiltroStatus, type FaturaConta,
} from '@/lib/contas-do-mes';
import { baixaPrecisaVincular } from '@/lib/baixa-previsto';
import type { AcaoOcorrencia } from '@/components/previstos/ExtratoFuturo';
import SeletorPagamento from '@/components/previstos/SeletorPagamento';
import PagarFaturaModal from '@/components/cartoes/PagarFaturaModal';
import PagarParcelaModal from '@/components/dividas/PagarParcelaModal';

const VERDE = '#16a34a';
const VERMELHO = '#dc2626';
const AMBAR = '#d97706';
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MAX_MESES = 11;
const chaveFaturas = (userId?: string | null) => `sora-contas-ocultar-faturas:${userId || 'anon'}`;

const ddmm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const nomeMes = (ym: string) => MESES[Number(ym.slice(5, 7)) - 1];
const semana = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'short' }).replace('.', '');

function textoStatus(i: ItemConta, hoje: string): { texto: string; cor: string } {
  if (i.status === 'paga') return { texto: `${i.tipo === 'receber' ? 'Recebido' : 'Pago'} em ${ddmm(i.data)}`, cor: VERDE };
  if (i.status === 'hoje') return { texto: i.tipo === 'receber' ? 'Entra hoje' : 'Vence hoje', cor: AMBAR };
  if (i.status === 'atrasada') {
    const d = i.diasAtraso || 0;
    return { texto: `${i.tipo === 'receber' ? 'Era pra entrar' : 'Venceu'} ${d === 1 ? 'ontem' : `há ${d} dias`} (${ddmm(i.data)})`, cor: VERMELHO };
  }
  const faltam = Math.round((Date.parse(`${i.data}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86400000);
  return { texto: `${faltam === 1 ? 'Amanhã' : `Em ${faltam} dias`} · ${semana(i.data)}, ${ddmm(i.data)}`, cor: 'hsl(var(--muted-foreground))' };
}

const ICONE = { fixa: Receipt, fatura: CreditCard, divida: Landmark, avulsa: CalendarDays } as const;

export default function ContasDoMes({
  phone, userId, recorrencias, dividas, wallets, faturasAtuais, faturasBrutas,
  carteirasBanco, contasPagamento, onAcaoFixa, ocupado, erro, onNovaConta, onMudou,
}: {
  phone: string;
  userId?: string | null;
  recorrencias: any[];
  dividas: any[];
  wallets: any[];
  /** Faturas de `/wallets/faturas` (offset 0) JÁ na moeda do grupo. */
  faturasAtuais: FaturaCartao[];
  /** As mesmas, sem conversão (trazem `atrasadas` na moeda do cartão). */
  faturasBrutas: FaturaCartao[];
  carteirasBanco: string[];
  contasPagamento: { id: string; nome: string }[];
  onAcaoFixa: (a: AcaoOcorrencia) => Promise<void>;
  ocupado: string | null;
  erro: string | null;
  onNovaConta: () => void;
  onMudou: () => void;
}) {
  const fmt = useDinheiro();
  const moedaBase = useMoedaBase();
  const { mutate } = useSWRConfig();
  const ymHoje = ymHojeSP();
  const hoje = hojeSP();

  const [offset, setOffset] = useState(0);
  const mes = somarMeses(ymHoje, offset);
  const ehMesAtual = offset === 0;
  const [aba, setAba] = useState<'pagar' | 'receber' | 'pagas'>('pagar');
  const [status, setStatus] = useState<FiltroStatus>('todas');
  const [busca, setBusca] = useState('');
  // Esconder faturas: escolha da pessoa, lembrada neste aparelho.
  const [ocultarFaturas, setOcultarFaturasState] = useState<boolean>(() => {
    try { return localStorage.getItem(chaveFaturas(userId)) === '1'; } catch { return false; }
  });
  const setOcultarFaturas = (v: boolean) => {
    setOcultarFaturasState(v);
    try { localStorage.setItem(chaveFaturas(userId), v ? '1' : '0'); } catch { /* sem storage: vale só agora */ }
  };

  // ── Dados do mês (chaves canônicas quando existem: o mês atual não custa requisição) ──
  const kTx = chave.transacoes(phone, { mes, limit: 500 });
  const { data: txData } = useSWR(phone ? kTx : null, () => api.transacoes.listar(phone, { mes, limit: 500 }), { revalidateOnFocus: false });
  const kOcorr = `d:contas-ocorr:${phone}:${mes}`;
  const { data: ocorr } = useSWR(phone ? kOcorr : null, () => api.previstos.ocorrencias(phone, mes, mes), { revalidateOnFocus: false });
  // O que ficou em aberto antes do mês (só no mês atual). Mesma chave do Extrato.
  const ymPassadoDe = somarMeses(ymHoje, -MESES_ATRASADOS);
  const kPassado = `d:previstos-passado:${phone}:${ymPassadoDe}`;
  const { data: passado } = useSWR(phone && ehMesAtual ? kPassado : null,
    () => api.previstos.ocorrencias(phone, ymPassadoDe, somarMeses(ymHoje, -1)), { revalidateOnFocus: false });
  // A fatura anterior (pra mostrar a do mês como PAGA quando a atual já é a seguinte).
  const kFatAnt = chave.faturas(phone, -1);
  const { data: fatAnt } = useSWR(phone && ehMesAtual ? kFatAnt : null, () => api.wallets.faturas(phone, -1), { revalidateOnFocus: false });

  const carregando = !txData || !ocorr || (ehMesAtual && (!passado || !fatAnt));

  const contaQuePaga = (cartaoId?: string | null) => {
    const c = wallets.find((w: any) => w.id === cartaoId);
    return c?.conta_pagamento_id ? (wallets.find((w: any) => w.id === c.conta_pagamento_id)?.nome ?? null) : null;
  };
  const paraConta = (f: FaturaCartao): FaturaConta => ({
    cartao_id: f.cartao_id, nome: f.nome, competencia: f.competencia, venc: f.venc,
    restante: f.restante, pago: f.pago, fatura: f.fatura, quitada: !!f.quitada, carteira: contaQuePaga(f.cartao_id),
  });

  const itens = useMemo(() => {
    if (carregando) return [];
    const ant = ((fatAnt as any)?.faturas || []).map((f: FaturaCartao) => faturaNaBase(f, moedaBase)).filter(Boolean) as FaturaCartao[];
    const faturas = [...faturasAtuais, ...ant].map(paraConta);
    // Atrasadas de cartão manual: só quando o cartão é da moeda do grupo (os
    // valores vêm na moeda do cartão e não há conversão por item).
    const atrasadas: FaturaConta[] = [];
    for (const f of faturasBrutas || []) {
      if (f.moeda && moedaBase && String(f.moeda).toUpperCase() !== String(moedaBase).toUpperCase()) continue;
      for (const a of f.atrasadas || []) {
        atrasadas.push({ cartao_id: f.cartao_id, nome: f.nome, competencia: a.competencia, venc: a.venc, restante: a.restante, carteira: contaQuePaga(f.cartao_id) });
      }
    }
    const pendencias = ehMesAtual ? pendenciasAnteriores({
      recorrencias: recorrencias as any, quitacoes: (passado as any)?.quitacoes ?? [], ajustes: (passado as any)?.ajustes ?? [],
      hojeYm: ymHoje, meses: MESES_ATRASADOS,
    }) : [];
    return montarContasDoMes({
      mes, hoje,
      transacoes: (txData as any)?.transacoes ?? [],
      recorrencias,
      dividas: dividas.map((d: any) => ({ ...d, carteira: d.conta_pagamento_id ? (wallets.find((w: any) => w.id === d.conta_pagamento_id)?.nome ?? null) : null })),
      quitacoes: (ocorr as any)?.quitacoes ?? [],
      ajustes: (ocorr as any)?.ajustes ?? [],
      faturas,
      cartoes: wallets.filter((w: any) => w.tipo === 'Crédito').map((w: any) => w.nome),
      anteriores: ehMesAtual ? { fixas: pendencias, faturas: atrasadas } : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, txData, ocorr, passado, fatAnt, faturasAtuais, faturasBrutas, recorrencias, dividas, wallets, mes, hoje, ehMesAtual, moedaBase, ymHoje]);

  const totais = totaisContas(itens, ocultarFaturas);
  const lista = filtrarContas(itens, { aba, status, busca, ocultarFaturas });
  const contagem = (a: 'pagar' | 'receber' | 'pagas') => filtrarContas(itens, { aba: a, ocultarFaturas }).length;
  const temFaturas = itens.some((i) => i.origem === 'fatura');

  // ── Ações ────────────────────────────────────────────────────────────────
  const [pagando, setPagando] = useState<ItemConta | null>(null);        // folha "Paguei" da conta fixa
  const [vinculando, setVinculando] = useState<ItemConta | null>(null);  // conta do banco: apontar o lançamento
  const [fatura, setFatura] = useState<ItemConta | null>(null);
  const [parcela, setParcela] = useState<ItemConta | null>(null);
  const [avulsa, setAvulsa] = useState<ItemConta | null>(null);
  const [pulando, setPulando] = useState<ItemConta | null>(null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);

  const recarregarAqui = () => Promise.all([mutate(kTx), mutate(kOcorr), mutate(kPassado), mutate(kFatAnt)]);
  const depois = async () => { await recarregarAqui(); onMudou(); };

  const linhaDe = (i: ItemConta) => ({
    data: i.data, tipo: (i.tipo === 'receber' ? 'Recebimento' : 'Gasto') as 'Recebimento' | 'Gasto',
    valor: i.valor, descricao: i.descricao, carteira: i.carteira, origem: 'recorrencia' as const,
    estado: 'previsto' as const, estimado: i.estimado, recorrenciaId: i.recorrenciaId ?? null,
    competencia: i.competencia ?? null, transacaoId: i.transacaoId ?? null,
  });

  function abrirPagamento(i: ItemConta) {
    setErroLocal(null);
    if (i.origem === 'fatura') { setFatura(i); return; }
    if (i.origem === 'divida') { setParcela(i); return; }
    if (i.origem === 'avulsa') { setAvulsa(i); return; }
    const rec = recorrencias.find((r: any) => String(r.id) === String(i.recorrenciaId));
    if (rec && baixaPrecisaVincular(rec, { contaDoBanco: !!i.carteira && carteirasBanco.includes(i.carteira) })) { setVinculando(i); return; }
    setPagando(i);
  }

  async function marcarAvulsaPaga(i: ItemConta) {
    if (!i.transacaoId) return;
    setTrabalhando(true); setErroLocal(null);
    try { await api.transacoes.editar(i.transacaoId, { pago: true }); setAvulsa(null); await depois(); }
    catch (e) { setErroLocal((e as Error)?.message || 'Não consegui marcar agora.'); }
    finally { setTrabalhando(false); }
  }
  async function quitarFixa(i: ItemConta, extra: Partial<AcaoOcorrencia>) {
    setTrabalhando(true);
    try { await onAcaoFixa({ linha: linhaDe(i) as never, acao: 'quitar', ...extra }); setPagando(null); setVinculando(null); await recarregarAqui(); }
    finally { setTrabalhando(false); }
  }
  async function pular(i: ItemConta) {
    setTrabalhando(true);
    try { await onAcaoFixa({ linha: linhaDe(i) as never, acao: 'pular' }); setPulando(null); await recarregarAqui(); }
    finally { setTrabalhando(false); }
  }

  const fatParaPagar = fatura ? faturasAtuais.find((f) => f.cartao_id === fatura.cartaoId) : null;
  const dividaParaPagar = parcela ? dividas.find((d: any) => d.id === parcela.dividaId) : null;

  return (
    <div className="space-y-4">
      {/* ── Mês ── */}
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0}
          aria-label="Mês anterior" className="w-11 h-11 rounded-xl flex items-center justify-center border border-border/60 disabled:opacity-30 hover:bg-muted">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="text-base font-bold text-foreground capitalize">{nomeMes(mes)} <span className="text-muted-foreground font-semibold">{mes.slice(0, 4)}</span></p>
          {!ehMesAtual && (
            <button type="button" onClick={() => setOffset(0)} className="text-[11px] font-semibold text-primary hover:underline">Voltar ao mês atual</button>
          )}
        </div>
        <button type="button" onClick={() => setOffset((o) => Math.min(MAX_MESES, o + 1))} disabled={offset >= MAX_MESES}
          aria-label="Próximo mês" className="w-11 h-11 rounded-xl flex items-center justify-center border border-border/60 disabled:opacity-30 hover:bg-muted">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* ── Totais ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <Total rotulo={`Falta pagar${ehMesAtual ? '' : ` em ${nomeMes(mes)}`}`} valor={fmt(totais.aPagar)} cor={VERMELHO} />
        <Total rotulo={`Falta receber${ehMesAtual ? '' : ` em ${nomeMes(mes)}`}`} valor={fmt(totais.aReceber)} cor={VERDE} />
        <Total rotulo={totais.nAtrasadas ? `${totais.nAtrasadas} ${totais.nAtrasadas === 1 ? 'atrasada' : 'atrasadas'}` : 'Atrasadas'}
               valor={totais.nAtrasadas ? fmt(totais.atrasado) : 'Nenhuma'} cor={totais.nAtrasadas ? VERMELHO : 'hsl(var(--muted-foreground))'}
               className="col-span-2 sm:col-span-1" icone={totais.nAtrasadas ? AlertTriangle : undefined} />
      </div>

      {/* ── Sub-abas ── */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none" role="tablist" aria-label="Contas">
        {([['pagar', 'A pagar'], ['receber', 'A receber'], ['pagas', 'Pagas e recebidas']] as const).map(([id, rotulo]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => { setAba(id); setStatus('todas'); }}
            className={`inline-flex items-center gap-1.5 px-3.5 h-10 rounded-xl text-[13px] font-bold whitespace-nowrap transition-colors ${
              aba === id ? 'bg-foreground text-background' : 'bg-muted/50 text-muted-foreground hover:text-foreground'}`}>
            {rotulo} <span className="tabular-nums opacity-70">{contagem(id)}</span>
          </button>
        ))}
      </div>

      {/* ── Filtros ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {aba !== 'pagas' && (
          <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filtrar por situação">
            {([['todas', 'Todas'], ['atrasadas', 'Atrasadas'], ['hoje', 'Hoje'], ['a_vencer', 'A vencer']] as const).map(([id, rotulo]) => (
              <button key={id} type="button" onClick={() => setStatus(id)} aria-pressed={status === id}
                className={`h-9 px-3 rounded-full text-[11px] font-bold border transition-colors ${
                  status === id ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                {rotulo}
              </button>
            ))}
          </div>
        )}
        {temFaturas && (
          <button type="button" onClick={() => setOcultarFaturas(!ocultarFaturas)} aria-pressed={!ocultarFaturas}
            className="h-9 px-3 rounded-full text-[11px] font-bold border border-border text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
            {ocultarFaturas ? <EyeOff size={13} /> : <Eye size={13} />} {ocultarFaturas ? 'Faturas escondidas' : 'Faturas à vista'}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <label className="flex-1 flex items-center gap-2 h-11 rounded-xl border border-border/60 bg-background px-3 focus-within:border-primary">
          <Search size={15} className="text-muted-foreground flex-shrink-0" aria-hidden />
          <span className="sr-only">Buscar conta</span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar conta…"
                 className="flex-1 min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
          {busca && <button type="button" onClick={() => setBusca('')} aria-label="Limpar busca" className="w-8 h-8 -mr-1 rounded-lg flex items-center justify-center text-muted-foreground"><X size={14} /></button>}
        </label>
        <button type="button" onClick={onNovaConta}
          className="h-11 px-3.5 rounded-xl bg-primary text-white text-sm font-bold inline-flex items-center gap-1.5 flex-shrink-0 active:scale-[0.98]">
          <Plus size={15} /> <span className="hidden sm:inline">Nova conta</span><span className="sm:hidden">Nova</span>
        </button>
      </div>

      {(erro || erroLocal) && <p className="text-xs text-red-600 px-1" role="alert">{erroLocal || erro}</p>}

      {/* ── Lista ── */}
      {carregando ? (
        <div className="space-y-2" aria-busy="true">{[0, 1, 2, 3].map((k) => <div key={k} className="h-[68px] rounded-2xl bg-muted/40 animate-pulse" />)}</div>
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 py-10 px-6 text-center">
          <Check size={22} className="mx-auto" style={{ color: VERDE }} aria-hidden />
          <p className="mt-2 text-sm font-semibold text-foreground">
            {busca ? 'Nada com essa busca.' : aba === 'pagas' ? `Nada pago ainda em ${nomeMes(mes)}.`
              : status !== 'todas' ? 'Nada nessa situação.' : aba === 'pagar' ? `Nada a pagar em ${nomeMes(mes)}.` : `Nada a receber em ${nomeMes(mes)}.`}
          </p>
          {aba !== 'pagas' && !busca && <p className="mt-1 text-xs text-muted-foreground">Contas fixas, faturas, parcelas e lançamentos marcados como não pagos aparecem aqui.</p>}
        </div>
      ) : (
        <ul className="space-y-2">
          {lista.map((i) => {
            const st = textoStatus(i, hoje);
            const Icone = ICONE[i.origem];
            const ocupadoAqui = !!i.recorrenciaId && ocupado === i.recorrenciaId;
            const podePagar = i.status !== 'paga' && !(i.origem === 'fixa' && i.semanal) && !(i.origem === 'avulsa' && !i.transacaoId);
            return (
              <li key={i.chave} className="rounded-2xl border border-border/40 px-3.5 py-3 flex items-center gap-3"
                  style={{ background: 'hsl(var(--bg-card) / 0.5)', ...(i.status === 'atrasada' ? { borderColor: 'color-mix(in srgb, #dc2626 35%, transparent)' } : {}) }}>
                <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `color-mix(in srgb, ${i.tipo === 'receber' ? VERDE : st.cor === VERMELHO ? VERMELHO : '#64748b'} 12%, transparent)` }}>
                  <Icone size={17} style={{ color: i.tipo === 'receber' ? VERDE : st.cor === VERMELHO ? VERMELHO : '#64748b' }} aria-hidden />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{i.descricao}</p>
                  <p className="text-[11.5px] truncate">
                    <span className="font-semibold" style={{ color: st.cor }}>{st.texto}</span>
                    {i.deMesAnterior && <span className="text-muted-foreground"> · de {nomeMes(i.competencia || i.data.slice(0, 7))}</span>}
                    {i.detalhe && <span className="text-muted-foreground"> · {i.detalhe}</span>}
                    {i.carteira && <span className="text-muted-foreground"> · {i.carteira}</span>}
                    {i.origem === 'fixa' && i.semanal && <span className="text-muted-foreground"> · semanal</span>}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-sm font-bold tabular-nums" style={{ color: i.tipo === 'receber' ? VERDE : 'hsl(var(--foreground))' }}>
                    {i.estimado ? '≈ ' : ''}{fmt(i.valor)}
                  </span>
                  {podePagar && (
                    <div className="flex items-center gap-1">
                      {i.origem === 'fixa' && (
                        <button type="button" onClick={() => setPulando(i)} aria-label={`Pular ${i.descricao} este mês`} title="Pular este mês"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted">
                          <SkipForward size={14} />
                        </button>
                      )}
                      <button type="button" onClick={() => abrirPagamento(i)} disabled={ocupadoAqui}
                        className="h-8 px-2.5 rounded-lg text-[11.5px] font-bold text-white inline-flex items-center gap-1 disabled:opacity-60"
                        style={{ background: i.tipo === 'receber' ? VERDE : 'hsl(var(--primary))' }}>
                        {ocupadoAqui ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        {i.tipo === 'receber' ? 'Recebi' : i.origem === 'fatura' || i.origem === 'divida' ? 'Pagar' : 'Paguei'}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!carregando && aba !== 'pagas' && (
        <p className="text-[11px] text-muted-foreground px-1 leading-relaxed">
          <Clock size={11} className="inline -mt-0.5 mr-1" aria-hidden />
          Compras no cartão entram pela fatura. {ehMesAtual ? 'Contas e faturas atrasadas de meses anteriores aparecem até serem pagas.' : 'A fatura de um mês futuro aparece quando ela abre.'}
        </p>
      )}

      {/* ── Folhas e modais (portal: a página tem cards com backdrop-blur) ── */}
      {pagando && (
        <FolhaPaguei item={pagando} hoje={hoje} contas={contasPagamento} trabalhando={trabalhando}
          onFechar={() => setPagando(null)}
          onConfirmar={(d) => quitarFixa(pagando, { data: d.data, valor: d.valor, conta: d.conta })} />
      )}
      {vinculando && phone && (
        <SeletorPagamento phone={phone} titulo={vinculando.descricao} valorPrevisto={vinculando.valor}
          tipo={vinculando.tipo === 'receber' ? 'Recebimento' : 'Gasto'} competencia={vinculando.competencia || mes}
          conta={vinculando.carteira ?? undefined}
          onEscolher={(txId) => quitarFixa(vinculando, { transacaoBanco: txId })}
          onSemLancamento={() => quitarFixa(vinculando, { conta: null })}
          onFechar={() => setVinculando(null)} />
      )}
      {fatura && fatParaPagar && (
        <PagarFaturaModal cartaoId={fatura.cartaoId!} cartaoNome={fatParaPagar.nome} valorFatura={fatura.valor}
          competencia={fatura.competencia || undefined}
          onClose={() => setFatura(null)} onPago={() => { setFatura(null); void depois(); }} />
      )}
      {fatura && !fatParaPagar && (
        <Folha titulo={fatura.descricao} onFechar={() => setFatura(null)}>
          <p className="text-sm text-muted-foreground">Pague esta fatura pela aba <b className="text-foreground">Cartões</b>, no próprio cartão.</p>
        </Folha>
      )}
      {parcela && dividaParaPagar && typeof document !== 'undefined' && createPortal(
        <PagarParcelaModal phone={phone} divida={dividaParaPagar}
          onClose={() => setParcela(null)} onSuccess={() => { setParcela(null); void depois(); }} />,
        document.body,
      )}
      {avulsa && (
        <Folha titulo={avulsa.tipo === 'receber' ? 'Marcar como recebido' : 'Marcar como pago'} onFechar={() => setAvulsa(null)}>
          <p className="text-sm text-foreground"><b>{avulsa.descricao}</b> · {fmt(avulsa.valor)}{avulsa.carteira ? ` · ${avulsa.carteira}` : ''}</p>
          <p className="mt-1 text-xs text-muted-foreground">O lançamento passa a contar como {avulsa.tipo === 'receber' ? 'recebido' : 'pago'} na data dele ({ddmm(avulsa.data)}).</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setAvulsa(null)} className="h-11 px-4 rounded-xl text-sm font-semibold text-foreground hover:bg-muted">Cancelar</button>
            <button type="button" onClick={() => void marcarAvulsaPaga(avulsa)} disabled={trabalhando}
              className="h-11 px-4 rounded-xl text-sm font-bold text-white bg-primary inline-flex items-center gap-1.5 disabled:opacity-60">
              {trabalhando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Confirmar
            </button>
          </div>
        </Folha>
      )}
      {pulando && (
        <Folha titulo="Pular este mês?" onFechar={() => setPulando(null)}>
          <p className="text-sm text-foreground"><b>{pulando.descricao}</b> não vai acontecer em {nomeMes(pulando.competencia || mes)}.</p>
          <p className="mt-1 text-xs text-muted-foreground">Ela sai da lista e da previsão deste mês. Se pagou, use “Paguei” em vez disto. Dá pra desfazer no Extrato.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setPulando(null)} className="h-11 px-4 rounded-xl text-sm font-semibold text-foreground hover:bg-muted">Cancelar</button>
            <button type="button" onClick={() => void pular(pulando)} disabled={trabalhando}
              className="h-11 px-4 rounded-xl text-sm font-bold text-white bg-foreground inline-flex items-center gap-1.5 disabled:opacity-60">
              {trabalhando ? <Loader2 size={14} className="animate-spin" /> : <SkipForward size={14} />} Pular
            </button>
          </div>
        </Folha>
      )}
    </div>
  );
}

function Total({ rotulo, valor, cor, className = '', icone: Icone }: { rotulo: string; valor: string; cor: string; className?: string; icone?: typeof AlertTriangle }) {
  return (
    <div className={`rounded-2xl border border-border/40 px-4 py-3 ${className}`} style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <p className="text-[11px] font-semibold text-muted-foreground inline-flex items-center gap-1">{Icone && <Icone size={12} style={{ color: cor }} aria-hidden />}{rotulo}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums tracking-tight" style={{ color: cor }}>{valor}</p>
    </div>
  );
}

function Folha({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center p-4" onClick={onFechar}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-label={titulo}
           className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl border border-border animate-fade-in p-5"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-foreground">{titulo}</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="w-10 h-10 -mr-2 rounded-xl flex items-center justify-center hover:bg-muted"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// "Paguei" de conta fixa: dia, valor e de qual conta saiu (ou de nenhuma).
function FolhaPaguei({ item, hoje, contas, trabalhando, onFechar, onConfirmar }: {
  item: ItemConta; hoje: string; contas: { id: string; nome: string }[]; trabalhando: boolean;
  onFechar: () => void; onConfirmar: (d: { data: string; valor: number; conta: string | null | undefined }) => void;
}) {
  const fmt = useDinheiro();
  const [data, setData] = useState(hoje);
  const [valor, setValor] = useState(String(item.valor.toFixed(2)).replace('.', ','));
  const [conta, setConta] = useState<string>(item.carteira || (contas[0]?.nome ?? ''));
  // Vírgula ou ponto (regra única do painel — nunca parseFloat em campo de valor).
  const numero = parseNumeroDigitado(valor);
  const valido = Number.isFinite(numero) && numero > 0 && data <= hoje;
  const receber = item.tipo === 'receber';
  return (
    <Folha titulo={receber ? 'Recebi' : 'Paguei'} onFechar={onFechar}>
      <p className="text-sm text-foreground"><b>{item.descricao}</b> · previsto {item.estimado ? '≈ ' : ''}{fmt(item.valor)}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground mb-1.5 block">Dia</span>
          <input type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground mb-1.5 block">Valor</span>
          <input value={valor} inputMode="decimal" onChange={(e) => setValor(e.target.value)} className="input tabular-nums" />
        </label>
      </div>
      <label className="block mt-3">
        <span className="text-xs font-semibold text-muted-foreground mb-1.5 block">{receber ? 'Entrou em' : 'Saiu de'}</span>
        <select value={conta} onChange={(e) => setConta(e.target.value)} className="input">
          {contas.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          <option value="">Nenhuma conta (só registrar)</option>
        </select>
      </label>
      {data > hoje && <p className="mt-2 text-xs text-red-600">O dia não pode ser no futuro.</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onFechar} className="h-11 px-4 rounded-xl text-sm font-semibold text-foreground hover:bg-muted">Cancelar</button>
        <button type="button" disabled={!valido || trabalhando}
          onClick={() => onConfirmar({ data, valor: Math.round(numero * 100) / 100, conta: conta === '' ? null : conta })}
          className="h-11 px-4 rounded-xl text-sm font-bold text-white inline-flex items-center gap-1.5 disabled:opacity-50"
          style={{ background: receber ? VERDE : 'hsl(var(--primary))' }}>
          {trabalhando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Confirmar
        </button>
      </div>
    </Folha>
  );
}
