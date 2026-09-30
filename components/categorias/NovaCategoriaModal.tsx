'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Check, Smile } from 'lucide-react';
import { api } from '@/lib/api';
import { primeiroEmoji } from '@/lib/emoji-valido';

const BRAND = 'hsl(var(--primary))';

// Paleta de 12 cores vibrantes em HSL (hue) — sempre renderizadas a
// S65%/L50% (ver `corPreview` abaixo e `getCategoriaTheme` em lib/categorias).
export const PALETA_CORES = [
  { hue: 142, label: 'Verde'    },
  { hue: 215, label: 'Azul'     },
  { hue: 270, label: 'Roxo'     },
  { hue: 320, label: 'Rosa'     },
  { hue: 0,   label: 'Vermelho' },
  { hue: 25,  label: 'Laranja'  },
  { hue: 45,  label: 'Amarelo'  },
  { hue: 195, label: 'Ciano'    },
  { hue: 160, label: 'Esmeralda'},
  { hue: 290, label: 'Magenta'  },
  { hue: 235, label: 'Índigo'   },
  { hue: 35,  label: 'Âmbar'    },
];

// Paleta SÓBRIA — pedido de cliente (26/09/2026): "na barra lateral há
// diversas opções de cores mas são muito 'gritantes'. Se puderem deixar
// algumas opções um pouco mais 'sóbrias', ficaria legal."
//
// ⚠️ POR QUE É HEX, E NÃO MAIS ENTRADAS DE `hue`: a paleta vibrante inteira
// passa pela MESMA fórmula fixa (`hsl(hue 65% 50%)`, em `corPreview` abaixo e
// em `getCategoriaTheme`/`normalizaCor` no resto do app) — é essa saturação
// de 65% cravada que o cliente achou "gritante", não o tom em si. Um hue novo
// sairia da mesma fôrma. `cor` no banco já aceita string hex além de number
// (`getCategoriaTheme` trata os dois desde a introdução de marcas
// personalizadas), então cada cor sóbria carrega a PRÓPRIA saturação/brilho
// já reduzidos — é o único jeito de essas cores serem realmente mais suaves,
// em toda tela que lê a categoria (ícone, chip, gráfico), não só aqui.
//
// Medido (script à parte): nenhuma é lida como cinza por `isHexGrayscale`
// (que descartaria a cor e cairia no hash do nome) e todas ficam entre
// ~15–29% de saturação — contra os 65% fixos das vibrantes.
export const PALETA_SOBRIAS = [
  { hex: '#5B6B85', label: 'Chumbo'    },
  { hex: '#4B5567', label: 'Grafite'   },
  { hex: '#5E7052', label: 'Musgo'     },
  { hex: '#3D6870', label: 'Petróleo'  },
  { hex: '#A5715A', label: 'Terracota' },
  { hex: '#7D4A54', label: 'Vinho'     },
  { hex: '#8C7350', label: 'Areia'     },
  { hex: '#54628C', label: 'Ardósia'   },
  { hex: '#71703F', label: 'Oliva'     },
  { hex: '#6B5240', label: 'Café'      },
];

// Emojis comuns para o picker rápido (os das categorias predefinidas vêm primeiro)
const EMOJI_COMUNS = [
  '🛒', '🚗', '🍔', '🏠', '💊', '📺', '🎬', '💰',
  '📚', '👕', '🐶', '🥖', '🛜', '✈️', '🎉', '📦',
  '💡', '🍺', '💧', '🔥', '📱', '🎮', '🎵', '⚽',
  '☕', '🍕', '🍣', '🍜', '🚇', '⛽', '🚌', '🚕',
  '🧴', '💄', '👜', '👟', '💍', '⌚', '🎁', '🌸',
  '📈', '💼', '🏦', '💳', '💸', '🪙', '📊', '🧾',
  '🧼', '🩺', '❤️‍🩹', '💵', '🔒', '👶', '🔖', '📥',
  '🏫', '💪', '🎒', '🔧', '🚿', '🛏️', '🧹', '🪥',
  // Negócios / empreendedor + casa / dona de casa (personas mais comuns)
  '🏪', '🏬', '🏭', '🚚', '👔', '🤝', '🧑‍💼', '🖥️',
  '🍳', '🥘', '🍽️', '🧽', '🧺', '🍼', '🧸', '🧻',
];

// Emojis estendidos — catálogo amplo por tema (comida, casa, saúde, trabalho,
// transporte, lazer, pets, natureza, dinheiro, símbolos).
// `new Set` remove duplicados (evita key repetida no React quando um emoji
// aparece em COMUNS e num bloco temático).
const EMOJI_EXTENDIDOS = Array.from(new Set([
  ...EMOJI_COMUNS,
  // ── Negócios / empreendedor (persona pedida) ──
  '🧑‍💼', '👩‍💼', '👨‍💼', '🏢', '🏪', '🏬', '🏭', '🏗️',
  '📈', '📉', '📊', '💹', '💼', '🧾', '🧮', '🖇️',
  '📇', '🗂️', '🗄️', '🗃️', '📋', '📝', '🖊️', '✍️',
  '📦', '🚚', '🚛', '🏷️', '🪧', '📢', '📣', '🤝',
  '💳', '🏦', '🏧', '💰', '💵', '🪙', '🧑‍🔧', '🛠️',
  '⚖️', '🖥️', '💻', '🖨️', '📠', '☎️', '🔑', '🗝️',
  // ── Casa / dona de casa (persona pedida) ──
  '🏠', '🏡', '🧹', '🧽', '🧼', '🧺', '🪣', '🧴',
  '🧻', '🪥', '🚿', '🛁', '🚽', '🛏️', '🛋️', '🪑',
  '🚪', '🪟', '🍳', '🥘', '🍲', '🍽️', '🥄', '🍴',
  '🔪', '🧊', '🧂', '🥫', '🧅', '🧄', '🥔', '🍅',
  '🥬', '🧺', '🧷', '🧵', '🪡', '🧶', '🍼', '🧸',
  '👶', '🚼', '👗', '👚', '👖', '🧦', '🪆', '🕯️',
  // Pessoas / família
  '🧒', '👨', '👩', '👪', '🧑‍🍼', '👵', '👴', '🤝',
  // Saúde / bem-estar
  '🏥', '💉', '🦷', '🧠', '🫀', '🩹', '🧘', '🏃',
  '🥗', '⚖️', '😴', '🧑‍⚕️', '👓', '🩼', '🫁', '🩸',
  // Casa / contas
  '🛋️', '🚪', '🔑', '🧺', '🧽', '🪣', '🔌', '🪫',
  '🏡', '🏢', '🪑', '🚽', '🛁', '🪟', '🧯', '📶',
  // Comida / bebida
  '🍎', '🥕', '🥦', '🥑', '🍇', '🍓', '🥝', '🍌',
  '🍞', '🧀', '🥩', '🍗', '🥚', '🥛', '🍫', '🍦',
  '🍹', '🍷', '🥤', '🧃', '🍿', '🥪', '🌮', '🍩',
  // Transporte / veículo
  '🏍️', '🚲', '🛵', '🚙', '🚐', '🛻', '⛴️', '🚆',
  '🛞', '🅿️', '🛣️', '🚦', '🧰', '🔩', '🪛', '🚨',
  // Trabalho / estudo
  '💻', '🖥️', '⌨️', '🖨️', '📐', '✏️', '📎', '🗂️',
  '📅', '📝', '📋', '🗒️', '🎓', '🔬', '🔭', '🧪',
  // Lazer / hobbies
  '🎨', '🖼️', '🎤', '🎸', '🎹', '🥁', '📷', '📹',
  '🎧', '🎲', '🃏', '🎳', '🏊', '🚴', '⛺', '🎣',
  '🏀', '🏈', '🎾', '🏐', '🥊', '⛳', '🎯', '🛹',
  // Pets / natureza
  '🐱', '🐰', '🐠', '🐦', '🐹', '🐢', '🦜', '🐾',
  '🌳', '🌲', '🌻', '🌷', '🌵', '🍀', '🌊', '☀️',
  // Viagem / lugares
  '🏖️', '⛰️', '🏞️', '🗺️', '🎢', '🎡', '🏛️', '🕍',
  '🏨', '🗽', '🧳', '🎫', '🛂', '🏕️', '🚢', '🎪',
  // Dinheiro / finanças
  '🤑', '💲', '🏧', '🪝', '📉', '🧮', '🗝️', '🎰',
  // Símbolos / geral
  '⚙️', '🔨', '🪜', '⭐', '❤️', '✅', '❗', '🔔',
  '🎂', '💐', '🕯️', '📌', '🔍', '🏷️', '♻️', '🆘',

  // ── Ampliação jul/2026 (+100 emojis, mesmos temas) ──
  // Comida / bebida
  '🍳', '🥞', '🧇', '🥓', '🌭', '🍟', '🥨', '🥯',
  '🍰', '🧁', '🍪', '🍬', '🍭', '🍮', '🍯', '🥧',
  // Casa / utilidades
  '🪞', '🧻', '🧷', '🧵', '🪡', '🕰️', '🛎️', '🗄️',
  '🪠', '🪒', '🚰', '🪤',
  // Saúde / bem-estar
  '🦴', '🫂', '🩻', '💆', '💅', '🛌', '🧖', '🤒',
  '🤧', '🚭',
  // Trabalho / estudo
  '📞', '📠', '🗃️', '🖊️', '🖌️', '🖍️', '📏', '🗓️',
  '👔', '🧑‍💻',
  // Transporte / veículo
  '🚁', '🚂', '🚄', '🛥️', '⛵', '🛺', '🚛', '🏎️',
  // Lazer / hobbies
  '🎭', '🎱', '🕹️', '🪀', '🪁', '🧩', '♟️', '🏓',
  '🏸', '🥋', '🎻', '🎺',
  // Pets / natureza
  '🐕', '🐈', '🐇', '🦋', '🐝', '🌴', '🌱', '🍁',
  '🪴', '🌙',
  // Viagem / lugares
  '⛩️', '⛪', '🏰', '🗿', '🌉', '🏙️', '🏜️', '⛲',
  // Dinheiro / finanças
  '💴', '💶', '💷', '🧧', '💱', '💹',
  // Símbolos / geral
  '⚠️', 'ℹ️', '❓', '🔆', '💠', '🏆', '🎗️', '📣',

  // ── OBRAS E REFORMAS (pedido de cliente, 26/09/2026) ──
  // O catálogo tinha ferramenta solta (🔧 🔨 🛠️) mas nada de obra: faltavam
  // tijolo, pedreiro, material, pintura e a casa em reforma.
  '🧱', '👷', '👷‍♀️', '🚧', '🪚', '🪓', '⛏️', '⚒️',
  '🪵', '🪟', '🚪', '🪜', '🪞', '🧰', '🔩', '🪛',
  '🏚️', '🏗️', '🖌️', '🎨', '🪣', '📏', '📐', '🧑‍🔧',
  '🔌', '💡', '🚰', '🧯', '🗜️', '⚙️',
]));

interface Props {
  phone: string;
  edicao?: any | null;
  parentId?: string | null;
  parentNome?: string;
  parents?: any[]; // lista de categorias raiz, p/ dropdown "É subcategoria de"
  onClose: () => void;
  onSuccess: () => void;
}

export default function NovaCategoriaModal({
  phone, edicao, parentId, parentNome, parents = [], onClose, onSuccess,
}: Props) {
  const ediMode = !!edicao;

  const parentObj = parents.find(p => p.id === (parentId ?? edicao?.parent_id));
  const tipoInicial: 'despesa' | 'receita' =
    edicao?.tipo === 'receita' ? 'receita'
    : parentObj?.tipo === 'receita' ? 'receita'
    : 'despesa';

  const [nome,     setNome]     = useState(edicao?.nome || '');
  const [tipo,     setTipo]     = useState<'despesa' | 'receita'>(tipoInicial);
  const [emoji,    setEmoji]    = useState<string>(edicao?.icone || '📦');
  // ⚠️ `number | string`: número = paleta vibrante (hue, fórmula fixa
  // S65%/L50%); string começando em `#` = paleta sóbria (hex com a própria
  // saturação/brilho). `getCategoriaTheme`/`normalizaCor` já leem os dois —
  // é o mesmo campo `cor` que marcas personalizadas usam pra cor customizada.
  const [cor,      setCor]      = useState<number | string>(edicao?.cor ?? 142);
  const [parent,   setParent]   = useState<string | null>(parentId ?? edicao?.parent_id ?? null);
  const [verMais,  setVerMais]  = useState(false);
  // Campo "ou cole outro emoji". Guardado à parte do `emoji` porque enquanto a
  // pessoa digita o texto pode ainda não ser um emoji válido — e o ícone da
  // categoria não pode acompanhar rascunho.
  const [emojiLivre, setEmojiLivre] = useState('');
  const [erroEmoji, setErroEmoji]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [erro,     setErro]     = useState('');

  const ehSubcategoria = !!parent || !!parentId;
  const corEhHex = typeof cor === 'string' && cor.trim().startsWith('#');
  // Sóbria: o hex JÁ carrega a saturação/brilho certos, usa como está.
  // Vibrante: o hue passa pela fórmula fixa de sempre.
  const corPreview = corEhHex ? (cor as string) : `hsl(${cor} 65% 50%)`;
  const corBg = corEhHex ? `${cor}26` : `hsl(${cor} 75% 50% / 0.15)`;

  async function handleSalvar() {
    setErro('');
    if (!nome.trim()) {
      setErro('Informe o nome da categoria.');
      return;
    }
    setLoading(true);
    try {
      if (ediMode) {
        await api.categorias.editar(edicao.id, {
          nome: nome.trim(),
          icone: emoji,
          cor,
          tipo,
          // ⚠️ O SELETOR "É subcategoria de" APARECE NA EDIÇÃO (logo abaixo) e
          // o payload não o enviava — a pessoa escolhia o pai, salvava, e nada
          // mudava. Foi o relato de set/2026: "eu altero mas ele não grava".
          // ⚠️ `?? null`, nunca `|| undefined`: mandar `null` é como se TIRA a
          // categoria de baixo do pai, e `undefined` some do JSON — o backend
          // usa `'parent_id' in body` pra distinguir "não mexer" de "soltar".
          parent_id: parent ?? null,
        });
      } else {
        await api.categorias.criar({
          phone,
          nome: nome.trim(),
          icone: emoji,
          cor,
          tipo,
          parent_id: parent || undefined,
        });
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar categoria.');
    } finally {
      setLoading(false);
    }
  }

  const emojis = verMais ? EMOJI_EXTENDIDOS : EMOJI_COMUNS;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border"
        onClick={e => e.stopPropagation()}
      >
        {/* Header com preview */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 transition-all"
              style={{ background: corBg, color: corPreview }}
            >
              {emoji}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground truncate">
                {ediMode ? 'Editar categoria' : ehSubcategoria ? 'Nova subcategoria' : 'Nova categoria'}
              </h2>
              {ehSubcategoria && parentNome && (
                <p className="text-xs text-muted-foreground truncate">
                  Subcategoria de <strong className="text-foreground">{parentNome}</strong>
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* Nome */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Nome da categoria *
            </label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Mercado, Aluguel, Saúde..."
              className="input"
              autoFocus
            />
          </div>

          {/* Tipo: Despesa / Receita — só em categoria raiz (subs herdam do pai) */}
          {!ehSubcategoria && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Tipo
              </label>
              <div className="relative flex bg-muted rounded-2xl p-1">
                <div
                  className="absolute top-1 bottom-1 rounded-xl transition-all duration-200"
                  style={{
                    width: 'calc(50% - 4px)',
                    left: tipo === 'despesa' ? '4px' : 'calc(50%)',
                    background: tipo === 'despesa' ? 'hsl(0 72% 58%)' : 'hsl(var(--primary))',
                  }}
                />
                {(['despesa', 'receita'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={`relative flex-1 py-2 text-sm font-semibold rounded-xl transition-colors duration-200 ${tipo === t ? 'text-white' : 'text-muted-foreground'}`}
                  >
                    {t === 'despesa' ? '💸 Despesa' : '💰 Receita'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pai (só em modo edição se já tiver parent ou explicit) */}
          {ediMode && parents.length > 0 && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                É subcategoria de
              </label>
              <select
                value={parent || ''}
                onChange={e => setParent(e.target.value || null)}
                className="input"
              >
                <option value="">Nenhuma (categoria principal)</option>
                {parents.filter(p => p.id !== edicao?.id).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.icone || '📦'} {p.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Emoji */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ícone (emoji)
              </label>
              <button
                onClick={() => setVerMais(v => !v)}
                className="text-[11px] font-semibold inline-flex items-center gap-1"
                style={{ color: BRAND }}
              >
                <Smile size={11} />
                {verMais ? 'Menos emojis' : 'Mais emojis'}
              </button>
            </div>
            <div
              className="grid gap-1.5 p-2 rounded-xl bg-muted/30 border border-border"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))' }}
            >
              {emojis.map(e => {
                const ativo = e === emoji;
                return (
                  <button
                    key={e}
                    // Escolher na grade descarta o rascunho do campo livre —
                    // senão um "casa" mal digitado deixaria o erro em vermelho
                    // embaixo de uma escolha que deu certo.
                    onClick={() => { setEmoji(e); setEmojiLivre(''); setErroEmoji(''); }}
                    className={`aspect-square rounded-lg flex items-center justify-center text-2xl transition-all ${
                      ativo
                        ? 'bg-primary/15 ring-2 ring-primary/40 scale-110'
                        : 'hover:bg-card hover:scale-105'
                    }`}
                  >
                    {e}
                  </button>
                );
              })}
            </div>

            {/* ⚠️ QUALQUER EMOJI — a outra metade do pedido ("ou colocar a
                opção de nós mesmo carregar o emoji"). Por maior que fique, a
                lista nunca cobre o tema de todo mundo; este campo cobre.
                A validação mora em `lib/emoji-valido.ts` (com eval): `icone`
                é renderizado cru em dezenas de telas, e uma palavra colada
                aqui não daria erro — entortaria todas elas em silêncio. */}
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={emojiLivre}
                onChange={e => {
                  const v = e.target.value;
                  setEmojiLivre(v);
                  const achado = primeiroEmoji(v);
                  if (achado) { setEmoji(achado); setErroEmoji(''); }
                  else if (v.trim()) setErroEmoji('Isso não parece um emoji.');
                  else setErroEmoji('');
                }}
                placeholder="Ou cole outro emoji aqui"
                aria-label="Usar outro emoji"
                // `inputMode` abre direto o teclado de emoji no celular em vez
                // do alfabético — sem isso a pessoa tem de caçar a carinha.
                inputMode="text"
                maxLength={24}
                // h-11 = 44px, o mínimo de alvo de toque. A classe `.input`
                // sozinha dá ~36px, que basta pros campos de texto ao lado mas
                // é apertado pra um campo que se usa com o polegar.
                className="input flex-1 h-11 text-sm"
              />
              {/* O que ficou salvo, do tamanho em que vai aparecer na lista —
                  é o retorno que confirma que deu certo. */}
              <div className="w-11 h-11 rounded-lg bg-muted/40 border border-border flex items-center justify-center text-2xl flex-shrink-0"
                   aria-live="polite" aria-label={`Ícone escolhido: ${emoji}`}>
                {emoji}
              </div>
            </div>
            <p className={`text-[11px] mt-1 leading-snug ${erroEmoji ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
              {erroEmoji || 'Vale qualquer emoji do teclado do seu celular ou computador.'}
            </p>
          </div>

          {/* Cor */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Cor
              </label>
              <div className="flex flex-wrap gap-2">
                {PALETA_CORES.map(({ hue: h, label }) => {
                  const ativa = h === cor;
                  return (
                    <button
                      key={h}
                      onClick={() => setCor(h)}
                      title={label}
                      aria-label={label}
                      aria-pressed={ativa}
                      className={`relative w-9 h-9 rounded-full transition-all ${
                        ativa ? 'ring-2 ring-offset-2 ring-offset-card scale-110' : 'hover:scale-110'
                      }`}
                      style={{
                        background: `hsl(${h} 65% 50%)`,
                        // @ts-ignore
                        '--tw-ring-color': `hsl(${h} 65% 50%)`,
                      } as any}
                    >
                      {ativa && <Check size={14} className="text-white absolute inset-0 m-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sóbrias — pedido de cliente (26/09/2026): mesma paleta de
                sempre, mas com opções de saturação mais baixa pra quem acha
                as vibrantes "gritantes" demais. Fileira própria, não
                misturada: são famílias visuais diferentes, e misturar as duas
                deixaria a escolha mais difícil de escanear. */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Sóbrias
              </label>
              <div className="flex flex-wrap gap-2">
                {PALETA_SOBRIAS.map(({ hex, label }) => {
                  const ativa = cor === hex;
                  return (
                    <button
                      key={hex}
                      onClick={() => setCor(hex)}
                      title={label}
                      aria-label={label}
                      aria-pressed={ativa}
                      className={`relative w-9 h-9 rounded-full transition-all ${
                        ativa ? 'ring-2 ring-offset-2 ring-offset-card scale-110' : 'hover:scale-110'
                      }`}
                      style={{
                        background: hex,
                        // @ts-ignore
                        '--tw-ring-color': hex,
                      } as any}
                    >
                      {ativa && <Check size={14} className="text-white absolute inset-0 m-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Erro */}
          {erro && (
            <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{erro}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button
            onClick={handleSalvar}
            disabled={loading}
            className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {ediMode ? 'Salvar alterações' : 'Criar categoria'}
          </button>
        </div>
      </div>
    </div>
  );
}
