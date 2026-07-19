'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { HandHeart, Plus, Check, Trash2, Sparkles, Loader2 } from 'lucide-react';

const BRAND = 'hsl(var(--primary))';
const fmtData = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

// Lista de oração — pedidos ativos + respondidos (com celebração ao marcar).
export default function OracaoView({ phone }: { phone: string }) {
  const { data, mutate } = useApi(phone ? `biblia:oracoes:${phone}` : null, () => api.biblia.oracoes.listar(phone));
  const recarregar = useCallback(() => mutate(), [mutate]);
  const [novo, setNovo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const oracoes: any[] = data ?? [];
  const ativas = oracoes.filter(o => !o.respondida);
  const respondidas = oracoes.filter(o => o.respondida);

  async function adicionar() {
    const pedido = novo.trim();
    if (!pedido) return;
    setSalvando(true);
    try { setNovo(''); await api.biblia.oracoes.criar(pedido); await recarregar(); }
    finally { setSalvando(false); }
  }
  async function alternar(o: any) { await api.biblia.oracoes.alternar(o.id, !o.respondida); recarregar(); }
  async function remover(id: string) { await api.biblia.oracoes.remover(id); recarregar(); }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Adicionar pedido */}
      <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-4 sm:p-5" style={{ background: 'hsl(var(--bg-card) / 0.6)' }}>
        <div className="flex items-center gap-2 mb-3">
          <HandHeart size={16} style={{ color: BRAND }} />
          <p className="text-sm font-bold text-foreground">Pelo que você quer orar?</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={novo} onChange={e => setNovo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') adicionar(); }}
            placeholder="Ex.: pela saúde da minha mãe, por sabedoria no trabalho…"
            className="flex-1 h-11 rounded-xl bg-background border border-border px-3 text-sm focus:outline-none focus:border-primary"
            style={{ minHeight: 44 }}
          />
          <button onClick={adicionar} disabled={salvando || !novo.trim()}
                  className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-primary hover:opacity-90 text-white text-sm font-bold shadow-lg shadow-primary/25 disabled:opacity-50 active:scale-[0.98] transition-all"
                  style={{ minHeight: 44 }}>
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Adicionar
          </button>
        </div>
      </div>

      {/* Ativas */}
      {ativas.length > 0 ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 px-1">Orando por ({ativas.length})</p>
          <ul className="space-y-2.5">
            {ativas.map(o => (
              <li key={o.id} className="group flex items-start gap-3 rounded-2xl border border-border/40 p-4" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
                <button onClick={() => alternar(o)} title="Marcar como respondida"
                        className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full border-2 border-border hover:border-primary flex items-center justify-center transition-colors"
                        style={{ minWidth: 24 }}>
                  <Check size={13} className="text-transparent group-hover:text-primary/40" strokeWidth={3} />
                </button>
                <p className="flex-1 text-sm text-foreground leading-snug min-w-0">{o.pedido}</p>
                <button onClick={() => remover(o.id)} className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-border p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3" style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 14%, transparent)' }}>
            <HandHeart size={22} style={{ color: BRAND }} />
          </div>
          <p className="text-sm font-bold text-foreground">Nenhum pedido ainda</p>
          <p className="text-xs text-muted-foreground mt-1">Escreva acima o primeiro. Depois, marque como respondido quando Deus agir. 🙏</p>
        </div>
      )}

      {/* Respondidas */}
      {respondidas.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3 px-1 inline-flex items-center gap-1.5" style={{ color: BRAND }}>
            <Sparkles size={11} /> Respondidas ({respondidas.length})
          </p>
          <ul className="space-y-2">
            {respondidas.map(o => (
              <li key={o.id} className="group flex items-center gap-3 rounded-2xl border p-3.5" style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 6%, transparent)', borderColor: 'color-mix(in srgb, hsl(var(--primary)) 25%, transparent)' }}>
                <button onClick={() => alternar(o)} title="Voltar pra ativa"
                        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ background: BRAND, minWidth: 24 }}>
                  <Check size={13} strokeWidth={3} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground/80 leading-snug line-through decoration-1">{o.pedido}</p>
                  {o.respondida_em && <p className="text-[11px]" style={{ color: BRAND }}>respondida em {fmtData(o.respondida_em)}</p>}
                </div>
                <button onClick={() => remover(o.id)} className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
