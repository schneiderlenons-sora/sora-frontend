'use client';

// =============================================================================
// Contas a RECEBER — o lado que faltava.
//
// Não existe tabela própria: recebível é `lancamentos_negocio` com
// tipo='entrada' e status='pendente', o espelho exato de "conta a pagar =
// saída pendente". Uma tabela paralela seria uma segunda máquina pro mesmo
// fato (baixa, vencimento, conta, DRE) e duas chances de divergir.
//
// A tela é ordenada por URGÊNCIA, não por data: o que já venceu vem primeiro.
// Em ordem cronológica pura, a cobrança atrasada some no meio da lista — e é
// justamente ela que precisa de ação hoje.
// =============================================================================

import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useEmpresa } from '@/components/negocios/EmpresaContext';
import ModalLancamento from '@/components/negocios/ModalLancamento';
import { corEmpresa } from '@/lib/empresas';
import { fmtCent, labelCategoria, type Lancamento } from '@/lib/lancamentos';
import {
  HandCoins, Plus, AlertTriangle, CalendarClock, Check, Loader2,
  MessageCircle, Inbox, ChevronRight,
} from 'lucide-react';

const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

const diaMes = (iso?: string | null) => {
  if (!iso) return 'sem data';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
};

/** Dias até o vencimento (negativo = venceu há N dias). */
function diasAte(iso?: string | null): number | null {
  if (!iso) return null;
  const a = new Date(`${iso.slice(0, 10)}T12:00:00Z`).getTime();
  const b = new Date(`${hojeSP()}T12:00:00Z`).getTime();
  return Math.round((a - b) / 86400000);
}

export default function ReceberPage() {
  const { phone, temNegocios } = useAuth();
  const { empresa, carregando: carregandoEmpresa } = useEmpresa();
  const cor = corEmpresa(empresa);

  const [modalNovo, setModalNovo] = useState(false);
  const [baixando, setBaixando]   = useState<string | null>(null);

  const { data, mutate, isLoading } = useApi(
    (phone && temNegocios && empresa) ? `neg:receber:${phone}:${empresa.id}` : null,
    () => api.negocios.lancamentos.listar(phone, {
      empresa_id: empresa!.id, status: 'pendente', tipo: 'entrada',
    }),
  );

  const lista: Lancamento[] = useMemo(() => Array.isArray(data) ? data : [], [data]);

  // Urgência primeiro: vencido → vence hoje → a vencer → sem data.
  const { vencidos, hoje, futuros, semData, total, totalVencido } = useMemo(() => {
    const v: Lancamento[] = [], h: Lancamento[] = [], f: Lancamento[] = [], s: Lancamento[] = [];
    for (const l of lista) {
      const d = diasAte(l.vencimento);
      if (d === null) s.push(l);
      else if (d < 0) v.push(l);
      else if (d === 0) h.push(l);
      else f.push(l);
    }
    const soma = (arr: Lancamento[]) => arr.reduce((acc, l) => acc + (l.valor || 0), 0);
    return {
      vencidos: v, hoje: h, futuros: f, semData: s,
      total: soma(lista), totalVencido: soma(v),
    };
  }, [lista]);

  async function receber(l: Lancamento) {
    if (baixando) return;
    setBaixando(l.id);
    try {
      // Otimista: some da lista na hora. Errou? o revalidate traz de volta.
      mutate((cur: any) => (cur || []).filter((x: Lancamento) => x.id !== l.id), { revalidate: false });
      await api.negocios.lancamentos.editar(l.id, { status: 'pago', pago_em: hojeSP() });
    } catch {
      /* volta ao estado real */
    } finally {
      setBaixando(null);
      mutate();
    }
  }

  if (!temNegocios) {
    return <p className="text-sm text-muted-foreground py-20 text-center">Recurso do plano Platinum.</p>;
  }

  const carregando = carregandoEmpresa || isLoading;

  return (
    <div className="pb-20 space-y-5">
      {/* Cabeçalho */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground truncate">
            {empresa?.nome || 'Negócios'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mt-0.5">A receber</h1>
          <p className="text-sm text-muted-foreground mt-1">Quem ainda tem que te pagar</p>
        </div>
        <button onClick={() => setModalNovo(true)}
          className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl text-white text-sm font-bold shadow-sm transition-transform active:scale-[0.98]"
          style={{ background: cor, minHeight: 44 }}>
          <Plus size={16} /> Novo recebimento
        </button>
      </header>

      {/* Totais */}
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total em aberto</p>
          <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{fmtCent(total)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {lista.length} cobrança{lista.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="rounded-2xl border p-4"
             style={totalVencido > 0
               ? { borderColor: 'color-mix(in srgb, #ef4444 35%, transparent)', background: 'color-mix(in srgb, #ef4444 7%, transparent)' }
               : { borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-card))' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: totalVencido > 0 ? '#ef4444' : undefined }}>
            Vencido
          </p>
          <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: totalVencido > 0 ? '#ef4444' : 'hsl(var(--foreground))' }}>
            {fmtCent(totalVencido)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {vencidos.length === 0 ? 'nada atrasado' : `${vencidos.length} atrasada${vencidos.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </section>

      {carregando ? (
        <Esqueleto />
      ) : lista.length === 0 ? (
        <VazioReceber cor={cor} onCriar={() => setModalNovo(true)} />
      ) : (
        <div className="space-y-5">
          <Grupo titulo="Vencidas" itens={vencidos} tom="#ef4444" alerta
                 onReceber={receber} baixando={baixando} cor={cor} />
          <Grupo titulo="Vencem hoje" itens={hoje} tom="#f59e0b"
                 onReceber={receber} baixando={baixando} cor={cor} />
          <Grupo titulo="A vencer" itens={futuros} tom={cor}
                 onReceber={receber} baixando={baixando} cor={cor} />
          <Grupo titulo="Sem data de vencimento" itens={semData} tom="#71717a"
                 onReceber={receber} baixando={baixando} cor={cor} />
        </div>
      )}

      {modalNovo && empresa && (
        <ModalLancamento
          empresaId={empresa.id}
          cor={cor}
          tipoInicial="entrada"
          onClose={() => setModalNovo(false)}
          onSalvo={() => { setModalNovo(false); mutate(); }}
        />
      )}
    </div>
  );
}

/* ── Peças ─────────────────────────────────────────────────────── */

function Grupo({ titulo, itens, tom, alerta, onReceber, baixando, cor }: {
  titulo: string; itens: Lancamento[]; tom: string; alerta?: boolean;
  onReceber: (l: Lancamento) => void; baixando: string | null; cor: string;
}) {
  if (!itens.length) return null;
  const total = itens.reduce((s, l) => s + (l.valor || 0), 0);
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-2 px-1">
        <h2 className="text-sm font-bold flex items-center gap-1.5" style={{ color: alerta ? tom : 'hsl(var(--foreground))' }}>
          {alerta && <AlertTriangle size={14} />}
          {titulo}
          <span className="text-xs font-normal text-muted-foreground">({itens.length})</span>
        </h2>
        <span className="text-sm font-bold tabular-nums text-foreground">{fmtCent(total)}</span>
      </div>
      <ul className="space-y-2">
        {itens.map(l => (
          <LinhaReceber key={l.id} l={l} tom={tom} onReceber={onReceber} baixando={baixando} cor={cor} />
        ))}
      </ul>
    </section>
  );
}

function LinhaReceber({ l, tom, onReceber, baixando, cor }: {
  l: Lancamento; tom: string; onReceber: (l: Lancamento) => void; baixando: string | null; cor: string;
}) {
  const dias = diasAte(l.vencimento);
  const atrasada = dias !== null && dias < 0;
  const ocupado = baixando === l.id;

  // Cobrar por WhatsApp: o canal que o cliente responde. Sem número, o botão
  // não aparece (link vazio seria pior que ausência).
  const zap = (l.contraparte || '').replace(/\D/g, '');
  const linkZap = zap.length >= 10
    ? `https://wa.me/${zap.length <= 11 ? `55${zap}` : zap}?text=${encodeURIComponent(
        `Oi! Passando pra lembrar do pagamento de ${fmtCent(l.valor)}` +
        (l.vencimento ? ` com vencimento em ${diaMes(l.vencimento)}` : '') + '. 🙂')}`
    : null;

  return (
    <li className="rounded-2xl border border-border bg-card p-3.5 flex items-center gap-3">
      <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${tom} 14%, transparent)` }}>
        <HandCoins size={17} style={{ color: tom }} />
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{l.descricao}</p>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5 flex-wrap">
          {l.contraparte && <span className="truncate max-w-[140px]">{l.contraparte}</span>}
          <span className="inline-flex items-center gap-1">
            <CalendarClock size={10} />
            {diaMes(l.vencimento)}
            {/* Estado em TEXTO, não só na cor — quem não distingue contraste
                precisa saber que está atrasado. */}
            {atrasada && <b style={{ color: '#ef4444' }}>· {Math.abs(dias!)}d de atraso</b>}
            {dias === 0 && <b style={{ color: '#f59e0b' }}>· hoje</b>}
          </span>
          {l.categoria && <span className="hidden sm:inline">· {labelCategoria('entrada', l.categoria)}</span>}
        </p>
      </div>

      <span className="text-sm font-bold tabular-nums text-foreground flex-shrink-0">{fmtCent(l.valor)}</span>

      <div className="flex items-center gap-1 flex-shrink-0">
        {linkZap && (
          <a href={linkZap} target="_blank" rel="noreferrer"
             aria-label={`Cobrar ${l.contraparte} no WhatsApp`}
             className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
             style={{ minWidth: 40, minHeight: 40 }}>
            <MessageCircle size={16} />
          </a>
        )}
        <button onClick={() => onReceber(l)} disabled={ocupado}
          aria-label={`Marcar ${l.descricao} como recebido`}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-transform active:scale-90 disabled:opacity-60"
          style={{ background: cor, minWidth: 40, minHeight: 40 }}>
          {ocupado ? <Loader2 size={16} className="animate-spin" /> : <Check size={17} />}
        </button>
      </div>
    </li>
  );
}

function VazioReceber({ cor, onCriar }: { cor: string; onCriar: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-border p-10 text-center">
      <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
            style={{ background: `color-mix(in srgb, ${cor} 12%, transparent)` }}>
        <Inbox size={24} style={{ color: cor }} />
      </span>
      <p className="text-base font-bold text-foreground">Ninguém te devendo</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
        Quando você vender a prazo, registre aqui com a data que combinou de
        receber — a Sora avisa quando estiver perto de vencer.
      </p>
      <button onClick={onCriar}
        className="mt-4 inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl text-white text-sm font-bold"
        style={{ background: cor, minHeight: 44 }}>
        <Plus size={16} /> Registrar cobrança
      </button>
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="space-y-2 animate-pulse" aria-busy="true">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="rounded-2xl border border-border bg-card p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 rounded bg-muted" style={{ width: `${60 - i * 6}%` }} />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
          <div className="h-4 w-16 rounded bg-muted flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}
