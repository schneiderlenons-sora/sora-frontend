// =============================================================================
// QUAIS DOCUMENTOS VÃO NO CONSENTIMENTO DO OPEN FINANCE.
//
// A regra é da Celcoin (docs versionados em `sora-backend/docs/celcoin/`,
// `institutions.txt` e `consents__create.txt`):
//
//     PERSONAL → só o CPF (mandar CNPJ é ERRO)
//     BUSINESS → CPF do representante **E** o CNPJ da empresa
//     BOTH     → só CPF (pessoal) OU CPF + CNPJ (empresarial)
//
// ⚠️ ESTE ARQUIVO EXISTE PORQUE A MESMA REGRA JÁ FALHOU DUAS VEZES, NOS DOIS
// SENTIDOS OPOSTOS:
//
//  1. set/2026 — "coloquei o CNPJ e dá erro" →
//     `422 O campo cpf é obrigatório para esta instituição`.
//     A tela tratava CPF e CNPJ como excludentes e escondia o CPF em conta PJ.
//
//  2. 01/10/2026 — "não estou conseguindo conectar XP empresa, estou colocando
//     corretamente o CPF do representante e o CNPJ da empresa" →
//     `422 O campo cnpj é obrigatório para esta instituição`.
//     Ele estava preenchendo mesmo: numa instituição BUSINESS o seletor
//     PF/PJ não aparece (não existe conta pessoal ali), então `ehPj` ficava
//     `false` — e a TELA mostrava o campo CNPJ por `soEmpresa || ehPj`
//     enquanto o ENVIO o descartava olhando só `ehPj`. O usuário digitava o
//     CNPJ, via o campo preenchido, e o valor morria antes da requisição.
//
// A causa dos dois é a mesma: a decisão "esta conexão é empresarial?" existia
// solta, calculada de um jeito na tela e de outro no envio. Aqui ela é UMA, e
// quem desenhar um formulário novo pergunta pra cá.
// =============================================================================

export type InstituicaoOF = {
  type?: string | null;
  /** Derivado do `type` pela Celcoin — serve de fallback, nunca de fonte. */
  credentials?: string[] | null;
};

export type PerfilDocs = {
  /** A instituição aceita CNPJ (BUSINESS ou BOTH). */
  aceitaCnpj: boolean;
  /** Só atende empresa: não existe conexão pessoal, e o seletor some. */
  soEmpresa: boolean;
  /** Mostra o seletor "Pessoa física / Empresa" (só em BOTH). */
  podeEscolher: boolean;
};

export function docsDaInstituicao(i: InstituicaoOF | null | undefined): PerfilDocs {
  const t = String(i?.type || '').toUpperCase();
  const creds = i?.credentials || [];
  // ⚠️ `credentials` NÃO decide sozinho: ele vem `["cpf","cnpj"]` tanto em
  // BUSINESS (exige os dois) quanto em BOTH (CNPJ opcional). Foi essa
  // ambiguidade que o código antigo leu como "escolha um". Sem `type` (payload
  // antigo), aí sim ele é o melhor que existe.
  const aceitaCnpj = t ? (t === 'BUSINESS' || t === 'BOTH') : creds.includes('cnpj');
  return {
    aceitaCnpj,
    soEmpresa: t === 'BUSINESS',
    podeEscolher: t ? t === 'BOTH' : aceitaCnpj,
  };
}

/**
 * Esta conexão é empresarial?
 *
 * ⚠️ É ESTA a função que a tela e o envio têm de consultar — nunca `ehPj`
 * sozinho. Em instituição BUSINESS o seletor não aparece, então `ehPj`
 * continua `false` mesmo sendo uma conexão de empresa: quem responde é
 * `soEmpresa`.
 */
export function conexaoEmpresarial(inst: InstituicaoOF | null | undefined, ehPj: boolean): boolean {
  const { aceitaCnpj, soEmpresa } = docsDaInstituicao(inst);
  return aceitaCnpj && (soEmpresa || ehPj);
}

export type DocsDoConsentimento = {
  cpf?: string;
  cnpj?: string;
  /** O que falta preencher, pra barrar antes de gastar a chamada na Celcoin. */
  falta: 'cpf' | 'cnpj' | null;
  empresarial: boolean;
};

/**
 * Os documentos que vão no `POST /consents`, já só com dígitos.
 *
 * @param ehPj o que o seletor PF/PJ diz — irrelevante quando a instituição é
 *             BUSINESS, porque lá o seletor nem existe.
 */
export function documentosDoConsentimento(opts: {
  inst: InstituicaoOF | null | undefined;
  ehPj: boolean;
  cpf: string;
  cnpj: string;
}): DocsDoConsentimento {
  const { inst, ehPj } = opts;
  const empresarial = conexaoEmpresarial(inst, ehPj);
  const soDigitos = (s: string) => String(s || '').replace(/\D/g, '');

  const cpf = soDigitos(opts.cpf);
  // ⚠️ O CNPJ só acompanha conexão EMPRESARIAL. Mandá-lo numa instituição
  // PERSONAL é erro do outro lado — o primeiro dos dois bugs.
  const cnpj = empresarial ? soDigitos(opts.cnpj) : '';

  // ⚠️ O CPF É EXIGIDO SEMPRE, inclusive em PJ, onde identifica quem autoriza.
  const falta: DocsDoConsentimento['falta'] = !cpf ? 'cpf' : (empresarial && !cnpj ? 'cnpj' : null);

  return {
    cpf: cpf || undefined,
    cnpj: cnpj || undefined,
    falta,
    empresarial,
  };
}

/** A frase que a tela mostra quando falta documento. */
export function textoDoQueFalta(falta: DocsDoConsentimento['falta'], empresarial: boolean): string {
  if (falta === 'cpf') {
    return empresarial
      ? 'Informe também o CPF de quem responde pela empresa no banco — é essa pessoa que autoriza o acesso.'
      : 'Informe seu CPF pra continuar.';
  }
  if (falta === 'cnpj') return 'Informe o CNPJ da empresa — este banco exige os dois documentos.';
  return '';
}
