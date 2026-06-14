'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

/**
 * Dispara a mensagem de boas-vindas da Sora no WhatsApp — mas SÓ depois que o
 * plano está ativo (pós-pagamento). O número é vinculado no cadastro, porém a
 * Sora não fala com quem ainda não pagou.
 *
 * Fica montado dentro do AuthProvider, então cobre todos os caminhos:
 *  - cadastro: assim que o plano ativa e cai no /onboarding, o trigger envia;
 *  - usuário que fechou a aba antes de ativar: ao logar de novo, envia;
 *  - lead que vira pagante depois (upgrade): ao ativar, envia.
 *
 * Idempotente: o backend só manda na primeira vez (welcomed_at). Aqui a gente
 * só chama quando `welcomed_at` ainda está vazio, evitando a mensagem de
 * "reenvio". Um ref impede disparo duplo dentro da mesma sessão.
 */
export default function WelcomeTrigger() {
  const { perfil } = useAuth();
  const disparado = useRef(false);

  useEffect(() => {
    if (disparado.current) return;
    if (!perfil) return;

    const planoAtivo = !!perfil.plano && perfil.plano !== 'inativo';
    if (!planoAtivo) return;        // só após o pagamento ativar o plano
    if (!perfil.phone) return;      // precisa do WhatsApp vinculado
    if (perfil.welcomed_at) return; // já recebeu as boas-vindas

    disparado.current = true;
    api.user
      .welcome({ user_id: perfil.id, phone: perfil.phone })
      .catch(() => { disparado.current = false; }); // libera retry se falhar
  }, [perfil]);

  return null;
}
