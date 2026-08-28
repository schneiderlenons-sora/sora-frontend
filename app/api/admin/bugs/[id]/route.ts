import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';

/** Validade da URL assinada do anexo. Igual à do backend (services/bugAnexo). */
const TTL = 3600;

// Conversa de um chamado, do lado do admin: relato de abertura + thread +
// anexos. O anexo vem como URL ASSINADA — o bucket `bug-anexos` é privado
// porque print de bug quase sempre mostra saldo e extrato do cliente.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;

  const { id } = await ctx.params;

  const { data: rel } = await supabaseAdmin
    .from('bug_reports').select('*').eq('id', id).maybeSingle();
  if (!rel) return NextResponse.json({ erro: 'Chamado não encontrado.' }, { status: 404 });

  let mensagens: Array<Record<string, unknown>> = [];
  try {
    const { data } = await supabaseAdmin.from('bug_mensagens')
      .select('*').eq('bug_id', id).order('created_at', { ascending: true });
    mensagens = data || [];
    // Quem está lendo é o suporte → marca as do USUÁRIO como lidas.
    const pendentes = mensagens
      .filter((m) => m.autor === 'usuario' && !m.lida_em)
      .map((m) => m.id as string);
    if (pendentes.length) {
      await supabaseAdmin.from('bug_mensagens')
        .update({ lida_em: new Date().toISOString() }).in('id', pendentes);
    }
  } catch { /* migration 143 pendente — mostra só o relato de abertura */ }

  // Assina os caminhos de uma vez só.
  const caminhos = [rel.imagem_path, ...mensagens.map((m) => m.imagem_path)]
    .filter(Boolean) as string[];
  const urls: Record<string, string | null> = {};
  await Promise.all([...new Set(caminhos)].map(async (c) => {
    try {
      const { data } = await supabaseAdmin.storage.from('bug-anexos').createSignedUrl(c, TTL);
      urls[c] = data?.signedUrl || null;
    } catch { urls[c] = null; }
  }));

  return NextResponse.json({
    chamado: { ...rel, imagem_url: rel.imagem_path ? urls[rel.imagem_path] ?? null : null },
    mensagens: mensagens.map((m) => ({
      id: m.id, autor: m.autor, texto: m.texto, created_at: m.created_at,
      imagem_url: m.imagem_path ? urls[m.imagem_path as string] ?? null : null,
    })),
  });
}
