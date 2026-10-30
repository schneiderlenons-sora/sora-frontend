import { redirect } from 'next/navigation';

// =============================================================================
// /reportar-bug → /ajuda (out/2026).
//
// O suporte (relatar problema, sugerir melhoria, chamados) e as Novidades
// moraram aqui; agora são seções da aba Ajuda, que está fixa no menu — relato
// do Robert, "difícil achar os chamados".
//
// ⚠️ A ROTA FICA, só redirecionando: ela está em mensagem de WhatsApp, em
// e-mail e no histórico do navegador. Cada link antigo cai no lugar certo:
//   ?aba=novidades            → Novidades
//   ?aba=problema|melhoria    → o formulário daquele assunto (sugestao = melhoria)
//   ?chamado=<id>             → a conversa daquele chamado
//   sem nada                  → Suporte (os links "fale com a gente" vinham sem aba)
// =============================================================================

type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function ReportarBugRedirect({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';
  const aba = um(sp.aba);
  const chamado = um(sp.chamado);

  const q = new URLSearchParams();
  if (aba === 'novidades' && !chamado) {
    q.set('aba', 'novidades');
  } else {
    q.set('aba', 'suporte');
    const tipo = aba === 'sugestao' ? 'melhoria' : aba;
    if (tipo === 'problema' || tipo === 'melhoria' || tipo === 'duvida') q.set('tipo', tipo);
    if (/^[0-9a-f-]{8,40}$/i.test(chamado)) q.set('chamado', chamado);
  }
  redirect(`/ajuda?${q.toString()}`);
}
