'use client';

import { useEffect, useState } from 'react';
import { Tag, Plus, X, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import { getCategoriaTheme } from '@/lib/categorias';
import StepNav from '../components/StepNav';

const BRAND = '#61D17B';

type Cat = {
  id:        string;
  nome:      string;
  icone?:    string | null;
  tipo?:     string;
  parent_id?: string | null;
};

export default function Step4Categorias() {
  const { phone } = useAuth();

  const [cats, setCats]       = useState<Cat[]>([]);
  const [novaCat, setNovaCat] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvandoNova, setSalvando] = useState(false);

  // Carrega as categorias REAIS do grupo (criadas no signup) via backend —
  // service role, sem depender de RLS/grupo_ativo no cliente.
  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!phone) { setCarregando(false); return; }
      try {
        const data = await api.categorias.listar(phone);
        if (vivo) setCats(Array.isArray(data) ? data : []);
      } catch {
        if (vivo) setCats([]);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [phone]);

  async function adicionar() {
    const nome = novaCat.trim();
    if (!nome || !phone) return;
    if (cats.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) { setNovaCat(''); return; }
    setSalvando(true);
    try {
      const nova = await api.categorias.criar({ phone, nome, tipo: 'despesa' });
      setCats((prev) => [...prev, nova as Cat]);
      setNovaCat('');
    } catch {
      // silencioso — mantém o que digitou pra tentar de novo
    } finally {
      setSalvando(false);
    }
  }

  async function remover(idx: number) {
    const c = cats[idx];
    setCats((prev) => prev.filter((_, i) => i !== idx)); // otimista
    try {
      await api.categorias.deletar(c.id);
    } catch {
      // se falhar, recarrega pra refletir o estado real
      if (phone) { try { setCats(await api.categorias.listar(phone) as Cat[]); } catch { /* noop */ } }
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
          <div className="flex flex-wrap gap-2 mb-5">
            {cats.map((c, i) => {
              const tema = getCategoriaTheme(c.nome);
              const emoji = c.icone && /^\p{Extended_Pictographic}/u.test(c.icone) ? c.icone : undefined;
              return (
                <span
                  key={c.id}
                  className="group inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl border text-sm font-medium transition-all"
                  style={{ borderColor: `${tema.color}40`, background: `${tema.color}10` }}
                >
                  <CategoriaIcon nome={c.nome} icone={emoji} size={22} bg={tema.bg} color={tema.color} rounded="rounded-lg" />
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
            {cats.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma categoria ainda — adicione abaixo.</p>
            )}
          </div>

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
              disabled={!novaCat.trim() || salvandoNova}
              className="px-4 py-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 text-foreground text-sm font-semibold transition-colors disabled:opacity-40"
            >
              {salvandoNova ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Check size={11} style={{ color: BRAND }} />
            {cats.length} {cats.length === 1 ? 'categoria' : 'categorias'}
          </div>
        </>
      )}

      <StepNav podeAvancar={!carregando} />
    </>
  );
}
