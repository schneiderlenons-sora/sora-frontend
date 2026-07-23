'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { lerEmpresaAtiva, salvarEmpresaAtiva, type Empresa } from '@/lib/empresas';

// Empresa ativa compartilhada entre as páginas de Negócios. A key do SWR é a
// mesma em todas (`neg:empresas:<phone>`), então trocar de página não refaz a
// busca — e a escolha fica salva POR USUÁRIO (não vaza entre contas).
export function useEmpresaAtiva() {
  const { phone, isPremium, user } = useAuth();

  const { data, mutate } = useApi(
    (phone && isPremium) ? `neg:empresas:${phone}` : null,
    () => api.negocios.empresas.listar(phone),
  );
  const empresas: Empresa[] = Array.isArray(data) ? data : [];
  const carregando = data === undefined;

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  useEffect(() => {
    if (!empresas.length) return;
    const salva = lerEmpresaAtiva(user?.id);
    const valida = empresas.find(e => e.id === salva) || empresas[0];
    setEmpresaId(prev => (prev && empresas.some(e => e.id === prev) ? prev : valida.id));
  }, [empresas, user?.id]);

  const empresa = empresas.find(e => e.id === empresaId) || null;

  function trocar(e: Empresa) {
    setEmpresaId(e.id);
    salvarEmpresaAtiva(user?.id, e.id);
  }

  return { empresas, empresa, trocar, carregando, recarregar: mutate, phone, isPremium };
}
