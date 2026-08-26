'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Segundo bloco da seção "Gestão Compartilhada": quem gastou o que, e quem
// enxerga o quê.
//
// Vive DENTRO da seção (não é uma seção nova) porque é mais informação sobre a
// MESMA função — abrir seção nova quebraria o encadeamento e faria a página
// parecer mais longa do que é. Mesmo motivo do bloco de categorias na seção
// "Clareza total".
//
// ⚠️ `next/image` E NÃO `<img>`: as 5 artes somam ~1,5 MB e a de celular tem
// 1203px de largura pra um slot de ~340px. Servidas cruas, seriam o item mais
// pesado da landing. O otimizador entrega WebP/AVIF no tamanho do slot — e
// `sizes` é obrigatório, senão o Next assume 100vw e escolhe a maior variante,
// desfazendo o ganho.
//
// ⚠️ As três artes da rede de permissões (desktop claro, desktop escuro e
// celular) ficam atrás de `hidden`. Como o `next/image` nasce `loading="lazy"`,
// um elemento escondido nunca intersecta a tela e o navegador NÃO baixa o
// arquivo — é o que impede o celular de pagar por duas artes de desktop que
// jamais vai mostrar.
// ─────────────────────────────────────────────────────────────────────────────

import Image from 'next/image';
import { useTranslations } from 'next-intl';

const DIR = '/landing/gestao-compartilhada';

export default function GestaoCompartilhadaExtra() {
  const t = useTranslations('showcase.compartilhada');

  return (
    <div className="mt-16 sm:mt-20 pt-14 sm:pt-16 border-t border-zinc-200/60 dark:border-white/[0.06]">
      {/* h3, não h2: é subordinado ao título da seção. Pular nível quebra a
          navegação por cabeçalhos do leitor de tela. */}
      <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-[1.15] tracking-[-0.03em] max-w-2xl mx-auto">
        {t('titulo')}
      </h3>

      <p className="mt-5 text-base lg:text-lg text-zinc-600 dark:text-white/60 leading-relaxed max-w-2xl mx-auto">
        {t('desc1')}
      </p>

      {/* 1 — a família, com o gasto de cada um saindo de quem gastou.
          Retrato (1199×1312): container estreito, senão domina a seção. */}
      <div className="mt-12 mx-auto w-full max-w-[340px] sm:max-w-[420px]">
        <Image
          src={`${DIR}/gestao-compartilhada-1.webp`}
          alt={t('altGastos')}
          width={1199}
          height={1312}
          sizes="(max-width: 640px) 85vw, 420px"
          className="w-full h-auto"
        />
      </div>

      {/* 2 — quanto cada pessoa gastou no mês. */}
      <div className="mt-10 mx-auto w-full max-w-[560px] lg:max-w-[680px]">
        <Image
          src={`${DIR}/gestao-compartilhada-2.webp`}
          alt={t('altPessoas')}
          width={1536}
          height={1024}
          sizes="(max-width: 640px) 90vw, 680px"
          className="w-full h-auto"
        />
      </div>

      <p className="mt-16 text-base lg:text-lg text-zinc-600 dark:text-white/60 leading-relaxed max-w-2xl mx-auto">
        {t('desc2')}
      </p>

      {/* 3/4 — a rede de permissões. Arte em RETRATO no celular e em PAISAGEM
          no desktop: a mesma imagem nas duas larguras sairia ilegível numa
          delas. O tema escuro só troca a arte no desktop — a de celular já
          serve os dois. */}
      <div className="mt-10">
        <div className="sm:hidden mx-auto w-full max-w-[420px]">
          <Image
            src={`${DIR}/gestao-compartilhada-4.webp`}
            alt={t('altPermissoes')}
            width={1203}
            height={1307}
            sizes="90vw"
            className="w-full h-auto"
          />
        </div>

        <div className="hidden sm:block mx-auto w-full max-w-[900px]">
          <Image
            src={`${DIR}/gestao-compartilhada-3.webp`}
            alt={t('altPermissoes')}
            width={1672}
            height={941}
            sizes="(max-width: 1024px) 92vw, 900px"
            className="dark:hidden w-full h-auto"
          />
          <Image
            src={`${DIR}/gestao-compartilhada-3-black.webp`}
            alt={t('altPermissoes')}
            width={1672}
            height={941}
            sizes="(max-width: 1024px) 92vw, 900px"
            className="hidden dark:block w-full h-auto"
          />
        </div>
      </div>
    </div>
  );
}
