import { getRequestConfig } from 'next-intl/server';
import { headers } from 'next/headers';

export const LOCALES = ['pt', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'pt';

// Mapa locale interno → tag BCP-47 usada no <html lang> e no Intl.
export const HTML_LANG: Record<Locale, string> = {
  pt: 'pt-BR',
  es: 'es-MX',
};

export function normalizeLocale(value: string | null | undefined): Locale {
  return value === 'es' ? 'es' : DEFAULT_LOCALE;
}

// NÃO usamos o i18n-routing do next-intl (que prefixaria tudo). O locale é
// resolvido no middleware pelo pathname (/es → es, senão pt) e injetado via
// header `x-sora-locale`. Aqui só lemos esse header e carregamos o catálogo.
export default getRequestConfig(async () => {
  const headerLocale = (await headers()).get('x-sora-locale');
  const locale = normalizeLocale(headerLocale);

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
