'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import VideosEDicas from '@/components/ajuda/VideosEDicas';
import ComandosWhatsapp from '@/components/ajuda/ComandosWhatsapp';
import { Lightbulb, MessageCircle } from 'lucide-react';

// =============================================================================
// Ajuda — antiga aba "Comandos".
//
// Ela era 100% catálogo de comando do WhatsApp. Agora tem duas metades:
//   · Vídeos e dicas do app  — como tirar proveito do painel
//   · Comandos WhatsApp      — o catálogo, intacto
//
// ⚠️ "Vídeos e dicas" abre PRIMEIRO, de propósito. Quem entra em "Ajuda" quase
// nunca quer decorar comando — quer entender por que um número está estranho.
// O catálogo continua a um toque.
//
// ⚠️ /central-sora continua existindo e redireciona pra cá: a rota antiga está
// em link de WhatsApp, em e-mail e no histórico do navegador de quem já usa.
// =============================================================================

const BRAND = 'hsl(var(--primary))';

type Aba = 'dicas' | 'comandos';

export default function AjudaPage() {
  const [aba, setAba] = useState<Aba>('dicas');

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto pb-20 space-y-5">
        <header>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Ajuda</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dicas do painel e tudo que a Sora entende no WhatsApp.
          </p>
        </header>

        {/* Seletor de seção */}
        <div className="inline-flex items-center gap-1 rounded-2xl border border-border/60 p-1"
             style={{ background: 'hsl(var(--bg-muted) / 0.4)' }}>
          {([
            ['dicas',    'Vídeos e dicas', Lightbulb],
            ['comandos', 'Comandos WhatsApp', MessageCircle],
          ] as const).map(([id, label, Icone]) => {
            const ativo = aba === id;
            return (
              <button
                key={id} type="button" aria-pressed={ativo}
                onClick={() => setAba(id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-bold transition-colors ${
                  ativo ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}
                style={{ background: ativo ? BRAND : 'transparent', minHeight: 44 }}
              >
                <Icone size={14} />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{id === 'dicas' ? 'Dicas' : 'WhatsApp'}</span>
              </button>
            );
          })}
        </div>

        {aba === 'dicas' ? <VideosEDicas /> : <ComandosWhatsapp />}
      </div>
    </DashboardLayout>
  );
}
