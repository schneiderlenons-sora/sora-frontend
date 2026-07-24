import { NextIntlClientProvider } from 'next-intl';
import esMessages from '@/messages/es.json';

// Layout da árvore /es — força o locale ESPANHOL via um NextIntlClientProvider
// aninhado. Ele sobrepõe o provider do layout raiz (que fica "preso" no PT
// porque o layout raiz não re-renderiza na navegação client-side). Assim TODO
// componente client sob /es lê es, independente do header/navegação.
// Ver memória project-i18n-fase1-landing.
export default function EsLayout({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="es" messages={esMessages}>
      {children}
    </NextIntlClientProvider>
  );
}
