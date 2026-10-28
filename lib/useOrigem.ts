'use client';

import { useContext, useEffect, useState } from 'react';
import { detectarOrigem, esquecerOrigem, PARAM_ANDROID, type Origem } from './origem-app';
import { ehAppIos } from './app-ios';
import { AppIosContexto } from './app-ios-contexto';

/**
 * `true` SÓ quando a sessão está rodando DENTRO do app nativo (TWA) agora.
 *
 * ⚠️ POR QUE NÃO BASTA `useEhAndroid`: a origem 'android' é PERSISTIDA
 * (localStorage), e o TWA compartilha a storage com o Chrome da mesma origem.
 * Resultado: quem abriu o app UMA vez ficava marcado 'android' também no
 * Chrome — e a trava de venda do Google Play (ofertasDoPlano) escondia os planos
 * no navegador comum, impedindo o upgrade (relato Lushima, out/2026, vitalícia
 * que não conseguia migrar). A política do Play só proíbe vender DENTRO do app;
 * no Chrome do Android a venda é permitida.
 *
 * O sinal confiável de "estou no app agora" é a JANELA STANDALONE (o TWA sempre
 * abre sem barra de navegador). Chrome em aba comum nunca é standalone. Assim a
 * venda é escondida só no app de verdade (Play ok) e volta a aparecer no Chrome.
 */
export function useEhAppNativo(): boolean {
  const origem = useOrigem();            // 'web' até montar (origem persistida)
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    try {
      setStandalone(
        window.matchMedia('(display-mode: standalone)').matches
        || window.matchMedia('(display-mode: fullscreen)').matches
        || (window.navigator as { standalone?: boolean }).standalone === true,
      );
    } catch { /* sem matchMedia (ambiente estranho): fica false, lado seguro = mostra a venda no site */ }
  }, []);
  return origem === 'android' && standalone;
}

/**
 * A origem desta sessão, para componentes.
 *
 * ⚠️ COMEÇA SEMPRE EM 'web' E SÓ MUDA DEPOIS DE MONTAR. O servidor não tem
 * `localStorage`, `document.referrer` nem a URL do cliente: chutar 'android' no
 * primeiro render daria hydration mismatch, e o React descartaria a árvore
 * inteira — o preço seria um flash de tela trocada bem no primeiro contato com
 * o app.
 *
 * 'web' como estado inicial é o lado seguro: no pior caso o app Android pisca o
 * layout da web por um frame. O contrário — a web piscando um app sem forma de
 * assinar — seria perder venda.
 */
export function useOrigem(): Origem {
  const [origem, setOrigem] = useState<Origem>('web');

  useEffect(() => {
    // `?fonte=web` desfaz a marca — é como se testa o fluxo da web no mesmo
    // aparelho onde o app já rodou, sem limpar storage na mão.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get(PARAM_ANDROID) === 'web') esquecerOrigem();
    } catch { /* URL malformada */ }

    setOrigem(detectarOrigem());
  }, []);

  return origem;
}

/** `true` só depois de montar e confirmar que a sessão veio do app Android. */
export function useEhAndroid(): boolean {
  return useOrigem() === 'android';
}

/**
 * `true` dentro do app de IPHONE (App Store) — ver `lib/app-ios.ts`.
 *
 * No painel (`app/(app)`) a resposta vem do SERVIDOR via `AppIosProvider`, já
 * certa no 1º render — sem piscar venda. Fora dele (sem provider) começa em
 * `false` e lê o User-Agent depois de montar, pelo mesmo motivo do `useOrigem`:
 * o servidor não vê o `navigator`, e chutar no 1º render daria hydration mismatch.
 */
export function useEhAppIos(): boolean {
  const doServidor = useContext(AppIosContexto);
  const [ios, setIos] = useState(false);
  useEffect(() => { if (doServidor === null) setIos(ehAppIos()); }, [doServidor]);
  return doServidor ?? ios;
}
