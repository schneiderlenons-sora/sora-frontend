'use client';

import { useMemo, useState } from 'react';
import { Tag, Plus, X, Check } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import StepNav from '../components/StepNav';

const BRAND = '#61D17B';

// Templates por perfil + objetivo
const TEMPLATES = {
  base: [
    { nome: '🍔 Alimentação',  cor: '#f59e0b' },
    { nome: '🏠 Moradia',       cor: '#3b82f6' },
    { nome: '🚗 Transporte',    cor: '#8b5cf6' },
    { nome: '💊 Saúde',         cor: '#ef4444' },
    { nome: '🎮 Lazer',         cor: '#ec4899' },
    { nome: '📚 Educação',      cor: '#06b6d4' },
    { nome: '👕 Vestuário',     cor: '#84cc16' },
    { nome: '💼 Salário',       cor: BRAND,    tipo: 'receita' as const },
  ],
  casal: [
    { nome: '👶 Filhos',        cor: '#f97316' },
    { nome: '🐶 Pets',          cor: '#a855f7' },
    { nome: '🛒 Compras casa',  cor: '#14b8a6' },
  ],
  empresarial: [
    { nome: '🏭 Fornecedores',  cor: '#0ea5e9' },
    { nome: '👥 Folha',          cor: '#f43f5e' },
    { nome: '📣 Marketing',      cor: '#a855f7' },
    { nome: '🧾 Impostos',       cor: '#71717a' },
    { nome: '💰 Vendas',         cor: BRAND,    tipo: 'receita' as const },
  ],
};

type Cat = { nome: string; cor: string; tipo?: 'despesa' | 'receita' };

export default function Step4Categorias() {
  const { state } = useOnboarding();
  const { perfil } = useAuth();

  const inicial: Cat[] = useMemo(() => {
    const arr: Cat[] = [...TEMPLATES.base];
    if (state.perfilUso === 'casal' || state.perfilUso === 'ambos') arr.push(...TEMPLATES.casal);
    if (state.perfilUso === 'empresarial' || state.perfilUso === 'ambos') arr.push(...TEMPLATES.empresarial);
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.perfilUso]);

  const [cats, setCats]     = useState<Cat[]>(inicial);
  const [novaCat, setNovaCat] = useState('');

  function adicionar() {
    const nome = novaCat.trim();
    if (!nome) return;
    if (cats.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) return;
    setCats([...cats, { nome, cor: BRAND }]);
    setNovaCat('');
  }

  function remover(idx: number) {
    setCats(cats.filter((_, i) => i !== idx));
  }

  async function salvar() {
    const grupoId = perfil?.grupo_ativo?.id;
    if (!grupoId) return;
    try {
      // Insere todas em batch
      const rows = cats.map((c) => ({
        grupo_id: grupoId,
        nome:     c.nome,
        cor:      c.cor,
        tipo:     c.tipo || 'despesa',
        ativa:    true,
      }));
      await supabase.from('categorias').upsert(rows, { onConflict: 'grupo_id,nome' });
    } catch (e) {
      console.warn('[onboarding] erro ao salvar categorias', e);
    }
  }

  return (
    <>
      <div className="space-y-3 mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-2"
             style={{ background: `${BRAND}1A` }}>
          <Tag size={20} style={{ color: BRAND }} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
          Suas categorias
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          Já preparei algumas baseadas no seu perfil. Adicione, edite ou remova como quiser.
        </p>
      </div>

      {/* Grid de chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {cats.map((c, i) => (
          <span
            key={`${c.nome}-${i}`}
            className="group inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all"
            style={{ borderColor: `${c.cor}40`, background: `${c.cor}10` }}
          >
            <span className="text-foreground">{c.nome}</span>
            <button
              type="button"
              onClick={() => remover(i)}
              className="opacity-50 hover:opacity-100 transition-opacity"
              aria-label={`Remover ${c.nome}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      {/* Add nova */}
      <div className="flex gap-2">
        <input
          type="text"
          value={novaCat}
          onChange={(e) => setNovaCat(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), adicionar())}
          placeholder="Adicionar nova categoria…"
          className="flex-1 px-4 py-2.5 rounded-xl bg-card border border-border text-sm
                     placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={adicionar}
          disabled={!novaCat.trim()}
          className="px-4 py-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 text-foreground text-sm font-semibold transition-colors disabled:opacity-40"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Check size={11} style={{ color: BRAND }} />
        {cats.length} {cats.length === 1 ? 'categoria selecionada' : 'categorias selecionadas'}
      </div>

      <StepNav podeAvancar={cats.length > 0} onAntesAvancar={salvar} />
    </>
  );
}
