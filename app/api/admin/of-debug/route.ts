import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';
// O diagnóstico chama a Polp várias vezes e ainda paga o cold start do Render
// (free tier). No limite padrão a URL não carregava. `foco=cartoes` corta o
// grosso das chamadas; isto cobre o resto.
export const maxDuration = 60;

// Diagnóstico do Open Finance de UM usuário, aberto pelo navegador.
//
// A rota do backend (`/api/open-finance/debug-celcoin/:consentId`) exige token
// Bearer da sessão — o navegador não manda isso, então abrir a URL direto dava
// "Não autenticado". Aqui o painel já sabe quem é você (checkAdmin) e a chamada
// pro backend vai server-to-server com o ADMIN_SECRET.
//
// Uso:  /api/admin/of-debug?email=cliente@exemplo.com
//       (sem email → lista as conexões pra escolher; &cru=1 traz o payload bruto)
//       &resumo=1 → só os números que decidem a fatura, legível de bater o olho
//                   (o payload completo tem milhares de linhas)

type CartaoDebug = {
  normalizado?: { nome?: string; extras?: Record<string, unknown> };
  conferir?: Record<string, unknown>;
  conferencia?: Record<string, unknown>;
  parcelamentos_analise?: {
    parcelamentos?: number; compras_distintas?: number; duplicatas?: number;
    detalhe_duplicatas?: unknown[];
    futuras?: Record<string, Record<string, number>>;
    com_regra_de_ouro?: Record<string, number | null>;
  };
};

/** Extrai do payload gigante só o que responde "a correção da Polp chegou?". */
function resumir(diagnostico: Record<string, unknown>[]) {
  return diagnostico.map((d) => ({
    consent: d.consent,
    cartoes: ((d.cartoes as CartaoDebug[]) || []).map((c) => {
      const an = c.parcelamentos_analise;
      const conf = (c.conferencia || {}) as Record<string, number | null>;
      return {
        cartao: c.normalizado?.nome,
        // ── A pergunta principal ──
        parcelamento_duplicado: an
          ? (an.duplicatas === 0
              ? 'CORRIGIDO (0 duplicatas)'
              : `AINDA DUPLICA (${an.duplicatas} de ${an.compras_distintas} compras)`)
          : 'sem dado',
        linhas_na_api: an?.parcelamentos ?? null,
        compras_reais: an?.compras_distintas ?? null,
        duplicatas: an?.detalhe_duplicatas ?? [],
        // ── Os candidatos a fatura, pra comparar com o app do banco ──
        fatura_no_app_do_banco: '<<< preencher olhando o app',
        limite_usado: conf.limite_usado ?? null,
        fatura_publicada_pelo_banco: conf.bill_total_da_aberta ?? null,
        soma_das_transacoes: (conf.candidatas as unknown as Record<string, number>)?.soma_do_bill_da_aberta ?? null,
        regra_de_ouro: an?.com_regra_de_ouro ?? null,
        futuras: an?.futuras ?? null,
      };
    }),
  }));
}

export async function GET(req: NextRequest) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;

  const base = process.env.NEXT_PUBLIC_API_URL;
  const secret = process.env.ADMIN_SECRET;
  if (!base || !secret) {
    return NextResponse.json({ erro: 'Falta NEXT_PUBLIC_API_URL ou ADMIN_SECRET na Vercel.' }, { status: 503 });
  }

  const email = (req.nextUrl.searchParams.get('email') || '').trim().toLowerCase();
  const consentParam = (req.nextUrl.searchParams.get('consent') || '').trim();
  const cru = req.nextUrl.searchParams.get('cru') === '1';
  const resumo = req.nextUrl.searchParams.get('resumo') === '1';
  // `resumo=1` só olha cartão/parcelamento — então nem faz sentido pagar as
  // chamadas de conta, investimento e empréstimo. Por isso o foco vem junto
  // por padrão (dá pra forçar o completo com &foco=completo).
  const focoParam = (req.nextUrl.searchParams.get('foco') || '').trim();
  const foco = focoParam || (resumo ? 'cartoes' : '');

  let consents: string[] = consentParam ? [consentParam] : [];
  let contexto: Record<string, unknown> = {};

  if (!consents.length) {
    if (!email) {
      return NextResponse.json({
        erro: 'Informe ?email=<e-mail do cliente> (ou ?consent=<id>).',
        exemplo: '/api/admin/of-debug?email=cliente@exemplo.com',
      }, { status: 400 });
    }
    const { data: u } = await supabaseAdmin
      .from('users').select('id, name, grupo_ativo').eq('email', email).maybeSingle();
    if (!u) return NextResponse.json({ erro: `Nenhum usuário com o e-mail ${email}.` }, { status: 404 });

    const { data: cx } = await supabaseAdmin
      .from('of_conexoes')
      .select('external_id, provider, status, ultima_sync, ultimo_erro')
      .eq('grupo_id', u.grupo_ativo);

    consents = (cx || []).map((c) => String(c.external_id));
    contexto = { usuario: { nome: u.name, email }, conexoes: cx || [] };

    if (!consents.length) {
      return NextResponse.json({ ...contexto, erro: 'Esse usuário não tem conexão de Open Finance.' }, { status: 404 });
    }
  }

  // Carteiras do grupo entram no retorno pra dar pra comparar o que ESTÁ gravado
  // com o que a API responde agora — é a metade da conferência que não aparece
  // no payload do banco.
  const saida: Record<string, unknown> = { ...contexto, diagnostico: [] as unknown[] };

  for (const consent of consents) {
    const qs = new URLSearchParams();
    if (cru) qs.set('cru', '1');
    if (foco && foco !== 'completo') qs.set('foco', foco);
    const url = `${base}/api/open-finance/debug-celcoin/${encodeURIComponent(consent)}`
      + (qs.toString() ? `?${qs}` : '');
    try {
      const r = await fetch(url, { headers: { 'x-admin-secret': secret }, cache: 'no-store' });
      const body = await r.json().catch(() => ({ erro: `resposta inválida (${r.status})` }));
      (saida.diagnostico as unknown[]).push({ consent, status: r.status, ...body });
    } catch (e: unknown) {
      // Erro de fetch aqui é quase sempre TIMEOUT (Render free em cold start).
      // Dizer isso explicitamente evita caçar bug no lugar errado.
      (saida.diagnostico as unknown[]).push({
        consent,
        erro: e instanceof Error ? e.message : 'falhou',
        dica: 'Se demorou e caiu, provavelmente é cold start do Render. Recarregue a URL uma vez.',
      });
    }
  }

  if (resumo) {
    return NextResponse.json({
      ...contexto,
      como_ler: 'parcelamento_duplicado responde se a correção da Polp chegou. '
        + 'Depois compare fatura_no_app_do_banco com limite_usado, soma_das_transacoes '
        + 'e cada linha de regra_de_ouro — o que bater é a regra certa.',
      resumo: resumir(saida.diagnostico as Record<string, unknown>[]),
    });
  }

  return NextResponse.json(saida);
}
