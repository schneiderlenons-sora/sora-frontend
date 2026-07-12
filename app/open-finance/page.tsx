'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { Landmark, Wrench, FileUp, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

const BRAND = '#61D17B';

// Open Finance temporariamente EM ATUALIZAÇÃO. A integração via Pluggy foi
// removida (não puxava tudo — cartões virtuais, investimentos feitos no banco).
// A nova conexão entra aqui quando estiver pronta. Aba visível a TODOS.
export default function OpenFinancePage() {
  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 pb-24 space-y-6">
        {/* Hero */}
        <div className="space-y-3 pt-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl"
               style={{ background: `color-mix(in srgb, ${BRAND} 14%, transparent)` }}>
            <Landmark size={22} style={{ color: BRAND }} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Open Finance</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Conecte suas contas bancárias com segurança e deixe a Sora importar e
            atualizar seus saldos e transações automaticamente.
          </p>
        </div>

        {/* Card — Em atualização */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8">
          <div aria-hidden className="absolute -top-16 -right-12 w-52 h-52 rounded-full opacity-20 pointer-events-none"
               style={{ background: `radial-gradient(circle, ${BRAND} 0%, transparent 60%)` }} />

          <div className="relative space-y-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl flex-shrink-0"
                    style={{ background: `color-mix(in srgb, ${BRAND} 16%, transparent)` }}>
                <Wrench size={22} style={{ color: BRAND }} />
              </span>
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest"
                      style={{ background: `color-mix(in srgb, ${BRAND} 14%, transparent)`, color: BRAND }}>
                  <Sparkles size={11} /> Em breve
                </span>
                <h2 className="text-xl font-bold text-foreground tracking-tight mt-1.5">Em atualização</h2>
              </div>
            </div>

            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed [&_b]:text-foreground [&_b]:font-semibold">
              <p>
                Estamos migrando o Open Finance para uma conexão <b>nova, mais moderna e completa</b>.
                Ao usar a integração anterior, percebemos que ela <b>não trazia todos os seus dados
                com precisão</b> — <b>cartões virtuais</b>, <b>investimentos feitos direto no banco</b> e
                alguns lançamentos ficavam de fora ou vinham incompletos.
              </p>
              <p>
                Como a sua organização financeira depende de dados 100% corretos, preferimos
                <b> pausar essa conexão</b> a te entregar algo pela metade. Já estamos construindo uma
                integração Open Finance <b>bem melhor</b>, que puxa tudo certinho — contas, cartões e
                investimentos — e mantém seus saldos e transações sempre atualizados. Em breve ela
                aparece aqui mesmo. 🚀
              </p>
            </div>

            {/* Recomendação OFX */}
            <div className="rounded-2xl border border-border bg-muted/40 p-4 flex items-start gap-3">
              <FileUp size={18} style={{ color: BRAND }} className="flex-shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground leading-relaxed">
                <p className="font-semibold text-foreground">Quer importar tudo agora?</p>
                <p>
                  Enquanto a nova conexão não chega, você consegue trazer{' '}
                  <b className="text-foreground font-semibold">todas as suas transações de uma vez</b> pela
                  importação <b className="text-foreground font-semibold">OFX</b> nas Contas — é rápido e traz
                  seu extrato completo. 😉
                </p>
              </div>
            </div>

            <a href="/contas-bancarias"
               className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-2xl text-white text-sm font-bold shadow-lg transition-all active:scale-[0.99]"
               style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)`, minHeight: 44 }}>
              <FileUp size={17} /> Importar via OFX <ArrowRight size={16} />
            </a>
          </div>
        </div>

        {/* Selo de segurança */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck size={14} className="text-emerald-500" />
          Conexão via Open Finance regulada — seus dados sempre protegidos.
        </div>
      </div>
    </DashboardLayout>
  );
}
