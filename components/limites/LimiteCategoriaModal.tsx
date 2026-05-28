'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { X, Loader2, AlertCircle, Check, Target, Bell, Info, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import { getCategoriaTheme } from '@/lib/categorias';

const BRAND = '#61D17B';

interface Categoria {
  id:         string;
  nome:       string;
  icone?:     string;
  cor?:       any;
  parent_id?: string | null;
}

interface Props {
  phone:           string;
  mesRef:          string;
  categorias:      Categoria[];
  categoriaAlvo?:  string | null;  // nome — usado em modo edição (trava o select)
  limiteExistente?: any | null;     // category_limit row
  onClose:   () => void;
  onSuccess: () => void;
}

export default function LimiteCategoriaModal({
  phone, mesRef, categorias, categoriaAlvo, limiteExistente,
  onClose, onSuccess,
}: Props) {
  const ediMode = !!limiteExistente;

  const [categoriaNome, setCategoriaNome] = useState<string>(
    categoriaAlvo || limiteExistente?.categoria || ''
  );
  const [valorRaw, setValorRaw] = useState(
    limiteExistente?.limite_mensal
      ? String(Math.round(limiteExistente.limite_mensal * 100))
      : ''
  );
  const [alerta, setAlerta] = useState(true);
  const [pct,    setPct]    = useState(limiteExistente?.percentual_alerta ?? 80);
  const [loading, setLoading] = useState(false);
  const [erro,    setErro]    = useState('');
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!dropOpen) return;
    function onDoc(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [dropOpen]);

  // Agrupa categorias: pais com seus filhos
  const arvore = useMemo(() => {
    const pais = categorias.filter(c => !c.parent_id);
    return pais.map(p => ({
      pai: p,
      filhos: categorias.filter(c => c.parent_id === p.id),
    }));
  }, [categorias]);

  const valorFmt = (() => {
    if (!valorRaw) return '0,00';
    return (parseInt(valorRaw, 10) / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  })();

  const valorBruto = parseInt(valorRaw || '0', 10) / 100;
  const valorAlerta = valorBruto * (pct / 100);

  const categoriaInfo = useMemo(() => {
    return categorias.find(c => c.nome === categoriaNome);
  }, [categorias, categoriaNome]);

  async function handleSalvar() {
    setErro('');
    if (!categoriaNome) { setErro('Selecione uma categoria.'); return; }
    if (!valorRaw || valorRaw === '0') { setErro('Informe o valor do limite.'); return; }
    setLoading(true);
    try {
      await api.limites.setCategoria({
        phone,
        categoria: categoriaNome,
        limite_mensal: parseInt(valorRaw, 10) / 100,
        percentual_alerta: alerta ? pct : 0,
        ativo: true,
        mes_referencia: mesRef,
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar limite.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            {categoriaInfo ? (
              (() => {
                const t = getCategoriaTheme(categoriaInfo.nome);
                return (
                  <CategoriaIcon
                    nome={categoriaInfo.nome}
                    icone={categoriaInfo.icone}
                    bg={t.bg}
                    color={t.color}
                    size={44}
                    rounded="rounded-xl"
                  />
                );
              })()
            ) : (
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${BRAND}22` }}
              >
                <Target size={18} style={{ color: BRAND }} />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground leading-tight">
                {ediMode ? 'Editar limite' : 'Novo limite por categoria'}
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {ediMode && categoriaNome
                  ? <>Limite para <strong className="text-foreground">{categoriaNome}</strong></>
                  : 'Defina um teto específico por categoria.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors flex-shrink-0">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Select categoria — dropdown custom com ícones oficiais */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Categoria *
            </label>
            <div ref={dropRef} className="relative">
              <button
                type="button"
                onClick={() => !ediMode && !categoriaAlvo && setDropOpen(v => !v)}
                disabled={ediMode || !!categoriaAlvo}
                className="input cursor-pointer flex items-center gap-2.5 text-left disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {categoriaInfo ? (
                  <>
                    {(() => {
                      const t = getCategoriaTheme(categoriaInfo.nome);
                      return (
                        <CategoriaIcon
                          nome={categoriaInfo.nome}
                          icone={categoriaInfo.icone}
                          bg={t.bg}
                          color={t.color}
                          size={28}
                          rounded="rounded-lg"
                        />
                      );
                    })()}
                    <span className="flex-1 truncate text-sm font-medium text-foreground">{categoriaInfo.nome}</span>
                  </>
                ) : (
                  <span className="flex-1 text-sm text-muted-foreground">Selecione uma categoria...</span>
                )}
                {!ediMode && !categoriaAlvo && (
                  <ChevronDown size={16} className={`text-muted-foreground transition-transform ${dropOpen ? 'rotate-180' : ''}`} />
                )}
              </button>

              {dropOpen && (
                <div className="absolute z-30 top-full mt-1.5 left-0 right-0 max-h-80 overflow-y-auto rounded-2xl bg-card shadow-2xl border border-border animate-fade-in">
                  {arvore.map(({ pai, filhos }) => {
                    const tPai = getCategoriaTheme(pai.nome);
                    return (
                      <div key={pai.id} className="border-b border-border/40 last:border-b-0">
                        <button
                          type="button"
                          onClick={() => { setCategoriaNome(pai.nome); setDropOpen(false); }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors ${
                            categoriaNome === pai.nome ? 'bg-primary/10' : ''
                          }`}
                        >
                          <CategoriaIcon
                            nome={pai.nome}
                            icone={pai.icone}
                            bg={tPai.bg}
                            color={tPai.color}
                            size={28}
                            rounded="rounded-lg"
                          />
                          <span className="flex-1 text-sm font-semibold text-foreground truncate">{pai.nome}</span>
                        </button>
                        {filhos.map(f => {
                          const tF = getCategoriaTheme(f.nome);
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => { setCategoriaNome(f.nome); setDropOpen(false); }}
                              className={`w-full flex items-center gap-2.5 pl-9 pr-3 py-1.5 text-left hover:bg-muted/40 transition-colors ${
                                categoriaNome === f.nome ? 'bg-primary/10' : ''
                              }`}
                            >
                              <CategoriaIcon
                                nome={f.nome}
                                icone={f.icone}
                                bg={tF.bg}
                                color={tF.color}
                                size={22}
                                rounded="rounded-md"
                              />
                              <span className="flex-1 text-xs text-foreground truncate">{f.nome}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {ediMode && (
              <p className="text-[11px] text-muted-foreground mt-1.5">
                A categoria não pode ser alterada. Para mudá-la, exclua e crie um novo limite.
              </p>
            )}
          </div>

          {/* Valor */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Limite mensal *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
              <input
                type="text"
                inputMode="numeric"
                value={valorFmt}
                onChange={e => setValorRaw(e.target.value.replace(/\D/g, ''))}
                className="input pl-10 tabular text-right text-lg font-bold"
              />
            </div>
          </div>

          {/* Alerta toggle */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
                <Bell size={14} /> Alerta no WhatsApp
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Receba aviso ao atingir o percentual definido.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAlerta(v => !v)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                alerta ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5 ${
                alerta ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Slider */}
          {alerta && (
            <div className="rounded-xl p-3 bg-muted/30 border border-border/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground">Avisar ao atingir</span>
                <span className="text-sm font-bold tabular" style={{ color: BRAND }}>{pct}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                step={5}
                value={pct}
                onChange={e => setPct(parseInt(e.target.value, 10))}
                className="w-full accent-primary"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 tabular">
                <span>50%</span><span>75%</span><span>100%</span>
              </div>
              {valorBruto > 0 && (
                <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                  📱 Aviso ao atingir{' '}
                  <strong className="text-foreground tabular">
                    {valorAlerta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </strong>.
                </p>
              )}
            </div>
          )}

          {/* Info */}
          <div className="rounded-xl p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 flex items-start gap-2.5">
            <Info size={14} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
              Limites por categoria são <strong>independentes do limite geral</strong>. Você pode ultrapassar o limite geral mesmo respeitando os por categoria, e vice-versa.
            </p>
          </div>

          {erro && (
            <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{erro}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button
            onClick={handleSalvar}
            disabled={loading}
            className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {ediMode ? 'Salvar alterações' : 'Criar limite'}
          </button>
        </div>
      </div>
    </div>
  );
}
