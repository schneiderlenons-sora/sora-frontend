'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, MessageCircle, Sparkles } from 'lucide-react';
import StepNav from '../components/StepNav';
import { CATEGORIAS, COMANDOS } from '@/lib/sora-commands';

const BRAND = 'hsl(var(--primary))';

export default function Step10Comandos() {
  // Agrupa os comandos por categoria (só categorias que têm comandos).
  const grupos = useMemo(
    () => CATEGORIAS
      .map((cat) => ({ cat, cmds: COMANDOS.filter((c) => c.categoria === cat.id) }))
      .filter((g) => g.cmds.length > 0),
    [],
  );

  // Primeira categoria aberta por padrão; resto colapsado (progressive disclosure).
  const [aberta, setAberta] = useState<string | null>(grupos[0]?.cat.id ?? null);

  return (
    <>
      {/* Hero */}
      <div className="text-center space-y-4 mb-8">
        <div className="mx-auto w-16 h-16 rounded-3xl flex items-center justify-center shadow-glow-sm"
             style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
          <MessageCircle size={30} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
            É só conversar comigo 💬
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
            Você fala naturalmente e eu entendo. Aqui vão alguns comandos pra começar —
            toque numa categoria pra ver os exemplos.
          </p>
        </div>
      </div>

      {/* Acordeão de categorias */}
      <div className="space-y-2.5">
        {grupos.map(({ cat, cmds }) => {
          const open = aberta === cat.id;
          return (
            <div key={cat.id} className="rounded-2xl border border-border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => setAberta(open ? null : cat.id)}
                aria-expanded={open}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors"
              >
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: `color-mix(in srgb, ${cat.cor} 14%, transparent)` }}
                  aria-hidden
                >
                  {cat.emoji}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-foreground truncate">{cat.nome}</span>
                  <span className="block text-[11px] text-muted-foreground truncate">{cat.descricao}</span>
                </span>
                <span className="text-[10px] font-bold tabular-nums text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5 flex-shrink-0">
                  {cmds.length}
                </span>
                <ChevronDown
                  size={16}
                  className="text-muted-foreground flex-shrink-0 transition-transform duration-200"
                  style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>

              {open && (
                <ul className="px-4 pb-4 pt-1 space-y-3 animate-fade-in">
                  {cmds.map((c) => (
                    <li key={c.id} className="border-l-2 pl-3" style={{ borderColor: `color-mix(in srgb, ${cat.cor} 40%, transparent)` }}>
                      <p className="text-[13px] font-mono text-foreground leading-snug">“{c.exemplo}”</p>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{c.descricao}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Lembrete: revisitar na aba Comandos (ex-Central da Sora) */}
      <div className="mt-6 p-4 rounded-2xl border border-primary/20 flex items-start gap-3"
           style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${BRAND} 7%, transparent), transparent)` }}>
        <Sparkles size={18} style={{ color: BRAND }} className="mt-0.5 flex-shrink-0" />
        <p className="text-xs text-foreground leading-relaxed">
          Não precisa decorar! Você reencontra <strong>todos</strong> esses comandos — com mais exemplos e detalhes —
          a qualquer hora na aba <strong>Comandos</strong> do painel. E lembre: pode mandar também por
          <strong> áudio, foto ou PDF</strong>. 🐳
        </p>
      </div>

      <StepNav podeAvancar={true} textoContinuar="Entrar no painel" semPular />
    </>
  );
}
