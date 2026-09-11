import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const VALIDAS = ['android_app', 'android_web', 'ios_pwa', 'ios_web', 'desktop', 'outro'];

/**
 * Grava `users.plataforma` — só pra o /admin enxergar Android × Apple.
 *
 * ⚠️ Chamado UMA VEZ POR NAVEGADOR (o guard é `components/app/DispositivoSync.tsx`,
 * via localStorage) — não é rota de alta frequência, então o `getUser()` (ida de
 * rede ao Supabase Auth) aqui não pesa como pesaria num caminho quente.
 *
 * Sem sessão → 401 e o cliente NÃO marca como enviado (tenta de novo na
 * próxima carga, já logado). Silencioso de propósito: é telemetria, nunca pode
 * atrapalhar quem está usando o app.
 */
/**
 * Client que LÊ a sessão e NUNCA a escreve.
 *
 * ⚠️ ISTO NÃO É DETALHE — É O QUE IMPEDE ESTA ROTA DE DESLOGAR ALGUÉM.
 *
 * `/api/*` está FORA do matcher do middleware, então nenhuma das proteções de
 * sessão que vivem lá alcança esta rota. E `getUser()` não só valida: quando o
 * token está perto de vencer, é ELE quem dispara a renovação. Se essa renovação
 * perde a corrida de rotação (o middleware ou o navegador renovaram primeiro), o
 * supabase-js trata como falha definitiva e chama `_removeSession()` — que
 * escreve os cookies de sessão VAZIOS. Em Route Handler o `cookieStore.set`
 * FUNCIONA de verdade (ao contrário de Server Component, onde ele lança e é
 * engolido), então esses cookies vazios chegam ao navegador e a sessão morre.
 *
 * Esta rota é TELEMETRIA. Ela não tem nenhum motivo pra mexer em sessão: com o
 * `setAll` vazio ela continua lendo e validando, mas não consegue rotacionar
 * nem apagar nada. Quem é dono do cookie de sessão é o middleware, e só ele.
 *
 * ⚠️ Ao criar rota nova em `/api` que só PRECISA saber quem é o usuário, use
 * este padrão. `createSupabaseServer` (que escreve) é pra quem realmente
 * gerencia sessão — login, callback de auth.
 */
async function lerUsuario() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() { /* de propósito: esta rota nunca escreve cookie de sessão */ },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(req: NextRequest) {
  const user = await lerUsuario();
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const plataforma = String(body?.plataforma || '');
  if (!VALIDAS.includes(plataforma)) {
    return NextResponse.json({ erro: 'Plataforma inválida' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('users').update({ plataforma }).eq('id', user.id);
  // Coluna nova (migration 161) — se ainda não rodou, falha calado: é
  // telemetria opcional, não pode gerar erro visível pro usuário comum.
  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 200 });

  return NextResponse.json({ ok: true });
}
