'use client';

import { useEffect, useRef } from 'react';
import { trackViewContent } from '@/lib/analytics';

// Componente-folha pra disparar ViewContent em página Server Component (a
// landing, /oferta, /kit) sem precisar converter a página inteira pra
// 'use client' — o App Router deixa renderizar Client Component como filho
// de Server Component normalmente.
export default function ViewContentTracker({ name }: { name: string }) {
  const disparado = useRef(false);
  useEffect(() => {
    if (disparado.current) return;
    disparado.current = true;
    try { trackViewContent({ name }); } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
