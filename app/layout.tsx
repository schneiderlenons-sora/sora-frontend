import type { Metadata, Viewport } from 'next';
import { Inter, Pacifico } from 'next/font/google';
import './globals.css';
import Providers from '@/components/providers';
import InstallPwa from '@/components/pwa/InstallPwa';
import MetaPixel from '@/components/analytics/MetaPixel';

const inter    = Inter({ subsets: ['latin'] });
// Pacifico — script cursivo encorpado, estilo wordmark de marca (Pierre, Disney+, etc)
const pacifico = Pacifico({ subsets: ['latin'], weight: ['400'], variable: '--font-brand', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://forsora.com'),
  title: 'Sora — Assistente Financeira',
  description: 'Organize sua vida financeira pelo WhatsApp. Controle gastos, investimentos e metas em um só lugar.',
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
  icons: {
    icon: '/brands/sora.png',
    apple: '/brands/sora.png',
    shortcut: '/brands/sora.png',
  },
  openGraph: {
    title: 'Sora — Sua vida financeira pelo WhatsApp',
    description: 'Controle gastos, investimentos e metas — só mandando mensagem pra Sora.',
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Sora',
    // images é auto-injetado pelo Next a partir de app/opengraph-image.tsx
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sora — Sua vida financeira pelo WhatsApp',
    description: 'Controle gastos, investimentos e metas — só mandando mensagem pra Sora.',
    // images é auto-injetado pelo Next a partir de app/twitter-image.tsx
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAFA' },
    { media: '(prefers-color-scheme: dark)',  color: '#09090B' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={pacifico.variable}>
      <body className={inter.className} suppressHydrationWarning>
        {/* Cor temática escolhida — aplica --primary antes do paint (anti-flash) */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var m={verde:'134 55% 60%',azul:'217 91% 60%',roxo:'262 83% 58%',laranja:'25 95% 53%',rosa:'330 81% 60%',vermelho:'0 72% 55%'};var id=localStorage.getItem('sora-brand')||'verde';document.documentElement.style.setProperty('--primary',m[id]||m.verde);}catch(e){}})();` }} />
        <Providers>
          <MetaPixel />
          <InstallPwa>
            {children}
          </InstallPwa>
        </Providers>
      </body>
    </html>
  );
}
