// Força revalidação a cada request (evita cache CDN servir versões antigas após deploy).
// Ainda mantém SSG/SSR no build — só anula o cache de borda da Vercel.
// rev: hero-bg-overlays-v2
export const revalidate = 0;

import LandingPage from '@/components/landing/LandingPage';

export default function Page() {
  return <LandingPage />;
}
