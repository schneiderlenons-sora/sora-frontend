'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { COOKIE_AFILIADO } from '@/lib/afiliados-regras';

// Logou num navegador que veio por um link de afiliado → registra uma vez por
// sessão. Quem decide se conta é o servidor.
export default function AtribuirAfiliado() {
  const { user } = useAuth();
  const id = user?.id;
  useEffect(() => {
    if (!id || !document.cookie.includes(`${COOKIE_AFILIADO}=`)) return;
    const marca = `sora-af-visto:${id}`;
    try {
      if (sessionStorage.getItem(marca)) return;
      sessionStorage.setItem(marca, '1');
    } catch { /* sem storage: só repete o pedido */ }
    fetch('/api/afiliados/atribuir', { method: 'POST' }).catch(() => {});
  }, [id]);
  return null;
}
