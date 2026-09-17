import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { baseDisponivelSSR, marcarBaseIndisponivelSSR, ehErroDaColunaBase } from '@/lib/ssr';

// Carrega o perfil do usuário logado pelo SERVIDOR (sessão via cookie +
// service role). Confiável no F5 — não depende da hidratação da sessão no
// cliente nem de RLS, que causavam perfil=null e travamento do painel.
export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ perfil: null, papel: 'admin' }, { status: 401 });
    }

    // ⚠️ `moeda_base` (migration 168) entra no embed do grupo, mas é coluna
    // nova no caminho de TODO carregamento do painel: pedir antes de a
    // migration rodar faria esta leitura falhar e o painel abrir sem perfil.
    // Tenta com a coluna; se o erro for dela, refaz com o embed de sempre.
    const EMBED_SEM_BASE = '*, grupo_ativo:grupos!fk_users_grupo_ativo(id, nome, dono_id)';
    const EMBED_COM_BASE = '*, grupo_ativo:grupos!fk_users_grupo_ativo(id, nome, dono_id, moeda_base)';

    let { data: perfil, error: erroPerfil } = await supabaseAdmin
      .from('users')
      .select(baseDisponivelSSR() ? EMBED_COM_BASE : EMBED_SEM_BASE)
      .eq('id', user.id)
      .maybeSingle();
    if (erroPerfil && ehErroDaColunaBase(erroPerfil)) {
      marcarBaseIndisponivelSSR();
      ({ data: perfil, error: erroPerfil } = await supabaseAdmin
        .from('users').select(EMBED_SEM_BASE).eq('id', user.id).maybeSingle());
    }
    void erroPerfil;   // outros erros seguem o comportamento de antes: perfil null

    // Backfill do WhatsApp: se a linha existe mas phone está null (ex.: a
    // chamada /welcome do cadastro falhou/deu 401), recupera o número do
    // user_metadata (gravado atomicamente no signUp) e persiste. Sem o phone,
    // todo o app — que é keyed by phone — quebra (categorias, contas, etc.).
    if (perfil && !perfil.phone) {
      const metaPhone = (user.user_metadata?.phone as string | undefined)?.replace(/\D/g, '');
      if (metaPhone && metaPhone.length >= 12) {
        await supabaseAdmin.from('users').update({ phone: metaPhone }).eq('id', user.id);
        (perfil as { phone?: string | null }).phone = metaPhone;
      }
    }

    let papel: 'admin' | 'escrita' | 'leitura' = 'admin';
    const grupoId = (perfil as { grupo_ativo?: { id?: string; dono_id?: string } } | null)?.grupo_ativo?.id;
    const donoId  = (perfil as { grupo_ativo?: { id?: string; dono_id?: string } } | null)?.grupo_ativo?.dono_id;
    if (grupoId) {
      const { data: membro } = await supabaseAdmin
        .from('grupo_membros')
        .select('papel')
        .eq('grupo_id', grupoId).eq('user_id', user.id)
        .maybeSingle();
      if (membro?.papel) papel = membro.papel as typeof papel;
      else if (donoId === user.id) papel = 'admin';
      else papel = 'leitura';
    }

    return NextResponse.json({ perfil: perfil || null, papel });
  } catch {
    return NextResponse.json({ perfil: null, papel: 'admin' }, { status: 500 });
  }
}
