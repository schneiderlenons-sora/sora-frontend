'use client';

// ─────────────────────────────────────────────────────────────
// Mini notificação de "o suporte respondeu seu chamado".
//
// ⚠️ POR QUE ELA EXISTE (26/09/2026, pedido do dono). A resposta do suporte
// deixou de ir pelo WhatsApp — agora o zap leva só a campainha e a conversa
// vive no painel. Isso resolveu o problema de o cliente responder num número
// que ninguém lê como caixa de chamado, mas abriu outro: **quem não tem
// WhatsApp cadastrado não recebia campainha nenhuma** (havia 2 chamados assim,
// um deles sem resposta possível). Esta notificação é o aviso que funciona
// para todo mundo, com ou sem número.
//
// Some sozinha: abrir o chamado marca as mensagens como lidas no servidor
// (`routes/bug.js`), e a revalidação zera o contador — não há "dispensar
// permanente" a manter em lugar nenhum.
// ─────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { MessageSquare, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api, type ChamadoResumo } from '@/lib/api';
import useSWR from 'swr';

export default function AvisoChamado() {
  const { phone } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Dispensa vale só para esta montagem: mensagem NOVA acende de novo, porque
  // `dispensadoEm` é comparado com a data da última não lida.
  const [dispensadoEm, setDispensadoEm] = useState<string | null>(null);

  // ⚠️ `useSWR` direto e na CHAVE CANÔNICA — a mesma que a Sidebar e a aba de
  // chamados já usam. Com `useApi` a baleia do LoadingGate cobriria a página
  // por causa de um aviso, e com chave própria seria uma requisição a mais a
  // cada 2 minutos, para todo mundo, só para contar zero.
  const { data } = useSWR(
    phone ? `d:chamados:${phone}` : null,
    () => api.bug.meusChamados(),
    { refreshInterval: 120_000, revalidateOnFocus: true },
  );

  const alvo = useMemo(() => {
    const lista = ((data as { chamados?: ChamadoResumo[] } | undefined)?.chamados || [])
      .filter((c) => (Number(c.nao_lidas) || 0) > 0);
    if (!lista.length) return null;
    // A mais recente manda: é dela que o texto fala.
    const ordenada = [...lista].sort((a, b) =>
      (b.ultima_msg?.created_at || b.created_at).localeCompare(a.ultima_msg?.created_at || a.created_at));
    const total = lista.reduce((s, c) => s + (Number(c.nao_lidas) || 0), 0);
    return { chamado: ordenada[0], total, chamados: lista.length };
  }, [data]);

  // Na própria aba de chamados a notificação seria ruído — a resposta está na
  // tela, e abrir o chamado já é o que a faz sumir.
  if (!alvo || pathname?.startsWith('/reportar-bug')) return null;

  const carimbo = alvo.chamado.ultima_msg?.created_at || alvo.chamado.created_at;
  if (dispensadoEm && dispensadoEm === carimbo) return null;

  const abrir = () => router.push(`/reportar-bug?chamado=${alvo.chamado.id}`);

  return (
    <div
      // ⚠️ `aria-live="polite"` e NUNCA foco automático: a notificação não pode
      // interromper quem está digitando (regra `toast-accessibility`).
      aria-live="polite"
      className="fixed z-[45] left-4 right-4 md:left-auto md:right-6 md:w-[360px]
                 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] md:bottom-6
                 animate-[slide-up_220ms_ease-out_both] motion-reduce:animate-none"
      // ⚠️ `bottom` com safe-area + 5.5rem no mobile: a barra inferior tem 62px
      // + safe-area, e qualquer coisa a 24px do fundo nasce ATRÁS dela e vira
      // inalcançável — já aconteceu com 4 toasts deste app.
    >
      <div className="relative rounded-2xl border border-border/60 shadow-2xl backdrop-blur-xl overflow-hidden"
           style={{ background: 'hsl(var(--bg-card) / 0.97)' }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at top right, #61D17B24 0%, transparent 70%)' }}
        />
        <button
          onClick={abrir}
          className="relative w-full flex items-start gap-3 p-4 pr-12 text-left active:scale-[0.99] transition-transform"
        >
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#61D17B1f', color: '#3f9e58' }}>
            <MessageSquare size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-foreground">
              {alvo.total === 1 ? 'O suporte respondeu' : `${alvo.total} respostas do suporte`}
            </span>
            {/* A prévia do texto é o que faz valer a pena tocar. */}
            <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
              {alvo.chamado.ultima_msg?.texto?.trim()
                || alvo.chamado.mensagem?.trim()
                || 'Abra para ler a resposta.'}
            </span>
            <span className="block text-[11px] font-semibold mt-1.5" style={{ color: '#3f9e58' }}>
              Ver {alvo.chamados > 1 ? 'chamados' : 'chamado'} →
            </span>
          </span>
        </button>
        {/* 44px de alvo (regra de toque), separado da área que navega. */}
        <button
          onClick={() => setDispensadoEm(carimbo)}
          aria-label="Dispensar aviso"
          className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center rounded-xl
                     text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
