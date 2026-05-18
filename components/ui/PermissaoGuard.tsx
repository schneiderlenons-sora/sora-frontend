'use client';

import { useAuth } from '@/contexts/AuthContext';

interface Props {
  papel?:    'admin' | 'escrita';   // papel mínimo necessário
  children:  React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Esconde children se o usuário não tem o papel necessário no grupo ativo.
 * - papel="admin"  → só admins veem
 * - papel="escrita" → admin OU escrita veem (omite leitura)
 * - default ("escrita") esconde apenas para usuários "leitura"
 */
export default function PermissaoGuard({ papel = 'escrita', children, fallback = null }: Props) {
  const { podeEditar, podeAdministrar } = useAuth();

  const autorizado = papel === 'admin' ? podeAdministrar : podeEditar;
  if (!autorizado) return <>{fallback}</>;
  return <>{children}</>;
}
