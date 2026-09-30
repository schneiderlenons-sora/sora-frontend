// =============================================================================
// Casamento das MARCAS PERSONALIZADAS (logo de loja que o usuário sobe).
//
// Relato de cliente (26/09/2026): subiu a logo do "SEM PARAR", a marca ficou
// gravada, as 71 transações têm `observacao` exatamente "SEM PARAR" — e a logo
// não aparecia. ⚠️ O CASAMENTO NUNCA FOI O PROBLEMA: quem errava era a decisão
// ANTERIOR a ele, nas telas (ver `useTemMarca` no MarcasCustomContext).
//
// Vive aqui, fora do contexto React, porque é regra pura e testável — dentro
// do `.tsx` só daria pra verificar por cópia no eval, e cópia que diverge é o
// defeito que este projeto mais paga caro.
// =============================================================================

export type MarcaCustom = { id: string; termo: string; logo_url: string };

/** Mesma normalização do IconeMarca: minúsculas, sem acento, símbolo vira espaço. */
export function normalizarMarca(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * `trecho` aparece como palavra inteira dentro de `texto`.
 *
 * ⚠️ Palavra INTEIRA, não "contém": sem isso um termo curto como "gol" casaria
 * dentro de "google" e a loja do usuário roubaria o ícone de outra coisa.
 */
export function palavraInteiraMarca(texto: string, trecho: string): boolean {
  const escaped = trecho.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(texto);
}

/**
 * Índice das marcas, do termo mais LONGO pro mais curto.
 *
 * ⚠️ A ordem importa: com "posto" e "posto shell" cadastrados, o mais
 * específico tem de ganhar, senão toda transação de "posto shell" pegaria a
 * logo genérica de "posto".
 */
export function indexarMarcas(marcas: MarcaCustom[]) {
  return (marcas || [])
    .map((m) => ({ logo: m.logo_url, norm: normalizarMarca(m.termo) }))
    // Termo de 1 caractere casaria em quase tudo.
    .filter((m) => m.norm.length >= 2)
    .sort((a, b) => b.norm.length - a.norm.length);
}

// =============================================================================
// O RENAME DA REGRA APAGAVA A MARCA.
//
// Relato de cliente (José Roberto, 27/09/2026): "ao solicitar que o App mude a
// descrição do lançamento quando encontra uma determinada string, embora a
// descrição se torne perfeita, a associação da logo personalizada deixa de
// funcionar. Recebo um lançamento com a string 'UnisuperUniao', peço pra
// associar com uma logo e mudar a descrição pra 'Supermercado União'. O App
// muda a descrição e, com isso, a associação da logo deixa de funcionar."
//
// Ele está certo, e a mecânica é direta: a regra faz
// `linha.observacao = regra.renomear_para` (regrasCategoria.js) — ou seja,
// SOBRESCREVE. O texto que a marca conhecia deixa de existir na linha, e o
// casamento acima, que só olha a descrição, não tem mais como achar nada.
//
// ⚠️ MEDIDO ANTES DE ESCOLHER O REMÉDIO. Na base inteira: 35 regras com
// rename, em 7 grupos, e **apenas 2 colisões** — as duas dele
// ("sem parar" → "Crédito para TAG" e "unisuperuniao" → "Supermercado União").
// Nas outras 24 regras dele o nome novo CONTÉM o termo da marca ("baptistella"
// → "Auto Posto Baptistella"), e por isso a logo sempre sobreviveu. Quebra só
// quando o nome novo não guarda nenhum traço do original.
//
// A saída não é guardar a descrição antiga numa coluna nova: a regra JÁ é a
// ponte entre os dois textos. "unisuperuniao → Supermercado União" diz que os
// dois nomes são o mesmo estabelecimento — basta ler essa ponte ao contrário.
//
// ⚠️ A VOLTA É POR IGUALDADE EXATA, nunca por "contém". O gatilho é a descrição
// ser exatamente o que a regra escreveu (ela ATRIBUI o valor, então bate no
// caractere). Afrouxar aqui deixaria um rename curto arrastar logo pra
// transação que só por acaso tem aquelas palavras.
// =============================================================================

export type RegraRenome = { termo: string; renomear_para?: string | null };

/**
 * Índice inverso: o nome que a regra ESCREVE → os termos que o produziram.
 *
 * ⚠️ É uma lista, não um termo só: duas regras podem renomear pro mesmo nome
 * (na conta do relato, "cozinha chic atibaia" e "oasis" viram ambos
 * "Restaurante Oasis"). Guardar só a última perderia a logo de uma delas.
 */
export function indexarRenomes(regras: RegraRenome[]): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  for (const r of regras || []) {
    const destino = normalizarMarca(r?.renomear_para || '');
    const origem = normalizarMarca(r?.termo || '');
    if (!destino || !origem) continue;
    // Regra que renomeia pro próprio termo não acrescenta nada e só faria
    // trabalho repetido no passo 1.
    if (destino === origem) continue;
    const atual = mapa.get(destino);
    if (atual) { if (!atual.includes(origem)) atual.push(origem); }
    else mapa.set(destino, [origem]);
  }
  return mapa;
}

/**
 * A logo da marca personalizada que casa com este texto, ou `null`.
 *
 * `renomes` (opcional) é o índice de `indexarRenomes`: com ele, uma descrição
 * que a regra reescreveu ainda encontra a logo pelo texto original.
 */
export function acharLogo(
  idx: ReturnType<typeof indexarMarcas>,
  nome: string,
  renomes?: Map<string, string[]> | null,
): string | null {
  const key = normalizarMarca(nome);
  if (!key) return null;
  // Igualdade exata primeiro — é o caso mais comum e o mais seguro.
  for (const m of idx) if (m.norm === key) return m.logo;
  for (const m of idx) if (palavraInteiraMarca(key, m.norm)) return m.logo;

  // ⚠️ SÓ DEPOIS DE ESGOTAR A DESCRIÇÃO ATUAL. Se o texto que está na tela já
  // casa com alguma marca, é ela que vale — o desvio pelo nome antigo não pode
  // passar na frente do que o usuário está vendo.
  const origens = renomes?.get(key);
  if (origens) {
    for (const origem of origens) {
      for (const m of idx) if (m.norm === origem) return m.logo;
      for (const m of idx) if (palavraInteiraMarca(origem, m.norm)) return m.logo;
    }
  }
  return null;
}
