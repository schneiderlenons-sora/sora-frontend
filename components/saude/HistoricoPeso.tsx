'use client';

// Histórico de PESO — pedido de cliente (nov/2026): "opção para colocar
// histórico de peso, com a data do peso". Antes só existia o gráfico de 30
// dias do painel, sem lista, sem corrigir e sem apagar.
//
// - Período: 30 dias · 90 dias · 1 ano · tudo (o servidor filtra).
// - Lista: mais recente primeiro, cada pesagem com a variação em relação à
//   ANTERIOR no tempo (ícone + texto, nunca só cor). Corrigir e apagar.
// - ⚠️ `useSWR` direto, não `useApi`: o `useApi` registra no LoadingGate e a
//   baleia cobriria a página só por trocar o período.

import { useMemo, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import dynamic from 'next/dynamic';
import { Scale, Plus, Pencil, Trash2, TrendingDown, TrendingUp, Minus, Loader2, Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { linhasDoHistorico, variacaoDoPeriodo, fmtKg, fmtDelta, type RegistroPeso } from '@/lib/peso';
import ModalPeso from '@/components/saude/ModalPeso';

const GraficoPeso = dynamic(() => import('@/app/(app)/grow/saude/dashboard/GraficoPeso'), {
  ssr: false,
  loading: () => <div className="w-full h-full rounded-xl bg-muted/30 animate-pulse" />,
});

const BRAND = 'hsl(var(--primary))';
const PERIODOS = [
  { v: 30, l: '30 dias' },
  { v: 90, l: '90 dias' },
  { v: 365, l: '1 ano' },
  { v: 'todos', l: 'Tudo' },
] as const;
type Periodo = (typeof PERIODOS)[number]['v'];
const POR_PAGINA = 10;

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
/** "16 nov" — o ano vai na linha de baixo, junto do dia da semana. */
const diaMes = (iso: string) => `${iso.slice(8, 10)} ${MESES[Number(iso.slice(5, 7)) - 1]}`;
const semanaAno = (iso: string) => `${SEMANA[new Date(`${iso}T12:00:00Z`).getUTCDay()]} · ${iso.slice(0, 4)}`;
/** Pro leitor de tela: "16 de nov de 2026". */
const dataLonga = (iso: string) => `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;

/** Recarrega toda tela de peso (histórico de qualquer período + painel da Saúde). */
export function useRecarregarPesos() {
  const { mutate } = useSWRConfig();
  return () => mutate((k) => typeof k === 'string' && (k.startsWith('saude:pesos:') || k.startsWith('saude:dash:')));
}

export default function HistoricoPeso({ phone }: { phone: string }) {
  const [periodo, setPeriodo] = useState<Periodo>(90);
  const [modal, setModal] = useState<{ registro?: RegistroPeso } | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);   // id com confirmação aberta
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const recarregar = useRecarregarPesos();

  const { data, error, isLoading, mutate: mLista } = useSWR(
    phone ? `saude:pesos:${phone}:${periodo}` : null,
    () => api.saude.pesos.listar(phone, periodo),
    { revalidateOnFocus: false },
  );
  // Todas as datas que já têm peso (pra avisar antes de substituir). O período
  // "tudo" já as tem; nos outros, a lista do período basta pro caso comum.
  const registros: RegistroPeso[] = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const linhas = useMemo(() => linhasDoHistorico(registros), [registros]);
  const variacao = useMemo(() => variacaoDoPeriodo(registros), [registros]);

  const dadosGrafico = useMemo(() => {
    const crono = [...linhas].reverse();
    const anos = new Set(crono.map(l => l.data.slice(0, 4))).size > 1;
    return crono.map(l => ({
      dia: new Date(`${l.data}T12:00:00`).toLocaleDateString('pt-BR', anos
        ? { month: 'short', year: '2-digit' } : { day: '2-digit', month: 'short' }).replace(/\./g, ''),
      peso: l.kg,
    }));
  }, [linhas]);
  const min = dadosGrafico.length ? Math.floor(Math.min(...dadosGrafico.map(d => d.peso)) - 1) : 50;
  const max = dadosGrafico.length ? Math.ceil(Math.max(...dadosGrafico.map(d => d.peso)) + 1) : 100;

  async function apagar(id: string) {
    setOcupado(true); setErro(''); setAviso('');
    // Some da lista NA HORA (a volta do servidor leva 1–2s); se ele recusar, volta.
    mLista((cur) => (Array.isArray(cur) ? cur.filter((r) => r.id !== id) : cur), { revalidate: false });
    setApagando(null);
    try {
      await api.saude.pesos.deletar(id, phone);
      setAviso('Pesagem apagada.');
    } catch (e) {
      setErro((e as Error)?.message || 'Não consegui apagar.');
    } finally {
      setOcupado(false);
      await recarregar();
    }
  }

  const Tendencia = !variacao ? null
    : Math.abs(variacao.delta) < 0.05 ? Minus : variacao.delta < 0 ? TrendingDown : TrendingUp;

  return (
    <section id="peso" aria-labelledby="historico-peso-titulo"
             className="rounded-2xl border border-border/40 backdrop-blur-xl p-5 scroll-mt-24"
             style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Peso</p>
          <h2 id="historico-peso-titulo" className="text-base font-bold text-foreground">Histórico de peso</h2>
          {variacao && Tendencia && (
            <p className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1">
              <Tendencia size={12} aria-hidden />
              {fmtDelta(variacao.delta)} em {variacao.dias} {variacao.dias === 1 ? 'dia' : 'dias'}
            </p>
          )}
        </div>
        <button onClick={() => { setAviso(''); setModal({}); }}
                className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90">
          <Plus size={15} /> Registrar peso
        </button>
      </div>

      {/* Período */}
      <div role="group" aria-label="Período" className="mt-4 inline-flex p-1 rounded-xl bg-muted/50 border border-border/60">
        {PERIODOS.map(p => (
          <button key={String(p.v)} onClick={() => { setPeriodo(p.v); setMostrar(POR_PAGINA); }} aria-pressed={periodo === p.v}
                  className={`h-9 px-3 rounded-lg text-xs font-bold transition-colors ${periodo === p.v ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>
            {p.l}
          </button>
        ))}
      </div>

      {aviso && <p role="status" className="mt-3 text-xs text-foreground rounded-xl bg-primary/10 px-3 py-2">{aviso}</p>}
      {(erro || error) && (
        <p role="alert" className="mt-3 text-xs text-red-600 dark:text-red-400">
          {erro || 'Não consegui carregar o histórico. Ele continua salvo — tente de novo em instantes.'}
        </p>
      )}

      {isLoading ? (
        <div className="h-48 mt-4 rounded-xl bg-muted/30 animate-pulse" aria-busy="true" />
      ) : linhas.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border p-6 text-center">
          <Scale size={22} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">Nenhuma pesagem {periodo === 'todos' ? 'ainda' : 'neste período'}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Registre o peso de hoje ou de qualquer dia que já passou — a data fica do jeito que você escolher.
          </p>
        </div>
      ) : (
        <>
          {dadosGrafico.length > 1 && (
            <div className="h-48 mt-4">
              <GraficoPeso data={dadosGrafico} cor={BRAND} min={min} max={max} />
            </div>
          )}

          <ul className="mt-4 divide-y divide-border/50">
            {linhas.slice(0, mostrar).map(l => {
              const confirmando = apagando === l.id;
              const Icone = l.delta == null ? null : Math.abs(l.delta) < 0.05 ? Minus : l.delta < 0 ? TrendingDown : TrendingUp;
              return (
                <li key={l.id} className="py-2.5 flex items-center gap-3">
                  <div className="w-20 sm:w-24 flex-shrink-0">
                    <p className="text-sm font-semibold text-foreground tabular whitespace-nowrap">{diaMes(l.data)}</p>
                    <p className="text-[11px] text-muted-foreground whitespace-nowrap">{semanaAno(l.data)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-foreground tabular">{fmtKg(l.kg)} kg</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {Icone && l.delta != null && (
                        <span className="inline-flex items-center gap-0.5 mr-1.5">
                          <Icone size={11} aria-hidden /> {fmtDelta(l.delta)}
                          {l.diasDesde != null && <> em {l.diasDesde} {l.diasDesde === 1 ? 'dia' : 'dias'}</>}
                        </span>
                      )}
                      {l.observacao ? <span>{Icone && l.delta != null ? '· ' : ''}{l.observacao}</span> : null}
                    </p>
                  </div>
                  {confirmando ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[11px] text-muted-foreground mr-1 hidden sm:inline">Apagar?</span>
                      <button onClick={() => apagar(l.id)} disabled={ocupado} aria-label={`Confirmar: apagar a pesagem de ${dataLonga(l.data)}`}
                              className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-600 text-white disabled:opacity-60">
                        {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />}
                      </button>
                      <button onClick={() => setApagando(null)} aria-label="Cancelar"
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted">
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => { setAviso(''); setModal({ registro: l }); }} aria-label={`Corrigir a pesagem de ${dataLonga(l.data)}`}
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => { setAviso(''); setApagando(l.id); }} aria-label={`Apagar a pesagem de ${dataLonga(l.data)}`}
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {linhas.length > mostrar && (
            <button onClick={() => setMostrar(m => m + POR_PAGINA)}
                    className="mt-2 w-full h-11 rounded-xl text-sm font-semibold text-primary hover:bg-muted/50">
              Ver mais {Math.min(POR_PAGINA, linhas.length - mostrar)} de {linhas.length - mostrar}
            </button>
          )}
        </>
      )}

      {modal && (
        <ModalPeso
          phone={phone}
          registro={modal.registro}
          datasComPeso={registros.map(r => r.data)}
          onClose={() => setModal(null)}
          onSuccess={async (msg) => { setModal(null); if (msg) setAviso(msg); await recarregar(); }}
        />
      )}
    </section>
  );
}
