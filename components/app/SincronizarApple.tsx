'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { compraAppleDisponivel, direitosApple } from '@/lib/apple-compras';

/**
 * Restauração das assinaturas da Apple — uma vez por sessão, no app de iPhone.
 * Irmão do `SincronizarPlay`.
 *
 * É a rede de segurança da compra: se a internet cair entre o pagamento e a
 * confirmação, a assinatura existe na Apple e não na Sora. Relendo as
 * assinaturas vigentes do Apple ID a cada abertura (sem pedir senha), a Sora
 * confirma na próxima vez que a pessoa entra. O aviso automático da Apple
 * (/api/apple/notificacoes) cobre o mesmo buraco pelo outro lado.
 *
 * Fora do app (ou no app sem o plugin de compra) não faz nada. Devolve `null`:
 * wrapper em volta do app quebraria `position: fixed`.
 */
export default function SincronizarApple() {
  const { user, recarregar } = useAuth();
  const uid = user?.id;

  useEffect(() => {
    if (!uid || !compraAppleDisponivel()) return;
    const chave = `sora-apple-sync:${uid}`;
    try {
      if (sessionStorage.getItem(chave)) return;
      sessionStorage.setItem(chave, '1');
    } catch { /* storage bloqueado: tenta mesmo assim */ }

    (async () => {
      const itens = await direitosApple();
      if (!itens.length) return;
      const r = await fetch('/api/apple/verificar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jws: itens.map((i) => i.jws) }),
      });
      const j = await r.json().catch(() => ({})) as { resultados?: { ok: boolean }[] };
      if (j.resultados?.some((x) => x.ok)) await recarregar();
    })().catch(() => { /* a próxima sessão tenta de novo */ });
    // `recarregar` fora das dependências: nasce de novo a cada render do provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  return null;
}
