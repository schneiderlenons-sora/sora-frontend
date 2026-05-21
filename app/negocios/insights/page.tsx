'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  ArrowLeft, Sparkles, TrendingUp, TrendingDown, AlertTriangle, Trophy,
  Receipt, Zap, Lightbulb, X, Loader2, RefreshCw, ChevronRight,
  CheckCircle2, AlertCircle, Info as InfoIcon,
} from 'lucide-react';

const BRAND = '#61ce70';
const RED   = '#ef4444';

type Severidade = 'info' | 'sucesso' | 'atencao' | 'critico';

const SEV_STYLE: Record<Severidade, { cor: string; bg: string; border: string; iconBg: string }> = {
  info:     { cor: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)',  border: 'rgba(59, 130, 246, 0.25)',  iconBg: 'rgba(59, 130, 246, 0.15)' },
  sucesso:  { cor: '#22c55e', bg: 'rgba(34, 197, 94, 0.08)',   border: 'rgba(34, 197, 94, 0.25)',   iconBg: 'rgba(34, 197, 94, 0.15)' },
  atencao:  { cor: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)',  border: 'rgba(245, 158, 11, 0.25)',  iconBg: 'rgba(245, 158, 11, 0.15)' },
  critico:  { cor: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)',   border: 'rgba(239, 68, 68, 0.25)',   iconBg: 'rgba(239, 68, 68, 0.15)' },
};

const TIPO_ICON: Record<string, any> = {
  lucro_subiu:        TrendingUp,
  lucro_caiu:         TrendingDown,
  plataforma_top:     Trophy,
  produto_top:        Trophy,
  custo_alto:         AlertTriangle,
  imposto_reservar:   Receipt,
  vendas_recorde:     Zap,
  churn_alto:         AlertTriangle,
  fluxo_caixa_alerta: AlertCircle,
  sugestao:           Lightbulb,
};

function tempoAtras(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

export default function InsightsPage() {
  const { isBlack, phone } = useAuth();
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [gerando, setGerando]   = useState(false);
  const [feedback, setFeedback] = useState('');

  async function carregar() {
    if (!phone || !isBlack) return;
    setLoading(true);
    try { setInsights(await api.negocios.insights.listar(phone)); }
    catch { setInsights([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [phone, isBlack]);

  async function handleGerar() {
    if (!phone || gerando) return;
    setGerando(true);
    setFeedback('');
    try {
      const r = await api.negocios.insights.gerar(phone);
      setFeedback(r.gerados > 0
        ? `${r.gerados} ${r.gerados === 1 ? 'novo insight' : 'novos insights'}`
        : 'Nenhum padrão novo no momento. Volte amanhã.');
      await carregar();
      setTimeout(() => setFeedback(''), 4000);
    } catch (e: any) {
      setFeedback(e.message);
    } finally {
      setGerando(false);
    }
  }

  async function handleDispensar(id: string) {
    setInsights(s => s.filter(x => x.id !== id));
    try { await api.negocios.insights.dispensar(id); }
    catch {} // silent — UI já removeu
  }

  if (!isBlack) {
    return <DashboardLayout><div className="max-w-md mx-auto pt-20 px-6 text-center">
      <p className="text-sm text-muted-foreground">Disponível no plano Black.</p>
    </div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto pb-24 space-y-5">

        {/* HEADER */}
        <div className="animate-fade-in">
          <Link href="/negocios" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3">
            <ArrowLeft size={13} /> Voltar para Negócios
          </Link>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                   style={{ background: `linear-gradient(135deg, ${BRAND}25 0%, ${BRAND}10 100%)`, border: `1px solid ${BRAND}40` }}>
                <Sparkles size={18} style={{ color: BRAND }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Insights da IA</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Análises automáticas dos seus dados financeiros.
                </p>
              </div>
            </div>
            <button onClick={handleGerar} disabled={gerando}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white shadow-sm disabled:opacity-50"
                    style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
              {gerando
                ? <><Loader2 size={13} className="animate-spin" /> Analisando…</>
                : <><RefreshCw size={13} /> Analisar agora</>}
            </button>
          </div>
          {feedback && (
            <div className="mt-3 rounded-xl px-3 py-2 text-xs font-semibold animate-fade-in"
                 style={{ background: `${BRAND}15`, color: BRAND }}>
              {feedback}
            </div>
          )}
        </div>

        {/* LISTA */}
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : insights.length === 0 ? (
          <EmptyState onGerar={handleGerar} />
        ) : (
          <div className="space-y-3">
            {insights.map(ins => (
              <CardInsight key={ins.id} insight={ins} onDispensar={() => handleDispensar(ins.id)} />
            ))}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

function CardInsight({ insight, onDispensar }: { insight: any; onDispensar: () => void }) {
  const sev = SEV_STYLE[insight.severidade as Severidade] || SEV_STYLE.info;
  const Icon = TIPO_ICON[insight.tipo] || InfoIcon;
  const ehClaude = insight.dados?.fonte === 'claude';

  return (
    <div className="relative rounded-2xl border bg-card p-4 animate-fade-in"
         style={{ borderColor: sev.border }}>
      {/* Faixa lateral colorida */}
      <div className="absolute left-0 top-3 bottom-3 w-1 rounded-full" style={{ background: sev.cor }} />

      <div className="flex items-start gap-3 pl-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: sev.iconBg }}>
          <Icon size={15} style={{ color: sev.cor }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-sm font-bold text-foreground tracking-tight leading-snug">
              {insight.titulo}
            </h3>
            <button onClick={onDispensar}
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
                    aria-label="Dispensar">
              <X size={12} />
            </button>
          </div>

          {insight.descricao && (
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              {insight.descricao}
            </p>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {ehClaude && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                      style={{ background: `${BRAND}15`, color: BRAND }}>
                  <Sparkles size={8} /> Sora IA
                </span>
              )}
              <span>{tempoAtras(insight.created_at)}</span>
            </div>

            {insight.acao_url && insight.acao_label && (
              <Link href={insight.acao_url}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-foreground bg-foreground/5 hover:bg-foreground/10 transition-colors">
                {insight.acao_label} <ChevronRight size={11} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onGerar }: { onGerar: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-muted/20 p-10 text-center animate-fade-in">
      <div className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-3"
           style={{ background: `linear-gradient(135deg, ${BRAND}20 0%, ${BRAND}05 100%)` }}>
        <Sparkles size={22} style={{ color: BRAND }} />
      </div>
      <h2 className="text-base font-bold text-foreground mb-1">Nenhum insight ainda</h2>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed mb-4">
        A Sora analisa seus dados toda noite e gera insights aqui. Você também pode pedir uma análise agora.
      </p>
      <button onClick={onGerar}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm"
              style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
        <RefreshCw size={13} /> Analisar agora
      </button>
    </div>
  );
}
