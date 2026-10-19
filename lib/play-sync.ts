import { supabaseAdmin } from './supabase-admin';
import { buscarAssinatura, reconhecerAssinatura, ErroPlay } from './google-play';
import { lerAssinatura, planoDasAssinaturas, decidirPatchUsuario, type EstadoPlay } from './play-billing';

// ─────────────────────────────────────────────────────────────────────────────
// SINCRONIZAR UMA COMPRA DA PLAY — fonte única.
//
// Três portas chegam aqui e todas fazem a MESMA coisa:
//   · /api/play/verificar — logo depois da compra, com a pessoa logada;
//   · /api/play/verificar — na restauração (o app relê as compras do aparelho);
//   · /api/play/rtdn      — o aviso automático do Google (renovou, cancelou…).
//
// ⚠️ NUNCA SE CONFIA NO QUE O CLIENTE OU O AVISO DIZEM. Os dois só entregam o
// `purchaseToken`; o estado é SEMPRE relido na API do Google. É isso que torna
// seguro aceitar o aviso por uma URL com segredo simples: no pior caso alguém
// força uma releitura.
//
// ⚠️ RECUSAR = NÃO CONFIRMAR = O GOOGLE DEVOLVE O DINHEIRO. Compra que a Sora
// não confirma em 3 dias é reembolsada sozinha. Então, quando a compra não pode
// valer (conta vitalícia, conta que já paga pelo site, comprovante de outra
// conta), a resposta certa é simplesmente NÃO gravar e NÃO confirmar.
// ─────────────────────────────────────────────────────────────────────────────

export type ResultadoSync =
  | { ok: true; userId: string; plano: string | null; estado: string }
  | { ok: false; motivo: 'outra_conta' | 'sem_dono' | 'ja_tem_plano' | 'produto_desconhecido'; estado?: string };

const COLUNAS_USER = 'id, plano, plano_fonte, vitalicio, stripe_subscription_id';

async function gravar(token: string, userId: string, e: EstadoPlay) {
  const { error } = await supabaseAdmin.from('play_assinaturas').upsert({
    purchase_token: token,
    user_id: userId,
    product_id: e.produto,
    plano: e.plano,
    intervalo: e.intervalo,
    estado: e.estado,
    expira_em: e.expiraEm,
    auto_renova: e.autoRenova,
    linked_purchase_token: e.vinculada,
    reconhecida: e.reconhecida,
    pedido_id: e.pedido,
    teste: e.teste,
    atualizado_em: new Date().toISOString(),
  }, { onConflict: 'purchase_token' });
  // ⚠️ Lido de propósito: sem a migration 187 isto falha, e seguir em frente
  // liberaria o plano sem registro — o próximo aviso do Google não acharia dono.
  if (error) throw new Error(`play_assinaturas: ${error.message}`);
}

/** Relê todas as assinaturas Play da pessoa e acerta `users`. */
export async function recalcularPlanoPlay(userId: string): Promise<string | null> {
  const [{ data: linhas, error: eL }, { data: u, error: eU }] = await Promise.all([
    supabaseAdmin.from('play_assinaturas').select('plano, intervalo, estado, expira_em').eq('user_id', userId),
    supabaseAdmin.from('users').select(COLUNAS_USER).eq('id', userId).maybeSingle(),
  ]);
  // Sem dado, não se afirma nada: rebaixar por leitura que falhou tiraria o
  // plano de quem pagou.
  if (eL || eU || !u) throw new Error(`recalcular: ${eL?.message || eU?.message || 'usuário não encontrado'}`);
  const play = planoDasAssinaturas(linhas || [], Date.now());
  const patch = decidirPatchUsuario(u, play);
  if (patch) {
    const { error } = await supabaseAdmin.from('users').update(patch).eq('id', userId);
    if (error) throw new Error(`users: ${error.message}`);
  }
  return play?.plano ?? (patch?.plano ?? u.plano) ?? null;
}

/**
 * @param token     o `purchaseToken` da compra
 * @param reclamante quem está logado pedindo a compra (null = aviso do Google)
 */
export async function sincronizarToken(token: string, reclamante: string | null): Promise<ResultadoSync> {
  const sub = await buscarAssinatura(token);
  const e = lerAssinatura(sub);

  const { data: existente } = await supabaseAdmin
    .from('play_assinaturas').select('user_id').eq('purchase_token', token).maybeSingle();

  // ⚠️ Comprovante já ligado a OUTRA conta Sora não muda de dono. Acontece com
  // celular compartilhado: a conta Google do aparelho é a mesma, a conta Sora
  // não. Mudar o dono deixaria quem pagou sem o plano.
  if (existente && reclamante && existente.user_id !== reclamante) {
    return { ok: false, motivo: 'outra_conta', estado: e.estado };
  }

  let dono: string | null = existente?.user_id ?? null;

  // Troca de plano: a compra nova aponta pra antiga, e o aviso dela pode chegar
  // antes de o app confirmar. O dono é o mesmo da antiga.
  if (!dono && e.vinculada) {
    const { data: antiga } = await supabaseAdmin
      .from('play_assinaturas').select('user_id').eq('purchase_token', e.vinculada).maybeSingle();
    if (antiga) {
      if (reclamante && antiga.user_id !== reclamante) return { ok: false, motivo: 'outra_conta', estado: e.estado };
      dono = antiga.user_id;
    }
  }

  if (!dono) {
    // Aviso do Google de uma compra que o app ainda não confirmou: quem vai
    // ligá-la à conta é o /verificar, logo em seguida. Não há o que fazer aqui.
    if (!reclamante) return { ok: false, motivo: 'sem_dono', estado: e.estado };

    // Compra NOVA reclamada por alguém: só vale se a conta pode ter assinatura Play.
    const { data: u } = await supabaseAdmin.from('users').select(COLUNAS_USER).eq('id', reclamante).maybeSingle();
    if (!u) return { ok: false, motivo: 'sem_dono', estado: e.estado };
    // ⚠️ Vitalício e assinante do site não compram pela Play (o app nem oferece).
    // Se chegar mesmo assim, não confirmar = o Google reembolsa sozinho.
    if (u.vitalicio || (u.stripe_subscription_id && u.plano !== 'inativo' && u.plano !== 'gratis')) {
      return { ok: false, motivo: 'ja_tem_plano', estado: e.estado };
    }
    dono = reclamante;
  }

  if (!e.plano) {
    // Produto fora do catálogo: grava pra ficar visível no diagnóstico, mas não
    // confirma (o Google reembolsa) e não dá plano.
    await gravar(token, dono, e);
    return { ok: false, motivo: 'produto_desconhecido', estado: e.estado };
  }

  await gravar(token, dono, e);

  // Confirmação: só depois de gravado (se a gravação falhasse e a confirmação
  // passasse, o dinheiro ficaria e o plano não viria).
  const confirmavel = e.estado === 'SUBSCRIPTION_STATE_ACTIVE' || e.estado === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD';
  if (!e.reconhecida && confirmavel && e.produto) {
    try {
      await reconhecerAssinatura(e.produto, token);
      await supabaseAdmin.from('play_assinaturas').update({ reconhecida: true }).eq('purchase_token', token);
    } catch (err) {
      // Não derruba: o próximo aviso ou a próxima abertura do app tenta de novo
      // (há 3 dias de prazo). Mas fica no log, porque é dinheiro em risco.
      console.error('[play] confirmação falhou', e.produto, err instanceof Error ? err.message : err);
    }
  }

  // A compra antiga de uma troca normalmente expira na hora; relê pra o
  // registro dela não seguir "ativo" e segurar o plano antigo.
  if (e.vinculada) {
    try {
      const antiga = lerAssinatura(await buscarAssinatura(e.vinculada));
      await supabaseAdmin.from('play_assinaturas')
        .update({ estado: antiga.estado, expira_em: antiga.expiraEm, auto_renova: antiga.autoRenova, atualizado_em: new Date().toISOString() })
        .eq('purchase_token', e.vinculada).eq('user_id', dono);
    } catch (err) {
      if (!(err instanceof ErroPlay && err.definitivo)) console.warn('[play] releitura da compra antiga falhou', err instanceof Error ? err.message : err);
    }
  }

  const plano = await recalcularPlanoPlay(dono);
  return { ok: true, userId: dono, plano, estado: e.estado };
}
