'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { PLANOS_DISPLAY } from '@/lib/planos-display';
import { PLANOS_INFO } from '@/lib/stripe';
import type { Origem } from '@/lib/origem-app';

/**
 * O card de escolha que fecha a demonstração — em DOIS MODOS.
 *
 * ⚠️ O MODO ANDROID NÃO MOSTRA PREÇO, NÃO TEM "ASSINAR" E NÃO LINKA PRO
 * CHECKOUT. Não é decisão de gosto: a política de pagamentos do Google exige
 * Play Billing pra vender assinatura dentro de um app da loja e proíbe levar o
 * usuário a outro meio de pagamento por link ou texto persuasivo. O Brasil não
 * está na lista de billing alternativo (só Índia, Coreia do Sul e EEE). Um
 * botão daqui pro Stripe ou pro Mercado Pago é motivo de reprovação na revisão
 * — e de remoção depois, com a conta de desenvolvedor junto.
 *
 * O que o app faz então é o que a política permite: entregar o produto grátis e
 * completo no que ele tem, sem vitrine de preço. A venda continua no site.
 *
 * ⚠️ NÃO DESCREVER O PLANO PAGO AQUI TAMBÉM É PROPOSITAL. Listar o que "você
 * teria assinando" dentro do app é exatamente o texto persuasivo que a política
 * cita. O modo Android fala só do que a pessoa TEM.
 */
export default function CardPlanos({
  origem,
  onEscolher,
}: {
  origem: Origem;
  onEscolher: () => void;
}) {
  const router = useRouter();
  const [anual, setAnual] = useState(false);

  const fundo = 'radial-gradient(120% 80% at 50% 0%, #10231a 0%, #070a08 55%, #000 100%)';

  /* ── MODO ANDROID: só o modo manual, sem preço nenhum ────────────────── */
  if (origem === 'android') {
    return (
      <div className="fixed inset-0 z-[100] overflow-y-auto text-white" style={{ background: fundo }}>
        <div
          className="min-h-full flex flex-col items-center justify-center px-6 py-10"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 2.5rem)' }}
        >
          <div className="w-full max-w-md text-center motion-safe:animate-[slide-up_520ms_cubic-bezier(0.22,1,0.36,1)_both]">
            <span
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
              style={{ background: 'rgba(97,206,112,0.14)', color: '#61ce70' }}
              aria-hidden
            >
              <Sparkles size={26} />
            </span>

            <h1 className="text-[28px] font-bold leading-tight tracking-tight">
              Comece agora, de graça
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-white/60">
              O modo manual é seu, sem prazo e sem cartão. Você lança pelo painel e
              organiza tudo desde hoje.
            </p>

            <ul className="mt-7 space-y-3 text-left">
              {[
                'Lançamentos ilimitados pelo painel',
                'Até 3 contas e 3 cartões',
                'Categorias, subcategorias e limites de gasto',
                'Metas, dívidas e parcelamentos',
                'Relatórios e gráficos do mês',
                'Hábitos, tarefas e bem-estar',
              ].map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(97,206,112,0.16)' }}
                    aria-hidden
                  >
                    <Check size={12} style={{ color: '#61ce70' }} />
                  </span>
                  <span className="text-[14.5px] text-white/85 leading-snug">{f}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={onEscolher}
              className="mt-8 w-full h-13 inline-flex items-center justify-center gap-2 rounded-2xl text-[15px] font-bold text-[#0A2A14] shadow-xl active:scale-[0.99] transition-transform"
              style={{ background: '#61ce70', minHeight: 52 }}
            >
              Começar agora <ArrowRight size={17} />
            </button>

            {/* Honestidade sem venda: diz que existe mais, sem preço, sem link e
                sem lista do que é. É a linha que separa informar de induzir. */}
            <p className="mt-4 text-[12.5px] leading-relaxed text-white/35">
              Alguns recursos fazem parte dos planos assinados e aparecem marcados
              com um cadeado dentro do app.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ── MODO WEB: a vitrine completa ────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto text-white" style={{ background: fundo }}>
      <div
        className="min-h-full flex flex-col items-center justify-center px-5 py-10"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 2.5rem)' }}
      >
        <div className="w-full max-w-md motion-safe:animate-[slide-up_520ms_cubic-bezier(0.22,1,0.36,1)_both]">
          <div className="text-center">
            <h1 className="text-[28px] font-bold leading-tight tracking-tight">
              Escolha como quer usar
            </h1>
            <p className="mt-2.5 text-[15px] text-white/60">
              Comece de graça e mude quando quiser.
            </p>
          </div>

          {/* Ciclo. O desconto fica no botão ANUAL enquanto o mensal está
              escolhido — é ali que ele muda a decisão. */}
          <div className="mt-6 flex justify-center">
            <div className="inline-flex items-center gap-1 p-1.5 rounded-2xl bg-white/[0.06] border border-white/10">
              {([['Mensal', false], ['Anual', true]] as const).map(([label, v]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setAnual(v)}
                  className={`relative px-5 py-2.5 text-[13.5px] font-bold rounded-xl transition-colors ${
                    anual === v ? 'bg-white text-black' : 'text-white/70 hover:text-white'
                  }`}
                  style={{ minHeight: 44 }}
                >
                  {label}
                  {v && !anual && (
                    <span
                      className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full text-[9px] font-black text-[#0A2A14]"
                      style={{ background: '#61ce70' }}
                    >
                      -20%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Planos pagos */}
          <div className="mt-6 space-y-3">
            {PLANOS_DISPLAY.map((p) => {
              const info = PLANOS_INFO[p.id];
              const valor = anual ? info.anual : info.mensal;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => router.push(`/planos?intent=upgrade&plano=${p.id}&ciclo=${anual ? 'anual' : 'mensal'}`)}
                  className="w-full text-left rounded-2xl p-5 border transition-all active:scale-[0.99]"
                  style={{
                    borderColor: p.destaque ? p.cor : 'rgba(255,255,255,0.10)',
                    background: p.destaque ? 'rgba(97,206,112,0.07)' : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-bold text-[17px]">{p.nome}</span>
                    <span className="tabular">
                      <span className="text-[13px] text-white/50">R$ </span>
                      <span className="text-[22px] font-bold">
                        {valor.toFixed(2).replace('.', ',')}
                      </span>
                      <span className="text-[13px] text-white/50">/mês</span>
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-white/55">{p.subtitulo}</p>
                </button>
              );
            })}
          </div>

          {/* O grátis, com o mesmo peso visual de uma escolha — não como
              rodapé de desistência. */}
          <button
            type="button"
            onClick={onEscolher}
            className="mt-4 w-full rounded-2xl p-5 border border-white/10 bg-white/[0.03] text-left active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold text-[17px]">Modo manual</span>
              <span className="text-[13px] font-bold" style={{ color: '#61ce70' }}>Grátis</span>
            </div>
            <p className="mt-1 text-[13px] text-white/55">
              Lance pelo painel, sem prazo e sem cartão.
            </p>
          </button>

          <p className="mt-5 text-center text-[12px] text-white/35 inline-flex items-center justify-center gap-1.5 w-full">
            <Lock size={11} /> Pagamento seguro pelo Stripe. Cancele quando quiser.
          </p>
        </div>
      </div>
    </div>
  );
}
