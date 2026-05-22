'use client';

import { useState } from 'react';
import { Wallet, Sparkles, Briefcase, ChevronRight } from 'lucide-react';

type Pilar = {
  id: 'finance' | 'grow' | 'negocios';
  icon: any;
  cor: string;
  badge: string;
  titulo: string;
  features: { titulo: string; desc: string }[];
};

const PILARES: Pilar[] = [
  {
    id: 'finance',
    icon: Wallet,
    cor: '#61ce70',
    badge: 'Sora Finance',
    titulo: 'Dinheiro organizado, decisões certeiras.',
    features: [
      { titulo: 'Lançamentos por WhatsApp',  desc: '"Gastei 50 no mercado" — Sora interpreta, categoriza e lança. Texto, áudio ou foto da nota fiscal.' },
      { titulo: 'Open Finance',              desc: 'Conecte seu banco direto via convênio BACEN. Transações importadas em tempo real, sem CSV.' },
      { titulo: 'Contas e cartões',          desc: 'Quantos quiser. Visualização de saldo total, fatura, próximos vencimentos e parcelas.' },
      { titulo: 'Investimentos',             desc: 'Cripto, ações, FIIs, renda fixa. Cálculo automático de aporte para bater suas metas. Rentabilidade ao vivo.' },
      { titulo: 'Dívidas e parcelas',        desc: 'Empréstimo, financiamento, consignado. Sora calcula juros, agenda lembretes e mostra projeção de quitação.' },
      { titulo: 'Limites por categoria',     desc: 'Alertas automáticos quando você passa do limite — antes de virar problema.' },
      { titulo: 'Metas com aporte automático', desc: 'Defina o objetivo, prazo e perfil. Sora calcula quanto poupar por mês para chegar lá.' },
      { titulo: 'Relatórios financeiros',    desc: 'Gráficos interativos, comparativos mês-a-mês, projeção de patrimônio.' },
    ],
  },
  {
    id: 'grow',
    icon: Sparkles,
    cor: '#7c3aed',
    badge: 'Sora Grow',
    titulo: 'A vida que você quer, dia após dia.',
    features: [
      { titulo: 'Hábitos com streak',        desc: 'Check-in pelo zap. Heatmap GitHub-style, conquistas dinâmicas, próximo marco visível.' },
      { titulo: 'Saúde completa',            desc: 'Consultas, remédios (com lembrete automático no horário), treinos, peso, pressão e nutrição.' },
      { titulo: 'Estudos integrados',        desc: 'Faculdade, concursos, cursos. Sessões cronometradas, provas, notas, metas semanais.' },
      { titulo: 'Tarefas e checklist',       desc: 'Lembretes contextuais. Sora avisa no momento certo, não te enche fora da hora.' },
      { titulo: 'Casa',                      desc: 'Lista de compras, manutenção, pets, IPTU. Tudo que faz a casa funcionar sem você lembrar.' },
      { titulo: 'Bem-estar',                 desc: 'Mood tracking, sono, gratidão. Conecta com hábitos e mostra padrões.' },
    ],
  },
  {
    id: 'negocios',
    icon: Briefcase,
    cor: '#fbbf24',
    badge: 'Sora Negócios · Plano Black',
    titulo: 'Seu DRE em tempo real. Sem planilha, sem contador caro.',
    features: [
      { titulo: 'DRE detalhado',             desc: 'Receita bruta → taxas → impostos → custos → lucro. Drill-down por plataforma e produto.' },
      { titulo: 'Integrações automáticas',   desc: 'Hotmart, Kiwify, Eduzz, Stripe. Webhook em tempo real captura cada venda, reembolso e chargeback.' },
      { titulo: 'Importação histórica',      desc: 'Últimos 90 dias importados na conexão. Não perde nada do que já aconteceu.' },
      { titulo: 'Insights da IA',            desc: 'Alertas automáticos: "Seu lucro caiu 18% essa semana. Stripe puxou mais que Hotmart."' },
      { titulo: 'Conciliação automática',    desc: 'Venda Hotmart × depósito no banco — cruzamento automático para não contar duas vezes.' },
      { titulo: 'Forecast 3 meses',          desc: 'EMA + tendência. Projeção de receita e lucro com nível de confiança.' },
      { titulo: 'Wrapped compartilhável',    desc: 'Resumo mensal estilo Spotify Wrapped. Slides 9:16 prontos pra postar.' },
      { titulo: 'Config tributária',         desc: 'MEI, Simples Nacional, Lucro Presumido. Sora reserva o imposto automático no DRE.' },
    ],
  },
];

export default function Features() {
  const [ativo, setAtivo] = useState<Pilar['id']>('finance');
  const pilar = PILARES.find(p => p.id === ativo)!;
  const Icon = pilar.icon;

  return (
    <section id="features" className="relative py-24 lg:py-36 border-t border-zinc-200/50 dark:border-white/[0.04]">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">

        <div className="text-center mb-12 lg:mb-16">
          <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">
            Recursos
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.03em] max-w-3xl mx-auto">
            Tudo que você precisa.<br />
            <span className="text-zinc-400 dark:text-white/30">Nada que você não precisa.</span>
          </h2>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-1 bg-zinc-100/80 dark:bg-white/[0.04] backdrop-blur-sm rounded-2xl p-1.5 border border-zinc-200/60 dark:border-white/[0.06]">
            {PILARES.map(p => {
              const ativo_ = ativo === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setAtivo(p.id)}
                  className={`relative px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                    ativo_
                      ? 'text-white shadow-md'
                      : 'text-zinc-600 dark:text-white/60 hover:text-zinc-950 dark:hover:text-white'
                  }`}
                  style={ativo_ ? { background: `linear-gradient(135deg, ${p.cor} 0%, ${escurecer(p.cor)} 100%)` } : {}}
                >
                  {p.badge.split(' · ')[0]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Conteúdo da tab */}
        <div key={ativo} className="animate-[fade-in_400ms_ease-out_both]">
          {/* Headline */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
                 style={{ background: `${pilar.cor}15`, border: `1px solid ${pilar.cor}30` }}>
              <Icon size={13} style={{ color: pilar.cor }} />
              <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: pilar.cor }}>
                {pilar.badge}
              </span>
            </div>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight max-w-3xl mx-auto">
              {pilar.titulo}
            </h3>
          </div>

          {/* Grid de features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pilar.features.map((f, i) => (
              <div
                key={f.titulo}
                className="group rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-white/40 dark:bg-white/[0.02] backdrop-blur-sm p-5 transition-all hover:border-zinc-300 dark:hover:border-white/[0.12] hover:-translate-y-0.5"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold"
                       style={{ background: `${pilar.cor}18`, color: pilar.cor }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div>
                    <h4 className="font-bold text-base mb-1">{f.titulo}</h4>
                    <p className="text-sm text-zinc-600 dark:text-white/60 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function escurecer(hex: string, amt = 0.18): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - Math.round(255 * amt));
  const g = Math.max(0, ((n >> 8)  & 0xff) - Math.round(255 * amt));
  const b = Math.max(0,  (n        & 0xff) - Math.round(255 * amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
