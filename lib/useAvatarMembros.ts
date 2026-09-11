'use client';

import { useMemo } from 'react';
import { useApi } from './useApi';
import { api } from './api';
import { chave } from './chaves-swr';

// ─────────────────────────────────────────────────────────────────────────────
// A FOTO DE QUEM LANÇOU — buscada UMA vez, não uma por linha.
//
// ⚠️ ESTE ARQUIVO EXISTE POR CAUSA DE UM ESTOURO DE COTA. O `avatar_url` é um
// data URL em base64 (medido: 19 KB em média, 43 KB no maior) e vinha embutido
// no `criador` de CADA transação. O PostgREST repete o objeto embutido linha a
// linha, então uma listagem de 500 transações baixava 500 cópias da MESMA foto.
//
// Medido na base antes de mexer:
//   /transacoes de um usuário ...... 12,42 MB com a foto × 0,41 MB sem
//   somando os 17 usuários com foto ... 56,5 MB por rodada de carregamento
// E rodava em QUATRO lugares: /transacoes, /relatorios, o dashboard (SSR) e o
// prefetch ocioso — ou seja, acontecia mesmo em quem nunca abria a aba.
//
// Agora a foto sai da rota de membros (1–5 linhas por grupo) e a tela casa por
// `criador.id`. O resultado desenhado é idêntico.
//
// ⚠️ SÓ BUSCA EM GRUPO COMPARTILHADO. Em conta individual a autoria não é
// exibida, então buscar seria pagar por um dado que ninguém vê — que é
// exatamente o erro que este arquivo corrige.
// ─────────────────────────────────────────────────────────────────────────────

export type AvatarMembro = {
  url?: string | null;
  preset?: string | null;
  cor?: string | null;
};

export function useAvatarMembros(
  grupoId?: string | null,
  compartilhado = true,
): Map<string, AvatarMembro> {
  const { data } = useApi<any[]>(
    compartilhado && grupoId ? chave.membros(grupoId) : null,
    () => api.grupos.membros(grupoId!),
  );

  return useMemo(() => {
    const mapa = new Map<string, AvatarMembro>();
    for (const linha of Array.isArray(data) ? data : []) {
      // A rota devolve `{ ...membro, users: {...} }`; tolera as duas formas
      // pra não quebrar se o formato mudar.
      const u = (linha && linha.users) || linha;
      if (u?.id) {
        mapa.set(String(u.id), {
          url: u.avatar_url, preset: u.avatar_preset, cor: u.avatar_cor,
        });
      }
    }
    return mapa;
  }, [data]);
}
