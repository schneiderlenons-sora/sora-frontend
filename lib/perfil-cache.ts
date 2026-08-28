// Cache do PERFIL no localStorage — deixa o app abrir com o perfil na hora
// (cold-load / F5) e revalidar em segundo plano, em vez de travar esperando o
// /api/me. É o que mata o "até pra inicializar carrega".
//
// SEGURANÇA (PC compartilhado): guardado POR userId e limpo no signOut (junto
// do limparCacheSWR). Ao abrir, o perfil do cache só é MANTIDO se a sessão do
// Supabase for do MESMO usuário — senão é descartado na hora (ver AuthContext).

// ⚠️ VERSÃO NA CHAVE — subir sempre que um campo NOVO passar a decidir acesso.
//
// v1 → v2: entrou `negocios_liberado` (migration 142), que é o que mantém a aba
// Negócios pra quem já a usava. Um perfil cacheado ANTES não tem o campo, e o
// primeiro paint sairia com a aba TRANCADA e badge "Platinum" pra quem pagou
// por ela — até o /api/me responder. Trocar a chave descarta o cache velho:
// custa um cold-start mais lento uma única vez, e ninguém vê paywall no que já
// é seu.
const KEY = 'sora-perfil-cache-v2';

export interface PerfilCache {
  userId: string;
  perfil: any;
}

export function lerPerfilCache(): PerfilCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj && typeof obj.userId === 'string' && obj.perfil) return obj as PerfilCache;
    return null;
  } catch {
    return null;
  }
}

export function salvarPerfilCache(userId: string, perfil: any): void {
  if (typeof window === 'undefined' || !userId || !perfil) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ userId, perfil }));
  } catch {
    /* quota/serialização — cache é best-effort */
  }
}

export function limparPerfilCache(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
