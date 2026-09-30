// =============================================================================
// ISTO QUE O USUÁRIO COLOU É UM EMOJI?
//
// POR QUE EXISTE (26/09/2026). Pedido de cliente (Sebastião): "poderiam por
// favor acrescentar emojis com relação a obras e reformas, ou colocar a opção
// de nós mesmo carregar o emoji".
//
// A segunda metade é a que resolve para sempre: por mais que a lista cresça,
// ela nunca vai cobrir o tema de todo mundo. Mas um campo de texto livre no
// lugar do ícone aceita QUALQUER coisa — "casa", "123", um parágrafo colado
// sem querer — e o `icone` da categoria é renderizado cru em dezenas de
// telas (lista, dashboard, gráficos, extrato, WhatsApp). Uma palavra ali não
// dá erro: ela simplesmente ENTORTA todas essas telas, e a pessoa descobre
// depois, sem entender de onde veio.
//
// ⚠️ A VALIDAÇÃO É POR REGEX, NÃO POR `Intl.Segmenter`. O Segmenter conta
// grafemas com precisão, mas não existe em todo navegador que abre a Sora
// (Firefox só a partir do 125) — e um `undefined` aqui deixaria passar
// qualquer texto justamente nos navegadores mais antigos. O regex abaixo é
// determinístico e roda em qualquer lugar.
// =============================================================================

/**
 * Uma sequência de emoji COMPLETA e só ela.
 *
 * Começa obrigatoriamente com um pictográfico (`\p{Extended_Pictographic}`) e
 * depois só aceita o que faz parte do MESMO emoji: seletor de variação
 * (`️`), tom de pele (`\p{Emoji_Modifier}`) e junções ZWJ com outro
 * pictográfico ou com um símbolo de gênero.
 *
 * ⚠️ É isso que impede "🙂🙂": o segundo pictográfico não vem depois de um
 * ZWJ, então a cadeia não fecha. E "casa" nem começa.
 */
const RE_EMOJI =
  /^\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier}|‍(?:\p{Extended_Pictographic}|[♀♂])️?)*$/u;

/** Bandeiras são dois indicadores regionais — não são pictográficos. */
const RE_BANDEIRA = /^[\u{1F1E6}-\u{1F1FF}]{2}$/u;

/** Teclas (1️⃣ #️⃣): começam com dígito, então também ficam fora do regex principal. */
const RE_TECLA = /^[0-9#*]️?⃣$/;

/**
 * ⚠️ TETO DE TAMANHO. Uma família com quatro pessoas
 * ("👨‍👩‍👧‍👦") já gasta 11 unidades; nada legítimo passa muito disso. O limite
 * existe porque texto colado por engano pode vir com milhares de caracteres, e
 * rodar regex neles à toa é trabalho jogado fora.
 */
const MAX_UNIDADES = 24;

/** `true` se o texto é exatamente UM emoji. */
export function ehEmoji(texto: string): boolean {
  const s = (texto || '').trim();
  if (!s || s.length > MAX_UNIDADES) return false;
  return RE_EMOJI.test(s) || RE_BANDEIRA.test(s) || RE_TECLA.test(s);
}

/**
 * O que salvar a partir do que a pessoa digitou, ou `null` se não serve.
 *
 * ⚠️ Se veio texto com MAIS de um emoji, fica com o PRIMEIRO em vez de
 * recusar. Colar "🧱🔨" é engano comum (a pessoa escolhe dois e não decide),
 * e aproveitar o primeiro é mais gentil do que devolver erro — o campo mostra
 * o que ficou, então ela vê na hora.
 */
export function primeiroEmoji(texto: string): string | null {
  const s = (texto || '').trim();
  if (!s || s.length > MAX_UNIDADES) return null;
  if (ehEmoji(s)) return s;

  // Tenta consumir só o começo: a mesma gramática, sem a âncora do fim.
  const inicio = new RegExp(RE_EMOJI.source.replace(/\$$/, ''), 'u').exec(s);
  if (inicio?.[0]) return inicio[0];
  const bandeira = /^[\u{1F1E6}-\u{1F1FF}]{2}/u.exec(s);
  if (bandeira?.[0]) return bandeira[0];
  return null;
}
