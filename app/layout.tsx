import type { Metadata, Viewport } from 'next';
import { Inter, Pacifico } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { HTML_LANG, normalizeLocale, type Locale } from '@/i18n/request';
import './globals.css';
import Providers from '@/components/providers';
import InstallPwa from '@/components/pwa/InstallPwa';
import MetaPixel from '@/components/analytics/MetaPixel';
import TikTokPixel from '@/components/analytics/TikTokPixel';

// `variable` (e não só className) porque o globals.css referencia a família por
// var(--font-inter). Antes o CSS pedia 'Inter' pelo NOME, que só existia via
// @import do Google Fonts — ou seja, o next/font estava ali sem efeito e a
// fonte vinha de uma requisição que bloqueava o render.
const inter    = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
// Pacifico — script cursivo encorpado, estilo wordmark de marca (Pierre, Disney+, etc)
const pacifico = Pacifico({ subsets: ['latin'], weight: ['400'], variable: '--font-brand', display: 'swap' });

// Metadata locale-aware: título/descrição, og:locale e os alternates hreflang
// (pt-BR na raiz, es-MX em /es) mudam conforme o idioma resolvido no middleware.
export async function generateMetadata(): Promise<Metadata> {
  const locale = normalizeLocale(await getLocale()) as Locale;
  const es = locale === 'es';

  const title = es ? 'Sora — Asistente Financiera' : 'Sora — Assistente Financeira';
  const description = es
    ? 'Organiza tu vida financiera desde WhatsApp. Controla gastos, inversiones y metas en un solo lugar.'
    : 'Organize sua vida financeira pelo WhatsApp. Controle gastos, investimentos e metas em um só lugar.';
  const ogTitle = es ? 'Sora — Tu vida financiera desde WhatsApp' : 'Sora — Sua vida financeira pelo WhatsApp';
  const ogDesc = es
    ? 'Controla gastos, inversiones y metas — solo mandándole un mensaje a Sora.'
    : 'Controle gastos, investimentos e metas — só mandando mensagem pra Sora.';

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://forsora.com'),
    title,
    description,
    manifest: '/manifest.json',
    applicationName: 'Sora',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: 'Sora',
    },
    formatDetection: {
      telephone: false,
    },
    alternates: {
      canonical: es ? '/es' : '/',
      languages: {
        'pt-BR': '/',
        'es-MX': '/es',
        'x-default': '/',
      },
    },
    icons: {
      icon: '/brands/sora.png',
      // apple-touch-icon (ícone da PWA no iOS) precisa ser FULL-BLEED — o verde
      // cobre o quadrado todo. O /brands/sora.png é um círculo com fundo
      // transparente → o iOS mostrava os cantos como borda branca.
      apple: '/sora-icon.png',
      shortcut: '/brands/sora.png',
    },
    openGraph: {
      title: ogTitle,
      description: ogDesc,
      type: 'website',
      locale: es ? 'es_MX' : 'pt_BR',
      alternateLocale: es ? 'pt_BR' : 'es_MX',
      siteName: 'Sora',
      // images é auto-injetado pelo Next a partir de app/opengraph-image.tsx
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDesc,
      // images é auto-injetado pelo Next a partir de app/twitter-image.tsx
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Painel estático no mobile (pedido do usuário): sem pinch-zoom nem auto-zoom
  // ao focar campo. Trade-off de acessibilidade assumido conscientemente.
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAFA' },
    { media: '(prefers-color-scheme: dark)',  color: '#09090B' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = normalizeLocale(await getLocale()) as Locale;
  const messages = await getMessages();

  return (
    <html lang={HTML_LANG[locale]} suppressHydrationWarning className={`${pacifico.variable} ${inter.variable}`}>
      <head>
        {/* Abre a conexão com o backend (DNS + TLS) enquanto o JS ainda carrega.
            A chamada que o LCP espera só sai depois da hidratação (~1,4s) e
            pagava o handshake inteiro ali, com a rede já congestionada. */}
        {process.env.NEXT_PUBLIC_API_URL && (
          <link rel="preconnect" href={process.env.NEXT_PUBLIC_API_URL} crossOrigin="anonymous" />
        )}
      </head>
      <body className={inter.className} suppressHydrationWarning>
        {/* Cor temática escolhida — aplica --primary antes do paint (anti-flash) */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var m={verde:'134 55% 60%',azul:'217 91% 60%',roxo:'262 83% 58%',laranja:'25 95% 53%',rosa:'330 81% 60%',vermelho:'0 72% 55%'};var id=localStorage.getItem('sora-brand')||'verde';document.documentElement.style.setProperty('--primary',m[id]||m.verde);}catch(e){}})();` }} />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <MetaPixel />
            <TikTokPixel />
            <InstallPwa>
              {children}
            </InstallPwa>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
