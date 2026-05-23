import { createClient } from '@supabase/supabase-js';

// Client com service role key — usa apenas em Route Handlers e webhooks,
// nunca em componentes client-side (key não pode ser pública).
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // Aceita ambos os nomes de variável (compatibilidade com .env.local existente)
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
