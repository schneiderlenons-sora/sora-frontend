'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Check, Smile } from 'lucide-react';
import { api } from '@/lib/api';

const BRAND = '#61D17B';

// Paleta de 12 cores vibrantes em HSL (hue)
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

// Emojis comuns para o picker rápido
const EMOJI_COMUNS = [
  '🛒', '🚗', '🍔', '🏠', '💊', '📺', '🎬', '💰',
  '📚', '👕', '🐶', '🥖', '🛜', '✈️', '🎉', '📦',
  '💡', '🍺', '💧', '🔥', '📱', '🎮', '🎵', '⚽',
  '☕', '🍕', '🍣', '🍜', '🚇', '⛽', '🚌', '🚕',
  '🧴', '💄', '👜', '👟', '💍', '⌚', '🎁', '🌸',
  '📈', '💼', '🏦', '💳', '💸', '🪙', '📊', '🧾',
];

// Emojis estendidos
const EMOJI_EXTENDIDOS = [
  ...EMOJI_COMUNS,
  '🎨', '🖼️', '🎤', '🎸', '🎹', '🥁', '📷', '📹',
  '🏥', '🩺', '💉', '🦷', '👶', '🧒', '👨', '👩',
  '🐱', '🐰', '🐠', '🐦', '🌳', '🌲', '🌻', '🌷',
  '🍎', '🥕', '🥦', '🥑', '🍇', '🍓', '🥝', '🍌',
  '🏖️', '⛰️', '🏞️', '🗺️', '🎢', '🎡', '🏛️', '🕍',
  '⚙️', '🔧', '🔨', '🪛', '🧰', '🪜', '🔌', '🪫',
];

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

  const [nome,     setNome]     = useState(edicao?.nome || '');
  const [emoji,    setEmoji]    = useState<string>(edicao?.icone || '📦');
  const [hue,      setHue]      = useState<number>(edicao?.cor ?? 142);
  const [parent,   setParent]   = useState<string | null>(parentId ?? edicao?.parent_id ?? null);
  const [verMais,  setVerMais]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [erro,     setErro]     = useState('');

  const ehSubcategoria = !!parent || !!parentId;
  const corPreview = `hsl(${hue} 65% 50%)`;
  const corBg = `hsl(${hue} 75% 50% / 0.15)`;

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
          cor: hue,
        });
      } else {
        await api.categorias.criar({
          phone,
          nome: nome.trim(),
          icone: emoji,
          cor: hue,
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
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))' }}
            >
              {emojis.map(e => {
                const ativo = e === emoji;
                return (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    className={`aspect-square rounded-lg flex items-center justify-center text-lg transition-all ${
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
          </div>

          {/* Cor */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Cor
            </label>
            <div className="flex flex-wrap gap-2">
              {PALETA_CORES.map(({ hue: h, label }) => {
                const ativa = h === hue;
                return (
                  <button
                    key={h}
                    onClick={() => setHue(h)}
                    title={label}
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
