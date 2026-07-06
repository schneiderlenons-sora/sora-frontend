'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Wallet, Percent, PiggyBank, TrendingUp, Target, CalendarRange, CreditCard, FileText,
  Check, X, Crown, ShieldCheck, Lock, Sparkles, MessageCircle, Camera, Building2,
  Users, Bell, ChevronDown, ArrowRight, Infinity as InfinityIcon, Zap,
} from 'lucide-react';

const BRAND = '#61ce70';

// As 8 ferramentas do "kit" (estilo da criativa). marca quais já existem.
const FERRAMENTAS = [
  { icon: Wallet,        nome: 'App de Organização Financeira', desc: 'Controle total do seu dinheiro na palma da mão.' },
  { icon: Percent,       nome: 'Calculadora de Juros',          desc: 'Descubra quanto de juros você paga — e economize.' },
  { icon: PiggyBank,     nome: 'Reserva de Emergência',         desc: 'Saiba exatamente quanto guardar pra ficar tranquilo.' },
  { icon: TrendingUp,    nome: 'Calculadora de Investimentos',  desc: 'Veja quanto investir e o retorno que pode alcançar.' },
  { icon: Target,        nome: 'Calculadora de Metas',          desc: 'Transforme seus sonhos em metas alcançáveis.' },
  { icon: CalendarRange, nome: 'Planejamento Anual',            desc: 'Organize o ano, defina prioridades e conquiste mais.' },
  { icon: CreditCard,    nome: 'Controle de Dívidas',           desc: 'Clareza das dívidas e um plano pra quitá-las.' },
  { icon: FileText,      nome: 'PDF: Método Sobra no Mês',       desc: 'Estratégias práticas pra sobrar dinheiro todo mês.' },
];

const FAQ = [
  { q: 'Preciso entender de finanças?', a: 'Não. A Sora foi feita pra quem é leigo e bagunçado. Você só organiza o que já tem — sem termos complicados.' },
  { q: 'É pra sempre mesmo? Sem mensalidade?', a: 'Sim. Você paga UMA vez e o acesso é seu pra sempre. Sem mensalidade, sem pegadinha, sem cobrança recorrente.' },
  { q: 'Qual a diferença pro plano com WhatsApp?', a: 'No Kit você organiza tudo pelo painel. Na Sora Completa, você nem abre o app: manda "gastei 50 no mercado" no WhatsApp (texto, áudio ou foto) e ela lança sozinha. É o jeito mais fácil que existe.' },
  { q: 'Funciona no meu celular?', a: 'Sim, funciona em qualquer celular ou computador pelo navegador. Nada pra instalar.' },
  { q: 'E se eu não gostar?', a: 'Você tem 7 dias de garantia. Se não curtir, devolvemos 100% do seu dinheiro. O risco é todo nosso.' },
  { q: 'Meus dados estão seguros?', a: 'Sim. Conexão com bancos via Open Finance (regulado pelo BACEN), criptografia de ponta e 100% LGPD.' },
];

// ── Mini-mockups da seção "Controle absoluto sobre seus cartões" ──
const FluxoMock = (
  <div>
    <div className="flex items-start justify-between mb-3 gap-2">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Fluxo de caixa</p>
        <p className="text-xl font-bold text-white mt-1 tabular-nums"><span style={{ color: BRAND }}>R$</span> 4.250,00</p>
      </div>
      <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[10px] flex-shrink-0">
        <span className="px-2 py-1 rounded-md text-white/50">Realizado</span>
        <span className="px-2 py-1 rounded-md bg-white/10 text-white font-semibold">Projetado</span>
      </div>
    </div>
    <div className="flex gap-2">
      <div className="flex flex-col justify-between text-[9px] text-white/30 py-0.5">
        <span>R$ 5k</span><span>R$ 2k</span><span>R$ 0</span>
      </div>
      <div className="flex-1 min-w-0">
        <svg viewBox="0 0 300 90" className="w-full h-[86px]" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="fluxoKitGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND} stopOpacity="0.35" />
              <stop offset="100%" stopColor={BRAND} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,62 C30,55 45,66 70,60 C100,52 120,38 150,42 C185,47 205,22 235,28 C262,33 285,42 300,38 L300,90 L0,90 Z" fill="url(#fluxoKitGrad)" />
          <path d="M0,62 C30,55 45,66 70,60 C100,52 120,38 150,42 C185,47 205,22 235,28 C262,33 285,42 300,38" fill="none" stroke={BRAND} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="flex justify-between text-[9px] text-white/30 mt-1">
          <span>01/mai</span><span>10/mai</span><span>20/mai</span><span>30/mai</span>
        </div>
      </div>
    </div>
  </div>
);

const CategoriaMock = (
  <div>
    <p className="text-xs text-white/50 mb-2">Categoria</p>
    <div className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 mb-2.5">
      <span className="h-1.5 w-28 rounded-full bg-white/[0.12]" />
      <ChevronDown size={14} className="text-white/40" />
    </div>
    <div className="space-y-1.5">
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-white/55">Lazer</div>
      <div className="rounded-lg border px-3 py-2 text-sm font-medium text-white flex items-center gap-1.5"
           style={{ borderColor: BRAND, background: `color-mix(in srgb, ${BRAND} 12%, transparent)` }}>
        <Sparkles size={13} style={{ color: BRAND }} /> Vestuário
      </div>
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-white/55">Utilidades</div>
    </div>
  </div>
);

const TransacaoMock = (
  <div>
    <div className="flex items-center justify-between mb-3 gap-2">
      <p className="text-xs font-semibold text-white/70">Transação Identificada</p>
      <p className="text-[10px] text-white/40 flex-shrink-0">Hoje, 14:30</p>
    </div>
    <div className="flex gap-2 mb-2">
      <div className="flex-1 min-w-0 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-white truncate">SEPHORA STORE (8/10)</div>
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-white tabular-nums whitespace-nowrap">R$ 261,12</div>
    </div>
    <div className="flex gap-2 items-center">
      <div className="flex-1 min-w-0 flex items-center justify-between gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-white/70">Vestuário <ChevronDown size={12} className="text-white/40 flex-shrink-0" /></div>
      <div className="flex-1 min-w-0 flex items-center justify-between gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-white/70">A Pagar <ChevronDown size={12} className="text-white/40 flex-shrink-0" /></div>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BRAND }}><Check size={16} className="text-black" strokeWidth={3} /></div>
    </div>
  </div>
);

const CARTOES_CARDS = [
  { titulo: 'Cobranças recorrentes',           desc: 'Saiba quanto você já comprometeu para os próximos meses e projete seu fluxo de caixa.',                       visual: FluxoMock },
  { titulo: 'Organização Automática por IA',   desc: 'Seus gastos são categorizados sozinhos. O sistema aprende com seus hábitos e automatiza sua gestão financeira.', visual: CategoriaMock },
  { titulo: 'Identificação de Lançamentos',    desc: 'Tenha clareza total sobre a origem de cada transação em seu extrato.',                                          visual: TransacaoMock },
];

export default function KitOferta() {
  const [vagas, setVagas] = useState<{ restantes: number; vagas: number; vendidos: number } | null>(null);
  const [faqAberta, setFaqAberta] = useState<number | null>(0);

  useEffect(() => {
    fetch('/api/vitalicio/count').then((r) => r.json()).then(setVagas).catch(() => {});
  }, []);
  const pct = vagas ? Math.min(100, Math.max(6, (vagas.vendidos / vagas.vagas) * 100)) : 0;

  return (
    <div className="bg-[#070707] text-white">

      {/* ══════════ HERO ══════════ */}
      <section className="relative overflow-hidden pt-14 pb-16 px-5">
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] opacity-40"
               style={{ background: `radial-gradient(ellipse, ${BRAND}33 0%, transparent 60%)` }} />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-6">
            <Sparkles size={13} style={{ color: BRAND }} />
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/80">Kit Completo da Organização Financeira</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black leading-[0.98] tracking-tight">
            Transforme sua vida financeira<br />
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(135deg, ${BRAND}, #d4ff4f)` }}>
              de uma vez por todas.
            </span>
          </h1>

          {/* Mockup do produto (public/landing/kit/hero.png). Full-width no
              mobile (tela inteira); contido + sombra leve no desktop. */}
          <div className="mt-8 sm:mt-10 -mx-5 sm:mx-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/kit/hero.png" alt="Sora — kit de organização financeira"
                 className="w-full h-auto sm:max-w-3xl lg:max-w-4xl sm:mx-auto rounded-none sm:rounded-2xl sm:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)]"
                 draggable={false} />
          </div>

          <p className="mt-8 text-lg text-white/70 max-w-2xl mx-auto">
            <strong className="text-white">8 ferramentas essenciais</strong> pra você economizar, investir e realizar sonhos —
            organizadas num lugar só. Pra <strong className="text-white">autônomo</strong> que mistura tudo e pro <strong className="text-white">casal</strong> que quer as contas a dois.
          </p>

          {/* Grade das 8 ferramentas */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {FERRAMENTAS.map((f, i) => (
              <div key={f.nome}
                   className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left animate-[slide-up_500ms_ease-out_both] hover:border-[color:var(--b)]/40 transition-colors"
                   style={{ animationDelay: `${i * 40}ms`, ['--b' as string]: BRAND }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                     style={{ background: `${BRAND}1f` }}>
                  <f.icon size={20} style={{ color: BRAND }} />
                </div>
                <p className="text-[13px] font-bold leading-tight">{f.nome}</p>
                <p className="text-[11px] text-white/50 mt-1 leading-snug">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <a href="#ofertas"
               className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl font-black text-black text-lg active:scale-[0.98] transition"
               style={{ background: `linear-gradient(135deg, ${BRAND}, #b6f54f)`, boxShadow: `0 12px 40px -10px ${BRAND}99` }}>
              <Crown size={18} /> Quero meu acesso vitalício
            </a>
            <p className="mt-3 text-sm text-white/50">a partir de <strong className="text-white">R$47</strong> · pague uma vez, use pra sempre</p>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-white/45">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} /> BACEN · Open Finance</span>
            <span className="inline-flex items-center gap-1.5"><Lock size={13} /> Criptografia de ponta</span>
            <span className="inline-flex items-center gap-1.5"><Check size={13} /> 100% LGPD</span>
          </div>
        </div>
      </section>

      {/* ══════════ DASHBOARD (vídeo em loop) ══════════ */}
      <section className="py-16 lg:py-20 px-4 sm:px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-5 gap-8 lg:gap-12 items-center">
          {/* Texto */}
          <div className="lg:col-span-2">
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
              Dashboard inteligente com<br />
              <span style={{ color: BRAND }}>relatórios automáticos</span>
            </h2>
            <p className="mt-5 text-white/60 leading-relaxed max-w-md">
              Acompanhe seus gastos e receitas num painel incrível, com gráficos claros de saldo,
              categorias, planejamento financeiro e fluxo de caixa. Você acessa tudo pelo celular ou
              computador e a Sora organiza tudo pra você automaticamente.
            </p>

            <ul className="mt-7 space-y-3 border-t border-white/10 pt-6">
              {['Dashboard financeiro avançado', 'Gestão de contas e carteiras', 'Exportação de dados em PDF'].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: `color-mix(in srgb, ${BRAND} 18%, transparent)` }}>
                    <Check size={14} style={{ color: BRAND }} strokeWidth={3} />
                  </span>
                  <span className="text-[15px] text-white/85 font-medium">{t}</span>
                </li>
              ))}
            </ul>

            <a href="#ofertas"
               className="mt-8 inline-flex items-center gap-2 px-7 py-4 rounded-2xl font-black text-black text-lg active:scale-[0.98] transition"
               style={{ background: `linear-gradient(135deg, ${BRAND}, #b6f54f)`, boxShadow: `0 12px 40px -10px ${BRAND}99` }}>
              Começar agora <ArrowRight size={18} />
            </a>
          </div>

          {/* Vídeo em loop — decorativo, sem nenhum controle (play/pause/carregamento).
              Arquivo em: public/kit/relatorios.mp4 */}
          <div className="lg:col-span-3 relative rounded-2xl overflow-hidden border border-white/10 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.85)] bg-[#0d0d0d]">
            <video
              className="w-full h-auto block pointer-events-none select-none"
              src="/kit/relatorios.mp4"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              disablePictureInPicture
              controlsList="nodownload nofullscreen noremoteplayback"
              aria-hidden="true"
            />
          </div>
        </div>
      </section>

      {/* ══════════ CONTROLE DOS CARTÕES (cards) ══════════ */}
      <section className="py-16 lg:py-20 px-5 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">Controle absoluto sobre seus cartões.</h2>
            <p className="mt-4 text-white/55 max-w-xl mx-auto leading-relaxed">
              Tenha clareza imediata sobre cada transação e antecipe o impacto financeiro dos próximos meses.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {CARTOES_CARDS.map((c, i) => (
              <div key={c.titulo} className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5 flex flex-col animate-fade-in"
                   style={{ animationDelay: `${i * 80}ms` }}>
                <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d0d] p-4 mb-5 min-h-[210px] flex flex-col justify-center">
                  {c.visual}
                </div>
                <h3 className="text-lg font-bold text-white">{c.titulo}</h3>
                <p className="mt-2 text-sm text-white/55 leading-relaxed flex-1">{c.desc}</p>
                <div className="mt-5 flex items-center gap-1.5" aria-hidden="true">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="h-1.5 rounded-full transition-all"
                          style={{ width: d === i ? 18 : 6, background: d === i ? BRAND : 'rgba(255,255,255,0.15)' }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ DESTAQUES (Clareza total + Em conjunto) ══════════ */}
      {[
        {
          eyebrow: 'Clareza total',
          titulo: 'A Sora detalha exatamente para onde seu dinheiro está indo',
          img: '/landing/para-onde-vai.png',
          alt: 'Painel da Sora detalhando os gastos por categoria',
          sub: 'E ainda te mostra onde dá pra economizar da melhor forma.',
        },
        {
          eyebrow: 'Em conjunto',
          titulo: 'Gestão Compartilhada',
          img: '/landing/gestao-compartilhada.png',
          alt: 'Gestão financeira compartilhada entre casal ou família',
          sub: 'Organize sua vida e suas finanças em casal ou família, cada um com seu próprio acesso.',
        },
      ].map((s) => (
        <section key={s.titulo} className="relative overflow-hidden py-16 px-5 border-t border-white/5">
          <div aria-hidden className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[500px] opacity-15 pointer-events-none"
               style={{ background: `radial-gradient(ellipse, ${BRAND}20 0%, transparent 60%)` }} />
          <div className="relative max-w-4xl mx-auto text-center">
            <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-white/40 mb-4">{s.eyebrow}</p>
            <h2 className="text-2xl sm:text-4xl font-bold leading-[1.1] tracking-tight max-w-3xl mx-auto">{s.titulo}</h2>
            <div className="mt-8 mb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.img} alt={s.alt} loading="lazy" draggable={false}
                   className="mx-auto w-full h-auto sm:max-w-3xl object-contain" />
            </div>
            <p className="text-base lg:text-lg text-white/60 leading-relaxed max-w-2xl mx-auto">{s.sub}</p>
          </div>
        </section>
      ))}

      {/* ══════════ AS 2 OFERTAS (decoy) ══════════ */}
      <section id="ofertas" className="py-16 px-5 border-t border-white/5 scroll-mt-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: BRAND }}>Escolha seu acesso</p>
            <h2 className="text-3xl sm:text-4xl font-bold mt-2">Pague uma vez. É seu pra sempre.</h2>
            {vagas && vagas.restantes > 0 && (
              <div className="max-w-sm mx-auto mt-5">
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="font-semibold uppercase tracking-wider text-amber-400">Vagas de fundador</span>
                  <span className="text-white/60 tabular-nums">Restam {vagas.restantes} de {vagas.vagas}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-5 items-start">
            {/* KIT — R$47 */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
              <p className="text-sm font-bold text-white/70 uppercase tracking-wider">Kit Organização</p>
              <div className="flex items-end gap-1 mt-3">
                <span className="text-white/50 text-lg mb-1">R$</span>
                <span className="text-5xl font-black tabular-nums leading-none">47</span>
                <span className="text-white/50 text-sm mb-1">uma vez</span>
              </div>
              <p className="text-white/45 text-sm mt-1">As 8 ferramentas pra organizar tudo pelo painel.</p>
              <a href="/checkout-vitalicio?tier=kit"
                 className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-bold border border-white/15 hover:bg-white/5 transition">
                Começar com o Kit
              </a>
              <ul className="mt-6 space-y-2.5 text-sm">
                {FERRAMENTAS.map((f) => (
                  <li key={f.nome} className="flex items-center gap-2.5 text-white/80">
                    <Check size={15} style={{ color: BRAND }} className="flex-shrink-0" /> {f.nome}
                  </li>
                ))}
                <li className="flex items-center gap-2.5 text-white/35"><X size={15} className="flex-shrink-0" /> Sora no WhatsApp</li>
                <li className="flex items-center gap-2.5 text-white/35"><X size={15} className="flex-shrink-0" /> Open Finance, foto de nota, painel do casal</li>
              </ul>
            </div>

            {/* COMPLETA — R$97 (recomendado) */}
            <div className="relative rounded-3xl p-6 sm:p-8 border-2"
                 style={{ borderColor: BRAND, background: 'linear-gradient(160deg, #0f1a10 0%, #070707 60%)' }}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-black text-black"
                   style={{ background: BRAND }}>★ MAIS ESCOLHIDO</div>
              <p className="text-sm font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: BRAND }}>
                <Crown size={15} /> Sora Completa
              </p>
              <div className="mt-3">
                <p className="text-2xl font-black text-white tabular-nums leading-none">12x de R$9,87</p>
                <p className="text-white/50 text-sm mt-1">ou R$97 à vista · pra sempre</p>
              </div>
              <p className="text-white/55 text-sm mt-2">Tudo do Kit <strong className="text-white">+ a Sora no seu WhatsApp</strong> e a Sora inteira.</p>
              <a href="/checkout-vitalicio?tier=completa"
                 className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-black text-black active:scale-[0.98] transition"
                 style={{ background: `linear-gradient(135deg, ${BRAND}, #b6f54f)` }}>
                <Crown size={17} /> Quero a Sora Completa
              </a>
              <ul className="mt-6 space-y-2.5 text-sm">
                <li className="flex items-center gap-2.5 font-semibold"><Check size={15} style={{ color: BRAND }} className="flex-shrink-0" /> As 8 ferramentas do Kit</li>
                <li className="flex items-center gap-2.5 text-white"><MessageCircle size={15} style={{ color: BRAND }} className="flex-shrink-0" /> <strong>Sora no WhatsApp</strong> (texto, áudio e foto)</li>
                <li className="flex items-center gap-2.5"><Camera size={15} style={{ color: BRAND }} className="flex-shrink-0" /> Nota fiscal por foto (lança sozinha)</li>
                <li className="flex items-center gap-2.5"><Building2 size={15} style={{ color: BRAND }} className="flex-shrink-0" /> Open Finance — conecta seus bancos</li>
                <li className="flex items-center gap-2.5"><Users size={15} style={{ color: BRAND }} className="flex-shrink-0" /> Painel do casal (gestão a dois)</li>
                <li className="flex items-center gap-2.5"><Bell size={15} style={{ color: BRAND }} className="flex-shrink-0" /> Avisos e resumos automáticos</li>
                <li className="flex items-center gap-2.5"><Zap size={15} style={{ color: BRAND }} className="flex-shrink-0" /> + Sora Grow (hábitos, agenda, saúde…)</li>
                {[
                  'Importação OFX',
                  'Avisos de Compromissos',
                  'Integrações Hotmart, Kiwify, Eduzz, Stripe',
                  'Lembretes de contas',
                  'Alertas e limites de gastos',
                  'Exportação de dados',
                  'Painel DRE completo',
                  'Organização de Hábitos, Agenda, Tarefas, Estudos, Bem Estar',
                  'Controle de Medicação com alertas',
                  'Cálculo de Macros e Calorias por foto ou mensagem',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 leading-snug">
                    <Check size={15} style={{ color: BRAND }} className="flex-shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex items-center gap-2 text-amber-300 font-bold text-sm">
                <Sparkles size={15} className="flex-shrink-0" /> Tudo isso e muito mais!
              </p>
            </div>
          </div>
          <p className="text-center text-white/35 text-xs mt-5 flex items-center justify-center gap-1.5">
            <ShieldCheck size={13} /> Pagamento único e seguro · em até 12x ou Pix · 7 dias de garantia
          </p>
        </div>
      </section>

      {/* ══════════ WHATSAPP (por que a Completa) ══════════ */}
      <section className="py-16 px-5 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-5">
            <MessageCircle size={13} style={{ color: BRAND }} />
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/80">O que ninguém mais tem</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold leading-tight">
            Na Sora Completa, você <span style={{ color: BRAND }}>nem abre o app.</span>
          </h2>
          <p className="text-white/60 mt-4 text-lg">
            Manda <span className="text-white font-semibold">&ldquo;gastei 50 no mercado&rdquo;</span> no WhatsApp — por texto, áudio ou até foto da nota —
            e a Sora lança, categoriza e organiza <span className="text-white font-semibold">sozinha</span>. É o jeito mais fácil de controlar dinheiro que já inventaram. Sem planilha. Sem esforço.
          </p>
          <a href="#ofertas" className="mt-7 inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold border border-white/15 hover:bg-white/5 transition">
            Quero a Sora no meu WhatsApp <ArrowRight size={15} />
          </a>
        </div>
      </section>

      {/* ══════════ VALUE STACK ══════════ */}
      <section className="py-16 px-5 border-t border-white/5">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center">Veja o que você leva por menos que uma pizza:</h2>
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-8 space-y-3">
            {[
              ['App de Organização Financeira completo', 'R$197'],
              ['Sora no WhatsApp (texto/áudio/foto)', 'R$297'],
              ['Calculadoras (juros, investimentos, reserva, metas)', 'R$197'],
              ['Controle de Dívidas + Planejamento Anual', 'R$147'],
              ['Open Finance — conecta seus bancos', 'R$147'],
              ['🎁 Painel do Casal (gestão a dois)', 'R$97'],
              ['🎁 PDF: Método Sobra no Fim do Mês', 'R$47'],
            ].map(([item, val]) => (
              <div key={item} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-white/80 flex items-center gap-2"><Check size={14} style={{ color: BRAND }} /> {item}</span>
                <span className="text-white/40 line-through tabular-nums flex-shrink-0">{val}</span>
              </div>
            ))}
            <div className="pt-4 mt-2 border-t border-white/10 flex items-center justify-between">
              <span className="text-white/60">Valor total</span>
              <span className="text-white/40 line-through text-lg tabular-nums">R$1.129</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-lg">Hoje, pra sempre</span>
              <span className="text-3xl font-black tabular-nums" style={{ color: BRAND }}>R$47</span>
            </div>
          </div>
          <div className="mt-6 text-center">
            <a href="#ofertas" className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl font-black text-black text-lg active:scale-[0.98] transition"
               style={{ background: `linear-gradient(135deg, ${BRAND}, #b6f54f)` }}>
              <InfinityIcon size={18} /> Garantir meu acesso
            </a>
          </div>
        </div>
      </section>

      {/* ══════════ GARANTIA ══════════ */}
      <section className="py-14 px-5 border-t border-white/5">
        <div className="max-w-2xl mx-auto rounded-3xl border border-amber-400/30 bg-amber-400/[0.04] p-7 flex items-center gap-5">
          <ShieldCheck size={56} className="text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-amber-300 text-[11px] font-bold uppercase tracking-widest">Garantia incondicional</p>
            <h3 className="text-xl font-bold mt-0.5">7 dias de risco zero</h3>
            <p className="text-white/60 text-sm mt-1">Testa sem medo. Se em 7 dias você não amar, devolvemos <strong className="text-white">100% do seu dinheiro</strong>. O risco é todo nosso.</p>
          </div>
        </div>
      </section>

      {/* ══════════ FAQ ══════════ */}
      <section className="py-16 px-5 border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">Perguntas frequentes</h2>
          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <div key={item.q} className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <button onClick={() => setFaqAberta(faqAberta === i ? null : i)}
                        className="w-full flex items-center justify-between gap-3 p-4 text-left">
                  <span className="font-semibold text-sm">{item.q}</span>
                  <ChevronDown size={18} className={`flex-shrink-0 transition-transform ${faqAberta === i ? 'rotate-180' : ''}`} style={{ color: BRAND }} />
                </button>
                {faqAberta === i && <p className="px-4 pb-4 text-sm text-white/60 leading-relaxed">{item.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ CTA FINAL ══════════ */}
      <section className="py-20 px-5 border-t border-white/5 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-5xl font-black leading-tight">
            Invista em você.<br /><span style={{ color: BRAND }}>O retorno é pra vida toda.</span>
          </h2>
          <p className="text-white/60 mt-4">Sem mensalidade. Sem pegadinha. 100% seu, pra sempre.</p>
          <a href="#ofertas" className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-black text-lg active:scale-[0.98] transition"
             style={{ background: `linear-gradient(135deg, ${BRAND}, #b6f54f)`, boxShadow: `0 12px 40px -10px ${BRAND}99` }}>
            <Crown size={18} /> Quero meu acesso vitalício
          </a>
          <p className="mt-4 text-white/40 text-sm flex items-center justify-center gap-1.5">
            <Lock size={13} /> Pagamento seguro · 7 dias de garantia · acesso imediato
          </p>
        </div>
      </section>

      {/* Barra fixa de CTA no mobile */}
      <Link href="#ofertas"
            className="lg:hidden fixed bottom-0 inset-x-0 z-50 m-3 inline-flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-black shadow-2xl"
            style={{ background: `linear-gradient(135deg, ${BRAND}, #b6f54f)` }}>
        <Crown size={17} /> Garantir acesso · a partir de R$47
      </Link>
    </div>
  );
}
