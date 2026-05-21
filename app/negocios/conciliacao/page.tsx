'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  ArrowLeft, Loader2, ArrowRight, Check, X, Link2, Unlink,
  Sparkles, ShieldCheck, Info,
} from 'lucide-react';

const BRAND = '#61ce70';

const NOMES_PLAT: Record<string, string> = {
  hotmart: 'Hotmart', kiwify: 'Kiwify', eduzz: 'Eduzz',
  stripe: 'Stripe', mercadopago: 'Mercado Pago',
};
const CORES_PLAT: Record<string, string> = {
  hotmart: '#f04e23', kiwify: '#0066ff', eduzz: '#ff6b00',
  stripe: '#635bff', mercadopago: '#00b1ea',
};

const fmt = (centavos: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((centavos || 0) / 100);
const fmtReais = (reais: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reais || 0);
const dataBr = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

export default function ConciliacaoPage() {
  const { isBlack, phone } = useAuth();
  const [sugestoes, setSugestoes]   = useState<any[]>([]);
  const [conciliadas, setConciliadas] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<'sugeridas' | 'conciliadas'>('sugeridas');
  const [agindo, setAgindo]         = useState<Set<string>>(new Set());

  async function carregar() {
    if (!phone || !isBlack) return;
    setLoading(true);
    try {
      const [sug, conc] = await Promise.all([
        api.negocios.conciliacao.sugerir(phone),
        api.negocios.conciliacao.conciliadas(phone),
      ]);
      setSugestoes(sug);
      setConciliadas(conc);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [phone, isBlack]);

  async function aprovar(s: any) {
    if (!phone) return;
    const key = s.evento.id;
    setAgindo(prev => new Set(prev).add(key));
    try {
      await api.negocios.conciliacao.conciliar({
        phone, evento_id: s.evento.id, transacao_id: s.transacao.id, match_tipo: 'sugerido',
      });
      setSugestoes(prev => prev.filter(x => x.evento.id !== key));
      // recarrega conciliadas em background
      api.negocios.conciliacao.conciliadas(phone).then(setConciliadas).catch(() => {});
    } catch (e: any) { alert(e.message); }
    finally { setAgindo(prev => { const n = new Set(prev); n.delete(key); return n; }); }
  }

  function rejeitar(s: any) {
    // local-only — não persiste rejeição, só remove da lista
    setSugestoes(prev => prev.filter(x => x.evento.id !== s.evento.id));
  }

  async function desfazer(id: string) {
    if (!confirm('Desfazer essa conciliação? O evento voltará para a lista de sugestões na próxima atualização.')) return;
    setAgindo(prev => new Set(prev).add(id));
    try {
      await api.negocios.conciliacao.desconciliar(id);
      setConciliadas(prev => prev.filter(x => x.id !== id));
    } catch (e: any) { alert(e.message); }
    finally { setAgindo(prev => { const n = new Set(prev); n.delete(id); return n; }); }
  }

  if (!isBlack) {
    return <DashboardLayout><div className="max-w-md mx-auto pt-20 px-6 text-center">
      <p className="text-sm text-muted-foreground">Disponível no plano Black.</p>
    </div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto pb-24 space-y-5">

        {/* HEADER */}
        <div className="animate-fade-in">
          <Link href="/negocios" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3">
            <ArrowLeft size={13} /> Voltar para Negócios
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Conciliação</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Conecta cada venda da plataforma com a transação que caiu no seu banco — pra não contar duas vezes.
            </p>
          </div>
        </div>

        {/* Explicação */}
        <div className="rounded-2xl bg-muted/30 border border-border/60 p-3 flex items-start gap-3 animate-fade-in" style={{ animationDelay: '60ms' }}>
          <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center flex-shrink-0">
            <Info size={14} style={{ color: BRAND }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground leading-tight">Como funciona</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              A Sora compara valores e datas das suas vendas (Hotmart, Stripe…) com transações da Sora Finance.
              Se bater valor exato e estiver na mesma janela (±3 dias), sugere a conciliação. Você aprova ou rejeita.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="inline-flex items-center gap-1 bg-muted/40 rounded-2xl p-1.5 animate-fade-in" style={{ animationDelay: '120ms' }}>
          {([
            { v: 'sugeridas',   l: 'Sugeridas',   c: sugestoes.length },
            { v: 'conciliadas', l: 'Conciliadas', c: conciliadas.length },
          ] as const).map(t => (
            <button key={t.v} onClick={() => setTab(t.v)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      tab === t.v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}>
              {t.l}
              {t.c > 0 && (
                <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full"
                      style={{ background: tab === t.v ? BRAND : 'rgba(0,0,0,0.05)', color: tab === t.v ? 'white' : 'inherit' }}>
                  {t.c}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* CONTEÚDO */}
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : tab === 'sugeridas' ? (
          sugestoes.length === 0 ? (
            <EmptyState
              titulo="Nenhuma sugestão no momento"
              desc="Não encontramos vendas que batam exato com transações da Sora Finance nos últimos 90 dias. Isso significa que tudo já está conciliado ou que ainda não há eventos pra comparar."
            />
          ) : (
            <ul className="space-y-3">
              {sugestoes.map(s => (
                <CardSugestao
                  key={s.evento.id}
                  s={s}
                  agindo={agindo.has(s.evento.id)}
                  onAprovar={() => aprovar(s)}
                  onRejeitar={() => rejeitar(s)}
                />
              ))}
            </ul>
          )
        ) : (
          conciliadas.length === 0 ? (
            <EmptyState
              titulo="Sem conciliações ainda"
              desc="Aprovar uma sugestão acima cria um vínculo permanente entre o evento e a transação."
            />
          ) : (
            <ul className="space-y-2">
              {conciliadas.map(c => (
                <CardConciliada
                  key={c.id}
                  c={c}
                  agindo={agindo.has(c.id)}
                  onDesfazer={() => desfazer(c.id)}
                />
              ))}
            </ul>
          )
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── COMPONENTES ────────────────────────────────────────────────

function CardSugestao({ s, agindo, onAprovar, onRejeitar }: { s: any; agindo: boolean; onAprovar: () => void; onRejeitar: () => void }) {
  const corPlat = CORES_PLAT[s.evento.plataforma] || '#94a3b8';
  const nomePlat = NOMES_PLAT[s.evento.plataforma] || s.evento.plataforma;
  const confiancaPct = Math.round((s.confianca || 0) * 100);

  return (
    <li className="rounded-2xl border border-border bg-card p-4 animate-fade-in">
      {/* Header com confiança */}
      <div className="flex items-center justify-between mb-3">
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
             style={{ background: `${BRAND}15`, color: BRAND }}>
          <Sparkles size={10} /> Sugestão automática · {confiancaPct}%
        </div>
        <span className="text-[10px] text-muted-foreground">Valor exato · ±3d</span>
      </div>

      {/* Grid evento ↔ transação */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-center mb-4">
        {/* EVENTO (origem plataforma) */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                  style={{ background: `${corPlat}15`, color: corPlat }}>
              <span className="w-1 h-1 rounded-full" style={{ background: corPlat }} />
              {nomePlat}
            </span>
            <span className="text-[10px] text-muted-foreground">{dataBr(s.evento.data_evento)}</span>
          </div>
          <p className="text-sm font-bold text-foreground truncate">{s.evento.produto_nome || 'Venda'}</p>
          {s.evento.comprador_nome && (
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{s.evento.comprador_nome}</p>
          )}
          <p className="text-base font-bold tabular-nums text-foreground mt-2" style={{ color: BRAND }}>
            {fmt(s.evento.valor_liquido)}
          </p>
        </div>

        {/* Seta */}
        <div className="flex sm:flex-col items-center justify-center gap-1 text-muted-foreground">
          <ArrowRight size={16} className="hidden sm:block" />
          <Link2 size={14} className="sm:hidden" />
          <span className="text-[9px] uppercase tracking-wider font-bold opacity-50">match</span>
        </div>

        {/* TRANSAÇÃO (Sora Finance) */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                  style={{ background: 'rgba(97,206,112,0.15)', color: BRAND }}>
              Sora Finance
            </span>
            <span className="text-[10px] text-muted-foreground">{dataBr(s.transacao.data)}</span>
          </div>
          <p className="text-sm font-bold text-foreground truncate">
            {s.transacao.descricao || s.transacao.observacao || 'Transação'}
          </p>
          {s.transacao.carteira_nome && (
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">→ {s.transacao.carteira_nome}</p>
          )}
          <p className="text-base font-bold tabular-nums text-foreground mt-2">
            {fmtReais(parseFloat(s.transacao.valor))}
          </p>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2">
        <button onClick={onAprovar}
                disabled={agindo}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm disabled:opacity-50 transition-transform active:scale-[0.98]"
                style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
          {agindo ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Aprovar conciliação
        </button>
        <button onClick={onRejeitar}
                disabled={agindo}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-foreground bg-card border border-border hover:bg-muted/60 disabled:opacity-50">
          <X size={12} />
          Rejeitar
        </button>
      </div>
    </li>
  );
}

function CardConciliada({ c, agindo, onDesfazer }: { c: any; agindo: boolean; onDesfazer: () => void }) {
  const corPlat = CORES_PLAT[c.evento?.plataforma] || '#94a3b8';
  const nomePlat = NOMES_PLAT[c.evento?.plataforma] || c.evento?.plataforma;

  return (
    <li className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3 animate-fade-in">
      <ShieldCheck size={16} className="text-green-500 flex-shrink-0" />

      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: corPlat }}>
            <span className="w-1 h-1 rounded-full" style={{ background: corPlat }} />
            {nomePlat}
          </span>
          <p className="font-semibold text-foreground truncate">{c.evento?.produto_nome || 'Venda'}</p>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {fmt(c.evento?.valor_liquido)} · {c.evento?.data_evento && dataBr(c.evento.data_evento)}
          </p>
        </div>

        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sora Finance</span>
          <p className="font-semibold text-foreground truncate">
            {c.transacao?.descricao || c.transacao?.observacao || '—'}
          </p>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {c.transacao?.valor && fmtReais(parseFloat(c.transacao.valor))} · {c.transacao?.data && dataBr(c.transacao.data)}
          </p>
        </div>
      </div>

      <button onClick={onDesfazer}
              disabled={agindo}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors flex-shrink-0 disabled:opacity-50"
              title="Desfazer conciliação">
        {agindo ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} />}
      </button>
    </li>
  );
}

function EmptyState({ titulo, desc }: { titulo: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-muted/20 p-10 text-center animate-fade-in">
      <ShieldCheck size={22} className="text-muted-foreground mx-auto mb-2 opacity-50" />
      <h2 className="text-sm font-bold text-foreground mb-1">{titulo}</h2>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">{desc}</p>
    </div>
  );
}
