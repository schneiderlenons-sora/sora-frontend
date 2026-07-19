'use client';

import { useState, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { Brain, Plus, Trash2, Eye, Check, X as XIcon, Loader2, Sparkles } from 'lucide-react';

const BRAND = 'hsl(var(--primary))';
const hojeISO = () => new Date().toISOString().slice(0, 10);
// Rótulo do nível (0..6) → maturidade da memorização.
const NIVEL_LABEL = ['Nova', 'Aprendendo', 'Aprendendo', 'Firmando', 'Firmando', 'Quase de cor', 'Memorizada'];

export default function MemorizarView({ phone }: { phone: string }) {
  const { data, mutate } = useApi(phone ? `biblia:memo:${phone}` : null, () => api.biblia.memo.listar(phone));
  const recarregar = useCallback(() => mutate(), [mutate]);
  const [addOpen, setAddOpen] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const versos: any[] = data?.versos ?? [];
  const paraRevisar = useMemo(() => versos.filter(v => v.proxima_revisao <= hojeISO()), [versos]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Cabeçalho + revisar */}
      <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4"
           style={{ background: 'hsl(var(--bg-card) / 0.6)' }}>
        <div className="flex items-center gap-3 flex-1">
          <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 14%, transparent)' }}>
            <Brain size={20} style={{ color: BRAND }} />
          </span>
          <div>
            <p className="text-sm font-bold text-foreground">Memorização</p>
            <p className="text-xs text-muted-foreground">
              {versos.length === 0 ? 'Guarde versículos no coração.'
                : paraRevisar.length > 0 ? <><strong className="text-foreground">{paraRevisar.length}</strong> pra revisar hoje.</>
                : 'Tudo em dia por hoje. ✨'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {paraRevisar.length > 0 && (
            <button onClick={() => setRevisando(true)}
                    className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-primary hover:opacity-90 text-white text-sm font-bold shadow-lg shadow-primary/25 active:scale-[0.98]" style={{ minHeight: 44 }}>
              <Sparkles size={15} /> Revisar ({paraRevisar.length})
            </button>
          )}
          <button onClick={() => setAddOpen(true)}
                  className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-muted/40" style={{ minHeight: 44 }}>
            <Plus size={15} /> Novo
          </button>
        </div>
      </div>

      {/* Lista */}
      {versos.length > 0 ? (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {versos.map(v => {
            const revisarHoje = v.proxima_revisao <= hojeISO();
            return (
              <li key={v.id} className="group rounded-2xl border border-border/40 p-4" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-foreground">{v.referencia}</p>
                  <button onClick={async () => { await api.biblia.memo.remover(v.id); recarregar(); }}
                          className="flex-shrink-0 p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
                {v.texto && <p className="text-xs text-muted-foreground mt-1 leading-snug line-clamp-2 italic">"{v.texto}"</p>}
                <div className="flex items-center gap-2 mt-2.5">
                  <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-bold"
                        style={{ background: `color-mix(in srgb, hsl(var(--primary)) ${8 + v.nivel * 6}%, transparent)`, color: BRAND }}>
                    {NIVEL_LABEL[v.nivel] || 'Nova'}
                  </span>
                  {revisarHoje && <span className="text-[10px] font-semibold" style={{ color: '#f59e0b' }}>• revisar hoje</span>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-3xl border border-dashed border-border p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3" style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 14%, transparent)' }}>
            <Brain size={22} style={{ color: BRAND }} />
          </div>
          <p className="text-sm font-bold text-foreground">Nenhum versículo pra memorizar</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">Adicione um versículo e a Sora te lembra de revisar nos intervalos certos (1, 3, 7… dias).</p>
        </div>
      )}

      {addOpen && <AddSheet salvando={salvando} onFechar={() => setAddOpen(false)}
        onSalvar={async (referencia, texto) => { setSalvando(true); try { await api.biblia.memo.criar({ referencia, texto }); await recarregar(); setAddOpen(false); } finally { setSalvando(false); } }} />}

      {revisando && <RevisarSheet versos={paraRevisar} onFechar={() => { setRevisando(false); recarregar(); }}
        onRevisar={(id, acertou) => api.biblia.memo.revisar(id, acertou)} />}
    </div>
  );
}

// ── Adicionar versículo ──────────────────────────────────────────────────────
function AddSheet({ salvando, onFechar, onSalvar }: { salvando: boolean; onFechar: () => void; onSalvar: (referencia: string, texto: string) => void }) {
  const [ref, setRef] = useState('');
  const [texto, setTexto] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onFechar}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl border-t sm:border border-border shadow-2xl p-5 sm:p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-foreground">Novo versículo</p>
          <button onClick={onFechar} className="p-2 rounded-xl hover:bg-muted"><XIcon size={18} /></button>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Referência</label>
          <input value={ref} onChange={e => setRef(e.target.value)} autoFocus placeholder="Ex.: Filipenses 4:13"
                 className="w-full h-11 rounded-xl bg-background border border-border px-3 text-sm focus:outline-none focus:border-primary" style={{ minHeight: 44 }} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Texto (opcional — pra revisar de cor)</label>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={3} placeholder="Cole o versículo aqui…"
                    className="w-full rounded-xl bg-background border border-border p-3 text-sm resize-none focus:outline-none focus:border-primary" />
        </div>
        <button onClick={() => ref.trim() && onSalvar(ref.trim(), texto.trim())} disabled={salvando || !ref.trim()}
                className="w-full h-12 rounded-xl bg-primary hover:opacity-90 text-white text-sm font-bold shadow-lg shadow-primary/25 inline-flex items-center justify-center gap-2 disabled:opacity-50" style={{ minHeight: 44 }}>
          {salvando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Adicionar
        </button>
      </div>
    </div>
  );
}

// ── Modo revisão (um por vez: revela → acertei/errei) ────────────────────────
function RevisarSheet({ versos, onFechar, onRevisar }: { versos: any[]; onFechar: () => void; onRevisar: (id: string, acertou: boolean) => Promise<any> }) {
  const [i, setI] = useState(0);
  const [revelado, setRevelado] = useState(false);
  const [indo, setIndo] = useState(false);
  const v = versos[i];

  async function responder(acertou: boolean) {
    if (!v) return;
    setIndo(true);
    try { await onRevisar(v.id, acertou); } finally { setIndo(false); }
    if (i + 1 < versos.length) { setI(i + 1); setRevelado(false); }
    else onFechar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-card rounded-3xl border border-border shadow-2xl p-6 space-y-5 text-center" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{i + 1} de {versos.length}</p>
          <button onClick={onFechar} className="p-1.5 rounded-lg hover:bg-muted"><XIcon size={16} /></button>
        </div>

        <p className="text-2xl font-bold text-foreground tracking-tight pt-2">{v?.referencia}</p>

        {revelado ? (
          <p className="text-base text-foreground leading-relaxed min-h-[60px]">{v?.texto ? `"${v.texto}"` : <span className="text-muted-foreground text-sm">(sem texto salvo — recite de memória)</span>}</p>
        ) : (
          <button onClick={() => setRevelado(true)} className="w-full h-14 rounded-2xl border-2 border-dashed border-border text-sm font-bold text-muted-foreground hover:border-primary hover:text-foreground inline-flex items-center justify-center gap-2 transition-colors">
            <Eye size={16} /> Tente recitar, depois toque pra revelar
          </button>
        )}

        {revelado && (
          <div className="flex gap-2 pt-1">
            <button onClick={() => responder(false)} disabled={indo}
                    className="flex-1 h-12 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-muted/40 inline-flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ minHeight: 44 }}>
              <XIcon size={15} /> Errei
            </button>
            <button onClick={() => responder(true)} disabled={indo}
                    className="flex-1 h-12 rounded-xl bg-primary hover:opacity-90 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ minHeight: 44 }}>
              {indo ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={3} />} Acertei
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
