import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Client com service role key — usa apenas em Route Handlers e webhooks,
// nunca em componentes client-side (key não pode ser pública).
//
// Inicialização lazy via Proxy: a instância só é criada na primeira chamada
// (ex.: supabaseAdmin.from('users')). Isso permite que o build do Next.js
// importe o módulo mesmo sem SUPABASE_SERVICE_ROLE_KEY definida — só falha
// se uma rota for de fato executada sem a env var.

let _instance: SupabaseClient | null = null;

function getAdminInstance(): SupabaseClient {
  if (_instance) return _instance;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase admin: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SERVICE_KEY) precisam estar definidas nas variáveis de ambiente.'
    );
  }
  _instance = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _instance;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const real = getAdminInstance() as unknown as Record<string | symbol, unknown>;
    const value = real[prop as string];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});
