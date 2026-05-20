import type { Metadata, Viewport } from 'next';
import { Inter, Allura } from 'next/font/google';
import './globals.css';
import Providers from '@/components/providers';
import InstallPwa from '@/components/pwa/InstallPwa';

const inter  = Inter({ subsets: ['latin'] });
// Allura — script cursivo elegante (similar ao wordmark do Pierre) usado na marca "Sora"
const allura = Allura({ subsets: ['latin'], weight: ['400'], variable: '--font-brand', display: 'swap' });

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
    icon: '/sora-icon.png',
    apple: '/sora-icon.png',
    shortcut: '/sora-icon.png',
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
    <html lang="pt-BR" suppressHydrationWarning data-scroll-behavior="smooth" className={allura.variable}>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>
          <InstallPwa>
            {children}
          </InstallPwa>
        </Providers>
      </body>
    </html>
  );
}
