'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { detectarOrigem } from '@/lib/origem-app';

// `-v2`: a marca anterior podia ter sido gravada pela regra de origem antiga,
// que confundia link aberto pelo WhatsApp com o app (ver lib/origem-app.ts).
const CHAVE = 'sora-app-android-marcado-v2';

/**
 * Avisa o servidor que esta pessoa abriu a Sora DENTRO do app Android — é o que
 * faz a barra de convite da Play Store sumir em QUALQUER navegador dela
 * (`users.app_android_em`, migration 166).
 *
 * ⚠️ NÃO REAPROVEITA O GUARD DO `DispositivoSync`, e esse é o motivo de existir
 * separado. Aquele marca "enviado" UMA vez por navegador — e o app Android
 * compartilha o armazenamento do Chrome. Quem já tinha usado a Sora pelo Chrome
 * nunca reenviaria nada ao abrir o app, e o servidor jamais saberia que ela
 * instalou. Aqui a marca só é gravada DEPOIS de o servidor confirmar.
 *
 * ⚠️ Enquanto a migration 166 não roda, o servidor responde sem confirmar e a
 * marca não é gravada. O `sessionStorage` segura a nova tentativa pra próxima
 * SESSÃO, não pra cada tela — telemetria não pode virar chamada por navegação.
 */
export default function AppInstaladoSync() {
  const { user, loading, perfil } = useAuth();
  const jaSabe = !!perfil?.app_android_em;

  useEffect(() => {
    if (loading || !user || jaSabe) return;
    if (detectarOrigem() !== 'android') return;   // só DENTRO do app conta

    try {
      if (localStorage.getItem(CHAVE) === '1') return;
      if (sessionStorage.getItem(CHAVE) === '1') return;
      sessionStorage.setItem(CHAVE, '1');
    } catch {
      return; // storage bloqueado: sem como evitar reenvio — desiste.
    }

    fetch('/api/user/dispositivo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plataforma: 'android_app' }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.appAndroid) {
          try { localStorage.setItem(CHAVE, '1'); } catch { /* storage bloqueado */ }
        }
      })
      .catch(() => { /* melhor esforço — nunca atrapalha o app */ });
  }, [user, loading, jaSabe]);

  return null;
}
