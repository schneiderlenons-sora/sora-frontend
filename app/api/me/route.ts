import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

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

    const { data: perfil } = await supabaseAdmin
      .from('users')
      .select('*, grupo_ativo:grupos!fk_users_grupo_ativo(id, nome, dono_id)')
      .eq('id', user.id)
      .maybeSingle();

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
