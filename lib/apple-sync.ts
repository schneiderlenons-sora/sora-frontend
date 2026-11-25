import { supabaseAdmin } from './supabase-admin';
import { statusDasAssinaturas, ambienteDe, ErroApple } from './app-store';
import {
  lerAssinaturaApple, planoDasAssinaturasApple, decidirPatchUsuarioApple, appleMandaNoPlano, type LeituraApple,
} from './apple-billing';

// ─────────────────────────────────────────────────────────────────────────────
// SINCRONIZAR UMA ASSINATURA DA APPLE — fonte única. Irmão de `lib/play-sync.ts`.
//
// Três portas chegam aqui e todas fazem a MESMA coisa:
//   · /api/apple/verificar   — logo depois da compra, com a pessoa logada;
//   · /api/apple/verificar   — na restauração (o app relê as assinaturas do Apple ID);
//   · /api/apple/notificacoes — o aviso automático da App Store.
//
// ⚠️ O ESTADO VEM SEMPRE DA APPLE (getAllSubscriptionStatuses). O app e o aviso
// só dizem QUAL assinatura olhar.
//
// ⚠️ QUEM É O DONO, em ordem: a linha já gravada → o `appAccountToken` (o id
// da conta Sora que estava logada na hora da compra, carimbado pela Apple no
// comprovante) → quem está pedindo. Comprovante já ligado a outra conta não
// muda de dono (Apple ID compartilhado entre duas contas Sora).
// ─────────────────────────────────────────────────────────────────────────────

export type ResultadoSyncApple =
  | { ok: true; userId: string; plano: string | null; estado: string }
  | { ok: false; motivo: 'outra_conta' | 'sem_dono' | 'ja_tem_plano' | 'produto_desconhecido'; estado?: string };

const COLUNAS_USER = 'id, plano, plano_fonte, vitalicio, stripe_subscription_id';

async function gravar(userId: string, e: LeituraApple) {
  const { error } = await supabaseAdmin.from('apple_assinaturas').upsert({
    original_transaction_id: e.original,
    user_id: userId,
    transacao_id: e.transacao,
    product_id: e.produto,
    plano: e.plano,
    intervalo: e.intervalo,
    estado: e.estado,
    expira_em: e.expiraEm,
    auto_renova: e.autoRenova,
    proximo_produto: e.proximoProduto,
    conta_na_compra: e.conta,
    ambiente: e.ambiente,
    atualizado_em: new Date().toISOString(),
  }, { onConflict: 'original_transaction_id' });
  // ⚠️ Lido de propósito: sem a migration 199 isto falha, e seguir em frente
  // liberaria o plano sem registro — o próximo aviso da Apple não acharia dono.
  if (error) throw new Error(`apple_assinaturas: ${error.message}`);
}

/** Relê todas as assinaturas Apple da pessoa e acerta `users`. */
export async function recalcularPlanoApple(userId: string): Promise<string | null> {
  const [{ data: linhas, error: eL }, { data: u, error: eU }] = await Promise.all([
    supabaseAdmin.from('apple_assinaturas').select('plano, intervalo, estado, expira_em').eq('user_id', userId),
    supabaseAdmin.from('users').select(COLUNAS_USER).eq('id', userId).maybeSingle(),
  ]);
  // Sem dado, não se afirma nada: rebaixar por leitura que falhou tiraria o
  // plano de quem pagou.
  if (eL || eU || !u) throw new Error(`recalcular: ${eL?.message || eU?.message || 'usuário não encontrado'}`);
  const apple = planoDasAssinaturasApple(linhas || [], Date.now());
  const patch = decidirPatchUsuarioApple(u, apple);
  if (patch) {
    const { error } = await supabaseAdmin.from('users').update(patch).eq('id', userId);
    if (error) throw new Error(`users: ${error.message}`);
  }
  return (patch?.plano ?? u.plano) ?? null;
}

async function contaExiste(id: string | null): Promise<boolean> {
  if (!id) return false;
  const { data } = await supabaseAdmin.from('users').select('id').eq('id', id).maybeSingle();
  return !!data;
}

/**
 * @param transacaoId qualquer transação da assinatura (o app manda a da compra)
 * @param ambiente    'Production' ou 'Sandbox' (de onde o comprovante veio)
 * @param reclamante  quem está logado pedindo (null = aviso da Apple)
 */
export async function sincronizarApple(transacaoId: string, ambiente: string | null | undefined, reclamante: string | null): Promise<ResultadoSyncApple> {
  const lidos = await statusDasAssinaturas(transacaoId, ambienteDe(ambiente));
  if (!lidos.length) throw new ErroApple('a App Store não devolveu assinatura para esta compra', true);

  // Normalmente é uma só (um grupo de assinaturas). Se vierem mais, a primeira
  // de que se acha o dono define o dono das outras — são do mesmo Apple ID.
  const leituras = lidos.map((l) => lerAssinaturaApple(l.status, l.tx, l.renov)).filter((e) => e.original);
  if (!leituras.length) throw new ErroApple('assinatura sem identificador', true);

  const originais = leituras.map((e) => e.original as string);
  const { data: existentes } = await supabaseAdmin
    .from('apple_assinaturas').select('original_transaction_id, user_id').in('original_transaction_id', originais);
  const donoGravado = existentes?.[0]?.user_id ?? null;

  if (donoGravado && reclamante && donoGravado !== reclamante) {
    return { ok: false, motivo: 'outra_conta', estado: leituras[0].estado };
  }

  let dono: string | null = donoGravado;
  if (!dono) {
    const carimbada = leituras.find((e) => e.conta)?.conta ?? null;
    if (carimbada && await contaExiste(carimbada)) {
      // ⚠️ Carimbada com OUTRA conta: quem comprou foi a outra (o Apple ID é o
      // mesmo, a conta Sora não). Não muda de dono — mesma regra da Play.
      if (reclamante && carimbada !== reclamante) return { ok: false, motivo: 'outra_conta', estado: leituras[0].estado };
      dono = carimbada;
    } else {
      dono = reclamante;
    }
  }
  // Aviso da Apple de uma compra sem carimbo e que o app ainda não confirmou:
  // quem vai ligá-la à conta é o /verificar, em seguida.
  if (!dono) return { ok: false, motivo: 'sem_dono', estado: leituras[0].estado };

  for (const e of leituras) await gravar(dono, e);

  if (!leituras.some((e) => e.plano)) {
    return { ok: false, motivo: 'produto_desconhecido', estado: leituras[0].estado };
  }

  // Compra feita por quem já tem plano por outro caminho: gravada (aparece no
  // admin), plano intocado. A tela nunca oferece esse caso; se acontecer, a
  // pessoa pede o reembolso à Apple.
  const { data: u } = await supabaseAdmin.from('users').select(COLUNAS_USER).eq('id', dono).maybeSingle();
  if (u && !appleMandaNoPlano(u) && reclamante) {
    return { ok: false, motivo: 'ja_tem_plano', estado: leituras[0].estado };
  }

  const plano = await recalcularPlanoApple(dono);
  return { ok: true, userId: dono, plano, estado: leituras[0].estado };
}
