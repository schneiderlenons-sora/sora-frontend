'use client';

import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

const PERGUNTAS = [
  {
    q: 'O Open Finance é seguro?',
    a: 'Totalmente. A Sora opera dentro do convênio oficial do Banco Central. Você autoriza via app do seu banco, suas credenciais nunca passam pela Sora, e você pode revogar o acesso a qualquer momento direto pelo seu banco. Tudo criptografado ponta-a-ponta.',
  },
  {
    q: 'O WhatsApp da Sora é seguro?',
    a: 'Sim. Cada conta é vinculada a um número único, e a Sora só responde a você. Suas mensagens não são compartilhadas com ninguém e ficam protegidas pela criptografia do próprio WhatsApp. A IA processa só o necessário pra entender e responder.',
  },
  {
    q: 'Quais bancos vocês suportam?',
    a: 'Todos os bancos do Sistema Financeiro Nacional via Open Finance: Nubank, Itaú, Bradesco, Banco do Brasil, Santander, Caixa, C6, Inter, Will, Mercado Pago, PagBank, Sicredi, Sicoob, BTG, Next, Original — e mais 50+ instituições conveniadas.',
  },
  {
    q: 'Preciso instalar algum app?',
    a: 'Não. A Sora roda no seu WhatsApp (que você já tem) e num painel web que você acessa pelo navegador. Tem versão PWA — se quiser, dá pra "instalar" o painel como se fosse um app, sem passar pela App Store.',
  },
  {
    q: 'Como funciona o teste grátis?',
    a: 'No plano Premium e Black, o Sora Grow vem incluso. No Básico, você tem 7 dias pra testar o Grow gratuitamente. Pode cancelar a qualquer momento. Sem letras miúdas.',
  },
  {
    q: 'Como cancelo? Perco meus dados?',
    a: 'Cancela direto pelo painel em 1 clique — sem ligar, sem email. Seus dados ficam disponíveis por 30 dias pra você exportar (CSV/OFX). Depois disso são removidos permanentemente, conforme LGPD.',
  },
  {
    q: 'Funciona pra empreendedor digital?',
    a: 'Sim, é exatamente pra isso que existe o Plano Black. Conecta Hotmart, Kiwify, Eduzz, Stripe via webhook e captura cada venda em tempo real. Sora monta seu DRE, calcula imposto, faz forecast e gera insights automáticos.',
  },
  {
    q: 'Posso compartilhar a conta com família ou sócio?',
    a: 'Sim — a partir do plano Premium. Gestão compartilhada permite que casal, família ou sócio tenham acesso ao mesmo painel financeiro, com transações e metas conjuntas. Cada um com seu login próprio.',
  },
];

export default function Faq() {
  const [aberto, setAberto] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 lg:py-36 border-t border-zinc-200/50 dark:border-white/[0.04]">
      <div className="max-w-3xl mx-auto px-5 sm:px-8">

        <div className="text-center mb-14">
          <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">
            Dúvidas
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.03em]">
            Perguntas<br />
            <span className="text-zinc-400 dark:text-white/30">frequentes.</span>
          </h2>
        </div>

        <div className="space-y-2">
          {PERGUNTAS.map((p, i) => {
            const open_ = aberto === i;
            return (
              <div key={p.q}
                   className="rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-white/40 dark:bg-white/[0.02] backdrop-blur-sm overflow-hidden">
                <button
                  onClick={() => setAberto(open_ ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.02]"
                >
                  <span className="text-base font-bold text-zinc-900 dark:text-white">{p.q}</span>
                  <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all"
                        style={{ background: open_ ? '#61ce70' : 'rgba(0,0,0,0.05)' }}>
                    {open_
                      ? <Minus size={13} className="text-white" />
                      : <Plus size={13} className="text-zinc-700 dark:text-white/70" />}
                  </span>
                </button>
                {open_ && (
                  <div className="px-5 pb-5 animate-[fade-in_250ms_ease-out_both]">
                    <p className="text-sm text-zinc-600 dark:text-white/65 leading-relaxed">{p.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
