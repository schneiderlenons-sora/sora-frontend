'use client';

// =============================================================================
// Centros de custo da empresa (migration 105).
//
// Responde "qual PARTE do negócio consumiu isto". Sem ele, o dono vê
// "gastei 4.000 em fornecedor" e não sabe quanto foi da loja e quanto foi do
// online — que é exatamente a decisão que ele precisa tomar.
//
// Excluir ARQUIVA (o backend faz `ativo=false`): lançamento antigo continua
// apontando pro centro e o relatório do mês passado não muda de valor.
// =============================================================================

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Loader2, Layers, AlertCircle, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { CORES_EMPRESA } from '@/lib/empresas';
import type { CentroCusto } from '@/lib/lancamentos';

// Sugestões: a maioria dos negócios se divide assim, e ter um ponto de partida
// evita a tela em branco (que é onde o recurso morre).
const SUGESTOES = ['Loja física', 'Loja online', 'Marketing', 'Produção', 'Administrativo'];

export default function ModalCentrosCusto({
  empresaId, cor, onClose, onChanged,
}: {
  empresaId: string; cor: string; onClose: () => void; onChanged?: () => void;
}) {
  const { phone } = useAuth();
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState('');
  const [corNova, setCorNova] = useState(CORES_EMPRESA[1]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // `fixed` dentro de card com backdrop-blur fica preso no card — portal sempre.
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);

  async function carregar() {
    if (!phone) return;
    try { setCentros((await api.negocios.centrosCusto.listar(phone, empresaId)) || []); }
    catch { setCentros([]); }
    finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); /* eslint-disable-line */ }, [phone, empresaId]);

  async function criar(nomeAlvo?: string) {
    const n = (nomeAlvo ?? nome).trim();
    if (!n || salvando) return;
    setErro(''); setSalvando(true);
    try {
      await api.negocios.centrosCusto.criar({ empresa_id: empresaId, nome: n, cor: corNova });
      setNome('');
      await carregar();
      onChanged?.();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui criar.');
    } finally { setSalvando(false); }
  }

  async function arquivar(c: CentroCusto) {
    if (!confirm(`Arquivar "${c.nome}"?\n\nOs lançamentos antigos continuam com ele — só some das próximas escolhas.`)) return;
    setCentros(prev => prev.filter(x => x.id !== c.id));   // otimista
    try { await api.negocios.centrosCusto.arquivar(c.id); onChanged?.(); }
    catch { carregar(); }
  }

  const faltando = SUGESTOES.filter(s => !centros.some(c => c.nome.toLowerCase() === s.toLowerCase()));

  if (!montado) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
         onClick={onClose}>
      <div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl border border-border/60 shadow-2xl max-h-[92vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground">Centros de custo</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Qual parte do negócio gastou</p>
          </div>
          <button onClick={onClose} aria-label="Fechar"
                  className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {erro && (
            <p className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 rounded-xl p-3">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /> {erro}
            </p>
          )}

          {/* Criar */}
          <div>
            <label htmlFor="cc-nome" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Novo centro
            </label>
            <div className="flex gap-2">
              <input id="cc-nome" value={nome} onChange={e => setNome(e.target.value)}
                     onKeyDown={e => { if (e.key === 'Enter') criar(); }}
                     placeholder="Ex.: Loja física" className="input flex-1" style={{ minHeight: 44 }} />
              <button onClick={() => criar()} disabled={!nome.trim() || salvando}
                      aria-label="Criar centro de custo"
                      className="w-11 rounded-xl flex items-center justify-center text-white disabled:opacity-40 flex-shrink-0"
                      style={{ background: cor, minHeight: 44 }}>
                {salvando ? <Loader2 size={17} className="animate-spin" /> : <Plus size={18} />}
              </button>
            </div>

            {/* Cor: identifica o centro nos relatórios de relance */}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {CORES_EMPRESA.map(c => (
                <button key={c} onClick={() => setCorNova(c)} aria-label={`Cor ${c}`}
                        className="w-7 h-7 rounded-lg transition-transform active:scale-90 flex items-center justify-center"
                        style={{ background: c, outline: corNova === c ? '2px solid hsl(var(--foreground))' : 'none', outlineOffset: 2 }}>
                  {corNova === c && <Check size={13} className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Sugestões — evita a tela em branco */}
          {!carregando && faltando.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                Sugestões
              </p>
              <div className="flex flex-wrap gap-1.5">
                {faltando.map(s => (
                  <button key={s} onClick={() => criar(s)} disabled={salvando}
                          className="h-10 px-3 rounded-xl text-xs font-semibold border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors inline-flex items-center gap-1.5"
                          style={{ minHeight: 40 }}>
                    <Plus size={12} /> {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lista */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
              Seus centros {centros.length > 0 && <span className="font-normal">({centros.length})</span>}
            </p>
            {carregando ? (
              <div className="space-y-2 animate-pulse">
                {[0, 1].map(i => <div key={i} className="h-14 rounded-2xl bg-muted" />)}
              </div>
            ) : centros.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum ainda. Crie acima ou use uma sugestão.
              </p>
            ) : (
              <ul className="space-y-2">
                {centros.map(c => (
                  <li key={c.id} className="flex items-center gap-3 p-3 rounded-2xl border border-border">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `color-mix(in srgb, ${c.cor || cor} 15%, transparent)` }}>
                      <Layers size={16} style={{ color: c.cor || cor }} />
                    </span>
                    <span className="flex-1 min-w-0 text-sm font-semibold text-foreground truncate">{c.nome}</span>
                    <button onClick={() => arquivar(c)} aria-label={`Arquivar ${c.nome}`}
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors flex-shrink-0"
                            style={{ minWidth: 40, minHeight: 40 }}>
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
