// =============================================================================
// Compra do cartão DIVIDIDA com outra pessoa — o lado do painel (migration 206).
// Regra canônica no backend: services/divisaoCompra.js. `parteDoOutro` e
// `chavePessoa` são ESPELHO dela (eval:divisao compara caso a caso): a prévia
// da tela tem de mostrar o mesmo número que o servidor grava.
//
// "Quem deve quanto nesta fatura" é calculado aqui, em cima das MESMAS compras
// que o detalhe da fatura mostra (lib/fatura-lista.ts) — assim o bloco nunca
// discorda da lista logo acima dele. O servidor guarda só os acertos.
// =============================================================================

export type ModoDivisao = 'metade' | 'valor';
export type DivisaoPedido = { com: string; modo: ModoDivisao; valor?: number };

export type FormaAcerto = 'conta' | 'vincular' | 'fatura' | 'registro';
export type AcertoDivisao = {
  id: string; pessoa: string; pessoa_chave?: string; valor: number; forma: FormaAcerto;
  wallet_id?: string | null; transacao_id?: string | null; created_at?: string;
};

const cent = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100;

/** "Mesma pessoa" = mesma chave: sem acento, caixa nem pontuação. */
export function chavePessoa(nome: unknown): string {
  return String(nome ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036F]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Quanto desta linha é da outra pessoa (espelho do backend). null = não dá.
 * Na metade, o centavo ímpar fica com quem passou o cartão.
 */
export function parteDoOutro(valorLinha: number, divisao: { modo: ModoDivisao; valor?: number } | null): number | null {
  const v = cent(valorLinha);
  if (!divisao || !(v > 0)) return null;
  if (divisao.modo === 'metade') {
    const p = Math.floor(Math.round(v * 100) / 2) / 100;
    return p > 0 ? p : null;
  }
  const p = cent(divisao.valor);
  if (!(p > 0) || p > v) return null;
  return p;
}

/** Lê a divisão já gravada numa linha como pedido de formulário. */
export function divisaoDaLinha(t: { valor?: number; dividida_com?: string | null; parte_outro?: number | null }): DivisaoPedido | null {
  if (!t?.dividida_com || !(Number(t.parte_outro) > 0)) return null;
  const metade = parteDoOutro(Number(t.valor), { modo: 'metade' });
  return cent(t.parte_outro) === metade
    ? { com: t.dividida_com, modo: 'metade' }
    : { com: t.dividida_com, modo: 'valor', valor: cent(t.parte_outro) };
}

export type CompraDividida = {
  id: string; descricao: string; data: string; valor: number; parte: number;
  parcela: string | null;
};
export type PessoaDaFatura = {
  chave: string; nome: string;
  /** Soma das partes dela nas compras desta fatura. */
  devido: number;
  /** O que ela já acertou desta fatura. */
  recebido: number;
  /** O que falta (nunca negativo). */
  aReceber: number;
  compras: CompraDividida[];
  acertos: AcertoDivisao[];
};

/**
 * Quem deve quanto nesta fatura. Só COMPRA conta (Gasto com parte > 0); o nome
 * exibido é a grafia mais usada nas linhas (empate: a primeira que apareceu).
 * Acerto de pessoa sem compra na fatura (compra apagada depois) continua
 * aparecendo — sumir com dinheiro registrado seria pior.
 */
export function pessoasDaFatura(
  linhas: { id: string; tipo?: string; valor?: number; data?: string; observacao?: string | null; categoria?: string | null;
    dividida_com?: string | null; parte_outro?: number | null; parcela_num?: number | null; parcela_total?: number | null }[],
  acertos: AcertoDivisao[] = [],
): PessoaDaFatura[] {
  const porChave = new Map<string, PessoaDaFatura & { grafias: Map<string, number> }>();
  const pegar = (nome: string) => {
    const k = chavePessoa(nome);
    if (!k) return null;
    let p = porChave.get(k);
    if (!p) { p = { chave: k, nome, devido: 0, recebido: 0, aReceber: 0, compras: [], acertos: [], grafias: new Map() }; porChave.set(k, p); }
    return p;
  };
  for (const t of linhas || []) {
    if (!t || t.tipo !== 'Gasto' || !t.dividida_com || !(Number(t.parte_outro) > 0)) continue;
    const p = pegar(t.dividida_com);
    if (!p) continue;
    const nome = String(t.dividida_com).trim();
    p.grafias.set(nome, (p.grafias.get(nome) || 0) + 1);
    p.devido = cent(p.devido + Number(t.parte_outro));
    p.compras.push({
      id: t.id, descricao: (t.observacao || t.categoria || 'Compra').trim(), data: String(t.data || '').slice(0, 10),
      valor: cent(t.valor), parte: cent(t.parte_outro),
      parcela: Number(t.parcela_total) > 1 ? `${t.parcela_num}/${t.parcela_total}` : null,
    });
  }
  for (const a of acertos || []) {
    const p = pegar(a.pessoa);
    if (!p) continue;
    if (!p.grafias.size) p.grafias.set(String(a.pessoa).trim(), 0);
    p.recebido = cent(p.recebido + Number(a.valor));
    p.acertos.push(a);
  }
  return [...porChave.values()]
    .map(({ grafias, ...p }) => {
      let nome = p.nome, maior = -1;
      for (const [g, n] of grafias) if (n > maior) { nome = g; maior = n; }
      return {
        ...p, nome,
        aReceber: Math.max(0, cent(p.devido - p.recebido)),
        compras: p.compras.sort((a, b) => a.data.localeCompare(b.data) || a.descricao.localeCompare(b.descricao, 'pt-BR')),
      };
    })
    .sort((a, b) => b.aReceber - a.aReceber || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Mensagem da cobrança (vai pelo WhatsApp DO CLIENTE — não custa nada na Meta). */
export function mensagemCobranca(p: {
  nome: string; cartao: string; fatura: string; aReceber: number; recebido: number;
  compras: CompraDividida[]; fmt: (v: number) => string;
}): string {
  const MAX = 12;
  const linhas = p.compras.slice(0, MAX).map((c) => `• ${c.descricao}${c.parcela && !c.descricao.includes(c.parcela) ? ` (${c.parcela})` : ''}: ${p.fmt(c.parte)}`);
  if (p.compras.length > MAX) linhas.push(`• e mais ${p.compras.length - MAX} ${p.compras.length - MAX === 1 ? 'compra' : 'compras'}`);
  const partes = [
    `Oi, ${p.nome}! Sua parte na fatura do ${p.cartao} (${p.fatura}) deu ${p.fmt(p.aReceber)}.`,
    '',
    ...linhas,
  ];
  if (p.recebido > 0.009) partes.push('', `Já descontei os ${p.fmt(p.recebido)} que você pagou.`);
  return partes.join('\n');
}

/** Abre o WhatsApp do aparelho com a mensagem pronta (a pessoa escolhe o contato). */
export function linkWhatsApp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

/** O formulário vira pedido (ou o motivo de não virar). Espelha `validarDivisao`. */
export function pedidoDoFormulario(f: { ativo: boolean; com: string; modo: ModoDivisao; valor: number }):
  { ok: true; divisao: DivisaoPedido | null } | { ok: false; erro: string } {
  if (!f.ativo) return { ok: true, divisao: null };
  const com = String(f.com || '').replace(/\s+/g, ' ').trim();
  if (!com) return { ok: false, erro: 'Diga com quem a compra foi dividida.' };
  if (com.length > 60) return { ok: false, erro: 'O nome pode ter até 60 letras.' };
  if (f.modo === 'metade') return { ok: true, divisao: { com, modo: 'metade' } };
  const valor = cent(f.valor);
  if (!(valor > 0)) return { ok: false, erro: 'Informe quanto é da outra pessoa.' };
  return { ok: true, divisao: { com, modo: 'valor', valor } };
}
