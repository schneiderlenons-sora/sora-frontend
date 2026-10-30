'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import VideosEDicas from '@/components/ajuda/VideosEDicas';
import ComandosWhatsapp from '@/components/ajuda/ComandosWhatsapp';
import SecaoSuporte from '@/components/suporte/SecaoSuporte';
import Novidades from '@/components/suporte/Novidades';
import { useChamadosNaoLidos } from '@/lib/useChamadosNaoLidos';
import type { TipoChamado } from '@/lib/api';
import { Lightbulb, MessageCircle, LifeBuoy, Sparkles } from 'lucide-react';

// =============================================================================
// Ajuda — antiga aba "Comandos".
//
// Quatro seções:
//   · Vídeos e dicas     — como tirar proveito do painel
//   · Comandos WhatsApp  — o catálogo, intacto
//   · Suporte            — relatar problema, sugerir melhoria, tirar dúvida e
//                          a conversa dos chamados (out/2026; era /reportar-bug)
//   · Novidades          — o que mudou na Sora (também vinha de /reportar-bug)
//
// ⚠️ "Vídeos e dicas" abre PRIMEIRO, de propósito. Quem entra em "Ajuda" quase
// nunca quer decorar comando — quer entender por que um número está estranho.
// A exceção é resposta nova do suporte: aí abre em Suporte, porque foi o selo
// no "Ajuda" do menu que trouxe a pessoa até aqui.
//
// ⚠️ /central-sora e /reportar-bug continuam existindo e redirecionam pra cá:
// as rotas antigas estão em link de WhatsApp, em e-mail e no histórico.
// =============================================================================

const BRAND = 'hsl(var(--primary))';

type Aba = 'dicas' | 'comandos' | 'suporte' | 'novidades';
const ABAS = ['dicas', 'comandos', 'suporte', 'novidades'] as const;
const TIPOS: TipoChamado[] = ['problema', 'melhoria', 'duvida'];

const SECOES: readonly [Aba, string, string, typeof Lightbulb][] = [
  ['dicas',     'Vídeos e dicas',    'Dicas',     Lightbulb],
  ['comandos',  'Comandos WhatsApp', 'WhatsApp',  MessageCircle],
  ['suporte',   'Suporte',           'Suporte',   LifeBuoy],
  ['novidades', 'Novidades',         'Novidades', Sparkles],
];

// ⚠️ A página RECOMEÇA quando o endereço muda. Com ela aberta, tocar em
// "Novidades" no menu muda só o `?aba=` — sem a `key`, o React reaproveitaria
// a página e a seção ficaria onde estava. Por isso os botões de seção abaixo
// NÃO reescrevem o endereço: reescrever recriaria a página a cada toque.
export default function AjudaPage() {
  const sp = useSearchParams();
  return <Ajuda key={sp.toString()} />;
}

function Ajuda() {
  const { naoLidas, carregado } = useChamadosNaoLidos();

  // ── SEÇÃO VINDA DA URL ──────────────────────────────────────────────────
  // ⚠️ `useSearchParams`, não efeito: o servidor também enxerga a URL (a rota
  // é dinâmica), então a página já NASCE na seção pedida. Lendo num efeito,
  // ela desenhava "Dicas" e trocava um instante depois — um pisca visível.
  const sp = useSearchParams();
  const [daUrl] = useState(() => {
    const tipo = sp.get('tipo');
    const v = sp.get('aba');
    const tipoOk = TIPOS.includes(tipo as TipoChamado);
    const chamado = !!sp.get('chamado');
    const abaUrl: Aba | null = tipoOk || chamado ? 'suporte'
      : (ABAS as readonly string[]).includes(v || '') ? (v as Aba) : null;
    return { abaUrl, tipo: tipoOk ? (tipo as TipoChamado) : null, chamado };
  });
  const [aba, setAba] = useState<Aba>(daUrl.abaUrl ?? 'dicas');
  const [escolheu, setEscolheu] = useState(daUrl.abaUrl !== null);
  const tipoInicial = daUrl.tipo;
  const chamadoNoLink = daUrl.chamado;

  // Resposta nova do suporte e a pessoa não pediu seção nenhuma → Suporte.
  // ⚠️ DECIDIDO UMA VEZ, quando o contador chega. Ler a resposta zera o
  // contador; se a seção dependesse dele, voltaria sozinha pra Dicas no meio
  // da leitura.
  const [abaAuto, setAbaAuto] = useState<Aba | null>(null);
  if (abaAuto === null && carregado) setAbaAuto(naoLidas > 0 ? 'suporte' : 'dicas');
  const abaVisivel: Aba = escolheu ? aba : (abaAuto ?? 'dicas');

  function ir(a: Aba) { setAba(a); setEscolheu(true); }

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-5">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Ajuda</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dicas do painel, tudo que a Sora entende no WhatsApp e o suporte.
        </p>
      </header>

      {/* Seletor de seção. No celular vira grade de 4 (ícone em cima, rótulo
          embaixo): em linha, os quatro rótulos não cabem em 375px. */}
      <div role="tablist" aria-label="Seções da ajuda"
           className="grid grid-cols-4 sm:inline-flex sm:items-center gap-1 rounded-2xl p-1 w-full sm:w-auto"
           style={{ background: 'hsl(var(--bg-muted) / 0.4)', border: '1px solid hsl(var(--border) / 0.6)' }}>
        {SECOES.map(([id, label, curto, Icone]) => {
          const ativo = abaVisivel === id;
          const selo = id === 'suporte' && naoLidas > 0;
          return (
            <button
              key={id} type="button" role="tab" aria-selected={ativo}
              onClick={() => ir(id)}
              aria-label={selo ? `${label}, ${naoLidas} ${naoLidas === 1 ? 'resposta nova' : 'respostas novas'}` : undefined}
              className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 rounded-xl px-1 sm:px-3.5 py-2 sm:py-0 text-[11px] sm:text-[13px] font-bold transition-colors ${
                ativo ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}
              style={{ background: ativo ? BRAND : 'transparent', minHeight: 44 }}
            >
              <Icone size={15} />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden leading-none">{curto}</span>
              {selo && (
                <span aria-hidden
                      className="absolute top-1 right-1 sm:static min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-red-500 text-white text-[10px] font-bold tabular-nums">
                  {naoLidas > 9 ? '9+' : naoLidas}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {abaVisivel === 'dicas' && <VideosEDicas />}
      {abaVisivel === 'comandos' && <ComandosWhatsapp />}
      {abaVisivel === 'suporte' && (
        <div className="max-w-2xl">
          <SecaoSuporte tipoInicial={tipoInicial}
                        chamadoNoLink={chamadoNoLink} onVerDicas={() => ir('dicas')} />
        </div>
      )}
      {abaVisivel === 'novidades' && (
        <div className="max-w-2xl space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tudo que já mudou na Sora, na ordem em que foi lançado.
          </p>
          <Novidades />
        </div>
      )}
    </div>
  );
}
