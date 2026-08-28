'use client';

// =============================================================================
// Insights — o que a Sora percebe olhando o negócio.
//
// A tela antiga só entendia infoproduto (plataforma, churn, produto digital).
// Uma padaria não tem nada disso. Agora há duas fontes na mesma lista:
//   · loja  — calculado AO VIVO (estoque, preço, cliente, caixa)
//   · IA    — os insights guardados do motor digital, quando existirem
//
// Regra que manda no visual: cada item aponta pra uma tela e diz o que fazer.
// Insight sem ação é ruído, e ruído ensina o dono a ignorar a tela toda.
// =============================================================================

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useEmpresa } from '@/components/negocios/EmpresaContext';
import { corEmpresa } from '@/lib/empresas';
import Link from 'next/link';
import {
  Sparkles, TrendingUp, TrendingDown, AlertTriangle, Trophy, Receipt, Zap,
  Lightbulb, X, Loader2, RefreshCw, ChevronRight, CircleAlert, Boxes,
  PackageX, Users, CalendarClock, Target, Percent,
} from 'lucide-react';

type Severidade = 'info' | 'sucesso' | 'atencao' | 'critico';

const SEV: Record<Severidade, { cor: string; rotulo: string }> = {
  critico: { cor: '#ef4444', rotulo: 'Resolva primeiro' },
  atencao: { cor: '#f59e0b', rotulo: 'Fique de olho' },
  sucesso: { cor: '#22c55e', rotulo: 'Boa notícia' },
  info:    { cor: '#3b82f6', rotulo: 'Vale saber' },
};

const ICONE: Record<string, any> = {
  // loja
  preco_abaixo_custo: PackageX,
  receber_vencido:    CircleAlert,
  abaixo_equilibrio:  Target,
  estoque_baixo:      AlertTriangle,
  estoque_parado:     Boxes,
  cliente_sumido:     Users,
  pagar_semana:       CalendarClock,
  margem_saudavel:    Percent,
  // digital (motor antigo)
  lucro_subiu: TrendingUp, lucro_caiu: TrendingDown,
  plataforma_top: Trophy, produto_top: Trophy,
  custo_alto: AlertTriangle, imposto_reservar: Receipt,
  vendas_recorde: Zap, churn_alto: AlertTriangle, sugestao: Lightbulb,
};

export default function InsightsPage() {
  const { temNegocios, phone } = useAuth();
  const { empresa } = useEmpresa();
  const cor = corEmpresa(empresa);

  // Dispensados guardados POR EMPRESA. Antes um efeito limpava o conjunto ao
  // trocar de empresa — setState dentro de efeito dispara render em cascata.
  const [dispensadosPorEmpresa, setDispensados] = useState<Record<string, string[]>>({});
  const dispensados = new Set(dispensadosPorEmpresa[empresa?.id || ''] || []);
  const [gerando, setGerando] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Loja: ao vivo. Insight guardado de ontem sobre estoque já reposto é pior
  // que insight nenhum — o dono para de confiar na tela.
  const { data: lojaData, mutate: mLoja, isLoading } = useApi(
    (phone && temNegocios && empresa) ? `neg:insights-loja:${empresa.id}` : null,
    () => api.negocios.insights.loja(phone, empresa!.id),
  );
  const insightsLoja = (lojaData as any)?.insights || [];

  // Digital: os guardados do motor antigo (só faz sentido com integrações).
  const { data: iaData, mutate: mIa } = useApi(
    (phone && temNegocios && empresa?.tipo !== 'fisico') ? `neg:insights:${phone}` : null,
    () => api.negocios.insights.listar(phone),
  );
  const insightsIa = Array.isArray(iaData) ? iaData : [];

  async function analisar() {
    if (!phone || gerando) return;
    setGerando(true); setFeedback('');
    try {
      await mLoja();
      if (empresa?.tipo !== 'fisico') { await api.negocios.insights.gerar(phone); await mIa(); }
      setFeedback('Análise atualizada.');
      setTimeout(() => setFeedback(''), 3500);
    } catch (e: any) { setFeedback(e?.message || 'Não consegui analisar agora.'); }
    finally { setGerando(false); }
  }

  async function dispensar(id: string) {
    const emp = empresa?.id || '';
    setDispensados(s => ({ ...s, [emp]: [...(s[emp] || []), id] }));
    try { await api.negocios.insights.dispensar(id); } catch { /* já saiu da tela */ }
  }

  if (!temNegocios) {
    return <p className="max-w-md mx-auto pt-20 text-center text-sm text-muted-foreground">
      Disponível no plano Platinum.
    </p>;
  }

  const visiveis = insightsIa.filter((i: any) => !dispensados.has(i.id));
  const vazio = !isLoading && insightsLoja.length === 0 && visiveis.length === 0;

  return (
    <div className="pb-24 space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground truncate">
            {empresa?.nome || 'Negócios'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-0.5">Insights</h1>
          <p className="text-sm text-muted-foreground mt-1">O que a Sora percebeu olhando seu negócio</p>
        </div>
        <button onClick={analisar} disabled={gerando}
                className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl text-white text-sm font-bold disabled:opacity-60 transition-transform active:scale-[0.98]"
                style={{ background: cor, minHeight: 44 }}>
          {gerando ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Analisar agora
        </button>
      </header>

      {feedback && (
        <p role="status" aria-live="polite"
           className="rounded-xl px-3 py-2 text-xs font-semibold"
           style={{ background: `color-mix(in srgb, ${cor} 10%, transparent)`, color: cor }}>
          {feedback}
        </p>
      )}

      {isLoading ? (
        <ul className="space-y-3 animate-pulse" aria-busy="true">
          {[0, 1, 2].map(i => <li key={i} className="h-28 rounded-3xl bg-muted/50" />)}
        </ul>
      ) : vazio ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
                style={{ background: `color-mix(in srgb, ${cor} 12%, transparent)` }}>
            <Sparkles size={24} style={{ color: cor }} />
          </span>
          <p className="text-base font-bold text-foreground">Nada pedindo sua atenção</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
            Nenhum produto no prejuízo, nenhuma cobrança vencida, nenhum encalhe relevante.
            A Sora avisa aqui assim que algo mudar — e quanto mais você registra vendas e
            estoque, mais cedo ela percebe.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {insightsLoja.map((i: any, idx: number) => (
            <li key={i.chave} className="animate-[slide-up_500ms_ease-out_both]"
                style={{ animationDelay: `${Math.min(idx * 40, 320)}ms` }}>
              <Card i={i} />
            </li>
          ))}

          {visiveis.map((i: any, idx: number) => (
            <li key={i.id} className="animate-[slide-up_500ms_ease-out_both]"
                style={{ animationDelay: `${Math.min((insightsLoja.length + idx) * 40, 320)}ms` }}>
              <Card
                i={{
                  chave: i.tipo, severidade: i.severidade, titulo: i.titulo,
                  texto: i.descricao, acao: i.acao_label, url: i.acao_url,
                }}
                onDispensar={() => dispensar(i.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-muted-foreground px-1 leading-relaxed">
        Os insights são calculados na hora a partir do que você registrou. Nada aqui é
        recomendação contábil ou de investimento — é leitura dos seus próprios números.
      </p>
    </div>
  );
}

function Card({ i, onDispensar }: {
  i: { chave: string; severidade: Severidade; titulo: string; texto: string; acao?: string; url?: string };
  onDispensar?: () => void;
}) {
  const sev = SEV[i.severidade] || SEV.info;
  const Icone = ICONE[i.chave] || Lightbulb;

  return (
    <article className="rounded-3xl border bg-card p-4 sm:p-5"
             style={{ border: `1px solid color-mix(in srgb, ${sev.cor} 30%, transparent)`,
                      background: `color-mix(in srgb, ${sev.cor} 5%, hsl(var(--card)))` }}>
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: `color-mix(in srgb, ${sev.cor} 16%, transparent)` }}>
          <Icone size={18} style={{ color: sev.cor }} />
        </span>

        <div className="flex-1 min-w-0">
          {/* Ícone + rótulo, nunca só a cor */}
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: sev.cor }}>
            {sev.rotulo}
          </span>
          <h2 className="text-sm sm:text-base font-bold text-foreground mt-0.5 leading-snug">{i.titulo}</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">{i.texto}</p>

          {i.url && i.acao && (
            <Link href={i.url}
                  className="inline-flex items-center gap-1 mt-3 h-10 px-3 -ml-1 rounded-xl text-xs font-bold transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  style={{ color: sev.cor, minHeight: 40 }}>
              {i.acao} <ChevronRight size={14} />
            </Link>
          )}
        </div>

        {onDispensar && (
          <button onClick={onDispensar} aria-label="Dispensar"
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted flex-shrink-0"
                  style={{ minWidth: 40, minHeight: 40 }}>
            <X size={15} />
          </button>
        )}
      </div>
    </article>
  );
}
