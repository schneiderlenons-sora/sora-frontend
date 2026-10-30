'use client';

// =============================================================================
// Regras aprendidas do caixa da empresa (o "aprende", migration 192).
//
// Nascem quando a pessoa classifica um lançamento que veio do banco com
// "classificar assim os próximos parecidos". Aqui ela VÊ o que a Sora aprendeu,
// troca a categoria ou apaga. Sem esta tela, a única saída pra uma regra errada
// era reclassificar um lançamento e torcer.
//
// ⚠️ Apagar NÃO desfaz o que a regra já classificou — só para os próximos.
// Trocar a categoria acerta o que ainda está "a classificar", nunca a escolha
// que a pessoa fez à mão. As duas coisas são ditas na tela.
// =============================================================================

import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { X, Sparkles, Trash2, Pencil, Check, Loader2, AlertCircle, ArrowUpRight, ArrowDownRight, ArrowLeftRight } from 'lucide-react';
import { api, type RegraNegocio } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmar } from '@/contexts/ConfirmContext';
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA, labelCategoria, type TipoLancamento } from '@/lib/lancamentos';

const semInscricao = () => () => {};

/** Categorias oferecidas pra uma regra: as do sentido dela (ou as dos dois). */
function opcoesDe(tipo: RegraNegocio['tipo']) {
  if (tipo === 'entrada') return CATEGORIAS_ENTRADA;
  if (tipo === 'saida') return CATEGORIAS_SAIDA;
  const vistas = new Set<string>();
  return [...CATEGORIAS_ENTRADA, ...CATEGORIAS_SAIDA].filter((c) => (vistas.has(c.v) ? false : (vistas.add(c.v), true)));
}

const rotuloCat = (r: RegraNegocio) =>
  opcoesDe(r.tipo).find((c) => c.v === r.categoria)?.label
  || labelCategoria((r.tipo || 'saida') as TipoLancamento, r.categoria);

export default function ModalRegrasNegocio({ empresaId, cor, onClose, onChanged }: {
  empresaId: string; cor: string; onClose: () => void; onChanged?: () => void;
}) {
  const { phone } = useAuth();
  const confirmar = useConfirmar();
  const montado = useSyncExternalStore(semInscricao, () => true, () => false);
  const { data, mutate, isLoading } = useSWR(
    phone ? `neg:regras:${empresaId}` : null,
    () => api.negocios.lancamentos.regras.listar(phone!, empresaId),
  );
  const regras = data?.regras || [];
  const [editando, setEditando] = useState<string | null>(null);
  const [outra, setOutra] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  async function trocar(r: RegraNegocio, categoria: string) {
    const c = categoria.trim();
    if (!c || c === r.categoria) { setEditando(null); return; }
    setOcupado(r.id); setErro(''); setAviso('');
    try {
      const res = await api.negocios.lancamentos.regras.editar(r.id, c);
      await mutate();
      setEditando(null); setOutra('');
      setAviso(res.aplicadas
        ? `Regra atualizada. ${res.aplicadas === 1 ? '1 lançamento "a classificar" foi acertado' : `${res.aplicadas} lançamentos "a classificar" foram acertados`}.`
        : 'Regra atualizada. Vale para os próximos que chegarem do banco.');
      onChanged?.();
    } catch (e) {
      setErro((e as Error)?.message || 'Não consegui trocar a categoria.');
    } finally { setOcupado(null); }
  }

  async function apagar(r: RegraNegocio) {
    const ok = await confirmar({
      titulo: `Apagar a regra "${r.termo}"?`,
      mensagem: 'Os próximos lançamentos com essa descrição voltam a chegar como "a classificar". '
        + 'O que a regra já classificou continua como está.',
      confirmar: 'Apagar regra',
    });
    if (!ok) return;
    setOcupado(r.id); setErro(''); setAviso('');
    try {
      await api.negocios.lancamentos.regras.apagar(r.id);
      await mutate();
      setAviso('Regra apagada.');
    } catch (e) {
      setErro((e as Error)?.message || 'Não consegui apagar.');
    } finally { setOcupado(null); }
  }

  if (!montado) return null;

  return createPortal((
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
         onClick={onClose}>
      <div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl border border-border/60 shadow-2xl max-h-[92dvh] flex flex-col"
           role="dialog" aria-modal="true" aria-labelledby="regras-titulo"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 id="regras-titulo" className="text-base font-bold text-foreground">Regras aprendidas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Como a Sora classifica o que chega do banco</p>
          </div>
          <button onClick={onClose} aria-label="Fechar"
                  className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto overscroll-contain">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
          ) : data?.semMigration ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              As regras ainda não estão disponíveis nesta conta. Tente de novo mais tarde.
            </p>
          ) : regras.length === 0 ? (
            <div className="text-center py-6 px-2">
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3"
                    style={{ background: `color-mix(in srgb, ${cor} 12%, transparent)` }}>
                <Sparkles size={20} style={{ color: cor }} />
              </span>
              <p className="text-sm font-semibold text-foreground">Nenhuma regra ainda</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xs mx-auto">
                Ao classificar um lançamento que veio do banco, deixe marcado
                &quot;Classificar assim os próximos parecidos&quot;. A regra aparece aqui.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {regras.map((r) => {
                const aberto = editando === r.id;
                const Icone = r.tipo === 'entrada' ? ArrowUpRight : r.tipo === 'saida' ? ArrowDownRight : ArrowLeftRight;
                const sentido = r.tipo === 'entrada' ? 'Entradas' : r.tipo === 'saida' ? 'Saídas' : 'Entradas e saídas';
                const carregandoEsta = ocupado === r.id;
                return (
                  <li key={r.id} className="rounded-2xl bg-muted/20 p-3" style={{ border: '1px solid hsl(var(--border) / 0.6)' }}>
                    <div className="flex items-start gap-3">
                      <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground"
                            aria-hidden>
                        <Icone size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground leading-snug">
                          Descrição com <strong className="break-words">&ldquo;{r.termo}&rdquo;</strong>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {sentido} · vira <strong className="text-foreground">{rotuloCat(r)}</strong>
                        </p>
                      </div>
                      <div className="flex items-center flex-shrink-0 -mr-1">
                        <button onClick={() => { setEditando(aberto ? null : r.id); setOutra(''); }} disabled={carregandoEsta}
                                aria-label={`Trocar a categoria da regra ${r.termo}`} aria-expanded={aberto}
                                className="w-11 h-11 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => apagar(r)} disabled={carregandoEsta}
                                aria-label={`Apagar a regra ${r.termo}`}
                                className="w-11 h-11 flex items-center justify-center rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
                          {carregandoEsta ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                      </div>
                    </div>

                    {aberto && (
                      <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid hsl(var(--border) / 0.6)' }}>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Nova categoria</p>
                        <div className="flex flex-wrap gap-2">
                          {opcoesDe(r.tipo).map((c) => {
                            const atual = c.v === r.categoria;
                            return (
                              <button key={c.v} onClick={() => trocar(r, c.v)} disabled={carregandoEsta || atual}
                                      aria-pressed={atual}
                                      className="min-h-[44px] px-3 rounded-xl text-xs font-semibold transition-colors disabled:cursor-default"
                                      style={{
                                        border: `1px solid ${atual ? cor : 'hsl(var(--border) / 0.6)'}`,
                                        background: atual ? `color-mix(in srgb, ${cor} 12%, transparent)` : 'transparent',
                                        color: atual ? cor : 'hsl(var(--foreground))',
                                      }}>
                                {atual && <Check size={12} className="inline mr-1 -mt-0.5" aria-hidden />}{c.label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex gap-2">
                          <input value={outra} onChange={(e) => setOutra(e.target.value)} maxLength={30}
                                 placeholder="Ou outra categoria" className="input flex-1 min-w-0"
                                 onKeyDown={(e) => { if (e.key === 'Enter') trocar(r, outra); }} />
                          <button onClick={() => trocar(r, outra)} disabled={!outra.trim() || carregandoEsta}
                                  className="px-4 min-h-[44px] rounded-xl text-white text-xs font-bold disabled:opacity-50"
                                  style={{ background: cor }}>
                            Usar
                          </button>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Acerta também o que ainda está &quot;a classificar&quot;. O que você já classificou à mão não muda.
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {aviso && (
            <p role="status" className="text-xs rounded-xl px-3 py-2 text-foreground"
               style={{ background: `color-mix(in srgb, ${cor} 10%, transparent)` }}>{aviso}</p>
          )}
          {erro && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40">
              <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">{erro}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  ), document.body);
}
