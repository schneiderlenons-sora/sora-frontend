'use client';

import { useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { CATEGORIAS, COMANDOS, buscar, TOTAL_COMANDOS } from '@/lib/sora-commands';
import type { CategoriaCmdId } from '@/lib/sora-commands';
import ComandoCard from './components/ComandoCard';
import CategoriaCard from './components/CategoriaCard';
import { Search, Sparkles, MessageCircle, ArrowLeft, X } from 'lucide-react';

const BRAND = '#61D17B';

type View = { tipo: 'home' } | { tipo: 'categoria'; id: CategoriaCmdId } | { tipo: 'busca'; q: string };

export default function CentralSoraPage() {
  const { perfil, podeUsar } = useAuth();
  const [view, setView] = useState<View>({ tipo: 'home' });
  const [query, setQuery] = useState('');

  // Detecta busca em tempo real
  const resultados = useMemo(() => (query.trim() ? buscar(query) : []), [query]);

  const cmdsDisponiveis = useMemo(
    () => COMANDOS.filter((c) => !c.feature || podeUsar(c.feature)),
    [podeUsar]
  );

  const phoneSora = perfil?.phone || '';

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto pb-20 space-y-6">

        {/* ───── HERO ───── */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-10 border border-border/60"
             style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}>
          <div className="absolute inset-0 pointer-events-none opacity-60"
               style={{ background: `radial-gradient(ellipse 80% 60% at 20% 0%, ${BRAND}1A 0%, transparent 60%)` }} />

          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <Sparkles size={11} style={{ color: BRAND }} />
              <span className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: BRAND }}>
                Central da Sora
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold text-foreground tracking-tight leading-[1.05] max-w-2xl">
              Tudo que a Sora{' '}
              <span className="text-transparent bg-clip-text"
                    style={{ backgroundImage: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
                sabe fazer
              </span>
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground mt-3 sm:mt-4 max-w-xl leading-relaxed">
              A Sora entende linguagem natural — você não precisa decorar nada.
              Esses exemplos são só guias pra você descobrir tudo que dá pra fazer pelo WhatsApp.
            </p>

            <div className="mt-5 flex items-center gap-4 text-xs">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-border">
                <MessageCircle size={11} className="text-muted-foreground" />
                <span className="font-bold tabular-nums text-foreground">{cmdsDisponiveis.length}</span>
                <span className="text-muted-foreground">comandos disponíveis no seu plano</span>
              </div>
              {cmdsDisponiveis.length < TOTAL_COMANDOS && (
                <span className="text-muted-foreground">
                  +{TOTAL_COMANDOS - cmdsDisponiveis.length} desbloqueáveis com upgrade
                </span>
              )}
            </div>

            {/* SEARCH */}
            <div className="mt-6 relative max-w-xl">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setView(e.target.value.trim() ? { tipo: 'busca', q: e.target.value } : { tipo: 'home' });
                }}
                placeholder='Buscar: "transferir", "salário", "DRE"…'
                className="w-full pl-11 pr-10 py-3.5 rounded-2xl bg-card border border-border text-sm
                           placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary
                           transition-colors shadow-sm"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setView({ tipo: 'home' }); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-muted/60 transition-colors"
                >
                  <X size={14} className="text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ───── CONTEÚDO ───── */}
        {view.tipo === 'home' && (
          <HomeGrid onSelect={(id) => setView({ tipo: 'categoria', id })} />
        )}

        {view.tipo === 'categoria' && (
          <CategoriaView
            id={view.id}
            onVoltar={() => setView({ tipo: 'home' })}
            phoneSora={phoneSora}
          />
        )}

        {view.tipo === 'busca' && (
          <BuscaView resultados={resultados} query={query} phoneSora={phoneSora} />
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── Grid de categorias (home) ────────────────────────────────────────────────

function HomeGrid({ onSelect }: { onSelect: (id: CategoriaCmdId) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
      {CATEGORIAS.map((cat) => (
        <CategoriaCard key={cat.id} categoria={cat} onClick={() => onSelect(cat.id)} />
      ))}
    </div>
  );
}

// ─── Categoria expandida ──────────────────────────────────────────────────────

function CategoriaView({ id, onVoltar, phoneSora }: { id: CategoriaCmdId; onVoltar: () => void; phoneSora: string }) {
  const cat = CATEGORIAS.find((c) => c.id === id);
  const comandos = COMANDOS.filter((c) => c.categoria === id);
  const { podeUsar } = useAuth();
  if (!cat) return null;

  const bloqueada = cat.feature && !podeUsar(cat.feature);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Voltar */}
      <button
        type="button"
        onClick={onVoltar}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* Header da categoria */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-glow-sm"
             style={{ background: `linear-gradient(135deg, ${cat.cor}, ${cat.corDark})` }}>
          {cat.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
            {cat.nome}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{cat.descricao}</p>
        </div>
      </div>

      {bloqueada && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Esses comandos exigem um plano superior. <a href="/planos" className="font-bold underline">Ver planos →</a>
          </p>
        </div>
      )}

      {/* Comandos */}
      <div className="space-y-3">
        {comandos.map((cmd) => (
          <ComandoCard key={cmd.id} comando={cmd} cor={cat.cor} phoneSora={phoneSora} />
        ))}
      </div>
    </div>
  );
}

// ─── Resultados de busca ──────────────────────────────────────────────────────

function BuscaView({ resultados, query, phoneSora }: { resultados: ReturnType<typeof buscar>; query: string; phoneSora: string }) {
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{resultados.length}</strong>{' '}
          {resultados.length === 1 ? 'resultado' : 'resultados'} para{' '}
          <strong className="text-foreground">"{query}"</strong>
        </p>
      </div>

      {resultados.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl border border-dashed border-border bg-card/40">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm font-bold text-foreground">Nenhum resultado encontrado</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
            Lembre que a Sora entende linguagem natural — você pode tentar mandar mesmo assim no WhatsApp,
            ela provavelmente vai entender.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {resultados.map((cmd) => {
            const cat = CATEGORIAS.find((c) => c.id === cmd.categoria);
            return (
              <ComandoCard
                key={cmd.id}
                comando={cmd}
                cor={cat?.cor || BRAND}
                phoneSora={phoneSora}
                mostrarCategoria
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
