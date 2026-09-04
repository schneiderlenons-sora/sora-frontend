'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { PLANOS_INFO, type PlanoId, type Intervalo } from '@/lib/stripe';
import { PLANOS_DISPLAY } from '@/lib/planos-display';
import { PLANO_LABEL, type Plano } from '@/lib/plans';
import { trackInitiateCheckout, trackViewContent, trackAddToCart } from '@/lib/analytics';
import {
  Check, Crown, Sparkles, Loader2, AlertCircle, CheckCircle2,
  CreditCard, Settings, Zap, Infinity as InfinityIcon,
} from 'lucide-react';

const BRAND = 'hsl(var(--primary))';

// Catálogo de planos vem de lib/planos-display (fonte única, igual à landing).
// Básico · Premium · Platinum.
const PLANOS = PLANOS_DISPLAY;

// ⚠️ CHAVE ÚNICA DA OFERTA VITALÍCIA NO PAINEL.
//
// A oferta entra e sai daqui conforme a campanha (já foi removida uma vez, no
// commit b4d81ea, e reposta a pedido de um cliente). Para tirar de novo:
// trocar para `false` — o card some, a grade volta pra 2 colunas e o fetch de
// vagas nem sai. NÃO apagar o bloco: da próxima vez o texto voltaria
// desatualizado, que foi exatamente o que aconteceu agora (o card citava o
// preço do Black, plano já aposentado, e "Stripe" no lugar do Mercado
// Pago).
//
// Isto NÃO afeta /oferta nem /kit — as landings vendem o vitalício sempre.
// O cartão de status de quem JÁ TEM vitalício também é independente daqui.
const MOSTRAR_VITALICIO = false;

// `gratis` fica no MESMO degrau de `inativo` (0) de propósito: os dois não
// pagam nada, então todo plano da tela é "subir" pros dois, e o CTA sai como
// "Assinar" em vez de virar downgrade pro portal do Stripe.
const ORDEM: Record<Plano, number> = {
  inativo: 0, gratis: 0, basico: 1, kit: 1, premium: 2, platinum: 3,
};

// ─── Componente principal (separado por causa do Suspense) ────────────────────

function PlanosContent() {
  const { perfil, plano: planoAtual, recarregar, isVitalicio } = useAuth();
  const searchParams = useSearchParams();
  const [anual, setAnual]         = useState(false);
  const [loadingPlano, setLoading] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [erro, setErro]           = useState('');
  const [vagas, setVagas] = useState<{ vendidos: number; vagas: number; restantes: number } | null>(null);

  useEffect(() => {
    if (!MOSTRAR_VITALICIO) return;   // oferta fora do painel: nem busca vagas
    fetch('/api/vitalicio/count').then((r) => r.json()).then(setVagas).catch(() => {});
  }, []);

  useEffect(() => {
    try { trackViewContent({ name: 'Planos' }); } catch { /* noop */ }
  }, []);

  const success  = searchParams.get('success');
  const canceled = searchParams.get('canceled');
  const intent   = searchParams.get('intent');             // 'upgrade' vindo do signup
  const planoIntencao = searchParams.get('plano') as PlanoId | null;
  const planoIntencaoValido =
    planoIntencao && ['basico', 'premium'].includes(planoIntencao) ? planoIntencao : null;
  // Ciclo escolhido na landing (mensal/anual) — preserva a escolha no checkout.
  const cicloIntencao: Intervalo = searchParams.get('ciclo') === 'anual' ? 'anual' : 'mensal';

  // Refs pra fazer scroll até o card escolhido na intent
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Após o pagamento, o webhook do Stripe ativa o plano. Re-checa o perfil a
  // cada 2s; se em ~8s ainda estiver inativo, força um sync direto do Stripe
  // (fallback caso o webhook atrase/falhe). Continua tentando até ~40s.
  const recarregarRef = useRef(recarregar);
  recarregarRef.current = recarregar;
  useEffect(() => {
    if (!success) return;
    // ⚠️ NÃO dispare Purchase aqui. Já foi (duas vezes) e mal:
    //   · com `value: 0`, que o Meta recusa ("o campo de valor está ausente")
    //     e que foi medido em 36% dos Purchase do pixel;
    //   · sem relação com o Purchase do webhook, que carrega o valor REAL —
    //     event_id diferente, então o Meta contava a mesma venda duas vezes e
    //     acusava taxa de desduplicação baixa.
    //
    // Quem manda o Purchase é o webhook da Stripe (app/api/stripe/webhook),
    // com o valor cobrado de verdade, event_id determinístico e os cookies de
    // match guardados no checkout. Aqui o navegador não sabe quanto foi
    // cobrado (cupom, proporcional) — chutar é o que criava o valor zero.
    let cancelado = false;
    // Sync IMEDIATO direto do Stripe (não espera o webhook) — ativa na hora.
    (async () => {
      try { await fetch('/api/stripe/sync', { method: 'POST' }); } catch { /* noop */ }
      if (!cancelado) await recarregarRef.current();
    })();
    // Continua re-checando como rede de segurança (webhook + latência).
    let tries = 0;
    const iv = setInterval(async () => {
      tries += 1;
      if (tries === 6) { try { await fetch('/api/stripe/sync', { method: 'POST' }); } catch { /* noop */ } }
      await recarregarRef.current();
      if (tries >= 20) clearInterval(iv);
    }, 2000);
    return () => { cancelado = true; clearInterval(iv); };
  }, [success]);

  // Auto-checkout: se o usuário já escolheu o plano na landing (intent), vai
  // direto pro Stripe sem precisar clicar de novo. Só dispara uma vez, com o
  // usuário autenticado e inativo, e nunca ao voltar de um success/cancel
  // (evita loop). Se o checkout falhar, cai no fallback (a tela com os cards).
  const autoCheckout = useRef(false);
  useEffect(() => {
    if (autoCheckout.current) return;
    if (intent !== 'upgrade' || !planoIntencaoValido) return;
    if (planoAtual !== 'inativo') return;
    if (success || canceled) return;
    if (!perfil) return;                       // precisa de sessão pro checkout
    autoCheckout.current = true;
    assinar(planoIntencaoValido, cicloIntencao); // respeita mensal/anual da landing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent, planoIntencaoValido, planoAtual, success, canceled, perfil, cicloIntencao]);

  // Reflete o ciclo escolhido na landing no toggle (fallback visual, caso o
  // auto-checkout não dispare e o usuário veja os cards).
  useEffect(() => {
    if (cicloIntencao === 'anual') setAnual(true);
  }, [cicloIntencao]);

  // Fallback: se por algum motivo o auto-checkout não disparar, ao menos
  // rola suave até o card pré-selecionado.
  useEffect(() => {
    if (intent !== 'upgrade' || !planoIntencaoValido) return;
    const t = setTimeout(() => {
      const el = cardRefs.current[planoIntencaoValido];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
    return () => clearTimeout(t);
  }, [intent, planoIntencaoValido]);

  async function assinar(plano: PlanoId, intervaloForcado?: Intervalo) {
    setErro('');
    setLoading(plano);
    try {
      const intervalo: Intervalo = intervaloForcado ?? (anual ? 'anual' : 'mensal');
      const info = PLANOS_INFO[plano];
      const preco = intervalo === 'anual' ? info.anual : info.mensal;
      trackAddToCart({ name: `Plano ${plano}`, value: preco, currency: 'BRL' });
      trackInitiateCheckout({ name: `Plano ${plano}`, value: preco, currency: 'BRL' });

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano, intervalo }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setErro(data.erro || 'Erro ao iniciar checkout.');
      }
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setLoading(null);
    }
  }

  // Oferta vitalícia: checkout transparente (Mercado Pago — parcelamento até
  // 12x + Pix) na nossa própria página /checkout-vitalicio. AddToCart +
  // InitiateCheckout NÃO disparam aqui — o /checkout-vitalicio já dispara os
  // dois sozinho ao montar (é o mesmo ponto que cobre quem chega direto de
  // /oferta ou /kit); disparar nos dois lados duplicaria o evento.
  function comprarVitalicio() {
    setLoading('vitalicio');
    window.location.href = '/checkout-vitalicio';
  }

  async function gerenciarAssinatura() {
    setErro('');
    setLoadingPortal(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setErro(data.erro || 'Erro ao abrir portal.');
      }
    } catch {
      setErro('Falha de conexão.');
    } finally {
      setLoadingPortal(false);
    }
  }

  const ordemAtual = ORDEM[planoAtual];
  const temAssinatura = planoAtual !== 'inativo' && !!perfil;

  return (
    <>
      <div className="max-w-6xl mx-auto pb-24 space-y-8 px-4">

        {/* Banner de boas-vindas (vindo do signup com plano pré-selecionado) */}
        {intent === 'upgrade' && planoIntencaoValido && planoAtual === 'inativo' && (
          <div
            className="relative overflow-hidden rounded-2xl p-5 animate-fade-in border"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${BRAND} 6%, transparent) 0%, color-mix(in srgb, ${BRAND} 2%, transparent) 100%)`,
              borderColor: `color-mix(in srgb, ${BRAND} 25%, transparent)`,
            }}
          >
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none opacity-20"
                 style={{ background: `radial-gradient(circle, ${BRAND} 0%, transparent 60%)` }} />
            <div className="relative flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md"
                   style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
                <Sparkles size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">
                  Bem-vindo à Sora! 🎉
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Você escolheu o plano <strong className="text-foreground capitalize">{PLANO_LABEL[planoIntencaoValido]}</strong> na landing.
                  Confirme abaixo pra concluir sua assinatura — você pode trocar de plano ou ciclo (mensal/anual) antes de pagar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Banners de feedback */}
        {success && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/60 animate-fade-in">
            <CheckCircle2 size={18} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">Pagamento confirmado!</p>
              <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                {planoAtual === 'inativo'
                  ? <>Seu plano está sendo ativado. Se demorar, toque em “Concluir ativação”.</>
                  : <>Plano ativado. Em alguns instantes o painel será atualizado.</>}
              </p>
              {planoAtual === 'inativo' && (
                <button
                  onClick={async () => {
                    setLoading('__sync__'); // sentinela: desabilita os botões durante o sync
                    try { await fetch('/api/stripe/sync', { method: 'POST' }); await recarregarRef.current(); }
                    finally { setLoading(null); }
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-green-800 dark:text-green-300 underline"
                >
                  Concluir ativação
                </button>
              )}
            </div>
          </div>
        )}
        {canceled && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 animate-fade-in">
            <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">Checkout cancelado. Escolha um plano quando quiser.</p>
          </div>
        )}
        {erro && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60">
            <AlertCircle size={18} className="text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">{erro}</p>
          </div>
        )}

        {/* ── OFERTA VITALÍCIA (Premium pra sempre, pagamento único) ─────────
            Quem JÁ TEM vitalício vê sempre o cartão de status (é informação de
            conta, não oferta). A OFERTA em si respeita MOSTRAR_VITALICIO. */}
        {isVitalicio ? (
          <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 border border-amber-400/30 flex items-center gap-4 animate-fade-in"
               style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)' }}>
            <Crown size={28} className="text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-amber-400 text-[11px] font-bold uppercase tracking-widest">Fundador</p>
              <p className="text-white font-bold text-lg leading-tight">
                {planoAtual === 'kit' ? 'Você tem o Kit Vitalício 🐳' : 'Você é Premium Vitalício 🐳'}
              </p>
              <p className="text-white/60 text-sm">
                {planoAtual === 'kit'
                  ? 'Acesso vitalício ao Kit — organize tudo pelo painel, pra sempre. 💚'
                  : 'Acesso completo à Sora, para sempre. Obrigado por acreditar desde o começo. 💚'}
              </p>
            </div>
          </div>
        ) : MOSTRAR_VITALICIO && (
          <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-amber-400/25 animate-fade-in"
               style={{ background: 'linear-gradient(135deg, #1c1917 0%, #0a0a0a 55%, #1c1917 100%)' }}>
            <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full pointer-events-none opacity-25"
                 style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 60%)' }} />
            <div className="relative grid lg:grid-cols-5 gap-6 items-center">
              <div className="lg:col-span-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/15 mb-3">
                  <Sparkles size={12} className="text-amber-400" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">Oferta de fundador</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight flex items-center gap-2">
                  Premium <InfinityIcon size={26} className="text-amber-400" /> pra sempre
                </h2>
                <p className="text-white/60 text-sm mt-2 max-w-md">
                  Pague <span className="text-white font-semibold">uma única vez</span> e tenha o plano Premium completo — contas ilimitadas, OCR, investimentos, Negócios e Sora Grow — <span className="text-white font-semibold">para sempre</span>. Sem mensalidade, nunca mais.
                </p>
                {vagas && vagas.restantes > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="text-amber-300 font-semibold uppercase tracking-wider">Vagas de fundador</span>
                      <span className="text-white/70 tabular-nums">Restam {vagas.restantes} de {vagas.vagas}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300"
                           style={{ width: `${Math.min(100, Math.max(4, (vagas.vendidos / vagas.vagas) * 100))}%` }} />
                    </div>
                  </div>
                )}
              </div>
              <div className="lg:col-span-2 flex flex-col items-start lg:items-end gap-3">
                <div className="flex items-end gap-1">
                  <span className="text-white/50 text-sm mb-1">R$</span>
                  <span className="text-5xl font-bold text-white tabular-nums leading-none">97</span>
                  <span className="text-white/50 text-sm mb-1">único</span>
                </div>
                {/* Comparação com o PREMIUM (R$29,90/mês, PLANOS_INFO) — a
                    assinatura que o vitalício substitui. Já esteve
                    "R$79,90/mês" (um plano aposentado), e quem lesse
                    acharia que economiza um valor que ninguém cobra. */}
                <p className="text-white/40 text-xs line-through">R$29,90/mês na assinatura</p>
                <button
                  onClick={comprarVitalicio}
                  disabled={loadingPlano === 'vitalicio'}
                  className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-black transition active:scale-[0.98] disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }}>
                  {loadingPlano === 'vitalicio'
                    ? <><Loader2 size={16} className="animate-spin" /> Abrindo…</>
                    : <><Crown size={16} /> Garantir vitalício</>}
                </button>
                {/* O vitalício é pago no MERCADO PAGO (app/api/mercadopago/*),
                    não no Stripe — o Stripe cuida só da assinatura recorrente.
                    Dizer "Stripe" aqui e abrir um Payment Brick do MP na tela
                    seguinte quebra a confiança bem na hora de pagar. */}
                <p className="text-white/40 text-[11px] text-center lg:text-right">
                  Pagamento único e seguro — Pix ou cartão em até 12×
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center space-y-2 pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 mb-2">
            <Zap size={12} style={{ color: BRAND }} />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: BRAND }}>
              Planos
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-tight">
            {isVitalicio
              ? 'Você tem acesso vitalício'
              : planoAtual === 'inativo' ? 'Escolha o seu plano' : `Você está no ${PLANO_LABEL[planoAtual]}`}
          </h1>
          {isVitalicio ? (
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Plano completo, sem mensalidade — seu acesso é pra sempre. 💜
            </p>
          ) : planoAtual !== 'inativo' ? (
            <p className="text-muted-foreground text-sm">
              Faça upgrade a qualquer momento ou gerencie sua assinatura abaixo.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Cancele quando quiser. Sem letras miúdas.
            </p>
          )}
        </div>

        {/* Assinaturas recorrentes — não fazem sentido pra quem é vitalício. */}
        {!isVitalicio && (
        <>
        {/* Toggle mensal/anual */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1 p-1.5 rounded-2xl bg-muted/50 border border-border/60">
            <button
              onClick={() => setAnual(false)}
              className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all ${
                !anual ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setAnual(true)}
              className={`relative px-5 py-2.5 text-sm font-bold rounded-xl transition-all ${
                anual ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Anual
              {!anual && (
                <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white"
                      style={{ background: BRAND }}>
                  até -40%
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Cards de planos — são só DOIS (Básico e Premium). Com 3 colunas a
            terceira ficava vazia e a grade desalinhada, então centraliza em 2,
            mesmo padrão de components/landing/Pricing.tsx. */}
        <div className="grid grid-cols-1 lg:grid-cols-3 max-w-5xl mx-auto gap-5">
          {PLANOS.map((p) => {
            const info       = PLANOS_INFO[p.id];
            const preco      = anual ? info.anual : info.mensal;
            const ehAtual    = planoAtual === p.id;
            const ehIntencao = planoIntencaoValido === p.id && planoAtual === 'inativo';
            const podeSubir  = ORDEM[p.id] > ordemAtual;
            const podeDescer = ORDEM[p.id] < ordemAtual && ordemAtual > 0;
            const isLoading  = loadingPlano === p.id;

            return (
              <div
                key={p.id}
                ref={(el) => { cardRefs.current[p.id] = el; }}
                className={`relative rounded-3xl p-7 transition-all duration-300 ${
                  ehIntencao
                    ? 'border-2 shadow-[0_20px_60px_-20px_color-mix(in srgb, hsl(var(--primary)) 50%, transparent)] bg-card animate-pulse-glow'
                    : p.destaque
                      ? 'border-2 shadow-[0_20px_60px_-20px_color-mix(in srgb, hsl(var(--primary)) 35%, transparent)] bg-card'
                      : ehAtual
                        ? 'border-2 bg-card'
                        : 'border border-border/70 bg-card/60 hover:border-border'
                }`}
                style={{
                  borderColor: ehIntencao || p.destaque || ehAtual ? p.cor : undefined,
                  boxShadow: ehIntencao ? `0 0 0 4px color-mix(in srgb, ${p.cor} 13%, transparent), 0 20px 60px -20px color-mix(in srgb, ${p.cor} 50%, transparent)` : undefined,
                }}
              >
                {/* Badge */}
                {p.badge && (
                  <div
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white shadow-md"
                    style={{ background: `linear-gradient(135deg, ${p.cor}, ${escurecer(p.cor)})` }}
                  >
                    {p.id === 'premium' && <Sparkles size={9} />}
                    {p.id === 'platinum' && <Crown size={9} />}
                    {p.badge}
                  </div>
                )}

                {/* Plano atual badge */}
                {ehAtual && (
                  <div className="absolute top-4 right-4 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                       style={{ background: `color-mix(in srgb, ${p.cor} 13%, transparent)`, color: p.cor }}>
                    <CheckCircle2 size={10} /> Atual
                  </div>
                )}

                <div className="mt-2">
                  <h3 className="text-xl font-bold text-foreground tracking-tight">{p.nome}</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-5">{p.subtitulo}</p>

                  {/* Preço */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-foreground">R$</span>
                      <span className="text-5xl font-bold text-foreground tabular-nums tracking-tight">
                        {Math.floor(preco)}
                      </span>
                      <span className="text-2xl font-bold text-foreground">
                        ,{(preco % 1).toFixed(2).slice(2)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      por mês
                      {anual && (
                        <span className="ml-1 font-bold" style={{ color: p.cor }}>
                          · {info.descAnual}% off no anual
                        </span>
                      )}
                    </p>
                  </div>

                  {/* CTA */}
                  {ehAtual ? (
                    <button
                      onClick={gerenciarAssinatura}
                      disabled={loadingPortal || !temAssinatura}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 mb-7"
                      style={{ borderColor: p.cor, color: p.cor }}
                    >
                      {loadingPortal ? <Loader2 size={15} className="animate-spin" /> : <Settings size={15} />}
                      Gerenciar assinatura
                    </button>
                  ) : podeSubir ? (
                    <button
                      onClick={() => assinar(p.id)}
                      disabled={!!loadingPlano}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 shadow-md disabled:opacity-50 disabled:cursor-not-allowed mb-7"
                      style={{ background: `linear-gradient(135deg, ${p.cor}, ${escurecer(p.cor)})` }}
                    >
                      {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                      {ordemAtual === 0 ? 'Assinar' : 'Fazer upgrade'}
                    </button>
                  ) : podeDescer ? (
                    <button
                      onClick={gerenciarAssinatura}
                      disabled={loadingPortal}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border border-border text-muted-foreground transition-all hover:bg-muted/40 mb-7"
                    >
                      {loadingPortal ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                      Fazer downgrade
                    </button>
                  ) : (
                    // inativo — pode assinar qualquer plano
                    <button
                      onClick={() => assinar(p.id)}
                      disabled={!!loadingPlano}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 shadow-md disabled:opacity-50 disabled:cursor-not-allowed mb-7"
                      style={{ background: `linear-gradient(135deg, ${p.cor}, ${escurecer(p.cor)})` }}
                    >
                      {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                      Assinar
                    </button>
                  )}

                  {/* Features */}
                  <ul className="space-y-2.5">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[13px] text-foreground/80 leading-snug">
                        <span
                          className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: `color-mix(in srgb, ${p.cor} 13%, transparent)` }}
                        >
                          <Check size={9} style={{ color: p.cor }} strokeWidth={3} />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>

                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé */}
        <p className="text-center text-sm text-muted-foreground pb-4">
          Pagamentos processados com segurança pelo{' '}
          <span className="font-semibold text-foreground">Stripe</span>.
          Cancele a qualquer momento pelo portal de assinatura.
        </p>
        </>
        )}
      </div>
    </>
  );
}

export default function PlanosPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    }>
      <PlanosContent />
    </Suspense>
  );
}

function escurecer(hex: string, amt = 0.18): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - Math.round(255 * amt));
  const g = Math.max(0, ((n >> 8)  & 0xff) - Math.round(255 * amt));
  const b = Math.max(0,  (n        & 0xff) - Math.round(255 * amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
