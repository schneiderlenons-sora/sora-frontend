'use client';

import { useState } from 'react';
import {
  PASTAS, dicasDaPasta, TOTAL_DICAS,
  type Dica, type PastaDicas,
} from '@/lib/ajuda-conteudo';
import {
  Play, ChevronRight, ChevronLeft, Folder,
  Rocket, Wand2, Target, TrendingUp, Landmark, Clock,
} from 'lucide-react';

// =============================================================================
// Vídeos e dicas do app — navegação em três níveis.
//
//   home → pasta (lista de dicas) → dica (o texto)
//
// ⚠️ ESTADO LOCAL, não rota. Cada nível é um passo curto e o usuário volta pelo
// "‹" do próprio bloco — virar três rotas obrigaria a página inteira a
// remontar (e, com o SSR das abas, a rebuscar dado) só pra trocar um texto.
//
// Regras de UI (skill ui-ux-pro-max):
//  · toque ≥44pt em tudo que navega (§2 touch-target-size);
//  · "Em breve" é ÍCONE + PALAVRA, nunca só uma cor apagada (§1 color-not-only);
//  · o card de vídeos fica desabilitado com `aria-disabled` e cursor próprio, e
//    EXPLICA por que não abre em vez de sumir (§8 empty-nav-state);
//  · contagem em tabular-nums (§6).
// =============================================================================

const BRAND = 'hsl(var(--primary))';

// Ícone por pasta. Mapa explícito — `lucide-react` não expõe lookup dinâmico
// sem arrastar o pacote inteiro pro bundle.
const ICONES: Record<string, typeof Rocket> = {
  Rocket, Wand2, Target, TrendingUp, Landmark,
};

type Nivel =
  | { t: 'home' }
  | { t: 'pasta'; pasta: PastaDicas }
  | { t: 'dica'; pasta: PastaDicas; dica: Dica; indice: number };

export default function VideosEDicas() {
  const [nivel, setNivel] = useState<Nivel>({ t: 'home' });

  // ── Nível 3: a dica ───────────────────────────────────────────────────────
  if (nivel.t === 'dica') {
    const total = nivel.pasta.dicas.length;
    return (
      <section className="space-y-4">
        <Voltar
          rotulo={nivel.pasta.titulo.toUpperCase()}
          onClick={() => setNivel({ t: 'pasta', pasta: nivel.pasta })}
        />

        {/* Passo N de M — só faz sentido quando a pasta tem mais de uma dica.
            Com uma só, "Passo 1 de 1" é ruído que promete uma sequência. */}
        {total > 1 && (
          <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold text-white tabular-nums"
                style={{ background: BRAND }}>
            Passo {nivel.indice + 1} de {total}
          </span>
        )}

        <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
          {nivel.dica.titulo}
        </h2>

        <div className="space-y-4">
          {nivel.dica.corpo.map((p, i) => (
            <p key={i} className="text-[15px] leading-relaxed text-muted-foreground">{p}</p>
          ))}
        </div>

        {/* Próxima dica da mesma pasta — mantém a leitura andando sem obrigar a
            voltar e escolher de novo. */}
        {nivel.indice + 1 < total && (
          <button
            type="button"
            onClick={() => setNivel({
              t: 'dica', pasta: nivel.pasta,
              dica: dicasDaPasta(nivel.pasta)[nivel.indice + 1],
              indice: nivel.indice + 1,
            })}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white transition active:scale-[0.99]"
            style={{ background: BRAND, minHeight: 48 }}
          >
            Próxima dica <ChevronRight size={16} />
          </button>
        )}
      </section>
    );
  }

  // ── Nível 2: a pasta ──────────────────────────────────────────────────────
  if (nivel.t === 'pasta') {
    const dicas = dicasDaPasta(nivel.pasta);
    return (
      <section className="space-y-4">
        <Voltar rotulo={nivel.pasta.titulo} onClick={() => setNivel({ t: 'home' })} />

        <ul className="rounded-2xl border border-border/60 divide-y divide-border/50 overflow-hidden"
            style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          {dicas.map((d, i) => {
            const Icone = ICONES[nivel.pasta.icone] || Folder;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => setNivel({ t: 'dica', pasta: nivel.pasta, dica: d, indice: i })}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-foreground/5 transition-colors"
                  style={{ minHeight: 44 }}
                >
                  <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl"
                        style={{ background: 'hsl(var(--bg-muted))' }}>
                    <Icone size={16} className="text-muted-foreground" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-foreground leading-snug">
                      {d.titulo}
                    </span>
                    <span className="block text-[13px] text-muted-foreground mt-0.5 leading-snug">
                      {d.resumo}
                    </span>
                  </span>
                  <ChevronRight size={16} className="flex-shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  // ── Nível 1: home ─────────────────────────────────────────────────────────
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Truques rápidos pra tirar o máximo da Sora, do jeito certo, sem retrabalho.
      </p>

      {/* Vídeos — em breve.
          ⚠️ Fica VISÍVEL e desabilitado, não escondido: some-lo faria a seção
          parecer só "dicas", e quando os vídeos entrarem ninguém saberia que
          eram esperados. O card diz o que é e por que ainda não abre. */}
      <div
        aria-disabled="true"
        className="rounded-2xl border-2 p-4 opacity-70 cursor-not-allowed"
        style={{ borderColor: `color-mix(in srgb, ${BRAND} 35%, transparent)`,
                 background: `color-mix(in srgb, ${BRAND} 5%, transparent)` }}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl"
                style={{ background: BRAND }}>
            <Play size={18} className="text-white" fill="currentColor" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-foreground">Vídeos</h3>
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: 'color-mix(in srgb, #f59e0b 16%, transparent)', color: '#b45309' }}>
                <Clock size={9} /> Em breve
              </span>
            </div>
          </div>
        </div>
        <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
          Aqui é onde vão ficar os vídeos da Sora. Em meio minuto cada um mostra
          como o app funciona por dentro. Estamos gravando — logo aparecem aqui.
        </p>
      </div>

      {/* Pastas de dicas */}
      <div className="grid grid-cols-2 gap-3">
        {PASTAS.map((p) => {
          const Icone = ICONES[p.icone] || Folder;
          const n = p.dicas.length;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setNivel({ t: 'pasta', pasta: p })}
              className="rounded-2xl border border-border/60 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-border active:scale-[0.99]"
              style={{ background: 'hsl(var(--bg-card) / 0.5)', minHeight: 116 }}
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl mb-3"
                    style={{ background: `color-mix(in srgb, ${BRAND} 12%, transparent)` }}>
                <Icone size={18} style={{ color: BRAND }} />
              </span>
              <span className="block text-[15px] font-bold text-foreground leading-snug">
                {p.titulo}
              </span>
              <span className="block text-[12px] text-muted-foreground mt-0.5 tabular-nums">
                {n} {n === 1 ? 'dica' : 'dicas'}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground tabular-nums">
        {TOTAL_DICAS} dicas em {PASTAS.length} pastas
      </p>
    </section>
  );
}

function Voltar({ rotulo, onClick }: { rotulo: string; onClick: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button" onClick={onClick} aria-label="Voltar"
        className="grid flex-shrink-0 place-items-center rounded-full border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
        style={{ width: 44, height: 44 }}
      >
        <ChevronLeft size={18} />
      </button>
      <span className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground truncate">
        {rotulo}
      </span>
    </div>
  );
}
