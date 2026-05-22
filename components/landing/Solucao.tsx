'use client';

import { Wallet, Sparkles, Briefcase, ArrowRight } from 'lucide-react';

const PILARES = [
  {
    cor: '#61ce70',
    badge: 'Sora Finance',
    titulo: 'Dinheiro sob controle.',
    desc: 'Transações automáticas, contas, cartões, dívidas, metas e investimentos. Tudo via WhatsApp ou painel.',
    items: ['Lançamentos por áudio, imagem ou texto', 'Open Finance — conexão direta com seu banco', 'Limites por categoria + alertas inteligentes', 'Investimentos com cálculo automático de aportes'],
    icon: Wallet,
    bg: 'from-emerald-500/8 to-emerald-500/0',
  },
  {
    cor: '#7c3aed',
    badge: 'Sora Grow',
    titulo: 'Vida sob controle.',
    desc: 'Hábitos, saúde, dietas, estudos, casa, bem-estar. Sora te ajuda a ser quem você quer ser — todo dia.',
    items: ['Hábitos com streak + heatmap GitHub-style', 'Saúde: consultas, remédios, treinos, peso', 'Estudos: cursos, provas, sessões cronometradas', 'Tarefas e bem-estar conectados ao seu calendário'],
    icon: Sparkles,
    bg: 'from-violet-500/8 to-violet-500/0',
  },
  {
    cor: '#fbbf24',
    badge: 'Sora Negócios',
    titulo: 'Negócio sob controle.',
    desc: 'Para empreendedores digitais. DRE em tempo real, integrações Hotmart/Stripe/Kiwify e insights da IA.',
    items: ['DRE detalhado com drill-down por plataforma', 'Webhook em tempo real — Hotmart, Kiwify, Stripe, Eduzz', 'Forecast de receita 3 meses + insights da IA', 'Wrapped mensal compartilhável'],
    icon: Briefcase,
    bg: 'from-amber-500/8 to-amber-500/0',
    plan: 'Plano Black',
  },
];

export default function Solucao() {
  return (
    <section id="solucao" className="relative py-24 lg:py-36 border-t border-zinc-200/50 dark:border-white/[0.04]">

      {/* BG */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] opacity-30 dark:opacity-20"
             style={{ background: 'radial-gradient(ellipse, rgba(97,206,112,0.15) 0%, transparent 60%)' }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">

        {/* Section label + title */}
        <div className="text-center mb-16 lg:mb-20">
          <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">
            A solução
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.03em] max-w-3xl mx-auto">
            A Sora é{' '}
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #61ce70 0%, #4DAE61 100%)' }}>
              uma só coisa
            </span>:<br />
            organização total via WhatsApp.
          </h2>
          <p className="mt-6 text-lg lg:text-xl text-zinc-600 dark:text-white/60 leading-relaxed max-w-2xl mx-auto">
            Três pilares conectados. Um produto. Uma assinatura.
          </p>
        </div>

        {/* Pilares */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {PILARES.map((p, i) => {
            const Icon = p.icon;
            return (
              <div
                key={p.badge}
                className={`group relative rounded-3xl border border-zinc-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.02] backdrop-blur-sm p-8 lg:p-10 overflow-hidden transition-all hover:border-zinc-300 dark:hover:border-white/[0.14] hover:-translate-y-1 duration-300`}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {/* Gradient bg */}
                <div className={`absolute inset-0 bg-gradient-to-br ${p.bg} opacity-60 dark:opacity-100 pointer-events-none`} />

                {/* Glow on hover */}
                <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-500 pointer-events-none"
                     style={{ background: `radial-gradient(circle, ${p.cor}, transparent 60%)` }} />

                <div className="relative">
                  {/* Plan badge */}
                  {p.plan && (
                    <span className="absolute -top-2 -right-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest text-black shadow-md"
                          style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' }}>
                      {p.plan}
                    </span>
                  )}

                  {/* Icon */}
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
                       style={{ background: `${p.cor}18`, border: `1px solid ${p.cor}33` }}>
                    <Icon size={20} style={{ color: p.cor }} />
                  </div>

                  {/* Badge nome */}
                  <p className="text-[11px] font-bold tracking-widest uppercase mb-2" style={{ color: p.cor }}>
                    {p.badge}
                  </p>

                  {/* Title */}
                  <h3 className="text-3xl font-bold tracking-tight leading-tight mb-3">
                    {p.titulo}
                  </h3>

                  {/* Desc */}
                  <p className="text-sm text-zinc-600 dark:text-white/60 leading-relaxed mb-6">
                    {p.desc}
                  </p>

                  {/* Items */}
                  <ul className="space-y-2.5 mb-2">
                    {p.items.map(item => (
                      <li key={item} className="flex items-start gap-2 text-[13px] text-zinc-700 dark:text-white/75 leading-snug">
                        <span className="mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                              style={{ background: `${p.cor}25` }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.cor }} />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center mt-12 text-sm text-zinc-500 dark:text-white/50">
          Os três pilares conversam entre si.{' '}
          <span className="text-zinc-900 dark:text-white font-semibold">Uma só assinatura</span>, organização completa.
        </p>
      </div>
    </section>
  );
}
