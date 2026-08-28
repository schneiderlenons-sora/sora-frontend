'use client';

// =============================================================================
// DRE gerencial.
//
// A tela é organizada pela pergunta, não pela contabilidade:
//   1. Sobrou ou faltou dinheiro?          → resultado do mês
//   2. Quanto preciso vender pra empatar?  → ponto de equilíbrio
//   3. Onde o dinheiro foi parar?          → cascata expansível
//   4. Estou melhorando?                   → indicadores + histórico
//
// A cascata mostra o PESO de cada linha em barra: um número ao lado do outro
// não diz que o aluguel come metade do lucro bruto — a barra diz de relance.
//
// Cada linha traz uma frase de ajuda porque a maioria dos donos nunca leu um
// DRE. Relatório que não ensina a lê-lo é relatório que ninguém usa.
// =============================================================================

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useEmpresa } from '@/components/negocios/EmpresaContext';
import ModalConfigTributaria from '@/components/negocios/ModalConfigTributaria';
import { corEmpresa } from '@/lib/empresas';
import { cascata, csvDre, type DreGerencial } from '@/lib/dre';
import {
  ChevronRight, Calendar, Download, RefreshCw, Landmark, Target,
  TrendingUp, TrendingDown, Info, Printer, Boxes, Loader2,
} from 'lucide-react';

const GraficoEvolucao = dynamic(() => import('@/components/negocios/GraficoEvolucao'), {
  ssr: false,
  // Mesma altura do gráfico real — skeleton menor faz a página saltar ao montar.
  loading: () => <div className="h-[260px] rounded-2xl bg-muted/40 animate-pulse" />,
});

const RED = '#ef4444';
const MES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const mesLabel = (iso: string) => {
  const [a, m] = iso.split('-');
  return `${MES_NOMES[parseInt(m, 10) - 1]} de ${a}`;
};
const fmt = (c: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((c || 0) / 100);

export default function DrePage() {
  const { temNegocios, phone } = useAuth();
  const { empresa } = useEmpresa();
  const cor = corEmpresa(empresa);

  const [periodo, setPeriodo] = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7));
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [modalImposto, setModalImposto] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  const { data, mutate, isLoading } = useApi(
    (phone && temNegocios && empresa) ? `negdre2:${empresa.id}:${periodo}` : null,
    () => api.negocios.dre.gerencial(phone, periodo, empresa!.id),
  );
  const dre = (data ?? null) as DreGerencial | null;

  const opcoes = useMemo(() => {
    const out: { v: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      const v = d.toLocaleDateString('en-CA').slice(0, 7);
      out.push({ v, label: mesLabel(v) });
    }
    return out;
  }, []);

  const linhas = useMemo(() => (dre ? cascata(dre) : []), [dre]);

  async function atualizar() {
    setAtualizando(true);
    try { await api.negocios.dre.recalcular({ phone, periodo, empresa_id: empresa?.id }); await mutate(); }
    finally { setAtualizando(false); }
  }

  function exportar() {
    if (!dre) return;
    const blob = new Blob(['﻿' + csvDre(dre, empresa?.nome || 'Negócio')],
                          { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dre-${periodo}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!temNegocios) {
    return <p className="max-w-md mx-auto pt-20 text-center text-sm text-muted-foreground">
      Disponível no plano Platinum.
    </p>;
  }

  if (isLoading) return <Esqueleto />;

  if (!dre) {
    return (
      <div className="max-w-md mx-auto pt-16 text-center">
        <p className="text-base font-bold text-foreground">Sem dados para o DRE</p>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre uma empresa e registre movimentações no caixa — o demonstrativo se monta sozinho.
        </p>
      </div>
    );
  }

  const positivo = dre.lucro_liquido >= 0;
  const corResultado = positivo ? cor : RED;
  const antLucro = dre.anterior?.lucro_liquido;
  const delta = (antLucro != null && antLucro !== 0)
    ? ((dre.lucro_liquido - antLucro) / Math.abs(antLucro)) * 100 : null;

  // Escala das barras: proporção sobre a maior linha, pra comparação visual.
  const maior = Math.max(...linhas.map(l => Math.abs(l.valor)), 1);

  const historico = (dre.historico || []).map(h => ({
    mes: h.periodo,
    receita: h.receita_bruta,
    despesa: h.custos_total,
    lucro: h.lucro_liquido,
  }));

  return (
    <div className="pb-24 space-y-5">
      {/* Impressão: leva só o demonstrativo, sem sidebar nem botões. */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #dre-print, #dre-print * { visibility: visible; }
          #dre-print { position: absolute; left: 0; top: 0; width: 100%; }
          .nao-imprime { display: none !important; }
        }
      `}</style>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground truncate">
            {empresa?.nome || 'Negócios'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-0.5">DRE</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mesLabel(periodo)}
            {dre.em_curso && <span className="ml-1.5 text-[11px] font-bold" style={{ color: cor }}>· mês em curso</span>}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap nao-imprime">
          <div className="relative">
            <select value={periodo} onChange={e => setPeriodo(e.target.value)} aria-label="Período"
                    className="appearance-none cursor-pointer pl-9 pr-8 h-11 rounded-xl text-xs font-bold bg-card border border-border"
                    style={{ minHeight: 44 }}>
              {opcoes.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
            <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          </div>
          <Acao onClick={() => setModalImposto(true)} icone={<Landmark size={14} />} label="Impostos" />
          <Acao onClick={exportar} icone={<Download size={14} />} label="CSV" />
          <Acao onClick={() => window.print()} icone={<Printer size={14} />} label="Imprimir" />
          <Acao onClick={atualizar} icone={atualizando
            ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} label="Atualizar" />
        </div>
      </header>

      <div id="dre-print" className="space-y-5">

        {/* 1. Sobrou ou faltou? */}
        <section className="rounded-3xl border border-border bg-card p-5 sm:p-6"
                 style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${corResultado} 7%, hsl(var(--card))) 0%, hsl(var(--card)) 60%)` }}>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {positivo ? 'Sobrou no mês' : 'Faltou no mês'}
          </p>
          <p className="text-4xl sm:text-5xl font-bold tabular-nums tracking-tight mt-1"
             style={{ color: corResultado }}>
            {fmt(Math.abs(dre.lucro_liquido))}
          </p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-sm text-muted-foreground">
              margem de <b className="text-foreground tabular-nums">{dre.margem_pct.toFixed(1)}%</b>
            </span>
            {delta != null && (
              // Direção e significado são coisas diferentes: cair o prejuízo é
              // seta pra baixo e notícia boa. A cor segue o resultado, não a seta.
              <span className="inline-flex items-center gap-1 text-sm font-bold tabular-nums"
                    style={{ color: delta >= 0 ? cor : RED }}>
                {delta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {delta >= 0 ? '+' : ''}{delta.toFixed(0)}% vs mês anterior
              </span>
            )}
          </div>
        </section>

        {/* 2. Quanto preciso vender pra empatar? */}
        <PontoEquilibrio dre={dre} cor={cor} />

        {/* 3. Onde o dinheiro foi parar? */}
        <section className="rounded-3xl border border-border bg-card overflow-hidden">
          {linhas.map(l => {
            const aberta = abertos.has(l.key);
            const temDetalhe = (l.detalhe?.length || 0) > 0;
            const negativa = l.tipo === 'deducao';
            const corLinha = negativa ? RED
                           : l.tipo === 'resultado' ? corResultado
                           : 'hsl(var(--foreground))';
            const largura = Math.max(2, (Math.abs(l.valor) / maior) * 100);

            return (
              <div key={l.key} className={`border-b border-border/50 last:border-0 ${
                l.tipo === 'resultado' ? 'bg-foreground/[0.035]' : ''}`}>
                <button onClick={() => temDetalhe && setAbertos(s => {
                          const n = new Set(s);
                          if (n.has(l.key)) n.delete(l.key); else n.add(l.key);
                          return n;
                        })}
                        disabled={!temDetalhe} aria-expanded={temDetalhe ? aberta : undefined}
                        className={`w-full text-left px-4 sm:px-5 py-3.5 ${temDetalhe ? 'hover:bg-muted/30' : 'cursor-default'} transition-colors`}
                        style={{ minHeight: 44 }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 min-w-0">
                      {temDetalhe
                        ? <ChevronRight size={14} className={`text-muted-foreground transition-transform flex-shrink-0 ${aberta ? 'rotate-90' : ''}`} />
                        : <span className="w-[14px] flex-shrink-0" />}
                      <span className={`truncate ${l.tipo === 'deducao'
                        ? 'text-sm text-muted-foreground' : 'text-sm font-bold text-foreground'}`}>
                        {negativa ? '(−) ' : ''}{l.label}
                      </span>
                    </span>
                    <span className={`font-bold tabular-nums flex-shrink-0 ${
                      l.tipo === 'resultado' ? 'text-xl' : 'text-sm'}`} style={{ color: corLinha }}>
                      {negativa ? '−' : ''}{fmt(Math.abs(l.valor))}
                    </span>
                  </div>

                  {/* Peso da linha: o que a coluna de números não conta */}
                  <div className="h-1 rounded-full bg-muted mt-2 ml-[22px] overflow-hidden">
                    <div className="h-full rounded-full transition-[width] duration-500"
                         style={{ width: `${largura}%`, background: corLinha, opacity: negativa ? 0.55 : 0.85 }} />
                  </div>

                  {l.ajuda && (
                    <p className="text-[11px] text-muted-foreground mt-1.5 ml-[22px] leading-snug">{l.ajuda}</p>
                  )}
                </button>

                {aberta && temDetalhe && (
                  <ul className="bg-muted/25 border-t border-border/40">
                    {l.detalhe!.map((b, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 pl-11 pr-5 py-2">
                        <span className="text-xs text-foreground truncate">
                          {b.label}{b.meta && <span className="text-muted-foreground"> · {b.meta}</span>}
                        </span>
                        <span className="text-xs font-semibold tabular-nums text-foreground flex-shrink-0">
                          {fmt(b.valor)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>

        {/* Compra de estoque: a pergunta nº 1 de quem abastece a loja */}
        {dre.compras_estoque > 0 && (
          <section className="rounded-2xl border border-dashed border-border p-4 flex items-start gap-3">
            <Boxes size={17} className="text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Você comprou <b className="text-foreground tabular-nums">{fmt(dre.compras_estoque)}</b> em mercadoria
              neste mês. Isso <b className="text-foreground">saiu do caixa, mas não é despesa</b> — virou estoque
              e só entra no resultado quando o item for vendido. É por isso que o dinheiro na conta pode estar
              menor que o lucro.
            </p>
          </section>
        )}

        {/* 4. Estou melhorando? */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Indicador label="Margem bruta" valor={`${dre.margem_bruta_pct.toFixed(1)}%`}
                     nota="sobra depois do custo do produto" />
          <Indicador label="Margem líquida" valor={`${dre.margem_pct.toFixed(1)}%`}
                     nota="sobra depois de tudo" accent={corResultado} />
          <Indicador label="Ticket médio" valor={fmt(dre.ticket_medio)}
                     nota={`${dre.total_vendas} ${dre.total_vendas === 1 ? 'venda' : 'vendas'}`} />
          <Indicador label="Custo fixo" valor={fmt(dre.despesas_fixas)}
                     nota="a loja custa isso parada" />
        </section>

        <section className="rounded-3xl border border-border bg-card p-4 sm:p-5">
          <h2 className="text-sm font-bold text-foreground mb-1">Últimos 6 meses</h2>
          <p className="text-[11px] text-muted-foreground mb-3">Receita, despesa e o que sobrou</p>
          <GraficoEvolucao dados={historico} cor={cor} />
        </section>
      </div>

      {modalImposto && (
        <ModalConfigTributaria onClose={() => { setModalImposto(false); mutate(); }} />
      )}
    </div>
  );
}

// ── Ponto de equilíbrio ─────────────────────────────────────────────────────
// O número que o dono de comércio pequeno mais precisa e quase nunca tem.
function PontoEquilibrio({ dre, cor }: { dre: DreGerencial; cor: string }) {
  const pe = dre.ponto_equilibrio;

  if (pe == null) {
    // Honesto sobre o motivo: um "R$ 0,00" aqui leria como "já empatou".
    const semReceita = dre.receita_bruta <= 0;
    return (
      <section className="rounded-3xl border border-dashed border-border p-5 flex items-start gap-3">
        <Target size={18} className="text-muted-foreground flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-foreground">Ponto de equilíbrio indisponível</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {semReceita
              ? 'Ainda não há venda no período — sem faturamento não dá pra medir quanto sobra de cada real vendido.'
              : 'O custo dos produtos e as despesas variáveis estão consumindo tudo que entra. Nenhum volume de venda cobre o custo fixo assim: o caminho é preço ou custo, não quantidade.'}
          </p>
        </div>
      </section>
    );
  }

  const progresso = Math.min(100, (dre.receita_bruta / pe) * 100);
  const bateu = dre.receita_bruta >= pe;
  const falta = dre.falta_para_empatar ?? Math.max(0, pe - dre.receita_bruta);

  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Target size={12} /> Ponto de equilíbrio
          </p>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground mt-1">{fmt(pe)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">é o quanto precisa faturar pra não perder dinheiro</p>
        </div>
        {/* Ícone + texto, nunca só a cor */}
        <span className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-bold flex-shrink-0"
              style={{
                background: `color-mix(in srgb, ${bateu ? cor : '#f59e0b'} 14%, transparent)`,
                color: bateu ? cor : '#b45309',
              }}>
          {bateu ? '✓ já passou' : `faltam ${fmt(falta)}`}
        </span>
      </div>

      <div className="h-2.5 rounded-full bg-muted mt-4 overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-700"
             style={{ width: `${progresso}%`, background: bateu ? cor : '#f59e0b' }} />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] text-muted-foreground tabular-nums">
          faturou {fmt(dre.receita_bruta)}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{progresso.toFixed(0)}%</span>
      </div>

      <p className="text-[11px] text-muted-foreground mt-3 flex items-start gap-1.5 leading-relaxed">
        <Info size={12} className="flex-shrink-0 mt-0.5" />
        Cada R$ 1,00 vendido deixa <b className="text-foreground">
          {((dre.margem_contribuicao_pct ?? 0) / 100).toFixed(2).replace('.', ',')}
        </b> pra pagar o custo fixo de <b className="text-foreground">{fmt(dre.despesas_fixas)}</b>.
      </p>
    </section>
  );
}

function Indicador({ label, valor, nota, accent }: {
  label: string; valor: string; nota?: string; accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums tracking-tight mt-1" style={{ color: accent }}>{valor}</p>
      {nota && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{nota}</p>}
    </div>
  );
}

function Acao({ onClick, icone, label }: { onClick: () => void; icone: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
            className="inline-flex items-center gap-1.5 h-11 px-3.5 rounded-xl text-xs font-bold bg-card border border-border hover:bg-muted/60 transition-colors"
            style={{ minHeight: 44 }}>
      {icone} {label}
    </button>
  );
}

function Esqueleto() {
  return (
    <div className="space-y-5 animate-pulse" aria-busy="true">
      <div className="h-9 w-36 rounded-xl bg-muted" />
      <div className="h-36 rounded-3xl bg-muted/60" />
      <div className="h-32 rounded-3xl bg-muted/60" />
      <div className="h-80 rounded-3xl bg-muted/60" />
    </div>
  );
}
