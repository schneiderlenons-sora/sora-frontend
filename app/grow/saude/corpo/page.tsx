'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import ModalMedida from '@/components/saude/ModalMedida';
import {
  Ruler, Sparkles, Loader2, Plus, Image as ImageIcon, TrendingDown, TrendingUp, Minus,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const COR_CORPO = '#a78bfa';
const COR_GORD  = '#f59e0b';
const COR_MUSC  = '#10b981';

const CAMPOS = [
  { k: 'cintura_cm',  l: 'Cintura',   un: 'cm', cor: '#7c3aed' },
  { k: 'quadril_cm',  l: 'Quadril',   un: 'cm', cor: '#a78bfa' },
  { k: 'peito_cm',    l: 'Peito',     un: 'cm', cor: '#6366f1' },
  { k: 'braco_cm',    l: 'Braço',     un: 'cm', cor: '#3b82f6' },
  { k: 'perna_cm',    l: 'Perna',     un: 'cm', cor: '#06b6d4' },
  { k: 'pescoco_cm',  l: 'Pescoço',   un: 'cm', cor: '#0ea5e9' },
];

const fmtData = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

export default function CorpoPage() {
  const { phone } = useAuth();
  const [medidas, setMedidas]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [campoSel, setCampoSel] = useState('cintura_cm');

  const carregar = useCallback(async () => {
    if (!phone) return;
    try {
      const m = await api.saude.medidas.listar(phone);
      setMedidas(m || []);
    } catch (e) { console.warn('[corpo]', e); }
    finally { setLoading(false); }
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  // Ordena por data (mais recente primeiro)
  const ordenadas = useMemo(() => [...medidas].sort((a, b) => b.data.localeCompare(a.data)), [medidas]);
  const ultima    = ordenadas[0];
  const anterior  = ordenadas[1];

  // RCQ — Relação cintura/quadril
  const rcq = useMemo(() => {
    if (!ultima?.cintura_cm || !ultima?.quadril_cm) return null;
    return (parseFloat(ultima.cintura_cm) / parseFloat(ultima.quadril_cm)).toFixed(2);
  }, [ultima]);

  // Gráfico de evolução do campo selecionado
  const graficoEvo = useMemo(() => {
    return [...medidas]
      .filter(m => m[campoSel] != null)
      .sort((a, b) => a.data.localeCompare(b.data))
      .map(m => ({ dia: fmtData(m.data), valor: parseFloat(m[campoSel]) }));
  }, [medidas, campoSel]);

  const ultimoComCampo = graficoEvo[graficoEvo.length - 1];
  const primeiroComCampo = graficoEvo[0];
  const tendencia = useMemo(() => {
    if (!ultimoComCampo || !primeiroComCampo || ultimoComCampo === primeiroComCampo) return null;
    const delta = ultimoComCampo.valor - primeiroComCampo.valor;
    if (Math.abs(delta) < 0.1) return { icon: Minus, label: 'estável', cor: '#94a3b8' };
    return delta < 0
      ? { icon: TrendingDown, label: `${delta.toFixed(1)} cm`, cor: '#22c55e' }
      : { icon: TrendingUp,   label: `+${delta.toFixed(1)} cm`, cor: '#f59e0b' };
  }, [ultimoComCampo, primeiroComCampo]);

  if (loading) {
    return (
      <div className="card rounded-3xl p-16 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-5">

      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-border/40 backdrop-blur-xl p-6 sm:p-8 animate-fade-in"
           style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card) / 0.7) 0%, hsl(var(--bg-subtle) / 0.5) 100%)' }}>
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: `radial-gradient(ellipse at top right, ${COR_CORPO}24 0%, transparent 55%)` }} />
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-3" style={{ background: `${COR_CORPO}1A` }}>
              <Sparkles size={11} style={{ color: COR_CORPO }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: COR_CORPO }}>Corpo</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">Medidas & Composição</h1>
            <p className="text-muted-foreground text-sm mt-2 max-w-md">
              Cintura, quadril, braço, % gordura, % músculo e RCQ. Evolução no tempo.
            </p>
          </div>
          <button onClick={() => setModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shadow-lg shadow-violet-600/30">
            <Plus size={14} /> Nova medição
          </button>
        </div>
      </div>

      {medidas.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-violet-300 dark:border-violet-800 p-10 sm:p-12 bg-violet-50/30 dark:bg-violet-950/10 animate-fade-in text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-violet-100 dark:bg-violet-900/40">
            <Ruler size={28} className="text-violet-600 dark:text-violet-400" />
          </div>
          <p className="text-base font-bold text-foreground">Sem medidas registradas</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
            Comece registrando cintura, quadril e braço. Conforme você for medindo,
            a Sora calcula evolução automaticamente.
          </p>
          <button onClick={() => setModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 mt-5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700">
            <Plus size={13} /> Primeira medição
          </button>
        </div>
      ) : (
        <>
          {/* MEDIDAS ATUAIS — Grid de cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 animate-fade-in" style={{ animationDelay: '60ms' }}>
            {CAMPOS.map(({ k, l, un, cor }) => {
              const atual = ultima?.[k];
              const anterior_v = anterior?.[k];
              const delta = atual != null && anterior_v != null ? parseFloat(atual) - parseFloat(anterior_v) : null;
              return (
                <button key={k} onClick={() => setCampoSel(k)}
                  className={`text-left rounded-2xl border backdrop-blur-xl p-4 transition-all hover:scale-[1.015] ${
                    campoSel === k ? 'border-violet-500 ring-1 ring-violet-500/50' : 'border-border/40 hover:border-violet-300 dark:hover:border-violet-800'
                  }`}
                  style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{l}</p>
                  <p className="text-2xl font-bold tabular tracking-tight mt-1.5" style={{ color: cor }}>
                    {atual != null ? <>{atual}<span className="text-xs text-muted-foreground font-medium ml-0.5">{un}</span></> : '—'}
                  </p>
                  {delta != null && Math.abs(delta) >= 0.1 && (
                    <p className={`text-[10px] tabular mt-0.5 ${delta < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {delta < 0 ? '↓' : '↑'} {Math.abs(delta).toFixed(1)} {un}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* BIOIMPEDÂNCIA + RCQ */}
          {(ultima?.gordura_pct || ultima?.musculo_pct || rcq) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in" style={{ animationDelay: '120ms' }}>
              {ultima?.gordura_pct && (
                <BioCard label="% Gordura corporal" value={ultima.gordura_pct} unit="%" cor={COR_GORD} />
              )}
              {ultima?.musculo_pct && (
                <BioCard label="% Massa muscular" value={ultima.musculo_pct} unit="%" cor={COR_MUSC} />
              )}
              {rcq && (
                <BioCard label="Relação cintura/quadril" value={rcq} unit="" cor="#ec4899" hint={parseFloat(rcq) < 0.85 ? 'Faixa saudável' : 'Acima do recomendado'} />
              )}
            </div>
          )}

          {/* GRÁFICO DE EVOLUÇÃO */}
          <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
               style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '180ms' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Evolução</p>
                <p className="text-base font-bold text-foreground">{CAMPOS.find(c => c.k === campoSel)?.l || campoSel}</p>
              </div>
              {tendencia && (
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                     style={{ background: `${tendencia.cor}1A`, color: tendencia.cor }}>
                  <tendencia.icon size={10} />
                  {tendencia.label}
                </div>
              )}
            </div>

            {graficoEvo.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">
                Sem dados desta medida ainda.
              </div>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={graficoEvo} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={36} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                             formatter={(v: any) => [`${v} cm`, CAMPOS.find(c => c.k === campoSel)?.l]} />
                    <Line type="monotone" dataKey="valor" stroke={CAMPOS.find(c => c.k === campoSel)?.cor || COR_CORPO} strokeWidth={2.5} dot={{ fill: CAMPOS.find(c => c.k === campoSel)?.cor || COR_CORPO, r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* HISTÓRICO COMPLETO */}
          <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
               style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '240ms' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Histórico de medições</p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {ordenadas.slice(0, 20).map(m => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-violet-100 dark:bg-violet-950/40">
                    <Ruler size={14} className="text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">{fmtData(m.data)}</p>
                    <p className="text-[11px] text-muted-foreground tabular flex-wrap mt-0.5 flex gap-2.5">
                      {CAMPOS.filter(c => m[c.k] != null).map(c => (
                        <span key={c.k}><strong className="text-foreground">{m[c.k]}{c.un}</strong> {c.l.toLowerCase()}</span>
                      ))}
                    </p>
                    {m.observacao && <p className="text-[11px] text-muted-foreground italic mt-0.5 truncate">"{m.observacao}"</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* FOTOS DE PROGRESSO (placeholder) */}
      <div className="rounded-3xl border border-dashed border-border/60 p-6 sm:p-8 animate-fade-in bg-muted/10"
           style={{ animationDelay: '300ms' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">Em construção</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-violet-100 dark:bg-violet-950/40">
            <ImageIcon size={22} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Fotos de progresso</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-lg">
              Em breve: upload mensal de fotos (frente / lado / costas), galeria com swipe antes/depois e linha do tempo cinematográfica. Privacidade total — visíveis só por você.
            </p>
          </div>
        </div>
      </div>

      {modalOpen && phone && (
        <ModalMedida phone={phone} inicial={ultima} onClose={() => setModalOpen(false)} onSuccess={() => { carregar(); setModalOpen(false); }} />
      )}
    </div>
  );
}

function BioCard({ label, value, unit, cor, hint }: any) {
  return (
    <div className="rounded-2xl border border-border/40 backdrop-blur-xl p-5 relative overflow-hidden"
         style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="absolute inset-0 pointer-events-none opacity-40"
           style={{ background: `radial-gradient(circle at top right, ${cor}24 0%, transparent 70%)` }} />
      <div className="relative">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold tabular tracking-tight mt-1.5" style={{ color: cor }}>
          {value}<span className="text-base text-muted-foreground font-medium ml-1">{unit}</span>
        </p>
        {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
      </div>
    </div>
  );
}
