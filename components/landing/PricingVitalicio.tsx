'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, Crown, Sparkles, Infinity as InfinityIcon, ShieldCheck } from 'lucide-react';

// Tudo que o vitalício (Premium) inclui — features de todos os planos.
const INCLUI = [
  'Lançamentos ilimitados',
  'WhatsApp ou painel (texto/áudio/imagem)',
  'Contas e cartões ilimitados',
  'Gráficos interativos no painel',
  'Categorias e subcategorias personalizadas',
  'Lembretes de contas',
  'Relatórios financeiros',
  'Alertas e limites de gastos',
  'Importação OFX',
  'Exportação de dados',
  'Gestão compartilhada (casal/família)',
  'Central de Investimentos',
  'Metas com aporte automático',
  'Painel DRE completo',
  'Integrações Hotmart, Kiwify, Eduzz, Stripe',
  'Organização de Hábitos, Agenda, Tarefas, Estudos, Bem Estar',
  'Cálculo de Macros e Calorias por foto ou mensagem',
  'Controle de Medicação com alertas',
  'Avisos de Compromissos',
];

export default function PricingVitalicio() {
  const [vagas, setVagas] = useState<{ vendidos: number; vagas: number; restantes: number } | null>(null);

  useEffect(() => {
    fetch('/api/vitalicio/count').then((r) => r.json()).then(setVagas).catch(() => {});
  }, []);

  const pct = vagas ? Math.min(100, Math.max(4, (vagas.vendidos / vagas.vagas) * 100)) : 0;

  return (
    <section id="pricing" className="relative scroll-mt-24 py-24 lg:py-36 border-t border-zinc-200/50 dark:border-white/[0.04]">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[600px] opacity-30 dark:opacity-20"
             style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.18) 0%, transparent 60%)' }} />
      </div>

      <div className="relative max-w-3xl mx-auto px-5 sm:px-8">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 mb-5">
            <Sparkles size={13} className="text-amber-500 dark:text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
              Oferta de fundador
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.03em]">
            Premium. <span className="inline-flex items-center gap-2">Pra <InfinityIcon size={44} className="text-amber-500 dark:text-amber-400" /></span><br />
            sempre.
          </h2>
          <p className="mt-5 text-lg text-zinc-500 dark:text-white/50 max-w-xl mx-auto">
            Pague <span className="font-semibold text-zinc-800 dark:text-white">uma única vez</span> e tenha o plano completo da Sora <span className="font-semibold text-zinc-800 dark:text-white">para sempre</span>. Sem mensalidade, nunca mais.
          </p>
        </div>

        {/* Card da oferta */}
        <div className="relative overflow-hidden rounded-[28px] p-7 sm:p-9 border border-amber-400/25 shadow-2xl"
             style={{ background: 'linear-gradient(150deg, #1c1917 0%, #0a0a0a 55%, #1c1917 100%)' }}>
          <div className="absolute -top-24 -right-20 w-72 h-72 rounded-full pointer-events-none opacity-25"
               style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 60%)' }} />

          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Crown size={20} className="text-amber-400" />
              <span className="text-white font-bold text-lg">Sora Premium Vitalício</span>
            </div>

            {/* Preço — só o R$9,87 é grande; "12x de" e o resto ficam pequenos */}
            <div className="mt-4">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-white/60 text-sm sm:text-base font-semibold">12x de</span>
                <span className="text-5xl sm:text-6xl font-bold text-white tabular-nums leading-none tracking-tight">R$9,87</span>
              </div>
              <p className="text-white/55 text-sm mt-2">
                ou uma única vez de <span className="font-semibold text-white/80">R$97,00</span>
              </p>
              <p className="text-white/40 text-xs mt-1">
                <span className="line-through">R$79,90/mês</span> na assinatura — aqui você paga uma vez e pronto.
              </p>
            </div>

            {/* Vagas de fundador */}
            {vagas && vagas.restantes > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-amber-300 font-semibold uppercase tracking-wider">Vagas de fundador</span>
                  <span className="text-white/70 tabular-nums">Restam {vagas.restantes} de {vagas.vagas}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all"
                       style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}

            {/* Inclui — 1 coluna no mobile, 2 no desktop */}
            <ul className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {INCLUI.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-white/85 text-sm leading-snug">
                  <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-amber-400/20 flex items-center justify-center">
                    <Check size={11} className="text-amber-400" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 flex items-center gap-2 text-amber-300 font-bold text-sm sm:text-base">
              <Sparkles size={16} className="flex-shrink-0" /> Tudo isso e muito mais!
            </p>

            {/* CTA */}
            <Link
              href="/signup?vitalicio=1"
              className="mt-8 w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold text-black text-lg transition active:scale-[0.98] hover:brightness-105"
              style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }}>
              <Crown size={18} /> Garantir meu vitalício
            </Link>

            <div className="mt-4 flex items-center justify-center gap-2 text-white/40 text-xs">
              <ShieldCheck size={14} /> Pagamento único e seguro via Stripe · acesso imediato
            </div>
          </div>
        </div>

        <p className="text-center text-zinc-400 dark:text-white/30 text-xs mt-6">
          Oferta de lançamento por tempo e vagas limitadas. O preço da assinatura mensal continua disponível normalmente.
        </p>
      </div>
    </section>
  );
}
