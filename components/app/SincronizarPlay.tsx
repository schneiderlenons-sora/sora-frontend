'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEhAppNativo } from '@/lib/useOrigem';
import { comprasDoAparelho } from '@/lib/digital-goods';

/**
 * Restauração das assinaturas da Google Play — uma vez por sessão, no app.
 *
 * ⚠️ É A REDE DE SEGURANÇA DA COMPRA. Se a internet cair entre o pagamento e a
 * confirmação, a compra existe no Google e não na Sora — e compra que a Sora
 * não confirma em 3 dias é REEMBOLSADA pelo Google. Relendo as compras do
 * aparelho a cada abertura, a confirmação acontece na próxima vez que a pessoa
 * entra, sem ela precisar fazer nada.
 *
 * Fora do app (ou na versão do app sem cobrança) `comprasDoAparelho` devolve
 * vazio e nada é enviado. Devolve `null`: wrapper em volta do app quebraria
 * `position: fixed`.
 */
export default function SincronizarPlay() {
  const { user, recarregar } = useAuth();
  const nativo = useEhAppNativo();
  const uid = user?.id;

  useEffect(() => {
    if (!uid || !nativo) return;
    const chave = `sora-play-sync:${uid}`;
    try {
      if (sessionStorage.getItem(chave)) return;
      sessionStorage.setItem(chave, '1');
    } catch { /* storage bloqueado: tenta mesmo assim */ }

    (async () => {
      const tokens = await comprasDoAparelho();
      if (!tokens.length) return;
      const r = await fetch('/api/play/verificar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tokens }),
      });
      const j = await r.json().catch(() => ({})) as { resultados?: { ok: boolean }[] };
      if (j.resultados?.some((x) => x.ok)) await recarregar();
    })().catch(() => { /* a próxima sessão tenta de novo */ });
    // `recarregar` fora das dependências: nasce de novo a cada render do provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, nativo]);

  return null;
}
