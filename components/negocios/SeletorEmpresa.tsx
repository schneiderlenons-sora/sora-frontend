'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, Check, Settings2 } from 'lucide-react';
import { corEmpresa, labelTipo, type Empresa } from '@/lib/empresas';
import EmpresaAvatar from './EmpresaAvatar';

// Seletor da empresa ativa. Dropdown no desktop, bottom sheet no mobile
// (padrão da plataforma). Fecha no Esc e no toque fora — sempre há rota de
// saída (§1 escape-routes). Alvos ≥44pt.

export default function SeletorEmpresa({
  empresas, ativa, onTrocar, onNova, onGerenciar,
}: {
  empresas: Empresa[];
  ativa?: Empresa | null;
  onTrocar: (e: Empresa) => void;
  onNova: () => void;
  onGerenciar?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, [aberto]);

  const cor = corEmpresa(ativa);

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setAberto(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        className="inline-flex items-center gap-2.5 h-11 pl-1.5 pr-3 rounded-2xl border border-border/60 bg-card hover:bg-muted/60 transition-colors max-w-[70vw] sm:max-w-xs"
      >
        <EmpresaAvatar empresa={ativa} tamanho="md" />
        <span className="min-w-0 text-left">
          <span className="block text-sm font-bold text-foreground truncate leading-tight">
            {ativa?.nome || 'Selecionar empresa'}
          </span>
          {ativa && (
            <span className="block text-[10px] text-muted-foreground leading-tight">{labelTipo(ativa.tipo)}</span>
          )}
        </span>
        <ChevronDown size={15} className={`text-muted-foreground flex-shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <>
          {/* Scrim só no mobile (o sheet precisa isolar o fundo) */}
          <div className="fixed inset-0 z-40 bg-black/50 sm:hidden" onClick={() => setAberto(false)} aria-hidden />

          <div
            role="listbox"
            aria-label="Suas empresas"
            className="
              fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t
              sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:left-0 sm:mt-2 sm:w-80 sm:rounded-2xl sm:border
              border-border/60 bg-card shadow-2xl overflow-hidden
              animate-[slide-up_220ms_ease-out_both] sm:animate-none
            "
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Alça do sheet (mobile) */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <span className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            <p className="px-4 pt-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Suas empresas
            </p>

            <div className="max-h-[50vh] overflow-y-auto">
              {empresas.map(e => {
                const on = e.id === ativa?.id;
                return (
                  <button
                    key={e.id}
                    role="option"
                    aria-selected={on}
                    onClick={() => { onTrocar(e); setAberto(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] hover:bg-muted/50 transition-colors text-left"
                  >
                    <EmpresaAvatar empresa={e} tamanho="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground truncate">{e.nome}</span>
                      <span className="block text-[11px] text-muted-foreground">{labelTipo(e.tipo)}</span>
                    </span>
                    {on && <Check size={16} style={{ color: corEmpresa(e) }} className="flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-border/60">
              <button
                onClick={() => { onNova(); setAberto(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 min-h-[52px] hover:bg-muted/50 transition-colors text-left"
              >
                <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `color-mix(in srgb, ${cor} 14%, transparent)` }}>
                  <Plus size={16} style={{ color: cor }} />
                </span>
                <span className="text-sm font-semibold text-foreground">Cadastrar empresa</span>
              </button>
              {onGerenciar && (
                <button
                  onClick={() => { onGerenciar(); setAberto(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 min-h-[52px] hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-foreground/5">
                    <Settings2 size={16} className="text-muted-foreground" />
                  </span>
                  <span className="text-sm font-semibold text-foreground">Gerenciar empresas</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
