'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  Plus, Target, Loader2, Check, Flame, Trash2, X, Sparkles, Pencil,
} from 'lucide-react';

const BRAND = '#7c3aed';

const ICONES = ['🎯','💧','🏃','📚','🧘','💪','🍎','😴','✍️','🌅','🥗','💊','🚭','🧠','🎨','💼'];
const CORES  = ['#7c3aed','#ec4899','#f59e0b','#10b981','#06b6d4','#3b82f6','#ef4444','#84cc16'];

function calcStreak(habitoId: string, registros: any[]) {
  const regs = registros
    .filter(r => r.habito_id === habitoId && r.concluido)
    .map(r => r.data)
    .sort()
    .reverse();
  if (!regs.length) return 0;
  let streak = 0;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  for (let i = 0; i < regs.length; i++) {
    const d = new Date(regs[i] + 'T12:00:00');
    const esperado = new Date(hoje); esperado.setDate(esperado.getDate() - i);
    if (d.toDateString() === esperado.toDateString()) streak++;
    else break;
  }
  return streak;
}

export default function HabitosPage() {
  const { phone } = useAuth();
  const [habitos, setHabitos]     = useState<any[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando]   = useState<any | null>(null);

  const carregar = useCallback(async () => {
    if (!phone) return;
    setLoading(true);
    try {
      const r = await api.grow.habitos.listar(phone);
      setHabitos(r.habitos || []);
      setRegistros(r.registros || []);
    } finally { setLoading(false); }
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  const hoje = new Date().toISOString().slice(0, 10);
  const concluidosHoje = new Set(registros.filter(r => r.data === hoje && r.concluido).map(r => r.habito_id));

  async function toggleHabito(h: any) {
    if (!phone) return;
    const feito = concluidosHoje.has(h.id);
    setRegistros(prev => {
      const semHoje = prev.filter(r => !(r.habito_id === h.id && r.data === hoje));
      return feito ? semHoje : [...semHoje, { habito_id: h.id, data: hoje, concluido: true }];
    });
    try { await api.grow.habitos.toggle(h.id, { phone }); } catch (e: any) { alert(e.message); carregar(); }
  }

  async function deletar(h: any) {
    if (!phone) return;
    if (!confirm(`Excluir "${h.nome}"?`)) return;
    try {
      await api.grow.habitos.deletar(h.id, phone);
      carregar();
    } catch (e: any) { alert(e.message); }
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-border/60 animate-fade-in"
           style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}>
        <div className="absolute inset-0 pointer-events-none opacity-50"
             style={{ background: 'radial-gradient(ellipse at top right, rgba(124,58,237,0.12) 0%, transparent 60%)' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-950/40 mb-3">
              <Sparkles size={12} style={{ color: BRAND }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: BRAND }}>Hábitos</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">Hábitos</h1>
            <p className="text-muted-foreground text-sm mt-2 max-w-md">
              Pequenas consistências que constroem grandes mudanças.
            </p>
          </div>
          <button
            onClick={() => { setEditando(null); setModalOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shadow-lg shadow-violet-600/30 transition-all"
          >
            <Plus size={16} /> Novo hábito
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card rounded-3xl p-12 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-violet-600" />
        </div>
      ) : habitos.length === 0 ? (
        <div className="card rounded-3xl py-16 flex flex-col items-center text-center px-6 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
               style={{ background: `${BRAND}22` }}>
            <Target size={26} style={{ color: BRAND }} />
          </div>
          <p className="text-base font-bold text-foreground">Comece seu primeiro hábito</p>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
            Beber água, ler 10 páginas, treinar, meditar — qualquer coisa simples e diária.
          </p>
          <button
            onClick={() => { setEditando(null); setModalOpen(true); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 mt-5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700"
          >
            <Plus size={14} /> Criar hábito
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in" style={{ animationDelay: '60ms' }}>
            {habitos.map(h => {
              const feito = concluidosHoje.has(h.id);
              const streak = calcStreak(h.id, registros);
              return (
                <div key={h.id} className="card-hover rounded-2xl p-5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1" style={{ background: h.cor || BRAND }} />
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => toggleHabito(h)}
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all flex-shrink-0 ${
                        feito ? 'scale-110 shadow-lg' : 'hover:scale-105'
                      }`}
                      style={{
                        background: feito ? h.cor || BRAND : `${h.cor || BRAND}18`,
                        boxShadow: feito ? `0 8px 20px -6px ${h.cor || BRAND}` : 'none',
                      }}
                    >
                      {feito ? <Check size={22} className="text-white" strokeWidth={3} /> : <span className="text-2xl">{h.icone}</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-base font-bold ${feito ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {h.nome}
                        </p>
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditando(h); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-muted">
                            <Pencil size={12} className="text-muted-foreground" />
                          </button>
                          <button onClick={() => deletar(h)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40">
                            <Trash2 size={12} className="text-red-500" />
                          </button>
                        </div>
                      </div>
                      {h.descricao && <p className="text-xs text-muted-foreground mt-1 truncate">{h.descricao}</p>}
                      {streak > 0 && (
                        <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                             style={{ background: `${h.cor || BRAND}22`, color: h.cor || BRAND }}>
                          <Flame size={10} /> {streak} dia{streak > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                  <Heatmap habitoId={h.id} registros={registros} cor={h.cor || BRAND} />
                </div>
              );
            })}
          </div>
        </>
      )}

      {modalOpen && phone && (
        <ModalHabito
          phone={phone}
          habito={editando}
          onClose={() => { setModalOpen(false); setEditando(null); }}
          onSuccess={() => { carregar(); setModalOpen(false); setEditando(null); }}
        />
      )}
    </div>
  );
}

// ─── HEATMAP de 30 dias ──────────────────────────────────────────
function Heatmap({ habitoId, registros, cor }: { habitoId: string; registros: any[]; cor: string }) {
  const dias = useMemo(() => {
    const arr: { data: string; feito: boolean }[] = [];
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const set = new Set(registros.filter(r => r.habito_id === habitoId && r.concluido).map(r => r.data));
    for (let i = 29; i >= 0; i--) {
      const d = new Date(hoje); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      arr.push({ data: iso, feito: set.has(iso) });
    }
    return arr;
  }, [habitoId, registros]);

  return (
    <div className="mt-4 pt-4 border-t border-border/40">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Últimos 30 dias</p>
      <div className="flex gap-1 flex-wrap">
        {dias.map((d, i) => (
          <div
            key={i}
            title={`${d.data}: ${d.feito ? '✓' : '—'}`}
            className="w-4 h-4 rounded-sm transition-all"
            style={{
              background: d.feito ? cor : 'hsl(var(--muted))',
              opacity: d.feito ? 1 : 0.3,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── MODAL CRIAR/EDITAR ──────────────────────────────────────────
function ModalHabito({ phone, habito, onClose, onSuccess }: any) {
  const ed = !!habito;
  const [nome, setNome] = useState(habito?.nome || '');
  const [icone, setIcone] = useState(habito?.icone || '🎯');
  const [cor, setCor] = useState(habito?.cor || BRAND);
  const [descricao, setDescricao] = useState(habito?.descricao || '');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar() {
    setErro('');
    if (!nome.trim()) { setErro('Nome obrigatório.'); return; }
    setLoading(true);
    try {
      if (ed) await api.grow.habitos.editar(habito.id, { nome: nome.trim(), icone, cor, descricao });
      else await api.grow.habitos.criar({ phone, nome: nome.trim(), icone, cor, descricao });
      onSuccess();
    } catch (e: any) { setErro(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">{ed ? 'Editar hábito' : 'Novo hábito'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Beber 2L de água" className="input" autoFocus />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Ícone</label>
            <div className="grid grid-cols-8 gap-2">
              {ICONES.map(i => (
                <button key={i} type="button" onClick={() => setIcone(i)}
                  className={`w-10 h-10 rounded-xl text-xl transition-all ${icone === i ? 'bg-violet-100 dark:bg-violet-950/40 scale-110 ring-2 ring-violet-500' : 'bg-muted/40 hover:bg-muted'}`}>
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {CORES.map(c => (
                <button key={c} type="button" onClick={() => setCor(c)}
                  className={`w-9 h-9 rounded-xl transition-all ${cor === c ? 'scale-110 ring-2 ring-offset-2 ring-offset-card' : 'hover:scale-105'}`}
                  style={{ background: c, ['--tw-ring-color' as any]: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Descrição <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span></label>
            <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Por que esse hábito importa pra você?" className="input" maxLength={120} />
          </div>
          {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={loading || !nome.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {ed ? 'Salvar' : 'Criar hábito'}
          </button>
        </div>
      </div>
    </div>
  );
}
