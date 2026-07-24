'use client';

import { Folder, FileText, Search, Check, Image as ImageIcon, BadgeCheck, MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

const BRAND = '#61ce70';
const BRAND_DARK = '#4DAE61';
const VERDE = '#16a34a';

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl bg-white dark:bg-[#111418] border border-zinc-200/70 dark:border-white/[0.06] shadow-[0_20px_55px_-30px_rgba(0,0,0,0.35)] ${className}`}>
      {children}
    </div>
  );
}

function CabecalhoSora({ online }: { online: string }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-100 dark:border-white/[0.05]">
      <div className="w-9 h-9 rounded-full grid place-items-center overflow-hidden flex-shrink-0" style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brands/sora.png" alt="Sora" className="w-5 h-5 object-contain" draggable={false} />
      </div>
      <div className="leading-tight">
        <p className="font-bold text-[13px] text-zinc-900 dark:text-white flex items-center gap-1">
          Sora <BadgeCheck size={13} className="text-[#3b9eff]" fill="#3b9eff" stroke="white" />
        </p>
        <p className="text-[11px] font-semibold" style={{ color: '#22c55e' }}>{online}</p>
      </div>
    </div>
  );
}

function BolhaUser({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md px-3 py-2.5 text-[13px] leading-snug bg-[#d7f8cf] text-zinc-800 dark:bg-[#075c46] dark:text-white">
        {children}
      </div>
    </div>
  );
}

function BolhaSora({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] rounded-2xl rounded-bl-md px-3 py-2.5 text-[13px] leading-snug bg-white dark:bg-[#1e2530] border border-zinc-100 dark:border-white/[0.06] text-zinc-700 dark:text-zinc-200 shadow-sm">
        {children}
      </div>
    </div>
  );
}

// conector pontilhado vertical entre os cards da direita
function Conector() {
  return (
    <div className="flex justify-center py-1.5">
      <div className="flex flex-col gap-1">
        {[0, 1, 2].map((i) => <span key={i} className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-white/20" />)}
      </div>
    </div>
  );
}

export default function DriveShowcase() {
  const t = useTranslations('driveShowcase');
  const PILLS = t.raw('pills') as string[];
  const FEATURES = t.raw('features') as { t: string; d: string }[];
  return (
    <section className="relative overflow-hidden py-20 lg:py-28 border-t border-zinc-200/50 dark:border-white/[0.04]">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-0 w-[700px] h-[500px] opacity-40 dark:opacity-25"
             style={{ background: 'radial-gradient(ellipse, rgba(97,206,112,0.14) 0%, transparent 65%)' }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-5 sm:px-8 space-y-10 lg:space-y-8">

        {/* ---------- LINHA A: intro + chat salvar + Meu Drive ---------- */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* esquerda */}
          <div>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-bold text-white shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})` }}>
              <Folder size={16} /> {t('badge')}
            </span>
            <h2 className="mt-6 text-4xl sm:text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-zinc-900 dark:text-white">
              {t('tituloL1')}<br className="hidden sm:block" /> {t('tituloL2')}
            </h2>
            <p className="mt-5 text-lg text-zinc-600 dark:text-white/60 leading-relaxed max-w-md">
              {t('desc')}
            </p>
            <ul className="mt-8 space-y-3">
              {PILLS.map((t) => (
                <li key={t} className="flex items-center gap-3 w-fit pl-2 pr-5 py-2 rounded-full bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/[0.08]">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})` }}>
                    <Check size={14} className="text-white" strokeWidth={3} />
                  </span>
                  <span className="text-[15px] font-medium text-zinc-800 dark:text-zinc-200">{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* direita: chat salvar + Meu Drive */}
          <div className="w-full max-w-md mx-auto lg:max-w-none">
            <Card>
              <CabecalhoSora online={t('online')} />
              <div className="p-4 space-y-2.5">
                <BolhaUser>
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/70 dark:bg-black/20 mb-1.5">
                    <FileText size={15} className="text-red-500 flex-shrink-0" />
                    <span className="text-[12px] text-zinc-700 dark:text-zinc-200 truncate">{t('arquivoNome')}</span>
                  </div>
                  {t('salvarPedido')}
                </BolhaUser>
                <BolhaSora>
                  {t.rich('salvarResposta', { b: (c) => <strong className="font-semibold text-zinc-900 dark:text-white">{c}</strong> })}
                </BolhaSora>
              </div>
            </Card>

            <Conector />

            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="flex items-center gap-2 font-bold text-sm text-zinc-900 dark:text-white">
                  <Folder size={16} style={{ color: VERDE }} /> {t('meuDrive')}
                </p>
                <Search size={15} className="text-zinc-400" />
              </div>
              <p className="text-[10px] font-bold tracking-wider text-zinc-400 mb-2">{t('pastas')}</p>
              <div className="flex gap-2 mb-4">
                {(t.raw('pastasChips') as string[]).map((f) => (
                  <span key={f} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/[0.06] text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                    <Folder size={12} style={{ color: VERDE }} /> {f}
                  </span>
                ))}
              </div>
              <p className="text-[10px] font-bold tracking-wider text-zinc-400 mb-2">{t('recentes')}</p>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.04]">
                  <span className="w-8 h-8 rounded-lg grid place-items-center bg-red-50 dark:bg-red-500/10 flex-shrink-0"><FileText size={15} className="text-red-500" /></span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[12px] text-zinc-900 dark:text-white truncate">{t('arquivoNome')}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{t('arquivoLocalAgora')}</p>
                  </div>
                  <span className="text-[9px] font-bold text-white px-2 py-1 rounded-full flex-shrink-0" style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})` }}>{t('novo')}</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-xl">
                  <span className="w-8 h-8 rounded-lg grid place-items-center bg-blue-50 dark:bg-blue-500/10 flex-shrink-0"><ImageIcon size={15} className="text-blue-500" /></span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[12px] text-zinc-900 dark:text-white truncate">{t('arquivo2Nome')}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{t('arquivo2Local')}</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* ---------- LINHA B: 3 features + chat buscar ---------- */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* esquerda: 3 blocos */}
          <div className="space-y-4">
            {FEATURES.map((f) => (
              <div key={f.t} className="rounded-2xl bg-white dark:bg-[#111418] border border-zinc-200/70 dark:border-white/[0.06] p-5 shadow-[0_14px_40px_-28px_rgba(0,0,0,0.35)]">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})` }}>
                    <Check size={13} className="text-white" strokeWidth={3} />
                  </span>
                  <h3 className="font-bold text-[17px] text-zinc-900 dark:text-white">{f.t}</h3>
                </div>
                <p className="mt-2 text-[14px] text-zinc-500 dark:text-white/55 leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>

          {/* direita: chat buscar */}
          <div className="w-full max-w-md mx-auto lg:max-w-none">
            <Card>
              <CabecalhoSora online={t('online')} />
              <div className="p-4 space-y-2.5">
                <BolhaUser>{t('buscarPedido')}</BolhaUser>
                <BolhaSora>{t('buscarResposta')}</BolhaSora>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.04] border border-zinc-100 dark:border-white/[0.06]">
                  <span className="w-9 h-9 rounded-lg grid place-items-center bg-red-50 dark:bg-red-500/10 flex-shrink-0"><FileText size={16} className="text-red-500" /></span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[13px] text-zinc-900 dark:text-white truncate">{t('arquivoNome')}</p>
                    <p className="text-[11px] text-zinc-400 flex items-center gap-1 truncate"><Folder size={11} /> {t('arquivoLocalTamanho')}</p>
                  </div>
                </div>
              </div>
            </Card>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-zinc-400 dark:text-white/40">
              <MessageCircle size={13} /> {t('rodape')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
