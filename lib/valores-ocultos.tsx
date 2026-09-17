'use client';

// =============================================================================
// Ocultar valores do painel — o olho dos apps de banco.
//
// ⚠️ O BOTÃO JÁ EXISTIA EM 6 TELAS, cada uma com o SEU `useState(false)`.
// Era um estado por tela: esconder em /transacoes e navegar pra /contas
// devolvia todos os números à vista, e um F5 zerava tudo. Pra quem liga isso
// porque tem gente do lado, um "esconder" que se desfaz sozinho na próxima aba
// é pior do que não existir. Aqui o estado é UM só, do painel inteiro.
//
// ⚠️ A PERSISTÊNCIA É COOKIE, NÃO localStorage — e isso é o que evita o
// FLASH DOS VALORES. As telas do painel são SSR: o HTML já chega pintado com
// os números (`lib/ssr-data.ts` + `fallbackData`). Com localStorage o servidor
// não teria como saber da preferência, mandaria os valores à vista e só depois
// da hidratação eles virariam pontos — ou seja, o número aparece por um
// instante exatamente pra quem pediu pra escondê-lo. O cookie é lido em
// `app/(app)/layout.tsx` (Server Component) e desce como estado inicial, então
// o primeiro paint já sai mascarado e não há hydration mismatch.
//
// ⚠️ A MÁSCARA TEM LARGURA FIXA, nunca proporcional ao valor. Se a quantidade
// de pontos acompanhasse os dígitos, "•••••••••" × "••••" entregaria a ordem
// de grandeza — que é justamente o que a pessoa quer esconder.
// =============================================================================

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/** Nome do cookie. Lido no servidor pelo shell do painel. */
export const COOKIE_VALORES = 'sora_valores_ocultos';

/** Máscara padrão. Comprimento fixo de propósito (ver cabeçalho). */
export const MASCARA = '••••';

interface Ctx {
  ocultos: boolean;
  alternar: () => void;
}

// Fora do provider (landing, login) nada é ocultado — o default é "à vista".
const ValoresCtx = createContext<Ctx>({ ocultos: false, alternar: () => {} });

export function ValoresProvider({
  inicial = false,
  children,
}: {
  inicial?: boolean;
  children: React.ReactNode;
}) {
  const [ocultos, setOcultos] = useState(inicial);

  const alternar = useCallback(() => {
    setOcultos((v) => {
      const novo = !v;
      // Um ano: é preferência de tela, não sessão. `SameSite=Lax` porque o
      // cookie só precisa valer na navegação do próprio site.
      try {
        document.cookie =
          `${COOKIE_VALORES}=${novo ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`;
      } catch {
        /* cookie bloqueado (modo restrito): vale só nesta sessão */
      }
      return novo;
    });
  }, []);

  const valor = useMemo(() => ({ ocultos, alternar }), [ocultos, alternar]);
  return <ValoresCtx.Provider value={valor}>{children}</ValoresCtx.Provider>;
}

export function useValores(): Ctx {
  return useContext(ValoresCtx);
}

/**
 * Envolve um formatador de dinheiro: com os valores ocultos, ele passa a
 * devolver a máscara.
 *
 * ⚠️ É ISTO QUE COBRE TOOLTIP E EIXO DE GRÁFICO. Recharts recebe uma FUNÇÃO
 * formatadora e devolve string — não dá pra trocar por JSX ali. Envolvendo o
 * formatador, todo ponto que já chamava `fmt(v)` passa a mascarar sem que a
 * chamada mude, inclusive dentro dos gráficos.
 *
 * ⚠️ NÃO usar em campo de formulário: não dá pra editar pontos. Onde o valor é
 * digitável (o Planejamento anual dos Relatórios), o componente continua
 * chamando o formatador CRU de propósito.
 *
 * `f` precisa ser estável — uma função nova a cada render refaria o memo à
 * toa. Nas telas ele vem do `useDinheiro()` (lib/moeda-base), que devolve a
 * MESMA função enquanto a moeda base não muda; um formatador compacto declarado
 * no módulo entra pelo `useComSimbolo`, que tem a mesma garantia.
 */
export function useFmt<T extends (...args: never[]) => string>(f: T, mascara: string = MASCARA): T {
  const { ocultos } = useValores();
  return useMemo(() => (ocultos ? ((() => mascara) as unknown as T) : f), [ocultos, f, mascara]);
}
