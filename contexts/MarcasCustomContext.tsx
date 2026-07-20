'use client';

// ─────────────────────────────────────────────────────────────
// Marcas personalizadas do grupo — logo de loja custom, casada por NOME no
// texto da transação (igual às marcas famosas embutidas, só que do usuário).
// Carregado uma vez por grupo e consumido pelo CategoriaIcon como a marca de
// MAIOR prioridade. Sem provider, o hook devolve um matcher no-op (degrada
// pro comportamento antigo).
// ─────────────────────────────────────────────────────────────
import { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';

export type MarcaCustom = { id: string; termo: string; logo_url: string };

type Ctx = {
  marcas: MarcaCustom[];
  matchLogo: (nome: string) => string | null;
  recarregar: () => void;
};

const MarcasCustomContext = createContext<Ctx>({ marcas: [], matchLogo: () => null, recarregar: () => {} });

// Mesma normalização do IconeMarca: lowercase, sem acento, símbolos viram espaço.
function normalizar(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// `trecho` aparece como palavra inteira dentro de `texto`.
function palavraInteira(texto: string, trecho: string): boolean {
  const escaped = trecho.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(texto);
}

export function MarcasCustomProvider({ children }: { children: React.ReactNode }) {
  const { phone } = useAuth();
  const { data, mutate } = useApi(phone ? `marcas:${phone}` : null, () => api.marcas.listar(phone!));
  const marcas: MarcaCustom[] = (data as MarcaCustom[]) ?? [];

  const value = useMemo<Ctx>(() => {
    const idx = marcas
      .map(m => ({ logo: m.logo_url, norm: normalizar(m.termo) }))
      .filter(m => m.norm.length >= 2)
      // termos mais longos primeiro → match mais específico vence
      .sort((a, b) => b.norm.length - a.norm.length);
    const matchLogo = (nome: string) => {
      const key = normalizar(nome);
      if (!key) return null;
      for (const m of idx) if (m.norm === key) return m.logo;
      for (const m of idx) if (palavraInteira(key, m.norm)) return m.logo;
      return null;
    };
    return { marcas, matchLogo, recarregar: () => mutate() };
  }, [marcas, mutate]);

  return <MarcasCustomContext.Provider value={value}>{children}</MarcasCustomContext.Provider>;
}

export const useMarcasCustom = () => useContext(MarcasCustomContext);
