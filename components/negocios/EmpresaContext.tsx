'use client';

// =============================================================================
// Empresa ativa — compartilhada por TODO o painel Negócios.
//
// Antes cada página chamava `useEmpresaAtiva()` por conta própria. O SWR já
// evitava refetch (a key é a mesma), mas o `useState` da empresa escolhida vivia
// dentro do hook: ao trocar de rota o componente desmontava, o estado ia junto e
// o `useEffect` reelegia a empresa do zero. Resultado: um flash de "sem empresa"
// a cada navegação, e o seletor piscando.
//
// Com o provider no layout do segmento, o estado atravessa a navegação — trocar
// de aba não recalcula nada.
// =============================================================================

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { lerEmpresaAtiva, salvarEmpresaAtiva, type Empresa } from '@/lib/empresas';
import ModalEmpresa from '@/components/negocios/ModalEmpresa';

type Ctx = {
  empresas:   Empresa[];
  empresa:    Empresa | null;
  trocar:     (e: Empresa) => void;
  carregando: boolean;
  recarregar: () => void;
  phone:      string;
  isPremium:  boolean;
  /** Abre o cadastro de empresa. Sem argumento = criar; com = editar.
   *  Fica no shell pra ser alcançável de QUALQUER tela do painel — antes só
   *  existia no header de 4 páginas, e quem estava no DRE não tinha como
   *  cadastrar a segunda empresa sem voltar. */
  abrirCadastro: (e?: Empresa | null) => void;
};

const EmpresaCtx = createContext<Ctx | null>(null);

export function EmpresaProvider({ children }: { children: React.ReactNode }) {
  const { phone, isPremium, user } = useAuth();

  const { data, mutate } = useApi(
    (phone && isPremium) ? `neg:empresas:${phone}` : null,
    () => api.negocios.empresas.listar(phone),
  );
  const empresas: Empresa[] = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const carregando = data === undefined;

  // Só a escolha EXPLÍCITA do usuário nesta sessão vira estado. O resto é
  // derivado — sem `useEffect` sincronizando estado com props, que geraria
  // render em cascata a cada chegada da lista (e um flash de "sem empresa").
  const [escolhida, setEscolhida] = useState<string | null>(null);

  const empresa = useMemo(() => {
    if (!empresas.length) return null;
    // 1. o que ele acabou de escolher · 2. o que ficou salvo · 3. a primeira
    const porEscolha = escolhida ? empresas.find((e) => e.id === escolhida) : null;
    if (porEscolha) return porEscolha;
    const salva = lerEmpresaAtiva(user?.id);
    return empresas.find((e) => e.id === salva) || empresas[0];
  }, [empresas, escolhida, user?.id]);

  const trocar = useCallback((e: Empresa) => {
    setEscolhida(e.id);
    salvarEmpresaAtiva(user?.id, e.id); // persiste POR usuário (não vaza entre contas)
  }, [user?.id]);

  const recarregar = useCallback(() => { mutate(); }, [mutate]);

  // `undefined` = fechado · `null` = criando · Empresa = editando
  const [cadastro, setCadastro] = useState<Empresa | null | undefined>(undefined);
  const abrirCadastro = useCallback((e?: Empresa | null) => setCadastro(e ?? null), []);

  const valor = useMemo<Ctx>(
    () => ({ empresas, empresa, trocar, carregando, recarregar, phone: phone || '', isPremium: !!isPremium, abrirCadastro }),
    [empresas, empresa, trocar, carregando, recarregar, phone, isPremium, abrirCadastro],
  );

  return (
    <EmpresaCtx.Provider value={valor}>
      {children}
      {cadastro !== undefined && (
        <ModalEmpresa
          empresa={cadastro}
          onClose={() => setCadastro(undefined)}
          onSalvo={(e) => {
            setCadastro(undefined);
            recarregar();
            trocar(e); // empresa recém-criada já vira a ativa — é o que ele quer ver
          }}
        />
      )}
    </EmpresaCtx.Provider>
  );
}

/**
 * Empresa ativa do painel. Fora do provider devolve um estado vazio em vez de
 * quebrar — assim um componente de Negócios reaproveitado no app pessoal
 * (ex.: um card no dashboard) não derruba a tela.
 */
export function useEmpresa(): Ctx {
  const ctx = useContext(EmpresaCtx);
  if (ctx) return ctx;
  return {
    empresas: [], empresa: null, trocar: () => {}, carregando: false,
    recarregar: () => {}, phone: '', isPremium: false, abrirCadastro: () => {},
  };
}
