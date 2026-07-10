'use client';

import { ShieldCheck, Lock, Eye, RefreshCw } from 'lucide-react';

const BANCOS = [
  { nome: 'Nubank',       cor: '#8A05BE' },
  { nome: 'Itaú',         cor: '#EC7000' },
  { nome: 'Bradesco',     cor: '#CC092F' },
  { nome: 'Banco do Brasil', cor: '#FAA61A' },
  { nome: 'Santander',    cor: '#EC0000' },
  { nome: 'Caixa',        cor: '#0066B3' },
  { nome: 'C6 Bank',      cor: '#202020' },
  { nome: 'Inter',        cor: '#FF7A00' },
  { nome: 'Will Bank',    cor: '#FFD600' },
  { nome: 'Mercado Pago', cor: '#00B1EA' },
  { nome: 'PagBank',      cor: '#FDB022' },
  { nome: 'Sicredi',      cor: '#3F7F3F' },
  { nome: 'BTG',          cor: '#072E5F' },
  { nome: 'Sicoob',       cor: '#003641' },
  { nome: 'Next',         cor: '#00FF5F' },
  { nome: 'Original',     cor: '#00C16E' },
];

const GARANTIAS = [
  { icon: ShieldCheck, titulo: 'Convênio BACEN',     desc: 'Conexão oficial via Open Finance Brasil.' },
  { icon: Lock,        titulo: 'Criptografia ponta-a-ponta', desc: 'Suas credenciais nunca passam pela Sora.' },
  { icon: Eye,         titulo: 'Você revoga quando quiser', desc: 'Acesso pode ser desconectado a qualquer momento.' },
  { icon: RefreshCw,   titulo: 'Atualização em tempo real',  desc: 'Saldo e transações sincronizados automaticamente.' },
];

export default function OpenFinance() {
  return (
    <section className="relative py-24 lg:py-36 border-t border-zinc-200/50 dark:border-white/[0.04]">

      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[700px] opacity-20 dark:opacity-15"
             style={{ background: 'radial-gradient(ellipse, rgba(97,206,112,0.18) 0%, transparent 60%)' }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-5 sm:px-8">

        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">
            Open Finance
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.03em] max-w-3xl mx-auto">
            Não quer nem digitar?<br />
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #61ce70 0%, #4DAE61 100%)' }}>
              Conecte seu banco.
            </span>
          </h2>
          <p className="mt-6 text-lg lg:text-xl text-zinc-600 dark:text-white/60 leading-relaxed max-w-2xl mx-auto">
            Cada transação que cai no seu banco aparece organizada e categorizada na Sora.
            Sem CSV, sem importação manual.
          </p>
        </div>

        {/* Carrossel de bancos infinito */}
        <div className="relative mb-16 -mx-5 sm:-mx-8">
          {/* Fade laterais */}
          <div className="absolute inset-y-0 left-0 w-24 z-10 pointer-events-none bg-gradient-to-r from-white to-transparent dark:from-[#0a0a0a]" />
          <div className="absolute inset-y-0 right-0 w-24 z-10 pointer-events-none bg-gradient-to-l from-white to-transparent dark:from-[#0a0a0a]" />

          <div className="overflow-hidden">
            <div className="flex gap-3 animate-[marquee_45s_linear_infinite] whitespace-nowrap py-2"
                 style={{ width: 'max-content' }}>
              {[...BANCOS, ...BANCOS].map((banco, i) => (
                <div key={`${banco.nome}-${i}`}
                     className="inline-flex items-center gap-2.5 px-4 py-3 rounded-2xl border border-zinc-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.02] backdrop-blur-sm">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold"
                       style={{ background: banco.cor }}>
                    {banco.nome.charAt(0)}
                  </div>
                  <span className="text-sm font-semibold text-zinc-700 dark:text-white/80">{banco.nome}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Garantias 2x2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-12">
          {GARANTIAS.map(g => {
            const Icon = g.icon;
            return (
              <div key={g.titulo}
                   className="flex items-start gap-4 p-5 rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-white/40 dark:bg-white/[0.02]">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                     style={{ background: 'rgba(97,206,112,0.12)' }}>
                  <Icon size={18} style={{ color: '#61ce70' }} />
                </div>
                <div>
                  <h4 className="font-bold text-base mb-1">{g.titulo}</h4>
                  <p className="text-sm text-zinc-600 dark:text-white/60 leading-relaxed">{g.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selo BACEN */}
        <div className="flex items-center justify-center gap-6 text-zinc-500 dark:text-white/40">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} />
            <span className="text-xs font-bold tracking-widest uppercase">Autorizado pelo BACEN</span>
          </div>
          <span className="w-px h-4 bg-zinc-300 dark:bg-white/15" />
          <span className="text-xs font-bold tracking-widest uppercase">100% LGPD</span>
        </div>
      </div>
    </section>
  );
}
