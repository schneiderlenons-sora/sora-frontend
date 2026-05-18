import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from '@/components/providers';
import InstallPwa from '@/components/pwa/InstallPwa';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
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
    icon: '/sora-logo-green.png',
    apple: '/sora-logo-green.png',
    shortcut: '/sora-logo-green.png',
  },
  openGraph: {
    title: 'Sora — Assistente Financeira',
    description: 'Organize sua vida financeira pelo WhatsApp.',
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Sora',
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
    <html lang="pt-BR" suppressHydrationWarning data-scroll-behavior="smooth">
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
