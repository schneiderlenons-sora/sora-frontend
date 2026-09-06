import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Client server-side que lê a sessão via cookies.
// Usado nos Route Handlers para identificar o usuário logado.
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // ⚠️ EM SERVER COMPONENT, `cookieStore.set` LANÇA. O Next só deixa
          //    escrever cookie em Server Action ou Route Handler, e é o padrão
          //    documentado do @supabase/ssr engolir isso aqui.
          //
          //    Sem o try/catch o estrago é grande e silencioso: quando o
          //    access token vence, `getUser()` RENOVA — a ida de rede já
          //    aconteceu e o Supabase já ROTACIONOU o refresh token, matando o
          //    antigo — e então este `set` estoura. O par novo nunca chega ao
          //    navegador, que fica com o token recém-invalidado. Da próxima
          //    requisição em diante a renovação falha e o app manda pro login.
          //
          //    Quem persiste a renovação é o MIDDLEWARE, que roda antes e pode
          //    escrever na resposta. Aqui o silêncio é correto.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* Server Component: quem grava é o middleware. */ }
        },
      },
    }
  );
}
