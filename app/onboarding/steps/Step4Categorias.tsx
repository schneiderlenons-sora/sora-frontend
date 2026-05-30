'use client';

import { useEffect, useState } from 'react';
import { Tag, Plus, X, Check, Loader2 } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import { getCategoriaTheme } from '@/lib/categorias';
import StepNav from '../components/StepNav';

const BRAND = '#61D17B';

type Cat = {
  id?:        string;          // só as que já existem no banco têm id
  nome:       string;
  icone?:     string | null;
  tipo:       'despesa' | 'receita';
  parent_id?: string | null;
  novo?:      boolean;         // criada agora, ainda não está no banco
};

export default function Step4Categorias() {
  const { state } = useOnboarding();
  const { perfil } = useAuth();
  const grupoId = perfil?.grupo_ativo?.id;

  const [cats, setCats]       = useState<Cat[]>([]);
  const [removidos, setRem]   = useState<string[]>([]);  // ids a deletar no save
  const [novaCat, setNovaCat] = useState('');
  const [carregando, setCarregando] = useState(true);

  // Carrega as categorias REAIS do grupo (criadas no signup) — todas, inclusive
  // subcategorias. Assim o usuário vê/edita exatamente o que existe no banco.
  useEffect(() => {
    if (!grupoId) return;
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from('categorias')
        .select('id, nome, icone, tipo, parent_id')
        .eq('grupo_id', grupoId)
        .eq('ativa', true)
        .order('parent_id', { nullsFirst: true })
        .order('nome');
      if (!vivo) return;
      setCats((data as Cat[]) || []);
      setCarregando(false);
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoId]);

  function adicionar() {
    const nome = novaCat.trim();
    if (!nome) return;
    if (cats.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) { setNovaCat(''); return; }
    setCats([...cats, { nome, tipo: 'despesa', novo: true }]);
    setNovaCat('');
  }

  function remover(idx: number) {
    const c = cats[idx];
    if (c.id) setRem((r) => [...r, c.id!]);   // marca pra deletar no banco
    setCats(cats.filter((_, i) => i !== idx));
  }

  async function salvar() {
    if (!grupoId) return;
    try {
      // Deleta as removidas (conta nova, sem transações apontando — seguro)
      if (removidos.length) {
        await supabase.from('categorias').delete().in('id', removidos);
      }
      // Insere as novas criadas no wizard
      const novas = cats.filter((c) => c.novo);
      if (novas.length) {
        await supabase.from('categorias').insert(
          novas.map((c) => ({
            grupo_id: grupoId,
            nome:     c.nome,
            tipo:     c.tipo,
            ativa:    true,
          })),
        );
      }
    } catch (e) {
      console.warn('[onboarding] erro ao sincronizar categorias', e);
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
          Já preparei todas baseadas no seu perfil. Adicione, edite ou remova como quiser.
        </p>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 size={16} className="animate-spin" /> Carregando suas categorias…
        </div>
      ) : (
        <>
          {/* Grid de chips — todas as categorias e subcategorias */}
          <div className="flex flex-wrap gap-2 mb-5">
            {cats.map((c, i) => {
              const tema = getCategoriaTheme(c.nome);
              return (
                <span
                  key={c.id || `novo-${i}`}
                  className="group inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl border text-sm font-medium transition-all"
                  style={{ borderColor: `${tema.color}40`, background: `${tema.color}10` }}
                >
                  <CategoriaIcon nome={c.nome} icone={c.icone} size={22} bg={tema.bg} color={tema.color} rounded="rounded-lg" />
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
              );
            })}
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
            {cats.length} {cats.length === 1 ? 'categoria' : 'categorias'}
          </div>
        </>
      )}

      <StepNav podeAvancar={!carregando} onAntesAvancar={salvar} />
    </>
  );
}
