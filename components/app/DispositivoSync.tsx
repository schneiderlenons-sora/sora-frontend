'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { detectarPlataforma } from '@/lib/plataforma';

const CHAVE = 'sora-dispositivo-enviado';

/**
 * Manda a plataforma desta sessão (Android app/navegador, iOS com/sem
 * instalar, desktop) pro servidor — só pra o /admin enxergar Android × Apple.
 * Puramente analytics: nunca gate de feature.
 *
 * ⚠️ UMA VEZ POR NAVEGADOR (guard em localStorage), não a cada carga — é o
 * mesmo desenho do `OrigemSync` ao lado, que já resolve o problema de
 * "detectar de novo custaria uma escrita no banco em toda navegação".
 *
 * ⚠️ Sem sessão (401), NÃO marca como enviado — tenta de novo na próxima
 * carga já logado. Falha de rede também não marca, pelo mesmo motivo. Fora
 * isso (2xx, mesmo que a coluna não exista ainda), marca — é telemetria
 * opcional, não vale reenviar pra sempre.
 */
export default function DispositivoSync() {
  const { user, loading } = useAuth();

  useEffect(() => {
    // ⚠️ SÓ COM SESSÃO NA MÃO. Sem isto a rota respondia 401, o guard abaixo
    // nunca era marcado e o envio se repetia A CADA CARREGAMENTO — virando uma
    // chamada recorrente que valida sessão FORA do middleware. Telemetria não
    // pode ter esse peso: espera o usuário existir e dispara uma vez só.
    if (loading || !user) return;

    try {
      if (localStorage.getItem(CHAVE) === '1') return;
    } catch {
      return; // storage bloqueado: sem como marcar, sem como evitar reenvio — desiste.
    }

    const plataforma = detectarPlataforma();
    fetch('/api/user/dispositivo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plataforma }),
    })
      .then((res) => {
        if (res.ok) {
          try { localStorage.setItem(CHAVE, '1'); } catch { /* storage bloqueado */ }
        }
      })
      .catch(() => { /* melhor esforço — nunca atrapalha o app */ });
  }, [user, loading]);

  return null;
}
