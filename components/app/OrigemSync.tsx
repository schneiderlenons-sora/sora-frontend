'use client';

import { useEffect } from 'react';
import { detectarOrigem } from '@/lib/origem-app';

/**
 * Memoriza, uma vez por carga, se esta sessão veio do app Android.
 *
 * ⚠️ TEM DE RODAR CEDO E EM TODA ROTA, e é por isso que ele mora no provider e
 * não em quem consome a informação. O TWA abre em `/dashboard?fonte=android`, e
 * tanto o parâmetro quanto o `document.referrer` (`android-app://…`) valem só
 * naquela primeira navegação: se ninguém ler antes do primeiro clique, o sinal
 * some e a sessão inteira passa a parecer web.
 *
 * Renderiza `null` de propósito — wrapper com estilo em volta do app quebra
 * `position: fixed` sem avisar (foi o que já aconteceu com o ThemeColorSync).
 */
export default function OrigemSync() {
  useEffect(() => { detectarOrigem(); }, []);
  return null;
}
