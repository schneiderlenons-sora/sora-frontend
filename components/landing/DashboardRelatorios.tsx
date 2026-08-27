'use client';

// ═════════════════════════════════════════════════════════════════════════
// "Dashboard inteligente com relatórios automáticos" — texto + vídeo do painel.
//
// Nasceu inline na /kit e virou componente porque a landing principal passou a
// usar a MESMA seção. Duas cópias do mesmo markup significariam consertar bug
// duas vezes — e a /kit já tem precedente de reaproveitar componente da
// principal dentro do wrapper `.dark` (Personalizacao, MobileShowcase, Labs).
//
// ⚠️ THEME-AWARE, não dark-only. A /kit força tema escuro no `<main>`, então
// as classes `dark:` resolvem sozinhas lá; na forsora.com a seção acompanha o
// tema do visitante. Por isso nada de `text-white` cru — cada cor tem par
// claro/escuro.
// ═════════════════════════════════════════════════════════════════════════

import { Check } from 'lucide-react';
import VideoLazy from '@/components/landing/VideoLazy';

const BRAND = '#61ce70';

const ITENS = [
  'Dashboard financeiro avançado',
  'Gestão de contas e carteiras',
  'Exportação de dados em PDF',
];

export default function DashboardRelatorios() {
  return (
    <section className="py-16 lg:py-20 px-5 border-t border-zinc-200/50 dark:border-white/5">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-5 gap-8 lg:gap-12 items-center">
        {/* Texto — centralizado no mobile, à esquerda no desktop */}
        <div className="lg:col-span-2 text-center lg:text-left">
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
            Dashboard inteligente com<br />
            <span style={{ color: BRAND }}>relatórios automáticos</span>
          </h2>
          <p className="mt-5 text-base sm:text-lg text-zinc-600 dark:text-white/60 leading-relaxed max-w-md mx-auto lg:mx-0">
            Acompanhe seus gastos e receitas num painel incrível, com gráficos claros de saldo,
            categorias, planejamento financeiro e fluxo de caixa. Você acessa tudo pelo celular ou
            computador e a Sora organiza tudo pra você automaticamente.
          </p>

          <ul className="mt-7 space-y-3 border-t border-zinc-200 dark:border-white/10 pt-6 w-fit mx-auto lg:mx-0 text-left">
            {ITENS.map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: `color-mix(in srgb, ${BRAND} 18%, transparent)` }}>
                  <Check size={14} style={{ color: BRAND }} strokeWidth={3} />
                </span>
                <span className="text-[15px] text-zinc-800 dark:text-white/85 font-medium">{t}</span>
              </li>
            ))}
          </ul>

          {/* ⚠️ SEM BOTÃO AQUI. Havia um "Começar agora" nesta coluna, mas o
              CTA da dupla passou a ficar embaixo da seção de cartões, que vem
              logo depois: dois botões a uma rolagem de distância competem
              entre si e o de baixo — que fecha o assunto inteiro — perde
              força. */}
        </div>

        {/* ⚠️ `VideoLazy` E NÃO UM <video> SOLTO. Este arquivo tem 2,5 MB — um
            `<video src>` comum começa a baixar assim que o HTML chega, mesmo
            lá embaixo na página, roubando banda do LCP no 4G. O componente só
            atribui o `src` quando o bloco chega perto da tela, reserva a altura
            pela proporção (sem salto de layout), pausa ao segurar o dedo e
            retoma ao reaparecer.
            ⚠️ Proporção MEDIDA no arquivo: 1920×914. Chutar 16/9 aqui cortaria
            ou deixaria tarja — este é um recorte de tela mais largo que o
            normal. */}
        <div className="lg:col-span-3">
          <VideoLazy
            src="/kit/relatorios.webm"
            aspecto="1920 / 914"
            titulo="Painel da Sora: gráficos de saldo, categorias e fluxo de caixa"
          />
        </div>
      </div>
    </section>
  );
}
