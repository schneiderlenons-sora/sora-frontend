'use client';

// Chamados em que o CLIENTE respondeu e o admin ainda não abriu.
//
// Pedido do dono (nov/2026): "quero saber quando um cliente respondeu". O
// aviso por WhatsApp pro suporte que já existia é texto livre — fora da janela
// de 24h a Meta não o entrega —, então o selo no painel é o que garante.
//
// ⚠️ Só consulta quem é admin (chave null pros outros: zero requisição).
// ⚠️ `useSWR` direto, não `useApi`: o `useApi` registra no LoadingGate e a
// baleia cobriria a página por causa de um contador.
// ⚠️ Zero até montar: o cache do SWR mora no localStorage, e um selo que
// aparece no 1º render do navegador e não no HTML do servidor é hydration
// mismatch. Falha silenciosa: sem resposta, o selo some — nunca quebra a barra.

import { useEffect, useSyncExternalStore } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminEmail } from '@/lib/admin';

const semInscricao = () => () => {};

export function useAdminPendencias(): { respostas: number; semResposta: number } {
  const { perfil } = useAuth();
  const admin = isAdminEmail(perfil?.email);
  const { data, mutate } = useSWR(admin ? 'admin:pendencias' : null, async () => {
    const r = await fetch('/api/admin/pendencias', { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<{ respostas: number; semResposta: number }>;
  }, { refreshInterval: 120_000, revalidateOnFocus: true });

  // O admin abriu ou respondeu um chamado: relê na hora, sem esperar 2 min.
  useEffect(() => {
    if (!admin) return;
    const f = () => { mutate(); };
    window.addEventListener('sora:admin-pendencias', f);
    return () => window.removeEventListener('sora:admin-pendencias', f);
  }, [admin, mutate]);

  const montado = useSyncExternalStore(semInscricao, () => true, () => false);
  if (!montado || !admin) return { respostas: 0, semResposta: 0 };
  return { respostas: Number(data?.respostas) || 0, semResposta: Number(data?.semResposta) || 0 };
}
