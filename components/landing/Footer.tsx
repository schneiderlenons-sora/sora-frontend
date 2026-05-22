'use client';

import Link from 'next/link';

const COLUNAS = [
  {
    titulo: 'Produto',
    links: [
      { label: 'Recursos',       href: '#features' },
      { label: 'Demo no zap',    href: '#demo' },
      { label: 'Planos',         href: '#pricing' },
      { label: 'Open Finance',   href: '#features' },
    ],
  },
  {
    titulo: 'Empresa',
    links: [
      { label: 'Sobre nós',      href: '#' },
      { label: 'Blog',           href: '#' },
      { label: 'Carreiras',      href: '#' },
      { label: 'Imprensa',       href: '#' },
    ],
  },
  {
    titulo: 'Suporte',
    links: [
      { label: 'Central de ajuda', href: '#' },
      { label: 'WhatsApp',         href: '#' },
      { label: 'Status do sistema', href: '#' },
      { label: 'Contato',          href: '#' },
    ],
  },
  {
    titulo: 'Legal',
    links: [
      { label: 'Termos de uso',     href: '#' },
      { label: 'Privacidade',       href: '#' },
      { label: 'LGPD',              href: '#' },
      { label: 'Cookies',           href: '#' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-zinc-200/50 dark:border-white/[0.04] pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">

        {/* Linha principal */}
        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-10 mb-16">
          {/* Brand */}
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
              <img src="/sora-icon.png" alt="Sora" width={32} height={32} className="w-8 h-8 rounded-lg shadow-sm" />
              <span className="font-bold text-lg tracking-tight">Sora</span>
            </Link>
            <p className="text-sm text-zinc-600 dark:text-white/60 leading-relaxed max-w-sm">
              Finanças, hábitos, saúde, estudos e negócios — organizados pelo seu WhatsApp.
            </p>
            <div className="flex items-center gap-3 mt-6">
              <SocialIcon label="Instagram"><InstaSvg /></SocialIcon>
              <SocialIcon label="X (Twitter)"><XSvg /></SocialIcon>
              <SocialIcon label="LinkedIn"><LinkedInSvg /></SocialIcon>
              <SocialIcon label="YouTube"><YouTubeSvg /></SocialIcon>
            </div>
          </div>

          {/* Colunas */}
          {COLUNAS.map(c => (
            <div key={c.titulo}>
              <h4 className="text-[11px] font-bold tracking-widest uppercase text-zinc-500 dark:text-white/40 mb-4">{c.titulo}</h4>
              <ul className="space-y-2.5">
                {c.links.map(l => (
                  <li key={l.label}>
                    <a href={l.href}
                       className="text-sm text-zinc-700 dark:text-white/65 hover:text-zinc-950 dark:hover:text-white transition-colors">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Selo BACEN + Status */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-6 border-t border-zinc-200 dark:border-white/[0.06]">
          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-white/40">
            <span className="flex items-center gap-2">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full animate-ping bg-green-500 opacity-50" />
                <span className="relative rounded-full w-1.5 h-1.5 bg-green-500" />
              </span>
              Todos os sistemas operacionais
            </span>
            <span className="hidden sm:inline w-px h-3 bg-zinc-300 dark:bg-white/15" />
            <span className="hidden sm:inline">Autorizado BACEN · LGPD · ISO 27001</span>
          </div>

          <p className="text-xs text-zinc-500 dark:text-white/40">
            © {new Date().getFullYear()} Sora · Feito no Brasil 🇧🇷
          </p>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <a href="#" aria-label={label}
       className="w-9 h-9 rounded-xl flex items-center justify-center border border-zinc-200 dark:border-white/[0.08] bg-white/40 dark:bg-white/[0.02] text-zinc-600 dark:text-white/70 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-300 dark:hover:border-white/[0.18] transition-all">
      {children}
    </a>
  );
}

const InstaSvg = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);
const XSvg = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
const LinkedInSvg = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);
const YouTubeSvg = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);
